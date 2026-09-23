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
  /** Durée totale du flux en secondes */
  duration: number;
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
  if (signal?.aborted || (lastErr as DOMException)?.message === 'Aborted') throw abortError();
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
 * Réorganise et unifie les boîtes moof et mdat pour chaque segment fMP4.
 *
 * Contexte technique critique (Apple AVPlayer sous iOS) :
 * mux.js émet par défaut deux paires moof+mdat distinctes pour chaque segment
 * (une pour l'audio en premier, puis une pour la vidéo en second).
 * Sous iOS, AVPlayer lit le premier moof (audio seul), initialise la piste audio,
 * et ne trouvant pas de données vidéo dans ce premier fragment de temps, refuse
 * d'activer la surface de rendu vidéo (isReadyForDisplay = false). Résultat : écran noir avec son seul.
 *
 * Cette fonction fusionne les fragments d'un même segment en :
 * 1. UN SEUL moof unifié contenant traf(vidéo) en premier et traf(audio) en second.
 * 2. Active default-base-is-moof (0x020000) dans les deux tfhd.
 * 3. Recalcule précisément data_offset dans trun pour chaque piste.
 * 4. UN SEUL mdat unifié contenant les données vidéo suivies des données audio.
 *
 * Ce format est 100% conforme à la norme ISO-BMFF et lu nativement par AVPlayer (iOS) et ExoPlayer (Android).
 */
function recombineSegmentData(buf: Uint8Array): Uint8Array {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const boxes: Array<{ type: string; off: number; len: number }> = [];
  let off = 0;
  while (off < buf.byteLength - 8) {
    if (buf.byteLength - off < 8) break;
    const len = view.getUint32(off);
    if (len === 0 || len === 1 || len > buf.byteLength - off) break;
    const type = String.fromCharCode(buf[off + 4], buf[off + 5], buf[off + 6], buf[off + 7]);
    boxes.push({ type, off, len });
    off += len;
  }

  const moofs = boxes.filter(b => b.type === 'moof');
  const mdats = boxes.filter(b => b.type === 'mdat');

  if (moofs.length !== 2 || mdats.length !== 2) {
    return patchDefaultBaseIsMoof(buf);
  }

  let videoMoof: { off: number; len: number } | null = null;
  let videoMdat: { off: number; len: number } | null = null;
  let audioMoof: { off: number; len: number } | null = null;
  let audioMdat: { off: number; len: number } | null = null;

  for (let i = 0; i < 2; i++) {
    const m = moofs[i];
    let trafOff = m.off + 8;
    const moofEnd = m.off + m.len;
    let isVideo = false;
    while (trafOff < moofEnd - 8) {
      const bLen = view.getUint32(trafOff);
      if (bLen === 0 || bLen > moofEnd - trafOff) break;
      const bType = String.fromCharCode(buf[trafOff + 4], buf[trafOff + 5], buf[trafOff + 6], buf[trafOff + 7]);
      if (bType === 'traf') {
        let boxOff = trafOff + 8;
        const trafEnd = trafOff + bLen;
        while (boxOff < trafEnd - 8) {
          const sLen = view.getUint32(boxOff);
          if (sLen === 0 || sLen > trafEnd - boxOff) break;
          const sType = String.fromCharCode(buf[boxOff + 4], buf[boxOff + 5], buf[boxOff + 6], buf[boxOff + 7]);
          if (sType === 'sdtp' || sType === 'vmhd') {
            isVideo = true;
          } else if (sType === 'tfhd') {
            const trackId = view.getUint32(boxOff + 12);
            if (trackId === 256 || trackId === 1) isVideo = true;
          }
          boxOff += sLen;
        }
      }
      trafOff += bLen;
    }

    if (isVideo) {
      videoMoof = m;
      videoMdat = mdats[i];
    } else {
      audioMoof = m;
      audioMdat = mdats[i];
    }
  }

  if (!videoMoof || !audioMoof || !videoMdat || !audioMdat) {
    return patchDefaultBaseIsMoof(buf);
  }

  const mfhdLen = view.getUint32(videoMoof.off + 8);
  const mfhd = buf.subarray(videoMoof.off + 8, videoMoof.off + 8 + mfhdLen);

  const videoTraf = buf.subarray(videoMoof.off + 8 + mfhdLen, videoMoof.off + videoMoof.len);
  const audioMfhdLen = view.getUint32(audioMoof.off + 8);
  const audioTraf = buf.subarray(audioMoof.off + 8 + audioMfhdLen, audioMoof.off + audioMoof.len);

  const videoPayload = buf.subarray(videoMdat.off + 8, videoMdat.off + videoMdat.len);
  const audioPayload = buf.subarray(audioMdat.off + 8, audioMdat.off + audioMdat.len);

  const combinedMoofLen = 8 + mfhd.byteLength + videoTraf.byteLength + audioTraf.byteLength;
  const combinedMdatLen = 8 + videoPayload.byteLength + audioPayload.byteLength;
  const out = new Uint8Array(combinedMoofLen + combinedMdatLen);
  const outView = new DataView(out.buffer, out.byteOffset, out.byteLength);

  outView.setUint32(0, combinedMoofLen);
  out[4] = 0x6d; out[5] = 0x6f; out[6] = 0x6f; out[7] = 0x66; // 'moof'
  out.set(mfhd, 8);

  const videoTrafOff = 8 + mfhd.byteLength;
  out.set(videoTraf, videoTrafOff);

  const audioTrafOff = videoTrafOff + videoTraf.byteLength;
  out.set(audioTraf, audioTrafOff);

  const trafs = [
    { off: videoTrafOff, isVideo: true },
    { off: audioTrafOff, isVideo: false },
  ];

  for (const t of trafs) {
    const trafLen = outView.getUint32(t.off);
    let boxOff = t.off + 8;
    const trafEnd = t.off + trafLen;
    while (boxOff < trafEnd - 8) {
      const bLen = outView.getUint32(boxOff);
      if (bLen === 0 || bLen > trafEnd - boxOff) break;
      const bType = String.fromCharCode(out[boxOff + 4], out[boxOff + 5], out[boxOff + 6], out[boxOff + 7]);
      if (bType === 'tfhd') {
        out[boxOff + 9] |= 0x02; // default-base-is-moof
      } else if (bType === 'trun') {
        out[boxOff + 11] |= 0x01; // active le flag data-offset-present (bit 0)
        const targetOffset = t.isVideo ? (combinedMoofLen + 8) : (combinedMoofLen + 8 + videoPayload.byteLength);
        outView.setInt32(boxOff + 16, targetOffset);
      }
      boxOff += bLen;
    }
  }

  const mdatOff = combinedMoofLen;
  outView.setUint32(mdatOff, combinedMdatLen);
  out[mdatOff + 4] = 0x6d; out[mdatOff + 5] = 0x64; out[mdatOff + 6] = 0x61; out[mdatOff + 7] = 0x74; // 'mdat'
  out.set(videoPayload, mdatOff + 8);
  out.set(audioPayload, mdatOff + 8 + videoPayload.byteLength);

  return out;
}

function patchDefaultBaseIsMoof(buf: Uint8Array): Uint8Array {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let off = 0;
  while (off < buf.byteLength - 8) {
    if (buf.byteLength - off < 8) break;
    const len = view.getUint32(off);
    if (len === 0 || len === 1 || len > buf.byteLength - off) break;
    const type = String.fromCharCode(buf[off + 4], buf[off + 5], buf[off + 6], buf[off + 7]);
    if (type === 'moof') {
      let trafOff = off + 8;
      const moofEnd = off + len;
      while (trafOff < moofEnd - 8) {
        const trafLen = view.getUint32(trafOff);
        if (trafLen === 0 || trafLen > moofEnd - trafOff) break;
        const trafType = String.fromCharCode(buf[trafOff + 4], buf[trafOff + 5], buf[trafOff + 6], buf[trafOff + 7]);
        if (trafType === 'traf') {
          let boxOff = trafOff + 8;
          const trafEnd = trafOff + trafLen;
          while (boxOff < trafEnd - 8) {
            const bLen = view.getUint32(boxOff);
            if (bLen === 0 || bLen > trafEnd - boxOff) break;
            const bType = String.fromCharCode(buf[boxOff + 4], buf[boxOff + 5], buf[boxOff + 6], buf[boxOff + 7]);
            if (bType === 'tfhd') {
              buf[boxOff + 9] |= 0x02;
            }
            boxOff += bLen;
          }
        }
        trafOff += trafLen;
      }
    }
    off += len;
  }
  return buf;
}

/**
 * Patch le header ftyp de l'initSegment pour inclure les marques compatibles 'iso6' et 'mp42'.
 * Indique explicitement à AVPlayer qu'il s'agit d'un fragmented MP4 compatible ISO-6.
 */
function patchFtypHeader(initSegment: Uint8Array): Uint8Array {
  if (initSegment.byteLength < 16) return initSegment;
  const view = new DataView(initSegment.buffer, initSegment.byteOffset, initSegment.byteLength);
  const ftypLen = view.getUint32(0);
  const ftypType = String.fromCharCode(initSegment[4], initSegment[5], initSegment[6], initSegment[7]);
  if (ftypType !== 'ftyp') return initSegment;

  // Marques supplémentaires à ajouter : 'iso6' (69 73 6f 36) et 'mp42' (6d 70 34 32)
  const extraBrands = [0x69, 0x73, 0x6f, 0x36, 0x6d, 0x70, 0x34, 0x32];
  const newFtypLen = ftypLen + extraBrands.length;
  const newInit = new Uint8Array(initSegment.byteLength + extraBrands.length);

  // Copie le ftyp original avec nouvelle taille
  newInit.set(initSegment.subarray(0, ftypLen), 0);
  const newView = new DataView(newInit.buffer);
  newView.setUint32(0, newFtypLen);

  // Ajoute les marques supplémentaires
  newInit.set(extraBrands, ftypLen);

  // Copie le reste (le box moov)
  newInit.set(initSegment.subarray(ftypLen), newFtypLen);
  return newInit;
}

/**
 * Patch l'initSegment fMP4 :
 * 1. Ajoute les marques 'iso6' et 'mp42' dans ftyp pour AVPlayer
 * 2. Remplace 0xFFFFFFFF (qui donne ~25h aberrantes) par la vraie durée en ticks dans mvhd, tkhd, mdhd
 * 3. Injecte une boîte mehd (Movie Extends Header) dans mvex pour déclarer la durée officielle du fMP4
 */
function patchInitSegment(initSegment: Uint8Array, totalDurationSec: number): Uint8Array {
  const withFtyp = patchFtypHeader(initSegment);
  if (totalDurationSec <= 0) return withFtyp;

  const view = new DataView(withFtyp.buffer, withFtyp.byteOffset, withFtyp.byteLength);

  let movieTimescale = 90000;
  let mvhdDurationOff = -1;
  const tkhdDurationOffsets: number[] = [];
  const mdhdDurationEntries: Array<{ off: number; timescale: number }> = [];
  let mvexOff = -1;
  let mvexLen = -1;
  let moovOff = -1;
  let moovLen = -1;

  function scan(start: number, end: number) {
    let off = start;
    while (off < end - 8) {
      const len = view.getUint32(off);
      if (len === 0 || len > end - off) break;
      const type = String.fromCharCode(withFtyp[off + 4], withFtyp[off + 5], withFtyp[off + 6], withFtyp[off + 7]);

      if (type === 'moov') {
        moovOff = off;
        moovLen = len;
        scan(off + 8, off + len);
      } else if (type === 'mvhd') {
        movieTimescale = view.getUint32(off + 20);
        mvhdDurationOff = off + 24;
      } else if (type === 'trak' || type === 'mdia' || type === 'minf') {
        scan(off + 8, off + len);
      } else if (type === 'tkhd') {
        tkhdDurationOffsets.push(off + 28);
      } else if (type === 'mdhd') {
        const ts = view.getUint32(off + 20);
        mdhdDurationEntries.push({ off: off + 24, timescale: ts });
      } else if (type === 'mvex') {
        mvexOff = off;
        mvexLen = len;
      }
      off += len;
    }
  }

  scan(0, withFtyp.byteLength);

  const movieDurationTicks = Math.round(totalDurationSec * movieTimescale);

  if (mvexOff !== -1 && moovOff !== -1) {
    const mehdLen = 16;
    const out = new Uint8Array(withFtyp.byteLength + mehdLen);
    const outView = new DataView(out.buffer);

    const mvexHeaderEnd = mvexOff + 8;
    out.set(withFtyp.subarray(0, mvexHeaderEnd), 0);

    // Box mehd : size 16, type 'mehd', ver 0, flags 0, duration
    outView.setUint32(mvexHeaderEnd, 16);
    out[mvexHeaderEnd + 4] = 0x6d; // 'm'
    out[mvexHeaderEnd + 5] = 0x65; // 'e'
    out[mvexHeaderEnd + 6] = 0x68; // 'h'
    out[mvexHeaderEnd + 7] = 0x64; // 'd'
    outView.setUint32(mvexHeaderEnd + 8, 0); // ver=0, flags=0
    outView.setUint32(mvexHeaderEnd + 12, movieDurationTicks);

    out.set(withFtyp.subarray(mvexHeaderEnd), mvexHeaderEnd + mehdLen);

    outView.setUint32(moovOff, moovLen + mehdLen);
    outView.setUint32(mvexOff, mvexLen + mehdLen);

    if (mvhdDurationOff !== -1) {
      outView.setUint32(mvhdDurationOff, movieDurationTicks);
    }
    for (const tOff of tkhdDurationOffsets) {
      outView.setUint32(tOff, movieDurationTicks);
    }
    for (const mEntry of mdhdDurationEntries) {
      const dur = Math.round(totalDurationSec * mEntry.timescale);
      outView.setUint32(mEntry.off, dur);
    }

    return out;
  }

  if (mvhdDurationOff !== -1) {
    view.setUint32(mvhdDurationOff, movieDurationTicks);
  }
  for (const tOff of tkhdDurationOffsets) {
    view.setUint32(tOff, movieDurationTicks);
  }
  for (const mEntry of mdhdDurationEntries) {
    view.setUint32(mEntry.off, Math.round(totalDurationSec * mEntry.timescale));
  }
  return withFtyp;
}

/**
 * Répare in-situ la durée d'un fichier video.mp4 déjà téléchargé
 * en remplaçant la valeur par défaut 0xFFFFFFFF (qui donne ~25h aberrantes) dans mvhd, tkhd, mdhd.
 */
export function repairExistingMp4(file: File, expectedDurationSec?: number): boolean {
  if (!file.exists || file.size < 1024) return false;
  try {
    const handle = file.open(FileMode.ReadWrite);
    try {
      const head = handle.readBytes(Math.min(file.size, 4096));
      if (head.byteLength < 32) return false;
      const view = new DataView(head.buffer, head.byteOffset, head.byteLength);

      let mvhdOff = -1;
      let movieTimescale = 90000;
      let mvhdDur = 0;
      const tkhdOffsets: number[] = [];
      const mdhdEntries: Array<{ off: number; timescale: number }> = [];

      function scan(start: number, end: number) {
        let p = start;
        while (p < end - 8) {
          const len = view.getUint32(p);
          if (len === 0 || len > end - p) break;
          const type = String.fromCharCode(head[p + 4], head[p + 5], head[p + 6], head[p + 7]);
          if (type === 'moov' || type === 'trak' || type === 'mdia' || type === 'minf') {
            scan(p + 8, p + len);
          } else if (type === 'mvhd') {
            mvhdOff = p;
            movieTimescale = view.getUint32(p + 20);
            mvhdDur = view.getUint32(p + 24);
          } else if (type === 'tkhd') {
            tkhdOffsets.push(p + 28);
          } else if (type === 'mdhd') {
            const ts = view.getUint32(p + 20);
            mdhdEntries.push({ off: p + 24, timescale: ts });
          }
          p += len;
        }
      }

      scan(0, head.byteLength);

      // Si la durée est 0xFFFFFFFF ou aberrante (> 20h = 72000s)
      if (mvhdOff !== -1 && (mvhdDur === 0xffffffff || mvhdDur > 72000 * movieTimescale)) {
        const durSec = expectedDurationSec && expectedDurationSec > 0 ? expectedDurationSec : 1320;
        const durTicks = Math.round(durSec * movieTimescale);
        view.setUint32(mvhdOff + 24, durTicks);
        for (const off of tkhdOffsets) {
          view.setUint32(off, durTicks);
        }
        for (const m of mdhdEntries) {
          view.setUint32(m.off, Math.round(durSec * m.timescale));
        }

        handle.offset = 0;
        handle.writeBytes(head);
        return true;
      }
      return false;
    } finally {
      handle.close();
    }
  } catch (e) {
    console.warn('repairExistingMp4 failed:', e);
    return false;
  }
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

  const totalDurationSec = segments.reduce((sum, s) => sum + (s.duration || 0), 0);
  const qualityLabel = pickedVariant ? variantLabel(pickedVariant) : OFFLINE_QUALITY_LABEL[quality];

  // 2. Pré-scan des segments temporaires existants pour reprise exacte
  const existingValidSegments = new Set<number>();
  let segmentsDone = 0;
  let bytesDownloaded = 0;

  for (let i = 0; i < segments.length; i++) {
    const segName = `tmp_seg_${String(i).padStart(5, '0')}.ts`;
    const segFile = new File(dir, segName);
    if (segFile.exists) {
      if (segFile.size >= 188) {
        // Valide le magic byte MPEG-TS (0x47)
        let valid = false;
        try {
          const handle = segFile.open(FileMode.ReadOnly);
          try {
            const head = handle.readBytes(1);
            if (head.byteLength > 0 && head[0] === 0x47) {
              valid = true;
            }
          } finally {
            handle.close();
          }
        } catch {
          valid = false;
        }

        if (valid) {
          existingValidSegments.add(i);
          segmentsDone++;
          bytesDownloaded += segFile.size;
        } else {
          try {
            segFile.delete();
          } catch {
            /* ignore */
          }
        }
      } else {
        try {
          segFile.delete();
        } catch {
          /* ignore */
        }
      }
    }
  }

  const report = () => {
    onProgress?.({
      segmentsDone,
      segmentsTotal: segments.length,
      bytesDownloaded,
    });
  };

  // Notifie immédiatement la progression réelle déjà présente (ex: 50% au lieu de 0%)
  report();

  let cursor = 0;
  const worker = async () => {
    while (true) {
      const idx = cursor++;
      if (idx >= segments.length) return;
      throwIfAborted();

      if (existingValidSegments.has(idx)) {
        continue;
      }

      const segName = `tmp_seg_${String(idx).padStart(5, '0')}.ts`;
      const segFile = new File(dir, segName);

      const segData = await downloadBytes(segments[idx].uri, signal);
      if (segData.byteLength === 0 || segData[0] !== 0x47) {
        throw new Error(`Segment ${idx + 1}/${segments.length} invalide`);
      }
      segFile.write(segData);
      segmentsDone++;
      bytesDownloaded += segData.byteLength;
      report();
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

  // keepOriginalTimestamps: false aligne le premier sample à 0:00:00.000 pour éviter tout offset noir
  const transmuxer = new muxjs.mp4.Transmuxer({ keepOriginalTimestamps: false });
  let initWritten = false;

  transmuxer.on('data', segment => {
    if (!initWritten && segment.initSegment) {
      const patchedInit = patchInitSegment(segment.initSegment, totalDurationSec);
      handle.writeBytes(patchedInit);
      initWritten = true;
    }
    if (segment.data) {
      const patchedData = recombineSegmentData(segment.data);
      handle.writeBytes(patchedData);
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
      }
      // Cède un tick au runtime JS pour garder l'UI réactive
      if (i % 8 === 0) {
        await sleep(1, signal);
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

  // Nettoyage des segments temporaires UNIQUEMENT après succès confirmé
  for (let i = 0; i < segments.length; i++) {
    const segName = `tmp_seg_${String(i).padStart(5, '0')}.ts`;
    const segFile = new File(dir, segName);
    if (segFile.exists) {
      try {
        segFile.delete();
      } catch {
        /* ignore */
      }
    }
  }

  return {
    localUri: finalMp4File.uri,
    bytesTotal: finalMp4File.size,
    segments: segments.length,
    qualityLabel,
    duration: totalDurationSec,
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
