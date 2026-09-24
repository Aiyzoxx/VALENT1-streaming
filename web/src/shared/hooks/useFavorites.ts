import { useState, useEffect, useCallback, useMemo } from 'react';
import { MediaItem } from '../types/media';
import { useCatalog } from '../data/catalog';

const FAVORITES_KEY = '@streamflow_favorites';

export function useFavorites() {
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const { catalog } = useCatalog();

  useEffect(() => {
    try {
      const stored = localStorage.getItem(FAVORITES_KEY);
      if (stored) {
        setFavoriteIds(JSON.parse(stored));
      }
    } catch (err) {
      console.error('Failed to load favorites:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    setFavoriteIds(prev => {
      const exists = prev.includes(id);
      const next = exists ? prev.filter(item => item !== id) : [...prev, id];
      try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });
  }, []);

  const isFavorite = useCallback(
    (id: string) => favoriteIds.includes(id),
    [favoriteIds]
  );

  const favoriteItems: MediaItem[] = useMemo(() => {
    const map = new Map(catalog.map(item => [item.id, item]));
    return favoriteIds.map(id => map.get(id)).filter((item): item is MediaItem => !!item);
  }, [catalog, favoriteIds]);

  return {
    favoriteIds,
    favoriteItems,
    isFavorite,
    toggleFavorite,
    loading,
  };
}
