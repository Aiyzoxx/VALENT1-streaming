import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WatchProgress, MediaItem } from '../types/media';
import { CATALOG } from '../data/catalog';

const HISTORY_KEY = '@streamflow_watch_progress';

export function useWatchHistory() {
  const [history, setHistory] = useState<Record<string, WatchProgress>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadHistory() {
      try {
        const stored = await AsyncStorage.getItem(HISTORY_KEY);
        if (stored) {
          setHistory(JSON.parse(stored));
        }
      } catch (err) {
        console.error('Failed to load watch history:', err);
      } finally {
        setLoading(false);
      }
    }
    loadHistory();
  }, []);

  const updateProgress = useCallback(async (mediaId: string, currentTime: number, duration: number) => {
    if (!mediaId || duration <= 0) return;
    
    // If watched > 95%, consider completed
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
        }
      };
      AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next)).catch(console.error);
      return next;
    });
  }, []);

  const getProgress = useCallback((mediaId: string): WatchProgress | null => {
    return history[mediaId] || null;
  }, [history]);

  const clearItem = useCallback(async (mediaId: string) => {
    setHistory(prev => {
      const next = { ...prev };
      delete next[mediaId];
      AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next)).catch(console.error);
      return next;
    });
  }, []);

  // Items currently in continue watching (not completed and watched recently)
  const continueWatchingItems: { media: MediaItem; progress: WatchProgress }[] = Object.values(history)
    .filter(p => !p.completed && p.currentTime > 5)
    .sort((a, b) => b.lastWatched - a.lastWatched)
    .map(p => {
      const media = CATALOG.find(m => m.id === p.mediaId);
      return media ? { media, progress: p } : null;
    })
    .filter((item): item is { media: MediaItem; progress: WatchProgress } => item !== null);

  return {
    history,
    continueWatchingItems,
    updateProgress,
    getProgress,
    clearItem,
    loading
  };
}
