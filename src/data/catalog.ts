import { MediaItem } from '../types/media';
import rawCatalog from './catalog.json';

// Posters w600 -> w342 (cartes ~170px, 3-4x plus légers),
// backdrops w3840 -> w1280. Appliqué une fois au chargement.
const shrinkImage = (url: string): string =>
  url
    .replace('/w600_and_h900_bestv2/', '/w342/')
    .replace('/w3840_and_h2160_multi_faces/', '/w1280/');

export const CATALOG: MediaItem[] = (rawCatalog as MediaItem[]).map(item => ({
  ...item,
  posterUrl: item.posterUrl ? shrinkImage(item.posterUrl) : item.posterUrl,
  backdropUrl: item.backdropUrl ? shrinkImage(item.backdropUrl) : item.backdropUrl,
}));

export const CATEGORIES = [
  'Tout',
  'Films',
  'Séries',
  'Action',
  'Comédie',
  'Horreur',
  'Science-Fiction',
  'Animation',
  'Aventure',
  'Drame',
  'Thriller',
  'Documentaire',
  'Romance',
  'Familial'
];
