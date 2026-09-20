/**
 * usePlatforms — Disponibilités SVOD du catalogue (cache AsyncStorage 7j + refresh fond).
 *
 * Le premier appel sans clé TMDB reste silencieux : la carte est vide et le
 * filtre plateformes est masqué tant qu'aucune donnée n'existe.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchPlatformMap } from '../api/watchProviders';
import { PLATFORM_CACHE_TTL_MS } from '../constants/platforms';
import { MediaItem } from '../types/media';

const CACHE_KEY = '@streamflow_platforms_v1';

interface CachePayload {
  savedAt: number;
  map: Record<string, string[]>;
}

export interface UsePlatformsResult {
  /** itemId -> plateformes[] */
  platformMap: Map<string, string[]>;
  /** true pendant le premier chargement (cache + réseau) */
  loading: boolean;
  /** 0..1 pendant le refresh réseau, null sinon */
  progress: number | null;
  /** true si des données existent (cache ou réseau) */
  hasData: boolean;
  /** Relance un refresh réseau manuel */
  refresh: () => Promise<void>;
}

export function usePlatforms(items: MediaItem[]): UsePlatformsResult {
  const [map, setMap] = useState<Map<string, string[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<number | null>(null);

  const applyPayload = (payload: CachePayload) => {
    setMap(new Map(Object.entries(payload.map)));
  };

  const refresh = useCallback(async () => {
    setProgress(0);
    try {
      const fresh = await fetchPlatformMap(items, setProgress);
      const payload: CachePayload = { savedAt: Date.now(), map: fresh };
      applyPayload(payload);
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.warn('Platform refresh failed:', e);
    } finally {
      setProgress(null);
    }
  }, [items]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(CACHE_KEY);
        if (raw && alive) {
          const payload = JSON.parse(raw) as CachePayload;
          applyPayload(payload);
          // Cache frais : pas de réseau. Sinon refresh silencieux en fond.
          if (Date.now() - payload.savedAt < PLATFORM_CACHE_TTL_MS) {
            return;
          }
        }
      } catch {
        /* cache illisible : on tente le réseau */
      } finally {
        if (alive) setLoading(false);
      }
      if (alive) await refresh();
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(
    () => ({ platformMap: map, loading, progress, hasData: map.size > 0, refresh }),
    [map, loading, progress, refresh]
  );
  return value;
}
