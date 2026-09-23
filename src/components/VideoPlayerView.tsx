import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Platform,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { useVideoPlayer, VideoView, VideoContentFit, AudioTrack, SubtitleTrack, ContentType } from 'expo-video';
import { useEvent } from 'expo';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '../constants/theme';
import { resolveVariantUrl, resolvePlayableStreamUrl } from '../api/hls';

interface VideoPlayerViewProps {
  streamUrl: string;
  title: string;
  subtitle?: string;
  initialTime?: number;
  isLive?: boolean;
  /** true si la source est un téléchargement local (fichier ou serveur 127.0.0.1) */
  isLocalFile?: boolean;
  onClose: () => void;
  onProgressUpdate?: (currentTime: number, duration: number) => void;
  /** Durée attendue en secondes (fournie par les métadonnées hors-ligne) */
  expectedDuration?: number;
}

type SettingsTab = 'quality' | 'speed' | 'audio';

const SETTINGS_TABS: { id: SettingsTab; label: string }[] = [
  { id: 'quality', label: 'Qualité' },
  { id: 'speed', label: 'Vitesse' },
  { id: 'audio', label: 'Audio' },
];

const SPEED_OPTIONS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const totalSec = Math.floor(seconds);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
};

const formatSubtitleTrackInfo = (track: SubtitleTrack) => {
  const raw = `${track.label || ''} ${track.name || ''} ${track.language || ''}`.toLowerCase();
  const isForced = raw.includes('forced') || raw.includes('forcé');
  if (raw.includes('french') || raw.includes('français') || track.language === 'fr' || track.language === 'fre') {
    return isForced
      ? { title: 'Français (Forcé)', description: 'Traductions des passages étrangers uniquement', badge: 'FORCÉ' }
      : { title: 'Français (Complet)', description: 'Tous les dialogues sous-titrés en français', badge: 'COMPLET' };
  }
  if (raw.includes('english') || raw.includes('anglais') || track.language === 'en' || track.language === 'eng') {
    return isForced
      ? { title: 'Anglais (Forcé)', description: 'Passages étrangers traduits en anglais', badge: 'FORCÉ' }
      : { title: 'Anglais (English)', description: 'Tous les dialogues sous-titrés en anglais', badge: 'VO' };
  }
  return {
    title: track.label || track.name || `Sous-titre (${track.language?.toUpperCase() || 'SUB'})`,
    description: `Langue : ${track.language ? track.language.toUpperCase() : 'Non spécifié'}`,
    badge: track.language ? track.language.toUpperCase() : 'SUB',
  };
};

const formatAudioTrackInfo = (track: AudioTrack) => {
  const raw = `${track.label || ''} ${track.name || ''} ${track.language || ''}`.toLowerCase();
  if (raw.includes('french') || raw.includes('français') || track.language === 'fr' || track.language === 'fre') {
    return { title: 'Français (VF)', description: 'Version française doublée', badge: 'VF' };
  }
  if (raw.includes('english') || raw.includes('anglais') || track.language === 'en' || track.language === 'eng') {
    return { title: 'Anglais (VO)', description: 'Version originale anglaise', badge: 'VO' };
  }
  return {
    title: track.label || track.name || `Piste (${track.language?.toUpperCase() || 'AUDIO'})`,
    description: `Langue : ${track.language ? track.language.toUpperCase() : 'Non spécifié'}`,
    badge: track.language ? track.language.toUpperCase() : 'AUDIO',
  };
};

const haptic = (style: Haptics.ImpactFeedbackStyle) => {
  try {
    Haptics.impactAsync(style);
  } catch (_) {}
};

export const VideoPlayerView: React.FC<VideoPlayerViewProps> = ({
  streamUrl,
  title,
  subtitle,
  initialTime = 0,
  isLive = false,
  isLocalFile: isLocalFileProp,
  expectedDuration,
  onClose,
  onProgressUpdate,
}) => {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isLandscapeWindow = windowWidth > windowHeight;

  const [controlsVisible, setControlsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(isLandscapeWindow);
  const [contentFit, setContentFit] = useState<VideoContentFit>('contain');
  const [showSettings, setShowSettings] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>('quality');

  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [selectedQuality, setSelectedQuality] = useState('Source');

  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubValue, setScrubValue] = useState(0);
  const [currentTimeState, setCurrentTimeState] = useState(initialTime);

  // Verrouillage de l'affichage pendant la recherche réseau asynchrone (évite le snap-back à 0:22)
  const isSeekingRef = useRef(false);
  const seekTargetRef = useRef<number | null>(null);
  const seekTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const videoViewRef = useRef<any>(null);
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const controlsOpacity = useRef(new Animated.Value(1)).current;
  const sheetSlideAnim = useRef(new Animated.Value(380)).current;
  const sheetFadeAnim = useRef(new Animated.Value(0)).current;
  const playBtnScale = useRef(new Animated.Value(1)).current;

  // Glissé vertical des barres
  const topBarSlide = controlsOpacity.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] });
  const bottomBarSlide = controlsOpacity.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });

  // Fondu du contenu à chaque changement d'onglet réglages
  const tabFade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!showSettings) return;
    tabFade.setValue(0);
    Animated.timing(tabFade, { toValue: 1, duration: 180, useNativeDriver: true }).start();
  }, [activeSettingsTab, showSettings, tabFade]);

  // ── Source HLS + repli variante ──────────────────────────────────────────
  // Fichier hors-ligne local : pas de repli réseau, messages dédiés.
  // (fichier direct ou servi via le serveur HTTP local 127.0.0.1)
  const isLocalFile =
    isLocalFileProp ?? (streamUrl.startsWith('file:') || streamUrl.includes('127.0.0.1') || streamUrl.endsWith('.mp4'));

  // Résolution synchrone immédiate (0ms) pour les séries finepulfe (ex: Malcolm)
  // Permet de démarrer directement sur la variante 720p (durée exacte 22:34 et VF/VO muxées)
  const initialUri = useMemo(() => {
    if (!isLocalFile && streamUrl.includes('finepulfe.xyz') && /\/tv\/[^\/]+\/S\d+\/E\d+\/master\.m3u8/i.test(streamUrl)) {
      return streamUrl.replace(/\/master\.m3u8$/i, '/720p/playlist.m3u8');
    }
    return streamUrl;
  }, [streamUrl, isLocalFile]);

  const [activeUri, setActiveUri] = useState(initialUri);
  const [fallbackTried, setFallbackTried] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [loadTimedOut, setLoadTimedOut] = useState(false);

  useEffect(() => {
    setActiveUri(initialUri);
    setFallbackTried(false);
    setUsingFallback(false);
    setLoadTimedOut(false);
    setIsRetrying(false);
  }, [initialUri]);

  const videoSource = useMemo(
    () => ({
      uri: activeUri,
      contentType: (activeUri.includes('.m3u8') ? 'hls' : 'auto') as ContentType,
    }),
    [activeUri]
  );

  const player = useVideoPlayer(videoSource, p => {
    try {
      p.loop = false;
      // Tolérance de 2s : accroche le keyframe le plus proche instantanément sans bloquer le décodeur HLS
      p.seekTolerance = { toleranceBefore: 2, toleranceAfter: 2 };
    } catch (e) {
      console.warn('Error setup player:', e);
    }
  });

  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player?.playing ?? false });
  const { status, error } = useEvent(player, 'statusChange', { status: player?.status ?? 'idle' });

  const didStartRef = useRef(false);
  useEffect(() => {
    if (status === 'readyToPlay' && player && !didStartRef.current) {
      didStartRef.current = true;
      try {
        if (initialTime > 0) player.currentTime = initialTime;
        player.play();
      } catch (e) {
        console.warn('Error start player:', e);
      }
    }
  }, [status, player, initialTime]);

  useEffect(() => {
    setLoadTimedOut(false);
    didStartRef.current = false;
    if (status !== 'loading') return;
    const t = setTimeout(() => setLoadTimedOut(true), 30000);
    return () => clearTimeout(t);
  }, [status, streamUrl, activeUri]);

  useEffect(() => {
    if (isLocalFile || status !== 'error' || fallbackTried || usingFallback) {
      // Fichier local : pas de repli réseau possible, on affiche l'erreur telle quelle.
      if (isLocalFile && status === 'error' && !fallbackTried) setFallbackTried(true);
      return;
    }
    setFallbackTried(true);
    let alive = true;
    (async () => {
      const variant = await resolveVariantUrl(streamUrl);
      if (!alive || !variant || variant === activeUri) return;
      setUsingFallback(true);
      setLoadTimedOut(false);
      didStartRef.current = false;
      setActiveUri(variant);
      try {
        await player.replaceAsync({ uri: variant, contentType: 'hls' as const });
        player.play();
      } catch (_) {}
    })();
    return () => {
      alive = false;
    };
  }, [status, fallbackTried, usingFallback, streamUrl, activeUri, player]);

  // Diagnostic : log l'erreur native des fichiers hors-ligne (cause exacte).
  useEffect(() => {
    if (status === 'error' && isLocalFile) {
      console.warn(
        'Offline playback failed:',
        activeUri,
        '| native:',
        (error as { message?: string } | null)?.message ?? error
      );
    }
  }, [status, isLocalFile, activeUri, error]);

  const handleRetry = useCallback(async () => {
    setLoadTimedOut(false);
    setIsRetrying(true);
    didStartRef.current = false;
    try {
      if (isLocalFile) {
        // Fichier local : simple re-tentative, aucune résolution réseau.
        await player.replaceAsync({
          uri: activeUri,
          contentType: (activeUri.includes('.m3u8') ? 'hls' : 'auto') as ContentType,
        });
        player.play();
      } else {
        const playable = await resolvePlayableStreamUrl(streamUrl);
        if (playable !== activeUri) setActiveUri(playable);
        await player.replaceAsync({ uri: playable, contentType: 'hls' as const });
        player.play();
      }
    } catch {
      try {
        player.play();
      } catch (_) {}
    } finally {
      setTimeout(() => setIsRetrying(false), 1000);
    }
  }, [player, streamUrl, activeUri, isLocalFile]);

  // ── Pistes ───────────────────────────────────────────────────────────────
  const { availableAudioTracks } = useEvent(player, 'availableAudioTracksChange', {
    availableAudioTracks: player?.availableAudioTracks ?? [],
  });
  const { audioTrack } = useEvent(player, 'audioTrackChange', {
    audioTrack: player?.audioTrack ?? null,
  });
  const { availableSubtitleTracks } = useEvent(player, 'availableSubtitleTracksChange', {
    availableSubtitleTracks: player?.availableSubtitleTracks ?? [],
  });
  const { subtitleTrack } = useEvent(player, 'subtitleTrackChange', {
    subtitleTrack: player?.subtitleTrack ?? null,
  });
  const { videoTrack } = useEvent(player, 'videoTrackChange', {
    videoTrack: player?.videoTrack ?? null,
  });

  const detectedResolution = useMemo(() => {
    const h = videoTrack?.size?.height ?? 0;
    const w = videoTrack?.size?.width ?? 0;
    if (h >= 2160 || w >= 3840) return { label: '4K Ultra HD', detail: `${w} × ${h}`, badge: '4K' };
    if (h >= 1080 || w >= 1920) return { label: '1080p Full HD', detail: `${w} × ${h}`, badge: '1080p' };
    if (h >= 720 || w >= 1280) return { label: '720p HD', detail: `${w} × ${h}`, badge: '720p' };
    if (h > 0) return { label: `${h}p`, detail: `${w} × ${h}`, badge: `${h}p` };
    return { label: 'Qualité source', detail: 'Détection en cours', badge: 'HD' };
  }, [videoTrack]);

  const uniqueSubtitleTracks = useMemo(() => {
    const seen = new Set<string>();
    return availableSubtitleTracks.filter(t => {
      const info = formatSubtitleTrackInfo(t);
      const key = `${info.title.toLowerCase()}_${t.language?.toLowerCase() || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [availableSubtitleTracks]);

  const uniqueAudioTracks = useMemo(() => {
    const seen = new Set<string>();
    return availableAudioTracks.filter(t => {
      const info = formatAudioTrackInfo(t);
      const key = `${info.title.toLowerCase()}_${t.language?.toLowerCase() || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [availableAudioTracks]);

  // ── Orientation / rotation automatique / auto-hide ───────────────────────
  // Réagit immédiatement aux changements de dimensions de la fenêtre (rotation physique du téléphone)
  useEffect(() => {
    setIsFullscreen(isLandscapeWindow);
  }, [isLandscapeWindow]);

  useEffect(() => {
    let isMounted = true;
    // Déverrouille et autorise toutes les orientations pour permettre la rotation fluide au gyroscope
    ScreenOrientation.unlockAsync().catch(() => {});
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.DEFAULT).catch(() => {});

    // Détecte l'orientation initiale
    ScreenOrientation.getOrientationAsync().then(o => {
      if (!isMounted) return;
      const isLandscape =
        o === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
        o === ScreenOrientation.Orientation.LANDSCAPE_RIGHT;
      setIsFullscreen(isLandscape || isLandscapeWindow);
    }).catch(() => {});

    // Bascule automatiquement en plein écran paysage ou portrait selon l'orientation physique du téléphone
    const subscription = ScreenOrientation.addOrientationChangeListener(event => {
      if (!isMounted) return;
      const o = event.orientationInfo.orientation;
      const isLandscape =
        o === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
        o === ScreenOrientation.Orientation.LANDSCAPE_RIGHT;
      setIsFullscreen(isLandscape);
    });

    return () => {
      isMounted = false;
      subscription.remove();
      try {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      } catch (_) {}
    };
  }, [isLandscapeWindow]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (player && !isScrubbing) {
        const curr = player.currentTime;
        if (isSeekingRef.current) {
          // Pendant le chargement du nouveau segment distant, on attend que le lecteur
          // ait réellement atteint la position demandée avant de synchroniser le curseur
          if (seekTargetRef.current !== null && Math.abs(curr - seekTargetRef.current) < 2.5) {
            isSeekingRef.current = false;
            seekTargetRef.current = null;
            setCurrentTimeState(curr);
            if (onProgressUpdate && player.duration > 0) onProgressUpdate(curr, player.duration);
          }
        } else {
          setCurrentTimeState(curr);
          if (onProgressUpdate && player.duration > 0) onProgressUpdate(curr, player.duration);
        }
      }
    }, 500);
    return () => clearInterval(interval);
  }, [player, isScrubbing, onProgressUpdate]);

  const resetHideTimer = useCallback(() => {
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    if (isPlaying) {
      hideControlsTimer.current = setTimeout(() => setControlsVisible(false), 3500);
    }
  }, [isPlaying]);

  useEffect(() => {
    resetHideTimer();
    return () => {
      if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    };
  }, [controlsVisible, isPlaying, resetHideTimer]);

  useEffect(() => {
    Animated.timing(controlsOpacity, {
      toValue: controlsVisible ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [controlsVisible, controlsOpacity]);

  const toggleControls = () => {
    setControlsVisible(prev => {
      if (!prev) resetHideTimer();
      return !prev;
    });
  };

  // ── Actions ──────────────────────────────────────────────────────────────
  const togglePlayPause = () => {
    haptic(Haptics.ImpactFeedbackStyle.Medium);
    Animated.sequence([
      Animated.timing(playBtnScale, { toValue: 0.88, duration: 80, useNativeDriver: true }),
      Animated.spring(playBtnScale, { toValue: 1, speed: 20, bounciness: 9, useNativeDriver: true }),
    ]).start();
    if (!player) return;
    try {
      if (player.playing) player.pause();
      else player.play();
    } catch (e) {
      console.warn('Erreur play/pause:', e);
    }
    resetHideTimer();
  };

  const seekBy = (seconds: number) => {
    haptic(Haptics.ImpactFeedbackStyle.Light);
    if (!player) return;
    try {
      const target = Math.max(0, Math.min(duration || 99999, currentTimeState + seconds));
      isSeekingRef.current = true;
      seekTargetRef.current = target;
      setCurrentTimeState(target);
      if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);
      seekTimeoutRef.current = setTimeout(() => {
        isSeekingRef.current = false;
        seekTargetRef.current = null;
      }, 3000);
      player.seekBy(seconds);
    } catch (e) {
      console.warn('Erreur seekBy:', e);
    }
    resetHideTimer();
  };

  const toggleFullscreen = async () => {
    haptic(Haptics.ImpactFeedbackStyle.Medium);
    try {
      if (!isFullscreen) {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
        setIsFullscreen(true);
      } else {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        setIsFullscreen(false);
        // Réactive la rotation libre au gyroscope après le retour en portrait
        setTimeout(() => {
          ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.DEFAULT).catch(() => {});
        }, 500);
      }
    } catch (e) {
      console.warn('Erreur orientation plein écran:', e);
      setIsFullscreen(prev => !prev);
    }
    resetHideTimer();
  };

  const handleStartPiP = async () => {
    haptic(Haptics.ImpactFeedbackStyle.Light);
    try {
      await videoViewRef.current?.startPictureInPicture?.();
    } catch (e) {
      console.warn('PiP non supporté:', e);
    }
    resetHideTimer();
  };

  const toggleContentFit = () => {
    haptic(Haptics.ImpactFeedbackStyle.Light);
    setContentFit(prev => (prev === 'contain' ? 'cover' : 'contain'));
    resetHideTimer();
  };

  const openSettings = (tab?: SettingsTab) => {
    haptic(Haptics.ImpactFeedbackStyle.Light);
    if (tab) setActiveSettingsTab(tab);
    setShowSettings(true);
    sheetSlideAnim.setValue(380);
    sheetFadeAnim.setValue(0);
    Animated.parallel([
      Animated.spring(sheetSlideAnim, { toValue: 0, speed: 18, bounciness: 4, useNativeDriver: true }),
      Animated.timing(sheetFadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  const closeSettings = () => {
    Animated.parallel([
      Animated.timing(sheetSlideAnim, { toValue: 380, duration: 180, useNativeDriver: true }),
      Animated.timing(sheetFadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => setShowSettings(false));
  };

  const changeSpeed = (rate: number) => {
    haptic(Haptics.ImpactFeedbackStyle.Light);
    if (player) {
      try {
        player.playbackRate = rate;
      } catch (e) {
        console.warn('Erreur playbackRate:', e);
      }
      setPlaybackSpeed(rate);
    }
    closeSettings();
    resetHideTimer();
  };

  const changeQuality = (label: string) => {
    haptic(Haptics.ImpactFeedbackStyle.Light);
    setSelectedQuality(label);
    closeSettings();
    resetHideTimer();
  };

  const isCurrentAudioTrack = (track: AudioTrack) => {
    if (!audioTrack) return track.isDefault || false;
    if (track.id && audioTrack.id) return track.id === audioTrack.id;
    return formatAudioTrackInfo(track).title === formatAudioTrackInfo(audioTrack).title;
  };

  const handleSelectAudioTrack = (track: AudioTrack) => {
    haptic(Haptics.ImpactFeedbackStyle.Light);
    if (!player) return;
    try {
      player.audioTrack = track;
    } catch (e) {
      console.warn('Erreur piste audio:', e);
    }
  };

  const isCurrentSubtitleTrack = (track: SubtitleTrack) => {
    if (!subtitleTrack) return false;
    if (track.id && subtitleTrack.id) return track.id === subtitleTrack.id;
    return formatSubtitleTrackInfo(track).title === formatSubtitleTrackInfo(subtitleTrack).title;
  };

  const handleSelectSubtitleTrack = (track: SubtitleTrack | null) => {
    haptic(Haptics.ImpactFeedbackStyle.Light);
    if (!player) return;
    try {
      player.subtitleTrack = track;
    } catch (e) {
      console.warn('Erreur sous-titres:', e);
    }
  };

  const handleExit = async () => {
    try {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    } catch (_) {}
    try {
      player?.pause();
    } catch (_) {}
    onClose();
  };

  // ── États dérivés ────────────────────────────────────────────────────────
  const rawDuration = player?.duration ?? 0;
  const isLocalPlayback = activeUri.startsWith('file:');
  // Évite que la valeur 0xFFFFFFFF (~24h 51m = 89478s) ou 0 ne vienne corrompre le slider
  const duration = useMemo(() => {
    if (expectedDuration && expectedDuration > 0) {
      if (rawDuration <= 0 || rawDuration > 72000) return expectedDuration;
    }
    if (isLocalPlayback && rawDuration > 72000) {
      return expectedDuration && expectedDuration > 0 ? expectedDuration : 0;
    }
    return rawDuration;
  }, [rawDuration, expectedDuration, isLocalPlayback]);
  const isError = ((status === 'error' && fallbackTried) || loadTimedOut) && !isRetrying;
  const isLoading =
    ((status === 'loading' || (status === 'error' && !fallbackTried)) || isRetrying) && !loadTimedOut;
  const playerErrorMsg =
    (error as { message?: string } | null)?.message ??
    (loadTimedOut ? 'Délai dépassé sans image. Vérifiez la connexion.' : '');
  // Pas de badge DIRECT sur une erreur : durée inconnue ≠ live.
  const live = isLive || (player?.isLive === true && status !== 'error');
  const shownTime = isScrubbing ? scrubValue : currentTimeState;

  const topPad = Math.max(insets.top, Platform.OS === 'ios' ? (isFullscreen || isLandscapeWindow ? 16 : 44) : 20);
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'ios' ? (isFullscreen || isLandscapeWindow ? 16 : 20) : 12);
  const sidePad = Math.max(insets.left, insets.right, 20);

  return (
    <View style={styles.container}>
      <StatusBar hidden={isFullscreen || !controlsVisible} backgroundColor={THEME.colors.background} />

      <TouchableWithoutFeedback onPress={toggleControls}>
        <View style={styles.videoWrapper}>
          <VideoView
            ref={videoViewRef}
            player={player}
            style={styles.video}
            contentFit={contentFit}
            nativeControls={false}
            allowsPictureInPicture
            fullscreenOptions={{ enable: false }}
          />

          {isLoading && (
            <View style={styles.stateOverlay}>
              <ActivityIndicator size="large" color={THEME.colors.primary} />
              <Text style={styles.stateText}>Chargement…</Text>
            </View>
          )}

          {isError && (
            <View style={styles.stateOverlay}>
              <View style={styles.errorIcon}>
                <Ionicons name="alert-circle-outline" size={30} color={THEME.colors.primary} />
              </View>
              <Text style={styles.errorTitle}>Lecture impossible</Text>
              {isLocalPlayback && (
                <Text style={[styles.errorMsg, { textAlign: 'center', paddingHorizontal: 24 }]}>
                  Fichier hors-ligne illisible — supprimez-le et retéléchargez-le en WiFi.
                </Text>
              )}
              {!!playerErrorMsg && <Text style={styles.errorMsg} numberOfLines={3}>{playerErrorMsg}</Text>}
              <TouchableOpacity style={styles.retryBtn} onPress={handleRetry} activeOpacity={0.85}>
                <Ionicons name="refresh" size={16} color={THEME.colors.background} />
                <Text style={styles.retryText}>Réessayer</Text>
              </TouchableOpacity>
            </View>
          )}

          <Animated.View
            style={[styles.controlsOverlay, { opacity: controlsOpacity }]}
            pointerEvents={controlsVisible ? 'auto' : 'none'}
          >
            <LinearGradient
              colors={['rgba(9,9,15,0.92)', 'rgba(9,9,15,0.45)', 'transparent']}
              style={[styles.topGradient, { height: topPad + 96 }]}
            />
            <LinearGradient
              colors={['transparent', 'rgba(9,9,15,0.5)', 'rgba(9,9,15,0.95)']}
              style={[styles.bottomGradient, { height: bottomPad + 168 }]}
            />

            {/* ── Barre haute ── */}
            <Animated.View
              style={[
                styles.topBar,
                {
                  paddingTop: topPad,
                  paddingHorizontal: isFullscreen || isLandscapeWindow ? sidePad : THEME.spacing.lg,
                  transform: [{ translateY: topBarSlide }],
                },
              ]}
            >
              <TouchableOpacity style={styles.glassBtn} onPress={handleExit} activeOpacity={0.8}>
                <Ionicons name="close" size={20} color={THEME.colors.textPrimary} />
              </TouchableOpacity>

              <View style={styles.titleBox}>
                <Text style={styles.title} numberOfLines={1}>{title}</Text>
                {!!subtitle && (
                  <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
                )}
              </View>

              {live ? (
                <View style={styles.livePill}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>DIRECT</Text>
                </View>
              ) : (
                <TouchableOpacity style={styles.qualityPill} onPress={() => openSettings('quality')} activeOpacity={0.8}>
                  <Text style={styles.qualityText}>
                    {selectedQuality === 'Source' ? detectedResolution.badge : selectedQuality}
                  </Text>
                  <Ionicons name="chevron-down" size={12} color={THEME.colors.textMuted} />
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.glassBtn} onPress={() => openSettings('quality')} activeOpacity={0.8}>
                <Ionicons name="settings-outline" size={19} color={THEME.colors.textPrimary} />
              </TouchableOpacity>
            </Animated.View>

            {/* ── Contrôles centraux ── */}
            <View style={styles.centerControls}>
              {!live && (
                <TouchableOpacity style={styles.seekBtn} onPress={() => seekBy(-10)} activeOpacity={0.8}>
                  <Ionicons name="play-back" size={22} color={THEME.colors.textPrimary} />
                  <Text style={styles.seekLabel}>10s</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={togglePlayPause} activeOpacity={1}>
                <Animated.View style={[styles.playBtn, { transform: [{ scale: playBtnScale }] }]}>
                  <Ionicons
                    name={isPlaying ? 'pause' : 'play'}
                    size={34}
                    color={THEME.colors.background}
                    style={!isPlaying ? { marginLeft: 4 } : undefined}
                  />
                </Animated.View>
              </TouchableOpacity>
              {!live && (
                <TouchableOpacity style={styles.seekBtn} onPress={() => seekBy(10)} activeOpacity={0.8}>
                  <Ionicons name="play-forward" size={22} color={THEME.colors.textPrimary} />
                  <Text style={styles.seekLabel}>10s</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* ── Barre basse ── */}
            <Animated.View
              style={[
                styles.bottomBar,
                {
                  paddingBottom: bottomPad,
                  paddingHorizontal: isFullscreen || isLandscapeWindow ? sidePad : THEME.spacing.lg,
                  transform: [{ translateY: bottomBarSlide }],
                },
              ]}
            >
              {!live && duration > 0 && (
                <View style={styles.scrubRow}>
                  <Text style={styles.timeText}>{formatTime(shownTime)}</Text>
                  <Slider
                    style={styles.slider}
                    minimumValue={0}
                    maximumValue={duration}
                    value={shownTime}
                    onValueChange={val => {
                      setIsScrubbing(true);
                      setScrubValue(val);
                    }}
                    onSlidingComplete={val => {
                      setIsScrubbing(false);
                      setCurrentTimeState(val);
                      isSeekingRef.current = true;
                      seekTargetRef.current = val;
                      if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);
                      seekTimeoutRef.current = setTimeout(() => {
                        isSeekingRef.current = false;
                        seekTargetRef.current = null;
                      }, 3000);

                      if (player) {
                        try {
                          player.currentTime = val;
                        } catch (e) {
                          console.warn('Erreur seek slider:', e);
                        }
                      }
                      resetHideTimer();
                    }}
                    minimumTrackTintColor={THEME.colors.primary}
                    maximumTrackTintColor="rgba(255,255,255,0.22)"
                    thumbTintColor={THEME.colors.primary}
                  />
                  <Text style={styles.timeText}>{formatTime(duration)}</Text>
                </View>
              )}

              <View style={styles.actionsRow}>
                <TouchableOpacity style={styles.glassBtnSm} onPress={() => openSettings('audio')} activeOpacity={0.8}>
                  <Ionicons name="chatbubble-ellipses-outline" size={17} color={THEME.colors.textPrimary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.speedPill} onPress={() => openSettings('speed')} activeOpacity={0.8}>
                  <Text style={styles.speedText}>{playbackSpeed}x</Text>
                </TouchableOpacity>
                <View style={{ flex: 1 }} />
                <TouchableOpacity style={styles.glassBtnSm} onPress={toggleContentFit} activeOpacity={0.8}>
                  <Ionicons
                    name={contentFit === 'contain' ? 'scan-outline' : 'crop-outline'}
                    size={17}
                    color={THEME.colors.textPrimary}
                  />
                </TouchableOpacity>
                <TouchableOpacity style={styles.glassBtnSm} onPress={toggleFullscreen} activeOpacity={0.8}>
                  <Ionicons
                    name={isFullscreen ? 'contract-outline' : 'expand-outline'}
                    size={17}
                    color={THEME.colors.textPrimary}
                  />
                </TouchableOpacity>
              </View>
            </Animated.View>
          </Animated.View>
        </View>
      </TouchableWithoutFeedback>

      {/* ── Bottom sheet réglages ── */}
      {showSettings && (
        <Animated.View style={[styles.sheetOverlay, { opacity: sheetFadeAnim }]}>
          <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={closeSettings} />
          <Animated.View
            style={[
              styles.sheet,
              { transform: [{ translateY: sheetSlideAnim }], paddingBottom: Math.max(insets.bottom + 16, 24) },
            ]}
          >
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Réglages</Text>
              <TouchableOpacity style={styles.sheetClose} onPress={closeSettings} activeOpacity={0.8}>
                <Ionicons name="close" size={18} color={THEME.colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.segmented}>
              {SETTINGS_TABS.map(tab => {
                const active = activeSettingsTab === tab.id;
                const label = tab.id === 'speed' ? `Vitesse · ${playbackSpeed}x` : tab.label;
                return (
                  <TouchableOpacity
                    key={tab.id}
                    style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                    onPress={() => {
                      haptic(Haptics.ImpactFeedbackStyle.Light);
                      setActiveSettingsTab(tab.id);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.segmentText, active && styles.segmentTextActive]} numberOfLines={1}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Animated.View style={{ opacity: tabFade, flexShrink: 1 }}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetScroll}>
              {activeSettingsTab === 'quality' && (
                <View style={styles.section}>
                  <OptionRow
                    index={0}
                    selected={selectedQuality === 'Source'}
                    title={`${detectedResolution.label} · Source`}
                    description={detectedResolution.detail}
                    badge={detectedResolution.badge}
                    onPress={() => changeQuality('Source')}
                  />
                  <OptionRow
                    index={1}
                    selected={selectedQuality === 'Auto'}
                    title="Auto · Adaptatif"
                    description="Ajuste le débit selon la connexion"
                    badge="AUTO"
                    onPress={() => changeQuality('Auto')}
                  />
                  <Text style={styles.sectionLabel}>Affichage</Text>
                  <OptionRow
                    index={2}
                    selected={false}
                    title={contentFit === 'contain' ? 'Format cinéma' : 'Plein écran zoomé'}
                    description="Basculer entre bandes noires et remplissage"
                    badge={contentFit === 'contain' ? 'CINÉ' : 'ZOOM'}
                    onPress={toggleContentFit}
                  />
                  <OptionRow
                    index={3}
                    selected={false}
                    title="Image dans l'image"
                    description="Continuer en fenêtre flottante"
                    badge="PIP"
                    onPress={handleStartPiP}
                  />
                </View>
              )}

              {activeSettingsTab === 'speed' && (
                <View style={styles.speedGrid}>
                  {SPEED_OPTIONS.map((s, i) => (
                    <SpeedCard
                      key={s}
                      index={i}
                      selected={playbackSpeed === s}
                      label={s === 1 ? '1x · Normal' : `${s}x`}
                      onPress={() => changeSpeed(s)}
                    />
                  ))}
                </View>
              )}

              {activeSettingsTab === 'audio' && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Pistes audio ({uniqueAudioTracks.length})</Text>
                  {uniqueAudioTracks.length > 0 ? (
                    uniqueAudioTracks.map((track, idx) => {
                      const info = formatAudioTrackInfo(track);
                      return (
                        <OptionRow
                          key={track.id || `${track.language}-${idx}`}
                          index={idx}
                          selected={isCurrentAudioTrack(track)}
                          title={info.title}
                          description={`${info.description}${track.isDefault ? ' · Défaut' : ''}`}
                          badge={info.badge}
                          onPress={() => handleSelectAudioTrack(track)}
                        />
                      );
                    })
                  ) : (
                    <View style={styles.emptyBox}>
                      <Text style={styles.emptyText}>Piste audio principale active.</Text>
                    </View>
                  )}

                  <Text style={[styles.sectionLabel, { marginTop: THEME.spacing.lg }]}>
                    Sous-titres ({uniqueSubtitleTracks.length})
                  </Text>
                  <OptionRow
                    index={0}
                    selected={subtitleTrack === null}
                    title="Désactivés"
                    description="Aucun sous-titre affiché"
                    badge="OFF"
                    onPress={() => handleSelectSubtitleTrack(null)}
                  />
                  {uniqueSubtitleTracks.map((track, idx) => {
                    const info = formatSubtitleTrackInfo(track);
                    return (
                      <OptionRow
                        key={track.id || `${track.language}-${idx}`}
                        index={idx + 1}
                        selected={isCurrentSubtitleTrack(track)}
                        title={info.title}
                        description={info.description}
                        badge={info.badge}
                        onPress={() => handleSelectSubtitleTrack(track)}
                      />
                    );
                  })}
                </View>
              )}
            </ScrollView>
            </Animated.View>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
};

/** Entrée en cascade : fondu + glissé avec délai selon l'index. */
function useStagger(index: number) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 220,
      delay: Math.min(Math.max(index, 0), 12) * 35,
      useNativeDriver: true,
    }).start();
  }, [anim, index]);
  return {
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
  };
}

/** Ligne d'option carte — même langage que le reste de l'app (card, squircle, badge). */
const OptionRow = ({
  index = 0,
  selected,
  title,
  description,
  badge,
  onPress,
}: {
  index?: number;
  selected: boolean;
  title: string;
  description: string;
  badge: string;
  onPress: () => void;
}) => {
  const staggerStyle = useStagger(index);
  return (
  <Animated.View style={staggerStyle}>
  <TouchableOpacity
    style={[styles.optionRow, selected && styles.optionRowSelected]}
    onPress={onPress}
    activeOpacity={0.8}
  >
    <View style={styles.optionLeft}>
      <Ionicons
        name={selected ? 'checkmark-circle' : 'ellipse-outline'}
        size={20}
        color={selected ? THEME.colors.primary : THEME.colors.textMuted}
      />
      <View style={styles.optionTexts}>
        <Text style={[styles.optionTitle, selected && styles.optionTitleSelected]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.optionDesc} numberOfLines={2}>{description}</Text>
      </View>
    </View>
    <View style={[styles.badge, selected && styles.badgeSelected]}>
      <Text style={[styles.badgeText, selected && styles.badgeTextSelected]}>{badge}</Text>
    </View>
  </TouchableOpacity>
  </Animated.View>
  );
};

/** Carte de vitesse avec entrée en cascade. */
const SpeedCard = ({
  index,
  selected,
  label,
  onPress,
}: {
  index: number;
  selected: boolean;
  label: string;
  onPress: () => void;
}) => {
  const staggerStyle = useStagger(index);
  return (
    <Animated.View style={[{ width: '31%' }, staggerStyle]}>
      <TouchableOpacity
        style={[styles.speedCard, { width: '100%' }, selected && styles.speedCardSelected]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <Text style={[styles.speedCardText, selected && styles.speedCardTextSelected]}>
          {label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  videoWrapper: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME.colors.background,
  },
  video: {
    width: '100%',
    height: '100%',
  },

  // ── États chargement / erreur ──
  stateOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: THEME.colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: THEME.spacing.hero,
  },
  stateText: {
    marginTop: THEME.spacing.sm,
    color: THEME.colors.textSecondary,
    fontSize: THEME.typography.sizes.caption,
    fontFamily: THEME.fonts.semibold,
  },
  errorIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: THEME.colors.surfaceActive,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: THEME.spacing.md,
  },
  errorTitle: {
    color: THEME.colors.textPrimary,
    fontSize: THEME.typography.sizes.h3,
    fontFamily: THEME.fonts.extrabold,
  },
  errorMsg: {
    marginTop: THEME.spacing.sm,
    color: THEME.colors.textMuted,
    fontSize: THEME.typography.sizes.caption,
    fontFamily: THEME.fonts.medium,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: THEME.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: THEME.radii.full,
  },
  retryText: {
    color: THEME.colors.background,
    fontSize: THEME.typography.sizes.label,
    fontFamily: THEME.fonts.extrabold,
  },

  // ── Overlay contrôles ──
  controlsOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'space-between',
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },

  // ── Barre haute ──
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: THEME.spacing.lg,
    zIndex: 10,
  },
  titleBox: {
    flex: 1,
  },
  title: {
    color: THEME.colors.textPrimary,
    fontSize: THEME.typography.sizes.h3,
    fontFamily: THEME.fonts.extrabold,
    letterSpacing: THEME.typography.letterSpacing.tight,
  },
  subtitle: {
    marginTop: 2,
    color: THEME.colors.textMuted,
    fontSize: THEME.typography.sizes.small,
    fontFamily: THEME.fonts.semibold,
  },
  glassBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glassBtnSm: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: THEME.radii.full,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME.colors.matchGreen,
  },
  liveText: {
    color: THEME.colors.background,
    fontSize: THEME.typography.sizes.badge,
    fontFamily: THEME.fonts.extrabold,
    letterSpacing: THEME.typography.letterSpacing.wide,
  },
  qualityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: THEME.radii.full,
  },
  qualityText: {
    color: THEME.colors.textPrimary,
    fontSize: THEME.typography.sizes.small,
    fontFamily: THEME.fonts.extrabold,
    letterSpacing: THEME.typography.letterSpacing.wide,
  },

  // ── Centre ──
  centerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
    zIndex: 10,
  },
  seekBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seekLabel: {
    color: THEME.colors.textPrimary,
    fontSize: THEME.typography.sizes.badge,
    fontFamily: THEME.fonts.extrabold,
    marginTop: 1,
  },
  playBtn: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: THEME.colors.primary,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Bas ──
  bottomBar: {
    paddingHorizontal: THEME.spacing.lg,
    zIndex: 10,
  },
  scrubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: THEME.spacing.sm,
  },
  slider: {
    flex: 1,
    height: 36,
    marginHorizontal: THEME.spacing.sm,
  },
  timeText: {
    color: THEME.colors.textPrimary,
    fontSize: THEME.typography.sizes.small,
    fontFamily: THEME.fonts.bold,
    minWidth: 44,
    textAlign: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  speedPill: {
    height: 38,
    minWidth: 56,
    paddingHorizontal: 12,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedText: {
    color: THEME.colors.textPrimary,
    fontSize: THEME.typography.sizes.small,
    fontFamily: THEME.fonts.extrabold,
  },

  // ── Bottom sheet ──
  sheetOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 100,
    justifyContent: 'flex-end',
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: THEME.colors.overlayDark,
  },
  sheet: {
    backgroundColor: 'rgba(19,23,32,0.94)',
    borderTopLeftRadius: THEME.radii.xl,
    borderTopRightRadius: THEME.radii.xl,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: THEME.spacing.screen,
    paddingTop: THEME.spacing.sm,
    maxHeight: '78%',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: THEME.colors.surfaceActive,
    marginBottom: THEME.spacing.md,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: THEME.spacing.md,
  },
  sheetTitle: {
    color: THEME.colors.textPrimary,
    fontSize: THEME.typography.sizes.h3,
    fontFamily: THEME.fonts.extrabold,
    letterSpacing: THEME.typography.letterSpacing.tight,
  },
  sheetClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: THEME.colors.surfaceActive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmented: {
    position: 'relative',
    flexDirection: 'row',
    backgroundColor: THEME.colors.searchBar,
    borderRadius: THEME.radii.full,
    borderWidth: 1,
    borderColor: THEME.colors.searchBorder,
    padding: 4,
    marginBottom: THEME.spacing.md,
  },
  segmentBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: THEME.radii.full,
  },
  segmentBtnActive: {
    backgroundColor: THEME.colors.surfaceActive,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
  },
  segmentText: {
    color: THEME.colors.textMuted,
    fontSize: THEME.typography.sizes.small,
    fontFamily: THEME.fonts.semibold,
  },
  segmentTextActive: {
    color: THEME.colors.textPrimary,
    fontFamily: THEME.fonts.bold,
  },
  sheetScroll: {
    paddingBottom: THEME.spacing.lg,
  },
  section: {
    gap: 8,
  },
  sectionLabel: {
    color: THEME.colors.textMuted,
    fontSize: THEME.typography.sizes.small,
    fontFamily: THEME.fonts.semibold,
    marginBottom: 2,
    marginTop: 4,
  },

  // ── Options ──
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.colors.card,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
    borderRadius: THEME.radii.squircle,
    paddingVertical: 13,
    paddingHorizontal: 15,
  },
  optionRowSelected: {
    borderColor: THEME.colors.borderActive,
    backgroundColor: THEME.colors.surfaceActive,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  optionTexts: {
    flex: 1,
  },
  optionTitle: {
    color: THEME.colors.textPrimary,
    fontSize: THEME.typography.sizes.cardTitle,
    fontFamily: THEME.fonts.semibold,
  },
  optionTitleSelected: {
    fontFamily: THEME.fonts.bold,
  },
  optionDesc: {
    marginTop: 2,
    color: THEME.colors.textMuted,
    fontSize: THEME.typography.sizes.small,
    fontFamily: THEME.fonts.medium,
  },
  badge: {
    backgroundColor: THEME.colors.surfaceActive,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: THEME.radii.sm,
    marginLeft: 10,
  },
  badgeSelected: {
    backgroundColor: THEME.colors.primary,
  },
  badgeText: {
    color: THEME.colors.textSecondary,
    fontSize: THEME.typography.sizes.badge,
    fontFamily: THEME.fonts.bold,
    letterSpacing: THEME.typography.letterSpacing.wide,
  },
  badgeTextSelected: {
    color: THEME.colors.background,
    fontFamily: THEME.fonts.extrabold,
  },

  // ── Vitesses ──
  speedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  speedCard: {
    width: '31%',
    paddingVertical: 14,
    borderRadius: THEME.radii.card,
    backgroundColor: THEME.colors.card,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
    alignItems: 'center',
  },
  speedCardSelected: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  speedCardText: {
    color: THEME.colors.textPrimary,
    fontSize: THEME.typography.sizes.cardTitle,
    fontFamily: THEME.fonts.bold,
  },
  speedCardTextSelected: {
    color: THEME.colors.background,
    fontFamily: THEME.fonts.extrabold,
  },

  emptyBox: {
    backgroundColor: THEME.colors.searchBar,
    borderRadius: THEME.radii.card,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
    padding: THEME.spacing.md,
  },
  emptyText: {
    color: THEME.colors.textMuted,
    fontSize: THEME.typography.sizes.caption,
    fontFamily: THEME.fonts.medium,
  },
});
