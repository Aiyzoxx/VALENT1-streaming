/**
 * hlsOffline — Téléchargement et transmuxage HLS vers MP4 autonome.
 *
 * Résout le problème du mode avion sur iOS/Android :
 * Au lieu de stocker des centaines de fragments .ts et une playlist .m3u8
 * (incompatible avec AVPlayer sous file:// et bloqué sans serveur local),
 * ce module transmuxe les segments HLS à la volée vers un unique fichier
 * `video.mp4` (ISO-BMFF fragmented MP4) via mux.js.
 *
 * Le fichier `video.mp4` est ensuite lu nativement par AVPlayer (iOS)
 * et ExoPlayer (Android) en file:// sans aucune connexion réseau ni serveur.
 */

import { Directory, File, FileMode } from 'expo-file-system';
import muxjs from 'mux.js';

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
  uri: string;
}

interface Segment {
  uri: string;
  duration: number;
}

export interface OfflineProgress {
  segmentsDone: number;
  segmentsTotal: number;
  bytesDownloaded: number;
}

export interface OfflineResult {
  /** file:// URI du fichier MP4 local autonome à donner au player */
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
  const res = await fetchWithRetry(url, { signal, timeoutMs: 30000, retries: 4 });
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

/** Parse une master playlist HLS et retourne les variantes disponibles. */
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
      uri: resolveUrl(uriLine, baseUrl),
    });
  }
  return variants;
}

export function selectVariant(variants: Variant[], quality: OfflineQuality): Variant {
  const maxH = QUALITY_MAX_HEIGHT[quality];
  const sorted = [...variants].sort((a, b) => {
    const ha = a.height || Number.MAX_SAFE_INTEGER;
    const hb = b.height || Number.MAX_SAFE_INTEGER;
    return ha - hb || a.bandwidth - b.bandwidth;
  });
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

/** Parse une media playlist HLS pour extraire les segments vidéo. */
export function parseMedia(text: string, baseUrl: string): { segments: Segment[]; targetDuration: number } {
  const lines = text.split(/\r?\n/);
  const segments: Segment[] = [];
  let targetDuration = 6;
  let pendingDuration = 0;

  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith('#EXT-X-TARGETDURATION')) {
      targetDuration = Number(line.split(':')[1]) || 6;
    } else if (line.startsWith('#EXTINF')) {
      pendingDuration = Number(line.split(':')[1]?.split(',')[0]) || 0;
    } else if (line && !line.startsWith('#')) {
      segments.push({
        uri: resolveUrl(line, baseUrl),
        duration: pendingDuration,
      });
      pendingDuration = 0;
    }
  }
  return { segments, targetDuration };
}

function abortError(): DOMException {
  return new DOMException('Aborted', 'AbortError');
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(abortError());
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      signal?.removeEventListener('abort', onAbort);
      reject(abortError());
    };
    signal?.addEventListener('abort', onAbort);
  });
}

async function fetchWithRetry(
  url: string,
  opts: { signal?: AbortSignal; timeoutMs: number; retries: number }
): Promise<Response> {
  const { signal, timeoutMs, retries } = opts;
  let lastErr: unknown = new Error('Échec réseau');
  for (let attempt = 1; attempt <= retries; attempt++) {
    if (signal?.aborted) throw abortError();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const onExtAbort = () => ctrl.abort();
    signal?.addEventListener('abort', onExtAbort);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (e) {
      if (signal?.aborted) throw abortError();
      lastErr = e;
      if (attempt < retries) {
        try {
          await sleep(1000 * attempt, signal);
        } catch (abortErr) {
          throw abortErr;
        }
      }
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onExtAbort);
    }
  }
  if (signal?.aborted) throw abortError();
  if ((lastErr as DOMException)?.name === 'AbortError') {
    throw Object.assign(new Error('Connexion trop lente ou instable'), { name: 'TimeoutError' });
  }
  throw lastErr;
}

async function downloadBytes(url: string, signal?: AbortSignal): Promise<Uint8Array> {
  const res = await fetchWithRetry(url, { signal, timeoutMs: 30000, retries: 4 });
  return new Uint8Array(await res.arrayBuffer());
}

/**
 * Télécharge un flux HLS et le transmuxe en un fichier MP4 autonome (`video.mp4`).
 * Supporte la reprise : les segments temporaires déjà téléchargés ne sont pas retéléchargés.
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
    if (signal?.aborted) throw abortError();
  };

  throwIfAborted();

  // 1. Analyse master playlist ou media playlist
  const rootText = await fetchText(masterUrl, signal);
  let mediaUrl = masterUrl;
  let pickedVariant: Variant | null = null;

  if (rootText.includes('#EXT-X-STREAM-INF')) {
    const variants = parseMaster(rootText, masterUrl);
    if (variants.length > 0) {
      pickedVariant = selectVariant(variants, quality);
      mediaUrl = pickedVariant.uri;
    }
  }

  throwIfAborted();
  const mediaText = mediaUrl === masterUrl ? rootText : await fetchText(mediaUrl, signal);
  const { segments } = parseMedia(mediaText, mediaUrl);

  if (segments.length === 0) {
    throw new Error('Playlist vide ou illisible');
  }

  const qualityLabel = pickedVariant ? variantLabel(pickedVariant) : OFFLINE_QUALITY_LABEL[quality];

  // 2. Téléchargement concurrent des segments MPEG-TS en cache temporaire
  let segmentsDone = 0;
  let bytesDownloaded = 0;

  const report = () => {
    onProgress?.({
      segmentsDone,
      segmentsTotal: segments.length,
      bytesDownloaded,
    });
  };

  report();

  let cursor = 0;
  const worker = async () => {
    while (true) {
      const idx = cursor++;
      if (idx >= segments.length) return;
      throwIfAborted();

      const segName = `tmp_seg_${String(idx).padStart(5, '0')}.ts`;
      const segFile = new File(dir, segName);

      if (segFile.exists && segFile.size > 0) {
        segmentsDone++;
        bytesDownloaded += segFile.size;
        report();
      } else {
        const segData = await downloadBytes(segments[idx].uri, signal);
        if (segData.byteLength === 0 || segData[0] !== 0x47) {
          throw new Error(`Segment ${idx + 1}/${segments.length} invalide`);
        }
        segFile.write(segData);
        segmentsDone++;
        bytesDownloaded += segData.byteLength;
        report();
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(SEGMENT_CONCURRENCY, segments.length) }, worker)
  );

  throwIfAborted();

  // 3. Transmuxage séquentiel MPEG-TS -> MP4 (fMP4) via mux.js
  const finalMp4File = new File(dir, 'video.mp4');
  if (finalMp4File.exists) {
    try {
      finalMp4File.delete();
    } catch {
      /* ignore */
    }
  }

  finalMp4File.create({ intermediates: true, overwrite: true });
  const handle = finalMp4File.open(FileMode.Append);

  const transmuxer = new muxjs.mp4.Transmuxer({ keepOriginalTimestamps: true });
  let initWritten = false;

  transmuxer.on('data', segment => {
    if (!initWritten && segment.initSegment) {
      handle.writeBytes(segment.initSegment);
      initWritten = true;
    }
    if (segment.data) {
      handle.writeBytes(segment.data);
    }
  });

  try {
    for (let i = 0; i < segments.length; i++) {
      throwIfAborted();
      const segName = `tmp_seg_${String(i).padStart(5, '0')}.ts`;
      const segFile = new File(dir, segName);

      if (segFile.exists) {
        const data = segFile.bytesSync();
        transmuxer.push(data);
        transmuxer.flush();
        // Suppression immédiate du segment source pour libérer le stockage
        try {
          segFile.delete();
        } catch {
          /* ignore */
        }
      }
    }
  } finally {
    handle.close();
    transmuxer.dispose();
  }

  // Vérification de sécurité du fichier final généré
  if (!finalMp4File.exists || finalMp4File.size < 1024) {
    throw new Error('Échec de la génération du fichier vidéo MP4');
  }

  return {
    localUri: finalMp4File.uri,
    bytesTotal: finalMp4File.size,
    segments: segments.length,
    qualityLabel,
  };
}

/** Taille totale d'un dossier en octets (récursif). */
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

/**
 * Sonde un bundle hors-ligne : vérifie que le fichier `video.mp4` existe,
 * fait au moins 1 Ko et commence bien par le header MP4 `ftyp`.
 */
export function probeLocalBundle(localUri: string | null): boolean {
  if (!localUri) return false;
  try {
    const file = new File(localUri);
    if (!file.exists || file.size < 1024) return false;
    const handle = file.open(FileMode.ReadOnly);
    try {
      const head = handle.readBytes(12);
      if (head.byteLength < 8) return false;
      const boxType = String.fromCharCode(head[4], head[5], head[6], head[7]);
      return boxType === 'ftyp';
    } finally {
      handle.close();
    }
  } catch {
    return false;
  }
}

/**
 * Télécharge la jaquette / miniature d'un média dans le dossier hors-ligne.
 */
export async function downloadCover(imageUrl: string | null, dir: Directory): Promise<string | null> {
  if (!imageUrl) return null;
  try {
    const res = await fetchWithRetry(imageUrl, { timeoutMs: 15000, retries: 2 });
    const data = new Uint8Array(await res.arrayBuffer());
    if (data.byteLength === 0) return null;
    const fromUrl = imageUrl.split('?')[0].match(/\.(jpe?g|png|webp)$/i)?.[1]?.toLowerCase();
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    const fromCt = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : 'jpg';
    const ext = fromUrl === 'jpeg' ? 'jpg' : fromUrl ?? fromCt;
    const file = new File(dir, `cover.${ext}`);
    file.write(data);
    return file.uri;
  } catch {
    return null;
  }
}
