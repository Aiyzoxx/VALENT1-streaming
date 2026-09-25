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

  // Seuls les déploiements Vercel ont besoin du proxy car *.vercel.app est bloqué par le WAF upstream
  const isVercel =
    typeof window !== 'undefined' &&
    window.location.hostname.includes('vercel.app');

  if (isVercel && (streamUrl.includes('finepulfe.xyz') || streamUrl.includes('purstream'))) {
    return streamUrl.replace(/^https?:\/\/[^\/]+/, 'https://api.tribuneo.xyz/api/proxy');
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
  const targetUrl = toProxiedStreamUrl(streamUrl);

  if (!targetUrl.includes('.m3u8')) {
    return { url: targetUrl, subtitles: [] };
  }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(targetUrl, {
      signal: ctrl.signal,
      headers: { Accept: 'application/vnd.apple.mpegurl, application/x-mpegurl, */*' },
    });
    clearTimeout(timer);
    if (!res.ok) return { url: targetUrl, subtitles: [] };

    const text = await res.text();
    if (!text.includes('#EXTM3U')) {
      return { url: targetUrl, subtitles: [] };
    }

    const hasRawVtt = /#EXT-X-MEDIA:TYPE=SUBTITLES[^\r\n]+URI="[^"\r\n]+\.vtt"/i.test(text);
    const hasSeparateAudio = /#EXT-X-MEDIA:TYPE=AUDIO[^\r\n]+URI="[^"\r\n]+\.m3u8"/i.test(text);
    const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
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

    // Séries streaming (finepulfe) : master.m3u8 a des tags VTT non-conformes ou une déclaration de flux
    // audio externe AAC redondante. Les segments TS de la variante sont déjà muxés vidéo + audio (FR/EN).
    // Basculer directement sur l'URL de la variante élimine le double flux audio, les blocages MSE et le buffering infini à 00:00.
    if (hasRawVtt || hasSeparateAudio) {
      const variant = pickVariantUrl(text, baseUrl);
      if (variant) {
        return {
          url: variant,
          subtitles,
        };
      }
    }

    return {
      url: targetUrl,
      subtitles,
    };
  } catch (err) {
    console.warn('Failed to sanitize master playlist:', err);
    return { url: targetUrl, subtitles: [] };
  }
}

export async function resolvePlayableStreamUrl(streamUrl: string): Promise<string> {
  const res = await fetchAndSanitizeStream(streamUrl);
  return res.url;
}
