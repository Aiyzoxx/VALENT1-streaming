export interface PlatformDef {
  /** Slug interne stable */
  id: string;
  /** Label affiché dans les chips */
  label: string;
  /** ID du provider chez TMDB (watch/providers, région FR) */
  tmdbProviderId: number;
}

/** Plateformes proposées dans le filtre, région France. */
export const PLATFORMS: PlatformDef[] = [
  { id: 'netflix', label: 'Netflix', tmdbProviderId: 8 },
  { id: 'disney', label: 'Disney+', tmdbProviderId: 337 },
  { id: 'prime', label: 'Prime Video', tmdbProviderId: 119 },
  { id: 'apple', label: 'Apple TV+', tmdbProviderId: 350 },
  { id: 'max', label: 'Max', tmdbProviderId: 1899 },
  { id: 'paramount', label: 'Paramount+', tmdbProviderId: 531 },
  { id: 'canal', label: 'Canal+', tmdbProviderId: 381 },
];

/** Nombre de pages discover par plateforme et par type (20 résultats/page). */
export const PLATFORM_PAGES = 3;

/** Durée de validité du cache local (7 jours). */
export const PLATFORM_CACHE_TTL_MS = 7 * 24 * 3600 * 1000;
