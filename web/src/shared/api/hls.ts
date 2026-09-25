interface Variant {
  bandwidth: number;
  uri: string;
}

export interface ExternalSubtitle {
  id: number;
  label: string;
  src: string;
  lang: string;
  isDefault?: boolean;
}

export interface PlayableStreamResult {
  url: string;
  subtitles: ExternalSubtitle[];
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

export function toProxiedStreamUrl(streamUrl: string): string {
  if (!streamUrl || typeof streamUrl !== 'string') return streamUrl;
  if (streamUrl.startsWith('/api/proxy') || streamUrl.startsWith('https://api.tribuneo.xyz/api/proxy')) {
    return streamUrl;
  }

  const isDirectProxyHost =
    typeof window !== 'undefined' &&
    (window.location.hostname.includes('tribuneo.xyz') ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1');

  const proxyBase = isDirectProxyHost ? '/api/proxy' : 'https://api.tribuneo.xyz/api/proxy';

  if (streamUrl.includes('finepulfe.xyz') || streamUrl.includes('purstream')) {
    return streamUrl.replace(/^https?:\/\/[^\/]+/, proxyBase);
  }
  return streamUrl;
}

export async function resolveVariantUrl(masterUrl: string, timeoutMs = 8000): Promise<string | null> {
  const proxiedMaster = toProxiedStreamUrl(masterUrl);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(proxiedMaster, {
      signal: ctrl.signal,
      headers: { Accept: 'application/vnd.apple.mpegurl, application/x-mpegurl, */*' },
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text.includes('#EXT-X-STREAM-INF')) return null;
    const variant = pickVariantUrl(text, proxiedMaster);
    if (!variant || variant === proxiedMaster) return null;
    return variant;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchAndSanitizeStream(
  streamUrl: string,
  timeoutMs = 8000
): Promise<PlayableStreamResult> {
  if (!streamUrl || typeof streamUrl !== 'string') return { url: streamUrl, subtitles: [] };
  const proxied = toProxiedStreamUrl(streamUrl);

  if (!proxied.includes('.m3u8')) {
    return { url: proxied, subtitles: [] };
  }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(proxied, {
      signal: ctrl.signal,
      headers: { Accept: 'application/vnd.apple.mpegurl, application/x-mpegurl, */*' },
    });
    clearTimeout(timer);
    if (!res.ok) return { url: proxied, subtitles: [] };

    let text = await res.text();
    if (!text.includes('#EXTM3U')) {
      return { url: proxied, subtitles: [] };
    }

    const hasRawVtt = /#EXT-X-MEDIA:TYPE=SUBTITLES[^\r\n]+URI="[^"\r\n]+\.vtt"/i.test(text);
    const baseUrl = proxied.substring(0, proxied.lastIndexOf('/') + 1);
    const resolveUrl = (uri: string) => (/^https?:\/\//i.test(uri) ? uri : new URL(uri, baseUrl).toString());

    // Extraction des sous-titres
    const subtitles: ExternalSubtitle[] = [];
    const subMatches = text.matchAll(/#EXT-X-MEDIA:TYPE=SUBTITLES[^\r\n]*/gi);
    let subIdx = 0;
    for (const match of subMatches) {
      const line = match[0];
      const uriMatch = line.match(/URI="([^"]+)"/i);
      if (!uriMatch || !uriMatch[1]) continue;

      const nameMatch = line.match(/NAME="([^"]+)"/i);
      const langMatch = line.match(/LANGUAGE="([^"]+)"/i);
      subtitles.push({
        id: subIdx++,
        label: nameMatch ? nameMatch[1] : `Sous-titre ${subIdx}`,
        src: resolveUrl(uriMatch[1]),
        lang: langMatch ? langMatch[1] : 'fr',
        isDefault: /DEFAULT=YES/i.test(line),
      });
    }

    if (!hasRawVtt) {
      return { url: proxied, subtitles };
    }

    // Supprime faux tags VTT
    text = text.replace(/#EXT-X-MEDIA:TYPE=SUBTITLES[^\r\n]+URI="[^"\r\n]+\.vtt"[^\r\n]*(\r?\n)?/gi, '');
    if (!text.includes('TYPE=SUBTITLES')) {
      text = text.replace(/,SUBTITLES="[^"]+"/gi, '').replace(/SUBTITLES="[^"]+",?/gi, '');
    }

    // Chemins absolus vers le proxy
    const lines = text.split(/\r?\n/).map((l) => {
      const trimmed = l.trim();
      if (!trimmed) return l;
      if (trimmed.startsWith('#')) {
        return l.replace(/URI="([^"]+)"/g, (_, uri) => `URI="${resolveUrl(uri)}"`);
      }
      return resolveUrl(trimmed);
    });

    const cleanedManifest = lines.join('\n');
    const blob = new Blob([cleanedManifest], { type: 'application/vnd.apple.mpegurl' });
    const blobUrl = URL.createObjectURL(blob);

    return {
      url: blobUrl,
      subtitles,
    };
  } catch (err) {
    console.warn('Failed to sanitize master playlist:', err);
    return { url: proxied, subtitles: [] };
  }
}

export async function resolvePlayableStreamUrl(streamUrl: string): Promise<string> {
  const res = await fetchAndSanitizeStream(streamUrl);
  return res.url;
}
