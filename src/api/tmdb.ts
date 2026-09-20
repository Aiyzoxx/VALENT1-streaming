import { TMDB } from '../constants/tmdb';

// ---------- Types ----------

export interface TmdbPaginated<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

export interface TmdbMovie {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
  original_language: string;
}

export interface TmdbTv {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
  original_language: string;
}

export interface TmdbCastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
}

export interface TmdbCredits {
  id: number;
  cast: TmdbCastMember[];
}

export interface TmdbGenre {
  id: number;
  name: string;
}

export interface TmdbEpisode {
  id: number;
  name: string;
  overview: string;
  still_path: string | null;
  episode_number: number;
  season_number: number;
}

// ---------- Socle HTTP ----------

type QueryParams = Record<string, string | number | undefined>;

async function request<T>(path: string, params: QueryParams = {}): Promise<T> {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined) as [
    string,
    string | number,
  ][];
  const qs = new URLSearchParams({
    language: TMDB.language,
    ...Object.fromEntries(entries.map(([k, v]) => [k, String(v)])),
  }).toString();

  const res = await fetch(`${TMDB.baseUrl}${path}?${qs}`, {
    headers: {
      Authorization: `Bearer ${TMDB.readToken}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`TMDB ${res.status} sur ${path}`);
  }
  return (await res.json()) as T;
}

/** URL d'image TMDB (poster/backdrop/profil). Tailles : w200, w500, w780, original... */
export function tmdbImage(
  path: string | null | undefined,
  size: 'w200' | 'w500' | 'w780' | 'original' = 'w500'
): string {
  return path ? `${TMDB.imageBaseUrl}/${size}${path}` : '';
}

// ---------- Endpoints ----------

export const tmdb = {
  trending(
    mediaType: 'all' | 'movie' | 'tv' = 'all',
    timeWindow: 'day' | 'week' = 'week'
  ): Promise<TmdbPaginated<TmdbMovie | TmdbTv>> {
    return request(`/trending/${mediaType}/${timeWindow}`);
  },

  popularMovies(page = 1): Promise<TmdbPaginated<TmdbMovie>> {
    return request('/movie/popular', { page, region: TMDB.region });
  },

  popularSeries(page = 1): Promise<TmdbPaginated<TmdbTv>> {
    return request('/tv/popular', { page });
  },

  searchMulti(
    query: string,
    page = 1
  ): Promise<TmdbPaginated<TmdbMovie | TmdbTv>> {
    return request('/search/multi', {
      query,
      page,
      region: TMDB.region,
      include_adult: 'false',
    });
  },

  searchSeries(query: string, page = 1): Promise<TmdbPaginated<TmdbTv>> {
    return request('/search/tv', {
      query,
      page,
      include_adult: 'false',
    });
  },

  seriesEpisode(
    seriesId: number,
    season: number,
    episode: number
  ): Promise<TmdbEpisode> {
    return request(`/tv/${seriesId}/season/${season}/episode/${episode}`);
  },

  movieDetails(id: number): Promise<TmdbMovie> {
    return request(`/movie/${id}`);
  },

  seriesDetails(id: number): Promise<TmdbTv> {
    return request(`/tv/${id}`);
  },

  movieCredits(id: number): Promise<TmdbCredits> {
    return request(`/movie/${id}/credits`);
  },

  seriesCredits(id: number): Promise<TmdbCredits> {
    return request(`/tv/${id}/credits`);
  },

  similarMovies(id: number, page = 1): Promise<TmdbPaginated<TmdbMovie>> {
    return request(`/movie/${id}/similar`, { page });
  },

  similarSeries(id: number, page = 1): Promise<TmdbPaginated<TmdbTv>> {
    return request(`/tv/${id}/similar`, { page });
  },

  /** Top popularité dispo en flatrate chez un provider (région FR). */
  discoverByProvider(
    kind: 'movie' | 'tv',
    providerId: number,
    page = 1
  ): Promise<TmdbPaginated<TmdbMovie | TmdbTv>> {
    return request(`/discover/${kind}`, {
      page,
      watch_region: TMDB.region,
      with_watch_providers: providerId,
      with_watch_monetization_types: 'flatrate',
      sort_by: 'popularity.desc',
    });
  },
};
