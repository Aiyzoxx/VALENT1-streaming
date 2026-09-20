import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CustomStream } from '../types/media';

const CUSTOM_STREAMS_KEY = '@streamflow_custom_m3u8_streams';

export function useCustomStreams() {
  const [streams, setStreams] = useState<CustomStream[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStreams() {
      try {
        const stored = await AsyncStorage.getItem(CUSTOM_STREAMS_KEY);
        if (stored) {
          setStreams(JSON.parse(stored));
        } else {
          setStreams([]);
        }
      } catch (err) {
        console.error('Failed to load custom streams:', err);
      } finally {
        setLoading(false);
      }
    }
    loadStreams();
  }, []);

  const addStream = useCallback(async (title: string, url: string, isLive: boolean = false, category: string = 'Perso') => {
    const newStream: CustomStream = {
      id: 'stream_' + Date.now(),
      title: title.trim() || 'Flux M3U8 sans titre',
      url: url.trim(),
      addedAt: Date.now(),
      isLive,
      category,
    };

    setStreams(prev => {
      const next = [newStream, ...prev];
      AsyncStorage.setItem(CUSTOM_STREAMS_KEY, JSON.stringify(next)).catch(console.error);
      return next;
    });

    return newStream;
  }, []);

  const removeStream = useCallback(async (id: string) => {
    setStreams(prev => {
      const next = prev.filter(s => s.id !== id);
      AsyncStorage.setItem(CUSTOM_STREAMS_KEY, JSON.stringify(next)).catch(console.error);
      return next;
    });
  }, []);

  return {
    streams,
    loading,
    addStream,
    removeStream,
  };
}
