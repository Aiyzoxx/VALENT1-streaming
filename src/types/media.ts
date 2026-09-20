export type MediaType = 'movie' | 'series' | 'live';

export interface Episode {
  id: string;
  season: number;
  episodeNumber: number;
  title: string;
  duration: string;
  synopsis: string;
  streamUrl: string;
  thumbnailUrl: string;
}

export interface MediaItem {
  id: string;
  title: string;
  originalTitle?: string;
  type: MediaType;
  streamUrl: string;
  backdropUrl: string;
  posterUrl: string;
  synopsis: string;
  genres: string[];
  year: number;
  matchScore: number; // e.g. 98 -> 98% recommandé
  quality: '4K HDR' | '1080p FHD' | '720p HD' | 'EN DIRECT';
  duration: string; // e.g. "2h 15m" or "2 Saisons"
  ageRating: string; // "16+", "12+", "Tous"
  cast?: string[];
  episodeUrls?: { url: string; name?: string }[];
  episodes?: Episode[];
  isTrending?: boolean;
  isFeatured?: boolean;
}

export interface WatchProgress {
  mediaId: string;
  currentTime: number;
  duration: number;
  lastWatched: number; // timestamp
  completed: boolean;
}
