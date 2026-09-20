import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CATALOG } from '../data/catalog';
import { MediaItem } from '../types/media';

const FAVORITES_KEY = '@streamflow_favorites';

export function useFavorites() {
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Load favorites from AsyncStorage
  useEffect(() => {
    async function loadFavorites() {
      try {
        const stored = await AsyncStorage.getItem(FAVORITES_KEY);
        if (stored) {
          setFavoriteIds(JSON.parse(stored));
        }
      } catch (err) {
        console.error('Failed to load favorites:', err);
      } finally {
        setLoading(false);
      }
    }
    loadFavorites();
  }, []);

  // Save favorites to AsyncStorage
  const saveFavorites = async (ids: string[]) => {
    try {
      await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(ids));
      setFavoriteIds(ids);
    } catch (err) {
      console.error('Failed to save favorites:', err);
    }
  };

  const toggleFavorite = useCallback(async (id: string) => {
    setFavoriteIds(prev => {
      const exists = prev.includes(id);
      const next = exists ? prev.filter(item => item !== id) : [...prev, id];
      AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(next)).catch(console.error);
      return next;
    });
  }, []);

  const isFavorite = useCallback((id: string) => {
    return favoriteIds.includes(id);
  }, [favoriteIds]);

  const favoriteItems: MediaItem[] = CATALOG.filter(item => favoriteIds.includes(item.id));

  return {
    favoriteIds,
    favoriteItems,
    isFavorite,
    toggleFavorite,
    loading
  };
}
