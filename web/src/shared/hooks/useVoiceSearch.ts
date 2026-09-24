import { useState, useEffect, useCallback, useRef } from 'react';

export type VoiceSearchState = 'idle' | 'listening' | 'processing' | 'error';

export interface UseVoiceSearchResult {
  state: VoiceSearchState;
  isListening: boolean;
  transcript: string;
  error: string | null;
  startListening: () => Promise<void>;
  stopListening: () => void;
  cancel: () => void;
  isSupported: boolean;
}

export function useVoiceSearch(
  onResult: (text: string) => void
): UseVoiceSearchResult {
  const [state, setState] = useState<VoiceSearchState>('idle');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const recognitionRef = useRef<any>(null);

  const SpeechRecognitionClass =
    typeof window !== 'undefined'
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : null;

  const isSupported = Boolean(SpeechRecognitionClass);

  useEffect(() => {
    if (!SpeechRecognitionClass) return;

    try {
      const recognition = new SpeechRecognitionClass();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'fr-FR';

      recognition.onstart = () => {
        setState('listening');
        setError(null);
      };

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        if (currentTranscript) {
          setTranscript(currentTranscript);
          onResultRef.current(currentTranscript);
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'no-speech' || event.error === 'aborted') {
          setState('idle');
        } else {
          setError(`Erreur micro : ${event.error}`);
          setState('error');
        }
      };

      recognition.onend = () => {
        setState('idle');
      };

      recognitionRef.current = recognition;
    } catch (err: any) {
      console.warn('SpeechRecognition init failed:', err);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          /* ignore */
        }
      }
    };
  }, [SpeechRecognitionClass]);

  const startListening = useCallback(async () => {
    if (!recognitionRef.current) return;
    try {
      setTranscript('');
      setError(null);
      recognitionRef.current.start();
    } catch (e: any) {
      // If already started, ignore or abort and retry
      try {
        recognitionRef.current.abort();
        recognitionRef.current.start();
      } catch {
        setError(e?.message ?? 'Micro indisponible');
        setState('error');
      }
    }
  }, []);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch {
      /* ignore */
    }
  }, []);

  const cancel = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.abort();
    } catch {
      /* ignore */
    }
    setState('idle');
  }, []);

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
