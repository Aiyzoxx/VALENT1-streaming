/**
 * useVoiceSearch — Dictée vocale pour la barre de recherche.
 *
 * Basé sur expo-speech-recognition (SFSpeechRecognizer iOS / SpeechRecognizer Android).
 * Nécessite un dev client (expo prebuild + expo run:ios / run:android).
 * Dans Expo Go le module natif est absent : isSupported = false, le micro ne fait rien.
 *
 * Fonctionnement :
 *  - startListening() demande la permission puis démarre la reconnaissance en fr-FR.
 *  - Les résultats partiels sont propagés via onResult() en temps réel pendant la dictée.
 *  - stopListening() valide le résultat final, cancel() annule sans propager.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';

// Import protégé : requireNativeModule lève dans Expo Go si le module natif manque.
let ExpoSpeechRecognitionModule: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('expo-speech-recognition');
  ExpoSpeechRecognitionModule = mod.ExpoSpeechRecognitionModule ?? null;
} catch {
  ExpoSpeechRecognitionModule = null;
}

export type VoiceSearchState = 'idle' | 'listening' | 'processing' | 'error';

export interface UseVoiceSearchResult {
  /** État courant de la reconnaissance vocale */
  state: VoiceSearchState;
  /** true si le micro est actif */
  isListening: boolean;
  /** Texte transcrit (partiel ou final) */
  transcript: string;
  /** Message d'erreur éventuel */
  error: string | null;
  /** Lance la reconnaissance vocale */
  startListening: () => Promise<void>;
  /** Arrête et valide le résultat */
  stopListening: () => void;
  /** Annule sans propager le résultat */
  cancel: () => void;
  /** false dans Expo Go (pas de module natif) ou sur web */
  isSupported: boolean;
}

/**
 * Hook de dictée vocale.
 * @param onResult Callback appelé avec le texte transcrit (partiel ou final).
 */
export function useVoiceSearch(
  onResult: (text: string) => void
): UseVoiceSearchResult {
  const [state, setState] = useState<VoiceSearchState>('idle');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Ref pour éviter la closure périmée dans les listeners natifs.
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const isSupported =
    ExpoSpeechRecognitionModule !== null && Platform.OS !== 'web';

  // ── Listeners natifs (addListener direct, pas de hook conditionnel) ──
  useEffect(() => {
    if (!isSupported) return;
    const mod = ExpoSpeechRecognitionModule;
    if (typeof mod?.addListener !== 'function') return;

    const subs = [
      mod.addListener('result', (event: any) => {
        const text: string = event?.results?.[0]?.transcript ?? '';
        if (text) {
          setTranscript(text);
          onResultRef.current(text);
          if (event?.isFinal) setState('idle');
        }
      }),
      mod.addListener('start', () => {
        setState('listening');
        setError(null);
      }),
      mod.addListener('end', () => {
        setState(prev => (prev === 'listening' ? 'processing' : prev));
        setTimeout(
          () => setState(prev => (prev === 'processing' ? 'idle' : prev)),
          500
        );
      }),
      mod.addListener('error', (event: any) => {
        const code: string = event?.error ?? '';
        // "no-speech" (silence) et "aborted" (annulation) : pas d'erreur affichable.
        if (code !== 'no-speech' && code !== 'aborted') {
          setError(`Erreur micro : ${code}`);
          setState('error');
        } else {
          setState('idle');
        }
      }),
    ];

    return () => {
      subs.forEach(s => {
        try {
          s?.remove();
        } catch {
          /* ignore */
        }
      });
    };
  }, [isSupported]);

  // ── API publique ──
  const startListening = useCallback(async () => {
    if (!isSupported) return;
    try {
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm?.granted) {
        setError('Permission micro refusée');
        setState('error');
        return;
      }
      setTranscript('');
      setError(null);
      ExpoSpeechRecognitionModule.start({
        lang: 'fr-FR',
        interimResults: true,
        continuous: false,
        requiresOnDeviceRecognition: false,
      });
    } catch (e: any) {
      setError(e?.message ?? 'Impossible de démarrer le micro');
      setState('error');
    }
  }, [isSupported]);

  const stopListening = useCallback(() => {
    if (!isSupported) return;
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      /* ignore */
    }
  }, [isSupported]);

  const cancel = useCallback(() => {
    if (!isSupported) return;
    try {
      ExpoSpeechRecognitionModule.abort();
    } catch {
      /* ignore */
    }
    setState('idle');
  }, [isSupported]);

  return {
    state,
    isListening: state === 'listening',
    transcript,
    error,
    startListening,
    stopListening,
    cancel,
    isSupported,
  };
}
