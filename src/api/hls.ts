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

// Cache mémoire des résolutions pour un lancement instantané (0ms aux réouvertures)
const streamUrlCache = new Map<string, string>();

/**
 * Vérifie si une master playlist contient des balises EXT-X-MEDIA non conformes ou conflictuelles
 * (ex: URI pointant directement vers .vtt provoquant CoreMediaErrorDomain -12646,
 * ou piste audio externe séparée provoquant le doublement de durée 45:09 et blocage du seek sur AVPlayer).
 */
export function hasIncompatibleMediaTags(manifestText: string): boolean {
  const hasVttSubs = /#EXT-X-MEDIA:TYPE=SUBTITLES[^\n]+URI="[^"]+\.vtt"/i.test(manifestText);
  const hasSeparateAudio = /#EXT-X-MEDIA:TYPE=AUDIO[^\n]+URI="[^"]+\.m3u8"/i.test(manifestText);
  return hasVttSubs || hasSeparateAudio;
}

/**
 * Résout une URL de flux vers une URL 100% jouable sur AVPlayer iOS.
 * Si le flux est une master playlist avec tags non conformes ou audio séparé (ex: Malcolm, MobLand),
 * bascule préventivement sur la meilleure variante vidéo directe.
 * Si le flux est déjà conforme ou direct, le renvoie sans modification.
 */
export async function resolvePlayableStreamUrl(streamUrl: string, timeoutMs = 6000): Promise<string> {
  if (!streamUrl || typeof streamUrl !== 'string') return streamUrl;
  if (!streamUrl.includes('.m3u8')) return streamUrl;

  const cached = streamUrlCache.get(streamUrl);
  if (cached) return cached;

  // Résolution déterministe immédiate (0ms) pour les séries finepulfe (ex: Malcolm) :
  // Évite les timeouts réseau 4G/WiFi, élimine la durée doublée à 45:09 et débloque le seek
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

    // Détection des anomalies connues pour faire crasher AVPlayer iOS (-12646)
    // ou additionner la durée audio/vidéo (ex: 45:09 au lieu de 22:34)
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

