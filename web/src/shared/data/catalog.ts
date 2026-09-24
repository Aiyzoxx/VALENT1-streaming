import { useState, useEffect } from 'react';
import { MediaItem } from '../types/media';

const shrinkImage = (url: string): string =>
  url
    .replace('/w600_and_h900_bestv2/', '/w342/')
    .replace('/w3840_and_h2160_multi_faces/', '/w1280/');

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
  'Familial',
];

let cachedCatalog: MediaItem[] = [];
let loadPromise: Promise<MediaItem[]> | null = null;
const listeners = new Set<(catalog: MediaItem[]) => void>();

export async function fetchCatalog(): Promise<MediaItem[]> {
  if (cachedCatalog.length > 0) return cachedCatalog;
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const res = await fetch('/data/catalog.json');
        if (!res.ok) throw new Error(`Catalog load failed: ${res.status}`);
        const raw: MediaItem[] = await res.json();
        cachedCatalog = raw.map(item => ({
          ...item,
          posterUrl: item.posterUrl ? shrinkImage(item.posterUrl) : item.posterUrl,
          backdropUrl: item.backdropUrl ? shrinkImage(item.backdropUrl) : item.backdropUrl,
        }));
        listeners.forEach(fn => fn(cachedCatalog));
        return cachedCatalog;
      } catch (err) {
        console.error('Catalog fetch error:', err);
        return [];
      }
    })();
  }
  return loadPromise;
}

export function getCachedCatalog(): MediaItem[] {
  return cachedCatalog;
}

export function useCatalog() {
  const [catalog, setCatalog] = useState<MediaItem[]>(cachedCatalog);
  const [loading, setLoading] = useState(cachedCatalog.length === 0);

  useEffect(() => {
    let alive = true;
    const onUpdate = (data: MediaItem[]) => {
      if (alive) {
        setCatalog(data);
        setLoading(false);
      }
    };
    listeners.add(onUpdate);

    if (cachedCatalog.length === 0) {
      fetchCatalog().then(data => {
        if (alive) {
          setCatalog(data);
          setLoading(false);
        }
      });
    } else {
      setLoading(false);
    }

    return () => {
      alive = false;
      listeners.delete(onUpdate);
    };
  }, []);

  return { catalog, loading };
}
