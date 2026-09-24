interface Variant {
  bandwidth: number;
  uri: string;
}

/** Parse une master playlist et retourne l'URL absolue de la meilleure variante, ou null. */
export function pickVariantUrl(masterText: string, baseUrl: string): string | null {
  const lines = masterText.split(/\r?\n/);
  const variants: Variant[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('#EXT-X-STREAM-INF')) continue;
    const bwMatch = line.match(/BANDWIDTH=(\d+)/);
    const bandwidth = bwMatch ? parseInt(bwMatch[1], 10) : 0;
    let uri = '';
    for (let j = i + 1; j < lines.length; j++) {
      const next = lines[j].trim();
      if (!next) continue;
      if (next.startsWith('#')) continue;
      uri = next;
      break;
    }
    if (uri) variants.push({ bandwidth, uri });
  }

  if (variants.length === 0) return null;
  variants.sort((a, b) => b.bandwidth - a.bandwidth);

  for (const v of variants) {
    try {
      return new URL(v.uri, baseUrl).toString();
    } catch {
      continue;
    }
  }
  return null;
}

export async function resolveVariantUrl(masterUrl: string, timeoutMs = 10000): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(masterUrl, {
      signal: ctrl.signal,
      headers: { Accept: 'application/vnd.apple.mpegurl, application/x-mpegurl, */*' },
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text.includes('#EXT-X-STREAM-INF')) return null;
    const variant = pickVariantUrl(text, masterUrl);
    if (!variant || variant === masterUrl) return null;
    return variant;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const streamUrlCache = new Map<string, string>();

export function hasIncompatibleMediaTags(manifestText: string): boolean {
  const hasVttSubs = /#EXT-X-MEDIA:TYPE=SUBTITLES[^\n]+URI="[^"]+\.vtt"/i.test(manifestText);
  const hasSeparateAudio = /#EXT-X-MEDIA:TYPE=AUDIO[^\n]+URI="[^"]+\.m3u8"/i.test(manifestText);
  return hasVttSubs || hasSeparateAudio;
}

export async function resolvePlayableStreamUrl(streamUrl: string, timeoutMs = 6000): Promise<string> {
  if (!streamUrl || typeof streamUrl !== 'string') return streamUrl;
  if (!streamUrl.includes('.m3u8')) return streamUrl;

  const cached = streamUrlCache.get(streamUrl);
  if (cached) return cached;

  if (streamUrl.includes('finepulfe.xyz') && /\/tv\/[^\/]+\/S\d+\/E\d+\/master\.m3u8/i.test(streamUrl)) {
    const directVariant = streamUrl.replace(/\/master\.m3u8$/i, '/720p/playlist.m3u8');
    streamUrlCache.set(streamUrl, directVariant);
    return directVariant;
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(streamUrl, {
      signal: ctrl.signal,
      headers: { Accept: 'application/vnd.apple.mpegurl, application/x-mpegurl, */*' },
    });
    if (!res.ok) {
      streamUrlCache.set(streamUrl, streamUrl);
      return streamUrl;
    }

    const text = await res.text();
    if (!text.includes('#EXT-X-STREAM-INF')) {
      streamUrlCache.set(streamUrl, streamUrl);
      return streamUrl;
    }

    if (hasIncompatibleMediaTags(text)) {
      const variant = pickVariantUrl(text, streamUrl);
      if (variant) {
        streamUrlCache.set(streamUrl, variant);
        return variant;
      }
    }

    streamUrlCache.set(streamUrl, streamUrl);
    return streamUrl;
  } catch {
    return streamUrl;
  } finally {
    clearTimeout(timer);
  }
}
