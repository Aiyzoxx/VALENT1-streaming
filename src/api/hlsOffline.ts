/**
 * hlsOffline — Fige un flux HLS en fichiers locaux lisibles hors-ligne.
 *
 * Principe : télécharge la variante choisie (segments .ts + clés AES-128 +
 * init-map éventuel) puis réécrit une playlist locale `index.m3u8` avec des
 * chemins relatifs. Le player lit ensuite ce fichier local (contentType hls).
 *
 * Limites V1 : pas de DRM (Widevine/FairPlay/SAMPLE-AES refusés), pas de
 * live (pas de EXT-X-ENDLIST), téléchargement au premier plan uniquement.
 */

import { Directory, File } from 'expo-file-system';

export type OfflineQuality = 'eco' | 'hd' | 'source';

export const OFFLINE_QUALITY_LABEL: Record<OfflineQuality, string> = {
  eco: 'Éco · 720p max',
  hd: 'HD · 1080p max',
  source: 'Source · qualité max',
};

const QUALITY_MAX_HEIGHT: Record<OfflineQuality, number> = {
  eco: 720,
  hd: 1080,
  source: Number.MAX_SAFE_INTEGER,
};

const SEGMENT_CONCURRENCY = 4;

interface Variant {
  bandwidth: number;
  width: number;
  height: number;
  codecs: string;
  audioGroup: string | null;
  subtitleGroup: string | null;
  uri: string;
}

interface MediaGroup {
  type: string;
  groupId: string;
  language: string;
  name: string;
  isDefault: boolean;
  uri: string;
  rawLine: string;
}

interface Segment {
  uri: string;
  duration: number;
  keyUri: string | null;
  keyIv: string | null;
  mapUri: string | null;
}

export interface OfflineProgress {
  segmentsDone: number;
  segmentsTotal: number;
  bytesDownloaded: number;
}

export interface OfflineResult {
  /** file:// URI de la playlist locale à donner au player */
  localUri: string;
  bytesTotal: number;
  segments: number;
  qualityLabel: string;
}

function resolveUrl(uri: string, base: string): string {
  try {
    return new URL(uri, base).toString();
  } catch {
    return uri;
  }
}

async function fetchText(url: string, signal?: AbortSignal): Promise<string> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

function parseAttributes(line: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const body = line.slice(line.indexOf(':') + 1);
  const re = /([A-Z0-9-]+)=("[^"]*"|[^,]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    attrs[m[1]] = m[2].replace(/^"|"$/g, '');
  }
  return attrs;
}

/** Parse une master playlist. Retourne [] si c'est déjà une media playlist. */
export function parseMaster(text: string, baseUrl: string): Variant[] {
  const lines = text.split(/\r?\n/);
  const variants: Variant[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('#EXT-X-STREAM-INF')) continue;
    const attrs = parseAttributes(line);
    const uriLine = (lines[i + 1] || '').trim();
    if (!uriLine || uriLine.startsWith('#')) continue;
    const res = (attrs.RESOLUTION || '').split('x').map(Number);
    variants.push({
      bandwidth: Number(attrs.BANDWIDTH || 0),
      width: res[0] || 0,
      height: res[1] || 0,
      codecs: attrs.CODECS || '',
      audioGroup: attrs.AUDIO || null,
      subtitleGroup: attrs.SUBTITLES || null,
      uri: resolveUrl(uriLine, baseUrl),
    });
  }
  return variants;
}

/** Parse les lignes EXT-X-MEDIA (audio / sous-titres externes). */
export function parseMediaGroups(text: string, baseUrl: string): MediaGroup[] {
  const groups: MediaGroup[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line.startsWith('#EXT-X-MEDIA')) continue;
    const attrs = parseAttributes(line);
    if (!attrs.URI) continue;
    groups.push({
      type: (attrs.TYPE || '').toUpperCase(),
      groupId: attrs['GROUP-ID'] || '',
      language: attrs.LANGUAGE || '',
      name: attrs.NAME || '',
      isDefault: (attrs.DEFAULT || 'NO').toUpperCase() === 'YES',
      uri: resolveUrl(attrs.URI, baseUrl),
      rawLine: line,
    });
  }
  return groups;
}

export function selectVariant(variants: Variant[], quality: OfflineQuality): Variant {
  const maxH = QUALITY_MAX_HEIGHT[quality];
  const sorted = [...variants].sort((a, b) => {
    const ha = a.height || Number.MAX_SAFE_INTEGER;
    const hb = b.height || Number.MAX_SAFE_INTEGER;
    return ha - hb || a.bandwidth - b.bandwidth;
  });
  // Plus haute variante qui respecte le plafond, sinon la plus basse dispo.
  let picked = sorted[0];
  for (const v of sorted) {
    const h = v.height || 0;
    if (h === 0 || h <= maxH) picked = v;
    else break;
  }
  return picked;
}

export function variantLabel(v: Variant): string {
  if (v.height >= 2160) return '4K';
  if (v.height >= 1080) return '1080p';
  if (v.height >= 720) return '720p';
  if (v.height > 0) return `${v.height}p`;
  if (v.bandwidth > 0) return `${Math.round(v.bandwidth / 1000)} kb/s`;
  return 'Source';
}

/** Parse une media playlist (segments + clés + init-map). */
export function parseMedia(text: string, baseUrl: string): { segments: Segment[]; targetDuration: number; version: number } {
  const lines = text.split(/\r?\n/);
  const segments: Segment[] = [];
  let targetDuration = 6;
  let version = 3;
  let curKey: string | null = null;
  let curIv: string | null = null;
  let curMap: string | null = null;
  let pendingDuration = 0;

  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith('#EXT-X-VERSION')) {
      version = Number(line.split(':')[1]) || 3;
    } else if (line.startsWith('#EXT-X-TARGETDURATION')) {
      targetDuration = Number(line.split(':')[1]) || 6;
    } else if (line.startsWith('#EXT-X-KEY')) {
      const attrs = parseAttributes(line);
      const method = (attrs.METHOD || 'NONE').toUpperCase();
      if (method !== 'NONE' && method !== 'AES-128') {
        throw new Error(`Chiffrement non supporté hors-ligne (${method})`);
      }
      curKey = method === 'AES-128' && attrs.URI ? resolveUrl(attrs.URI, baseUrl) : null;
      curIv = attrs.IV ?? null;
    } else if (line.startsWith('#EXT-X-MAP')) {
      const attrs = parseAttributes(line);
      curMap = attrs.URI ? resolveUrl(attrs.URI, baseUrl) : null;
    } else if (line.startsWith('#EXTINF')) {
      pendingDuration = Number(line.split(':')[1]?.split(',')[0]) || 0;
    } else if (line && !line.startsWith('#')) {
      segments.push({
        uri: resolveUrl(line, baseUrl),
        duration: pendingDuration,
        keyUri: curKey,
        keyIv: curIv,
        mapUri: curMap,
      });
      pendingDuration = 0;
    }
  }
  return { segments, targetDuration, version };
}

async function downloadBytes(url: string, signal?: AbortSignal): Promise<Uint8Array> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

/**
 * Télécharge un flux HLS complet dans `dir` et écrit un master local `index.m3u8`
 * qui référence les renditions locales (vidéo + audio + sous-titres).
 */
export async function downloadHlsOffline(
  masterUrl: string,
  quality: OfflineQuality,
  dir: Directory,
  opts: {
    signal?: AbortSignal;
    onProgress?: (p: OfflineProgress) => void;
  } = {}
): Promise<OfflineResult> {
  const { signal, onProgress } = opts;
  dir.create({ intermediates: true, idempotent: true });

  const throwIfAborted = () => {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  };

  // Progression agrégée sur toutes les renditions.
  let totalSeg = 0;
  let doneSeg = 0;
  let bytes = 0;
  const totals = new Map<string, number>();
  const report = () => onProgress?.({ segmentsDone: doneSeg, segmentsTotal: totalSeg, bytesDownloaded: bytes });

  // 1. Master -> variante + groupes media
  const masterText = await fetchText(masterUrl, signal);
  const variants = parseMaster(masterText, masterUrl);
  const picked = variants.length > 0 ? selectVariant(variants, quality) : null;
  const videoUrl = picked ? picked.uri : masterUrl;
  const groups = parseMediaGroups(masterText, masterUrl);

  const audios = groups.filter(g => g.type === 'AUDIO' && (!picked?.audioGroup || g.groupId === picked.audioGroup));
  const subs = groups.filter(g => g.type === 'SUBTITLES' && (!picked?.subtitleGroup || g.groupId === picked.subtitleGroup));
  // Audio : la piste par défaut (souvent VF), sinon la première — 1 seule pour limiter le poids.
  const audioPick = audios.find(g => g.isDefault) ?? audios[0] ?? null;

  // 2. Télécharge vidéo (+ audio + sous-titres), compte les segments pour la progression.
  const jobs: { url: string; prefix: string }[] = [{ url: videoUrl, prefix: 'v' }];
  if (audioPick) jobs.push({ url: audioPick.uri, prefix: 'a' });
  subs.forEach((s, i) => jobs.push({ url: s.uri, prefix: `s${i}` }));

  // Pré-compte les segments de chaque rendition (1 fetch léger par playlist).
  const renditions: { job: { url: string; prefix: string }; mediaText: string }[] = [];
  for (const job of jobs) {
    throwIfAborted();
    const mediaText = await fetchText(job.url, signal);
    const { segments } = parseMedia(mediaText, job.url);
    if (segments.length === 0) {
      if (job.prefix === 'v') throw new Error('Playlist vide ou illisible');
      continue; // rendition secondaire illisible : on l'ignore, la vidéo reste jouable.
    }
    if (!mediaText.includes('#EXT-X-ENDLIST') && segments.length < 3) {
      if (job.prefix === 'v') throw new Error('Flux live non supporté hors-ligne');
      continue;
    }
    totals.set(job.prefix, segments.length);
    totalSeg += segments.length;
    renditions.push({ job, mediaText });
  }
  report();

  const results = new Map<string, string>();
  for (const { job, mediaText } of renditions) {
    throwIfAborted();
    results.set(job.prefix, await downloadRendition(dir, job.url, job.prefix, mediaText, {
      signal,
      onSegment: segBytes => {
        doneSeg += 1;
        bytes += segBytes;
        report();
      },
      onBytes: b => {
        bytes += b;
      },
    }));
  }

  // 3. Master local : reprend les lignes EXT-X-MEDIA téléchargées + 1 variante.
  let master = '#EXTM3U\n#EXT-X-VERSION:6\n';
  if (audioPick && results.has('a')) {
    master += rewriteMediaUri(audioPick.rawLine, 'a.m3u8') + '\n';
  }
  subs.forEach((s, i) => {
    if (results.has(`s${i}`)) master += rewriteMediaUri(s.rawLine, `s${i}.m3u8`) + '\n';
  });
  const streamAttrs = [
    `BANDWIDTH=${picked?.bandwidth || 800000}`,
    ...(picked && picked.width && picked.height ? [`RESOLUTION=${picked.width}x${picked.height}`] : []),
    ...(picked?.codecs ? [`CODECS="${picked.codecs}"`] : []),
    ...(audioPick && results.has('a') ? [`AUDIO="${audioPick.groupId}"`] : []),
    ...(subs.length > 0 && results.has('s0') ? [`SUBTITLES="${subs[0].groupId}"`] : []),
  ].join(',');
  master += `#EXT-X-STREAM-INF:${streamAttrs}\nv.m3u8\n`;
  const playlistFile = new File(dir, 'index.m3u8');
  playlistFile.write(master);

  const qualityLabel = picked ? variantLabel(picked) : OFFLINE_QUALITY_LABEL[quality];
  return { localUri: playlistFile.uri, bytesTotal: bytes, segments: totalSeg, qualityLabel };
}

/** Réécrit l'URI d'une ligne EXT-X-MEDIA vers le fichier local. */
function rewriteMediaUri(rawLine: string, localName: string): string {
  return rawLine.replace(/URI="[^"]*"/, `URI="${localName}"`);
}

/** Extension du fichier distant (.ts, .m4s, .vtt, .mp4...), défaut .ts. */
function remoteExt(url: string): string {
  const m = url.split('?')[0].match(/\.([a-z0-9]{2,4})$/i);
  return m ? m[1].toLowerCase() : 'ts';
}

/**
 * Télécharge une rendition (media playlist) : clés, init-maps, segments,
 * puis écrit `<prefix>.m3u8` local. Les fichiers existants sont sautés (reprise).
 */
async function downloadRendition(
  dir: Directory,
  mediaUrl: string,
  prefix: string,
  mediaText: string,
  opts: {
    signal?: AbortSignal;
    onSegment: (segBytes: number) => void;
    onBytes: (b: number) => void;
  }
): Promise<string> {
  const { signal, onSegment, onBytes } = opts;
  const throwIfAborted = () => {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  };
  const { segments, targetDuration, version } = parseMedia(mediaText, mediaUrl);

  // Clés AES-128 + init-maps (dédupliqués, préfixés par rendition).
  const keyUris = [...new Set(segments.map(s => s.keyUri).filter((u): u is string => !!u))];
  const mapUris = [...new Set(segments.map(s => s.mapUri).filter((u): u is string => !!u))];
  const keyFiles = new Map<string, string>();
  const mapFiles = new Map<string, string>();
  for (let i = 0; i < keyUris.length; i++) {
    throwIfAborted();
    const name = `${prefix}_key_${i}.key`;
    const file = new File(dir, name);
    if (!file.exists || file.size === 0) {
      const data = await downloadBytes(keyUris[i], signal);
      file.write(data);
      onBytes(data.byteLength);
    } else {
      onBytes(file.size);
    }
    keyFiles.set(keyUris[i], name);
  }
  for (let i = 0; i < mapUris.length; i++) {
    throwIfAborted();
    const ext = remoteExt(mapUris[i]);
    const name = `${prefix}_init_${i}.${ext}`;
    const file = new File(dir, name);
    if (!file.exists || file.size === 0) {
      const data = await downloadBytes(mapUris[i], signal);
      file.write(data);
      onBytes(data.byteLength);
    } else {
      onBytes(file.size);
    }
    mapFiles.set(mapUris[i], name);
  }

  // Segments (pool de workers, reprise : fichiers existants sautés).
  let cursor = 0;
  const worker = async () => {
    while (true) {
      const i = cursor++;
      if (i >= segments.length) return;
      throwIfAborted();
      const name = `${prefix}_seg_${String(i).padStart(5, '0')}.${remoteExt(segments[i].uri)}`;
      const file = new File(dir, name);
      if (file.exists && file.size > 0) {
        onSegment(file.size);
      } else {
        const data = await downloadBytes(segments[i].uri, signal);
        file.write(data);
        onSegment(data.byteLength);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(SEGMENT_CONCURRENCY, segments.length) }, worker));

  // Playlist locale réécrite (chemins relatifs).
  let out = `#EXTM3U\n#EXT-X-VERSION:${Math.max(version, 4)}\n`;
  out += `#EXT-X-TARGETDURATION:${targetDuration}\n#EXT-X-MEDIA-SEQUENCE:0\n#EXT-X-PLAYLIST-TYPE:VOD\n`;
  let lastKey = '';
  let lastMap = '';
  segments.forEach((s, i) => {
    const keyName = s.keyUri ? keyFiles.get(s.keyUri) ?? '' : '';
    const mapName = s.mapUri ? mapFiles.get(s.mapUri) ?? '' : '';
    if (mapName && mapName !== lastMap) {
      out += `#EXT-X-MAP:URI="${mapName}"\n`;
      lastMap = mapName;
    }
    const keyDecl = keyName ? `#EXT-X-KEY:METHOD=AES-128,URI="${keyName}"${s.keyIv ? `,IV=${s.keyIv}` : ''}\n` : '';
    if (keyDecl !== lastKey) {
      out += keyDecl;
      lastKey = keyDecl;
    }
    out += `#EXTINF:${s.duration || targetDuration},\n${prefix}_seg_${String(i).padStart(5, '0')}.${remoteExt(s.uri)}\n`;
  });
  out += '#EXT-X-ENDLIST\n';
  const playlistName = `${prefix}.m3u8`;
  const playlistFile = new File(dir, playlistName);
  playlistFile.write(out);
  onBytes(playlistFile.size);
  return playlistName;
}

/** Taille totale d'un dossier (récursif, ignore les absents). */
export function directoryBytes(dir: Directory): number {
  try {
    if (!dir.exists) return 0;
    let total = 0;
    for (const entry of dir.list()) {
      if (entry instanceof Directory) total += directoryBytes(entry);
      else total += entry.size || 0;
    }
    return total;
  } catch {
    return 0;
  }
}
