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

export function toProxiedStreamUrl(streamUrl: string): string {
  if (!streamUrl || typeof streamUrl !== 'string') return streamUrl;
  if (streamUrl.startsWith('/api/proxy')) return streamUrl;

  if (streamUrl.includes('finepulfe.xyz')) {
    return streamUrl.replace(/^https?:\/\/[^\/]+/, '/api/proxy');
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

export async function resolvePlayableStreamUrl(streamUrl: string): Promise<string> {
  if (!streamUrl || typeof streamUrl !== 'string') return streamUrl;
  return toProxiedStreamUrl(streamUrl);
}
