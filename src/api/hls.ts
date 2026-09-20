// Résolution master HLS -> variante directe.
//
// Contexte : AVPlayer iOS rejette certaines master playlists avec
// `CoreMediaErrorDomain error -12646` (playlist parse error), typiquement
// quand les tags EXT-X-MEDIA sous-titres VTT ne respectent pas strictement
// la spec (ex: #EXT-X-VERSION:3 + URI .vtt directe). Dans ce cas, basculer
// sur la variante vidéo au plus haut débit permet quand même la lecture
// (les segments .ts sont muxés vidéo + audio, seuls les sous-titres
// sélectionnables sont perdus).

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
    // L'URI est sur la première ligne non vide et non commentaire qui suit.
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

/**
 * Télécharge la playlist à `masterUrl` et retourne l'URL de la meilleure
 * variante, ou null si ce n'est pas une master / échec réseau.
 */
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
