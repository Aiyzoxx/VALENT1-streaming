import { useState, useEffect, useCallback, useMemo } from 'react';
import { WatchProgress, MediaItem } from '../types/media';
import { useCatalog } from '../data/catalog';

const HISTORY_KEY = '@streamflow_watch_progress';

export function useWatchHistory() {
  const [history, setHistory] = useState<Record<string, WatchProgress>>({});
  const [loading, setLoading] = useState(true);
  const { catalog } = useCatalog();

  useEffect(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch (err) {
      console.error('Failed to load watch history:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateProgress = useCallback((mediaId: string, currentTime: number, duration: number) => {
    if (!mediaId || duration <= 0) return;
    const completed = currentTime / duration >= 0.95;

    setHistory(prev => {
      const next = {
        ...prev,
        [mediaId]: {
          mediaId,
          currentTime,
          duration,
          lastWatched: Date.now(),
          completed,
        },
      };
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });
  }, []);

  const getProgress = useCallback((mediaId: string): WatchProgress | null => {
    return history[mediaId] || null;
  }, [history]);

  const clearItem = useCallback((mediaId: string) => {
    setHistory(prev => {
      const next = { ...prev };
      delete next[mediaId];
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });
  }, []);

  const continueWatchingItems: { media: MediaItem; progress: WatchProgress }[] = useMemo(() => {
    const catalogMap = new Map(catalog.map(m => [m.id, m]));
    return Object.values(history)
      .filter(p => !p.completed && p.currentTime > 5)
      .sort((a, b) => b.lastWatched - a.lastWatched)
      .map(p => {
        // Handle episode IDs (e.g. "3695_ep_3695-s5-e1" -> baseId "3695")
        const baseId = p.mediaId.includes('_ep_') ? p.mediaId.split('_ep_')[0] : p.mediaId;
        const media = catalogMap.get(baseId);
        return media ? { media, progress: p } : null;
      })
      .filter((item): item is { media: MediaItem; progress: WatchProgress } => item !== null);
  }, [catalog, history]);

  return {
    history,
    continueWatchingItems,
    updateProgress,
    getProgress,
    clearItem,
    loading,
  };
}
