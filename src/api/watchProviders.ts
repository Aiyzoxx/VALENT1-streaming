/**
 * watchProviders — Disponibilités SVOD France via TMDB (discover + watch providers).
 *
 * Stratégie : plutôt qu'appeler /watch/providers sur 5000 titres (trop coûteux),
 * on interroge `discover/movie|tv` filtré par provider (tri popularité) puis on
 * apparie les résultats au catalogue local par titre normalisé + année (±1).
 * Seuls les titres populaires de chaque plateforme sont donc tagués — le filtre
 * reste honnête : sans tag, un titre est exclu quand une plateforme est choisie.
 */

import { tmdb } from './tmdb';
import { PLATFORMS, PLATFORM_PAGES } from '../constants/platforms';
import { MediaItem } from '../types/media';

/** Normalisation aggressive pour apparier les titres FR/VO. */
export function normalizeTitle(raw: string): string {
  return (raw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function resultTitle(r: { title?: string; name?: string }): string {
  const t = (r as { title?: string }).title ?? (r as { name?: string }).name ?? '';
  return normalizeTitle(t);
}

function resultYear(r: { release_date?: string; first_air_date?: string }): number | null {
  const d = (r as { release_date?: string }).release_date ?? (r as { first_air_date?: string }).first_air_date;
  if (!d || d.length < 4) return null;
  const y = parseInt(d.slice(0, 4), 10);
  return isNaN(y) ? null : y;
}

/**
 * Construit itemId -> plateformes[] en appariant le top discover au catalogue.
 * @param items Catalogue local (pour l'appariement titre/année).
 * @param onProgress Callback optionnel (0..1) pour afficher une progression.
 */
export async function fetchPlatformMap(
  items: MediaItem[],
  onProgress?: (p: number) => void
): Promise<Record<string, string[]>> {
  // Index catalogue : titre normalisé -> [{id, year, type}]
  const index = new Map<string, { id: string; year: number; type: string }[]>();
  for (const item of items) {
    const key = normalizeTitle(item.title);
    if (!key) continue;
    const list = index.get(key) ?? [];
    list.push({ id: item.id, year: item.year, type: item.type });
    index.set(key, list);
  }

  const map: Record<string, Set<string>> = {};
  const add = (id: string, platform: string) => {
    (map[id] ??= new Set()).add(platform);
  };

  const jobs: { kind: 'movie' | 'tv'; platform: string; providerId: number; page: number }[] = [];
  for (const p of PLATFORMS) {
    for (let page = 1; page <= PLATFORM_PAGES; page++) {
      jobs.push({ kind: 'movie', platform: p.id, providerId: p.tmdbProviderId, page });
      jobs.push({ kind: 'tv', platform: p.id, providerId: p.tmdbProviderId, page });
    }
  }

  let done = 0;
  // Séquentiel : respecte le rate-limit TMDB sans rafale.
  for (const job of jobs) {
    try {
      const res = await tmdb.discoverByProvider(job.kind, job.providerId, job.page);
      for (const r of res.results ?? []) {
        const title = resultTitle(r);
        if (!title) continue;
        const year = resultYear(r);
        const candidates = index.get(title);
        if (!candidates) continue;
        for (const c of candidates) {
          const typeOk =
            (job.kind === 'movie' && c.type === 'movie') ||
            (job.kind === 'tv' && c.type !== 'movie');
          if (!typeOk) continue;
          if (year !== null && Math.abs(c.year - year) > 1) continue;
          add(c.id, job.platform);
        }
      }
    } catch (e) {
      console.warn('TMDB discover failed:', job.platform, job.kind, job.page, e);
    }
    done += 1;
    onProgress?.(done / jobs.length);
  }

  const out: Record<string, string[]> = {};
  for (const [id, set] of Object.entries(map)) out[id] = [...set];
  return out;
}
