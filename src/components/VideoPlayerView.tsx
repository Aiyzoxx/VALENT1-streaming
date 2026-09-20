import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Platform,
  StatusBar,
  Modal,
  ScrollView,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useVideoPlayer, VideoView, VideoContentFit, AudioTrack, SubtitleTrack, VideoTrack } from 'expo-video';
import { useEvent } from 'expo';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '../constants/theme';
import { resolveVariantUrl } from '../api/hls';

interface VideoPlayerViewProps {
  streamUrl: string;
  title: string;
  subtitle?: string;
  initialTime?: number;
  isLive?: boolean;
  onClose: () => void;
  onProgressUpdate?: (currentTime: number, duration: number) => void;
}

const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  }
  return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
};

const formatSubtitleTrackInfo = (track: SubtitleTrack) => {
  const raw = `${track.label || ''} ${track.name || ''} ${track.language || ''}`.toLowerCase();
  const isForced = raw.includes('forced') || raw.includes('forcé');

  if (raw.includes('french') || raw.includes('français') || track.language === 'fr' || track.language === 'fre') {
    if (isForced) {
      return {
        title: 'Français (Forcé)',
        description: 'Traductions des passages étrangers uniquement (idéal avec la VF)',
        badge: 'FORCÉ',
      };
    }
    return {
      title: 'Français (Complet)',
      description: 'Tous les dialogues sous-titrés en français',
      badge: 'COMPLET',
    };
  }

  if (raw.includes('english') || raw.includes('anglais') || track.language === 'en' || track.language === 'eng') {
    if (isForced) {
      return {
        title: 'Anglais (Forcé)',
        description: 'Passages en langues étrangères traduits en anglais',
        badge: 'FORCÉ',
      };
    }
    return {
      title: 'Anglais (English)',
      description: 'Tous les dialogues sous-titrés en anglais',
      badge: 'VO',
    };
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
    return {
      title: 'Français (VF)',
      description: 'Version française doublée',
      badge: 'VF',
    };
  }

  if (raw.includes('english') || raw.includes('anglais') || track.language === 'en' || track.language === 'eng') {
    return {
      title: 'Anglais (VO)',
      description: 'Version originale anglaise',
      badge: 'VO',
    };
  }

  return {
    title: track.label || track.name || `Piste (${track.language?.toUpperCase() || 'AUDIO'})`,
    description: `Langue : ${track.language ? track.language.toUpperCase() : 'Non spécifié'}`,
    badge: track.language ? track.language.toUpperCase() : 'AUDIO',
  };
};

export const VideoPlayerView: React.FC<VideoPlayerViewProps> = ({
  streamUrl,
  title,
  subtitle,
  initialTime = 0,
  isLive = false,
  onClose,
  onProgressUpdate,
}) => {
  const insets = useSafeAreaInsets();
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [contentFit, setContentFit] = useState<VideoContentFit>('contain');
  const [showSettings, setShowSettings] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<'speed' | 'quality' | 'audio'>('quality');
  
  // Custom Controls State
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [selectedQuality, setSelectedQuality] = useState<string>('Source');
  const [selectedAudio, setSelectedAudio] = useState<string>('Défaut');
  const [selectedSubtitle, setSelectedSubtitle] = useState<string>('Désactivé');

  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubValue, setScrubValue] = useState(0);
  const [currentTimeState, setCurrentTimeState] = useState(initialTime);

  const videoViewRef = useRef<any>(null);
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Micro-animations Refs
  const controlsOpacity = useRef(new Animated.Value(1)).current;
  const sheetSlideAnim = useRef(new Animated.Value(350)).current;
  const sheetFadeAnim = useRef(new Animated.Value(0)).current;
  const playBtnScale = useRef(new Animated.Value(1)).current;
  const seekBackScale = useRef(new Animated.Value(1)).current;
  const seekFwdScale = useRef(new Animated.Value(1)).current;

  // URI réellement jouée : master par défaut, variante directe en repli
  // si AVPlayer rejette la master (-12646 playlist parse error).
  const [activeUri, setActiveUri] = useState(streamUrl);
  const [fallbackTried, setFallbackTried] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);
  useEffect(() => {
    setActiveUri(streamUrl);
    setFallbackTried(false);
    setUsingFallback(false);
    setLoadTimedOut(false);
  }, [streamUrl]);

  // Source HLS explicite (doc v57: contentType 'hls' requis si pas d'extension standard).
  const videoSource = useMemo(
    () => ({ uri: activeUri, contentType: 'hls' as const }),
    [activeUri]
  );

  // Setup sans play() immédiat : play quand readyToPlay (évite stall AVPlayer).
  const player = useVideoPlayer(videoSource, (p) => {
    try {
      p.loop = false;
    } catch (e) {
      console.warn('Error setup player:', e);
    }
  });

  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player?.playing ?? false });
  const { status, error } = useEvent(player, 'statusChange', { status: player?.status ?? 'idle' });

  // Démarrage + seek initial quand le player est prêt.
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

  // Timeout anti-spinner-infini : si toujours loading après 30s, bascule en erreur.
  const [loadTimedOut, setLoadTimedOut] = useState(false);
  useEffect(() => {
    setLoadTimedOut(false);
    didStartRef.current = false;
    if (status !== 'loading') return;
    const t = setTimeout(() => setLoadTimedOut(true), 30000);
    return () => clearTimeout(t);
  }, [status, streamUrl, activeUri]);

  // Repli automatique : si AVPlayer rejette la master playlist (-12646),
  // bascule une fois sur la variante directe (muxée vidéo + audio).
  useEffect(() => {
    if (status !== 'error' || fallbackTried || usingFallback) return;
    setFallbackTried(true);
    let alive = true;
    (async () => {
      const variant = await resolveVariantUrl(streamUrl);
      if (!alive || !variant) return;
      setUsingFallback(true);
      setLoadTimedOut(false);
      didStartRef.current = false;
      setActiveUri(variant);
      try {
        await player.replaceAsync({ uri: variant, contentType: 'hls' as const });
      } catch (_) {}
    })();
    return () => {
      alive = false;
    };
  }, [status, fallbackTried, usingFallback, streamUrl, player]);

  const handleRetry = useCallback(async () => {
    setLoadTimedOut(false);
    didStartRef.current = false;
    try {
      await player.replaceAsync(videoSource);
    } catch (e) {
      try {
        player.play();
      } catch (_) {}
    }
  }, [player, videoSource]);

  // Pistes audio réelles du flux HLS
  const { availableAudioTracks } = useEvent(player, 'availableAudioTracksChange', {
    availableAudioTracks: player?.availableAudioTracks ?? [],
  });
  const { audioTrack } = useEvent(player, 'audioTrackChange', {
    audioTrack: player?.audioTrack ?? null,
  });

  // Pistes de sous-titres réelles du flux HLS
  const { availableSubtitleTracks } = useEvent(player, 'availableSubtitleTracksChange', {
    availableSubtitleTracks: player?.availableSubtitleTracks ?? [],
  });
  const { subtitleTrack } = useEvent(player, 'subtitleTrackChange', {
    subtitleTrack: player?.subtitleTrack ?? null,
  });

  // Piste vidéo active et résolution réelle détectée
  const { videoTrack } = useEvent(player, 'videoTrackChange', {
    videoTrack: player?.videoTrack ?? null,
  });

  const detectedResolution = useMemo(() => {
    if (videoTrack?.size?.height && videoTrack?.size?.width) {
      const h = videoTrack.size.height;
      const w = videoTrack.size.width;
      if (h >= 2160 || w >= 3840) return { label: '4K Ultra HD', resolution: `${w} × ${h}`, badge: '4K HDR' };
      if (h >= 1080 || w >= 1920) return { label: '1080p Full HD', resolution: `${w} × ${h}`, badge: '1080p' };
      if (h >= 720 || w >= 1280) return { label: '720p Haute Définition', resolution: `${w} × ${h}`, badge: '720p' };
      return { label: `${h}p`, resolution: `${w} × ${h}`, badge: `${h}p` };
    }
    return { label: '1080p Full HD', resolution: '1920 × 1080', badge: '1080p' };
  }, [videoTrack]);

  // Déduplication des sous-titres (élimine les doublons de flux remontés par iOS AVPlayer)
  const uniqueSubtitleTracks = useMemo(() => {
    const seen = new Set<string>();
    const list: SubtitleTrack[] = [];

    for (const track of availableSubtitleTracks) {
      const info = formatSubtitleTrackInfo(track);
      const key = `${info.title.toLowerCase()}_${track.language?.toLowerCase() || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        list.push(track);
      }
    }
    return list;
  }, [availableSubtitleTracks]);

  // Déduplication des pistes audio
  const uniqueAudioTracks = useMemo(() => {
    const seen = new Set<string>();
    const list: AudioTrack[] = [];

    for (const track of availableAudioTracks) {
      const info = formatAudioTrackInfo(track);
      const key = `${info.title.toLowerCase()}_${track.language?.toLowerCase() || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        list.push(track);
      }
    }
    return list;
  }, [availableAudioTracks]);

  // Clean up orientation when unmounting player
  useEffect(() => {
    return () => {
      try {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      } catch (_) {}
    };
  }, []);

  // Update current time state periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (player && !isScrubbing) {
        const curr = player.currentTime;
        setCurrentTimeState(curr);
        if (onProgressUpdate && player.duration > 0) {
          onProgressUpdate(curr, player.duration);
        }
      }
    }, 500);

    return () => clearInterval(interval);
  }, [player, isScrubbing, onProgressUpdate]);

  // Handle auto-hide of controls after 3.5 seconds of inactivity
  const resetHideTimer = useCallback(() => {
    if (hideControlsTimer.current) {
      clearTimeout(hideControlsTimer.current);
    }
    if (isPlaying) {
      hideControlsTimer.current = setTimeout(() => {
        setControlsVisible(false);
      }, 3500);
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
  }, [controlsVisible]);

  const toggleControls = () => {
    setControlsVisible(prev => {
      const next = !prev;
      if (next) resetHideTimer();
      return next;
    });
  };

  const openSettings = (tab?: 'speed' | 'quality' | 'audio') => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_) {}
    if (tab) setActiveSettingsTab(tab);
    setShowSettings(true);
    sheetSlideAnim.setValue(350);
    sheetFadeAnim.setValue(0);
    Animated.parallel([
      Animated.spring(sheetSlideAnim, {
        toValue: 0,
        speed: 18,
        bounciness: 4,
        useNativeDriver: true,
      }),
      Animated.timing(sheetFadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeSettings = () => {
    Animated.parallel([
      Animated.timing(sheetSlideAnim, {
        toValue: 350,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(sheetFadeAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowSettings(false);
    });
  };

  // Play / Pause toggle with spring bounce
  const togglePlayPause = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (_) {}

    Animated.sequence([
      Animated.timing(playBtnScale, {
        toValue: 0.88,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.spring(playBtnScale, {
        toValue: 1,
        speed: 20,
        bounciness: 9,
        useNativeDriver: true,
      }),
    ]).start();

    if (player) {
      try {
        if (player.playing) {
          player.pause();
        } else {
          player.play();
        }
      } catch (e) {
        console.warn('Erreur play/pause:', e);
      }
      resetHideTimer();
    }
  };

  // Seek forward / backward (-10s / +10s) with spring bounce
  const seekBy = (seconds: number) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_) {}

    const targetAnim = seconds < 0 ? seekBackScale : seekFwdScale;
    Animated.sequence([
      Animated.timing(targetAnim, {
        toValue: 0.86,
        duration: 70,
        useNativeDriver: true,
      }),
      Animated.spring(targetAnim, {
        toValue: 1,
        speed: 22,
        bounciness: 6,
        useNativeDriver: true,
      }),
    ]).start();

    if (player) {
      try {
        player.seekBy(seconds);
      } catch (e) {
        console.warn('Erreur seekBy:', e);
      }
      resetHideTimer();
    }
  };

  // Toggle Fullscreen Landscape Mode (Custom UI)
  const toggleFullscreen = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (_) {}

    try {
      if (!isFullscreen) {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
        setIsFullscreen(true);
      } else {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        setIsFullscreen(false);
      }
    } catch (e) {
      console.warn('Erreur orientation plein écran:', e);
      setIsFullscreen(prev => !prev);
    }
    resetHideTimer();
  };

  // Start Picture-in-Picture
  const handleStartPiP = async () => {
    try {
      if (videoViewRef.current?.startPictureInPicture) {
        await videoViewRef.current.startPictureInPicture();
      }
    } catch (e) {
      console.warn('PiP non supporté sur ce device:', e);
    }
  };

  // Cycle aspect ratio
  const toggleContentFit = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_) {}
    setContentFit(prev => (prev === 'contain' ? 'cover' : 'contain'));
    resetHideTimer();
  };

  // Change playback speed
  const changeSpeed = (rate: number) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_) {}
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

  // Change quality
  const changeQuality = (qualityLabel: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_) {}
    setSelectedQuality(qualityLabel);
    closeSettings();
    resetHideTimer();
  };

  // Comparaison et sélection des pistes audio réelles
  const isCurrentAudioTrack = (track: AudioTrack) => {
    if (!audioTrack) return track.isDefault || false;
    if (track.id && audioTrack.id) return track.id === audioTrack.id;
    const trackInfo = formatAudioTrackInfo(track);
    const currInfo = formatAudioTrackInfo(audioTrack);
    return trackInfo.title === currInfo.title;
  };

  const handleSelectAudioTrack = (track: AudioTrack) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_) {}
    if (player) {
      try {
        player.audioTrack = track;
      } catch (e) {
        console.warn('Erreur sélection piste audio:', e);
      }
    }
  };

  // Comparaison et sélection des sous-titres réels
  const isCurrentSubtitleTrack = (track: SubtitleTrack) => {
    if (!subtitleTrack) return false;
    if (track.id && subtitleTrack.id) return track.id === subtitleTrack.id;
    const trackInfo = formatSubtitleTrackInfo(track);
    const currInfo = formatSubtitleTrackInfo(subtitleTrack);
    return trackInfo.title === currInfo.title;
  };

  const handleSelectSubtitleTrack = (track: SubtitleTrack | null) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_) {}
    if (player) {
      try {
        player.subtitleTrack = track;
      } catch (e) {
        console.warn('Erreur sélection sous-titres:', e);
      }
    }
  };

  // Exit player and restore portrait orientation
  const handleExit = async () => {
    try {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    } catch (_) {}
    if (player) {
      try {
        player.pause();
      } catch (_) {}
    }
    onClose();
  };

  const duration = player?.duration ?? 0;
  const isError = status === 'error' || loadTimedOut;
  const isLoading = status === 'loading' && !loadTimedOut;
  const playerErrorMsg =
    (error as { message?: string } | null)?.message ??
    (loadTimedOut ? 'Délai dépassé (30s) sans image. Réseau ou segments injoignables depuis l’iPhone.' : '');

  const SPEED_OPTIONS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

  return (
    <View style={styles.container}>
      <StatusBar hidden={isFullscreen || !controlsVisible} backgroundColor="#000000" />

      <TouchableWithoutFeedback onPress={toggleControls}>
        <View style={styles.videoWrapper}>
          {/* Native video engine without native controls (100% Custom Player UI) */}
          <VideoView
            ref={videoViewRef}
            player={player}
            style={styles.video}
            contentFit={contentFit}
            nativeControls={false}
            allowsPictureInPicture
            fullscreenOptions={{ enable: false }}
          />

          {/* Loading Spinner */}
          {isLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={THEME.colors.primary} />
              <Text style={styles.loadingText}>Chargement du flux HLS...</Text>
            </View>
          )}

          {/* Erreur player (remplace le spinner infini) */}
          {isError && (
            <View style={styles.loadingOverlay}>
              <Ionicons name="alert-circle-outline" size={42} color={THEME.colors.primaryRed} />
              <Text style={[styles.loadingText, { marginTop: 10, textAlign: 'center', paddingHorizontal: 24 }]}>
                Impossible de lire ce flux.{playerErrorMsg ? `\n${playerErrorMsg}` : ''}
              </Text>
              <TouchableOpacity
                style={{ marginTop: 16, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 10, backgroundColor: THEME.colors.primaryRed }}
                onPress={handleRetry}
                activeOpacity={0.85}
              >
                <Text style={{ color: '#09090F', fontFamily: THEME.fonts.extrabold, fontSize: 14 }}>Réessayer</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Custom Player Controls Overlay avec fondu progressif */}
          <Animated.View
            style={[styles.controlsOverlay, { opacity: controlsOpacity }]}
            pointerEvents={controlsVisible ? 'auto' : 'none'}
          >
            {/* Gradient Top */}
            <LinearGradient
              colors={['rgba(7,9,14,0.96)', 'rgba(7,9,14,0.5)', 'transparent']}
              style={[styles.topGradient, { height: Math.max(insets.top, 24) + 110 }]}
            />

            {/* Gradient Bottom */}
            <LinearGradient
              colors={['transparent', 'rgba(7,9,14,0.55)', 'rgba(7,9,14,0.98)']}
              style={[styles.bottomGradient, { height: Math.max(insets.bottom, 20) + 170 }]}
            />

            {/* Barre Supérieure */}
            <View style={[styles.topBar, { paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 44 : 20) }]}>
              <TouchableOpacity style={styles.iconBtn} onPress={handleExit} activeOpacity={0.8}>
                <Ionicons name="chevron-down" size={24} color="#FFFFFF" />
              </TouchableOpacity>

              <View style={styles.titleContainer}>
                <Text style={styles.playerTitle} numberOfLines={1}>
                  {title}
                </Text>
                {subtitle && (
                  <Text style={styles.playerSubtitle} numberOfLines={1}>
                    {subtitle}
                  </Text>
                )}
              </View>

              <View style={styles.topRightActions}>
                {/* Badge LIVE ou HLS */}
                {isLive || player?.isLive ? (
                  <View style={styles.liveIndicator}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveIndicatorText}>DIRECT</Text>
                  </View>
                ) : (
                  /* Sélecteur rapide de qualité */
                  <TouchableOpacity
                    style={styles.qualityPill}
                    onPress={() => openSettings('quality')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.qualityPillText}>
                      {selectedQuality === 'Source' ? detectedResolution.badge : selectedQuality}
                    </Text>
                    <Ionicons name="chevron-down" size={12} color={THEME.colors.primaryRed} />
                  </TouchableOpacity>
                )}

                {/* Bouton PiP */}
                <TouchableOpacity style={styles.iconBtn} onPress={handleStartPiP} activeOpacity={0.8}>
                  <Ionicons name="albums-outline" size={18} color="#FFFFFF" />
                </TouchableOpacity>

                {/* Bouton Options Générales (Qualité, Vitesse, Audio) */}
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => openSettings('speed')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="options-outline" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Contrôles Centraux avec Rebond Élastique Tactile */}
            <View style={styles.centerControls}>
              {!isLive && (
                <TouchableOpacity
                  onPress={() => seekBy(-10)}
                  activeOpacity={0.8}
                >
                  <Animated.View style={[styles.seekButton, { transform: [{ scale: seekBackScale }] }]}>
                    <Ionicons name="play-back" size={24} color="#FFFFFF" />
                    <Text style={styles.seekText}>-10s</Text>
                  </Animated.View>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={togglePlayPause}
                activeOpacity={0.85}
              >
                <Animated.View style={[styles.playPauseBtn, { transform: [{ scale: playBtnScale }] }]}>
                  <Ionicons
                    name={isPlaying ? 'pause' : 'play'}
                    size={36}
                    color="#09090F"
                    style={!isPlaying ? { marginLeft: 4 } : undefined}
                  />
                </Animated.View>
              </TouchableOpacity>

              {!isLive && (
                <TouchableOpacity
                  onPress={() => seekBy(10)}
                  activeOpacity={0.8}
                >
                  <Animated.View style={[styles.seekButton, { transform: [{ scale: seekFwdScale }] }]}>
                    <Ionicons name="play-forward" size={24} color="#FFFFFF" />
                    <Text style={styles.seekText}>+10s</Text>
                  </Animated.View>
                </TouchableOpacity>
              )}
            </View>

            {/* Barre Inférieure */}
            <View
              style={[
                styles.bottomBar,
                {
                  paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 20 : 12),
                  paddingHorizontal: Math.max(insets.left, insets.right, 16),
                },
              ]}
            >
              {/* Scrubber / Slider (si VOD) */}
              {!isLive && duration > 0 && (
                <View style={styles.scrubberRow}>
                  <Text style={styles.timeText}>
                    {formatTime(isScrubbing ? scrubValue : currentTimeState)}
                  </Text>

                  <Slider
                    style={styles.slider}
                    minimumValue={0}
                    maximumValue={duration}
                    value={isScrubbing ? scrubValue : currentTimeState}
                    onValueChange={(val) => {
                      setIsScrubbing(true);
                      setScrubValue(val);
                    }}
                    onSlidingComplete={(val) => {
                      setIsScrubbing(false);
                      if (player) {
                        try {
                          player.currentTime = val;
                        } catch (e) {
                          console.warn('Erreur seek slider:', e);
                        }
                      }
                      resetHideTimer();
                    }}
                    minimumTrackTintColor={THEME.colors.primaryRed}
                    maximumTrackTintColor="rgba(255, 255, 255, 0.22)"
                    thumbTintColor={THEME.colors.primaryRed}
                  />

                  <Text style={styles.timeText}>
                    {formatTime(duration)}
                  </Text>
                </View>
              )}

              {/* Actions inférieures épurées style Netflix / Apple TV */}
              <View style={styles.bottomActionsRow}>
                {/* Pilule Temps Écoulé / Total */}
                <View style={styles.timePill}>
                  <Text style={styles.timePillText}>
                    {formatTime(isScrubbing ? scrubValue : currentTimeState)}
                    <Text style={styles.timePillMuted}> / {formatTime(duration)}</Text>
                  </Text>
                </View>

                <View style={{ flex: 1 }} />

                {/* Bouton Pistes Audio & Sous-Titres */}
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => openSettings('audio')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={18} color="#FFFFFF" />
                </TouchableOpacity>

                {/* Bouton Vitesse */}
                <TouchableOpacity
                  style={styles.speedPillBtn}
                  onPress={() => openSettings('speed')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="speedometer-outline" size={13} color={THEME.colors.primaryRed} style={{ marginRight: 4 }} />
                  <Text style={styles.speedPillText}>{playbackSpeed}x</Text>
                </TouchableOpacity>

                {/* Format d'écran (Ajusté / Rempli) */}
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={toggleContentFit}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={contentFit === 'contain' ? "scan-outline" : "crop-outline"}
                    size={18}
                    color="#FFFFFF"
                  />
                </TouchableOpacity>

                {/* Bascule Plein Écran Paysage */}
                <TouchableOpacity
                  style={[styles.iconBtn, isFullscreen && styles.iconBtnActive]}
                  onPress={toggleFullscreen}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={isFullscreen ? 'contract' : 'expand'}
                    size={18}
                    color="#FFFFFF"
                  />
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        </View>
      </TouchableWithoutFeedback>

      {/* Panneau Réglages Custom (Qualité, Vitesse, Audio) - Overlay animé */}
      {showSettings && (
        <Animated.View style={[styles.settingsOverlay, { opacity: sheetFadeAnim }]}>
          <TouchableOpacity
            style={styles.settingsBackdrop}
            activeOpacity={1}
            onPress={closeSettings}
          />
          <Animated.View
            style={[
              styles.settingsSheet,
              {
                transform: [{ translateY: sheetSlideAnim }],
                paddingBottom: Math.max(insets.bottom + 16, Platform.OS === 'ios' ? 36 : 22),
              },
            ]}
          >
            {/* Header de la feuille de paramètres */}
            <View style={styles.settingsSheetHeader}>
              <View style={styles.settingsSheetTitleRow}>
                <Ionicons name="settings" size={20} color={THEME.colors.primaryRed} />
                <Text style={styles.settingsTitle}>Réglages du Lecteur Custom</Text>
              </View>
              <TouchableOpacity onPress={closeSettings} style={styles.settingsCloseBtn} activeOpacity={0.8}>
                <Ionicons name="close" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* Onglets dans la modale */}
            <View style={styles.modalTabsRow}>
              <TouchableOpacity
                style={[styles.modalTab, activeSettingsTab === 'quality' && styles.modalTabActive]}
                onPress={() => setActiveSettingsTab('quality')}
                activeOpacity={0.8}
              >
                <Text style={[styles.modalTabText, activeSettingsTab === 'quality' && styles.modalTabTextActive]}>
                  Qualité Vidéo
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalTab, activeSettingsTab === 'speed' && styles.modalTabActive]}
                onPress={() => setActiveSettingsTab('speed')}
                activeOpacity={0.8}
              >
                <Text style={[styles.modalTabText, activeSettingsTab === 'speed' && styles.modalTabTextActive]}>
                  Vitesse ({playbackSpeed}x)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalTab, activeSettingsTab === 'audio' && styles.modalTabActive]}
                onPress={() => setActiveSettingsTab('audio')}
                activeOpacity={0.8}
              >
                <Text style={[styles.modalTabText, activeSettingsTab === 'audio' && styles.modalTabTextActive]}>
                  Audio & Langues
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetScroll}>
              {/* Onglet QUALITÉ VIDÉO */}
              {activeSettingsTab === 'quality' && (
                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionHelpText}>
                    Qualité et résolution du flux :
                  </Text>

                  {/* Option 1: Qualité Source Native Détectée */}
                  <TouchableOpacity
                    style={[styles.optionRow, selectedQuality === 'Source' && styles.optionRowSelected]}
                    onPress={() => changeQuality('Source')}
                    activeOpacity={0.8}
                  >
                    <View style={styles.optionLeft}>
                      <Ionicons
                        name={selectedQuality === 'Source' ? "checkmark-circle" : "ellipse-outline"}
                        size={20}
                        color={selectedQuality === 'Source' ? THEME.colors.primary : THEME.colors.textMuted}
                      />
                      <View style={{ marginLeft: 8 }}>
                        <Text style={[styles.optionText, selectedQuality === 'Source' && styles.optionTextSelected]}>
                          {detectedResolution.label} (Source native)
                        </Text>
                        <Text style={styles.trackSubtext}>
                          Résolution master {detectedResolution.resolution} • Image optimale non compressée
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.optBadge, selectedQuality === 'Source' && styles.optBadgeSelected]}>
                      <Text style={[styles.optBadgeText, selectedQuality === 'Source' && styles.optBadgeTextSelected]}>
                        {detectedResolution.badge}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Option 2: Auto / Adaptatif HLS */}
                  <TouchableOpacity
                    style={[styles.optionRow, selectedQuality === 'Auto' && styles.optionRowSelected]}
                    onPress={() => changeQuality('Auto')}
                    activeOpacity={0.8}
                  >
                    <View style={styles.optionLeft}>
                      <Ionicons
                        name={selectedQuality === 'Auto' ? "checkmark-circle" : "ellipse-outline"}
                        size={20}
                        color={selectedQuality === 'Auto' ? THEME.colors.primary : THEME.colors.textMuted}
                      />
                      <View style={{ marginLeft: 8 }}>
                        <Text style={[styles.optionText, selectedQuality === 'Auto' && styles.optionTextSelected]}>
                          Auto (Adaptatif HLS)
                        </Text>
                        <Text style={styles.trackSubtext}>
                          Ajuste automatiquement le débit selon votre connexion (Wi-Fi / 4G / 5G)
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.optBadge, selectedQuality === 'Auto' && styles.optBadgeSelected]}>
                      <Text style={[styles.optBadgeText, selectedQuality === 'Auto' && styles.optBadgeTextSelected]}>
                        AUTO
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Option 3: Mode de cadrage d'écran */}
                  <Text style={[styles.sectionHelpText, { marginTop: 14 }]}>
                    Format d'affichage de l'image :
                  </Text>
                  <TouchableOpacity
                    style={styles.optionRow}
                    onPress={toggleContentFit}
                    activeOpacity={0.8}
                  >
                    <View style={styles.optionLeft}>
                      <Ionicons
                        name={contentFit === 'cover' ? "scan-outline" : "crop-outline"}
                        size={20}
                        color={THEME.colors.primary}
                      />
                      <View style={{ marginLeft: 8 }}>
                        <Text style={styles.optionText}>
                          {contentFit === 'contain' ? 'Format Cinéma (Original avec bandes)' : 'Plein Écran Zoomé (Sans bandes noires)'}
                        </Text>
                        <Text style={styles.trackSubtext}>
                          Appuyez pour basculer entre le format d'origine et le plein écran
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.optBadge, styles.optBadgeSelected]}>
                      <Text style={[styles.optBadgeText, styles.optBadgeTextSelected]}>
                        {contentFit === 'contain' ? 'CINÉMA' : 'ZOOM'}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Note explicative transparente */}
                  <View style={styles.emptyTrackBox}>
                    <Ionicons name="information-circle-outline" size={18} color={THEME.colors.primary} />
                    <Text style={styles.emptyTrackText}>
                      Ce flux est diffusé par le serveur dans sa résolution maximale ({detectedResolution.label}). Le protocole HLS stabilise automatiquement la diffusion pour vous garantir la meilleure qualité sans interruption.
                    </Text>
                  </View>
                </View>
              )}

              {/* Onglet VITESSE DE LECTURE */}
              {activeSettingsTab === 'speed' && (
                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionHelpText}>
                    Ajustez la vitesse de défilement de la vidéo :
                  </Text>
                  <View style={styles.speedGrid}>
                    {SPEED_OPTIONS.map(s => {
                      const isSelected = playbackSpeed === s;
                      return (
                        <TouchableOpacity
                          key={s}
                          style={[styles.speedCard, isSelected && styles.speedCardSelected]}
                          onPress={() => changeSpeed(s)}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.speedCardText, isSelected && styles.speedCardTextSelected]}>
                            {s === 1.0 ? '1.0x (Normal)' : `${s}x`}
                          </Text>
                          {isSelected && (
                            <Ionicons name="checkmark" size={16} color="#080B10" style={{ marginTop: 2 }} />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Onglet AUDIO & SOUS-TITRES (Flux HLS Réel) */}
              {activeSettingsTab === 'audio' && (
                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionHelpText}>
                    Pistes audio disponibles ({uniqueAudioTracks.length}) :
                  </Text>

                  {uniqueAudioTracks && uniqueAudioTracks.length > 0 ? (
                    uniqueAudioTracks.map((track: AudioTrack, idx: number) => {
                      const isSelected = isCurrentAudioTrack(track);
                      const info = formatAudioTrackInfo(track);
                      return (
                        <TouchableOpacity
                          key={track.id || `${track.language}-${idx}`}
                          style={[styles.optionRow, isSelected && styles.optionRowSelected]}
                          onPress={() => handleSelectAudioTrack(track)}
                          activeOpacity={0.8}
                        >
                          <View style={styles.optionLeft}>
                            <Ionicons
                              name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                              size={20}
                              color={isSelected ? THEME.colors.primary : THEME.colors.textMuted}
                            />
                            <View style={{ marginLeft: 8 }}>
                              <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                                {info.title}
                              </Text>
                              <Text style={styles.trackSubtext}>
                                {info.description} {track.isDefault ? '• Par défaut' : ''}
                              </Text>
                            </View>
                          </View>
                          <View style={[styles.optBadge, isSelected && styles.optBadgeSelected]}>
                            <Text style={[styles.optBadgeText, isSelected && styles.optBadgeTextSelected]}>
                              {info.badge}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })
                  ) : (
                    <View style={styles.emptyTrackBox}>
                      <Ionicons name="information-circle-outline" size={18} color={THEME.colors.primary} />
                      <Text style={styles.emptyTrackText}>
                        Piste audio principale active. Ce flux ne contient pas de piste audio secondaire alternative.
                      </Text>
                    </View>
                  )}

                  <Text style={[styles.sectionHelpText, { marginTop: 22 }]}>
                    Sous-titres disponibles ({uniqueSubtitleTracks.length}) :
                  </Text>

                  {/* Option Désactiver les sous-titres */}
                  <TouchableOpacity
                    style={[styles.optionRow, subtitleTrack === null && styles.optionRowSelected]}
                    onPress={() => handleSelectSubtitleTrack(null)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.optionLeft}>
                      <Ionicons
                        name={subtitleTrack === null ? "checkmark-circle" : "ellipse-outline"}
                        size={20}
                        color={subtitleTrack === null ? THEME.colors.primary : THEME.colors.textMuted}
                      />
                      <View style={{ marginLeft: 8 }}>
                        <Text style={[styles.optionText, subtitleTrack === null && styles.optionTextSelected]}>
                          Désactivés
                        </Text>
                        <Text style={styles.trackSubtext}>Aucun sous-titre affiché à l'écran</Text>
                      </View>
                    </View>
                    {subtitleTrack === null && (
                      <View style={styles.activeBadge}>
                        <Text style={styles.activeBadgeText}>OFF</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  {/* Liste des vraies pistes de sous-titres dédupliquées */}
                  {uniqueSubtitleTracks && uniqueSubtitleTracks.length > 0 ? (
                    uniqueSubtitleTracks.map((track: SubtitleTrack, idx: number) => {
                      const isSelected = isCurrentSubtitleTrack(track);
                      const info = formatSubtitleTrackInfo(track);
                      return (
                        <TouchableOpacity
                          key={track.id || `${track.language}-${idx}`}
                          style={[styles.optionRow, isSelected && styles.optionRowSelected]}
                          onPress={() => handleSelectSubtitleTrack(track)}
                          activeOpacity={0.8}
                        >
                          <View style={styles.optionLeft}>
                            <Ionicons
                              name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                              size={20}
                              color={isSelected ? THEME.colors.primary : THEME.colors.textMuted}
                            />
                            <View style={{ marginLeft: 8 }}>
                              <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                                {info.title}
                              </Text>
                              <Text style={styles.trackSubtext}>
                                {info.description}
                              </Text>
                            </View>
                          </View>
                          <View style={[styles.optBadge, isSelected && styles.optBadgeSelected]}>
                            <Text style={[styles.optBadgeText, isSelected && styles.optBadgeTextSelected]}>
                              {info.badge}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })
                  ) : (
                    <View style={styles.emptyTrackBox}>
                      <Ionicons name="information-circle-outline" size={18} color={THEME.colors.textMuted} />
                      <Text style={styles.emptyTrackText}>
                        Aucun sous-titre embarqué dans ce flux vidéo.
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  videoWrapper: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(8, 10, 14, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: THEME.colors.textSecondary,
    fontSize: 13,
    fontFamily: THEME.fonts.semibold,
  },
  controlsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 140,
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
    paddingTop: Platform.OS === 'ios' ? 50 : 24,
    paddingHorizontal: 16,
  },
  titleContainer: {
    flex: 1,
    marginHorizontal: 12,
  },
  playerTitle: {
    fontSize: 16,
    fontFamily: THEME.fonts.extrabold,
    color: THEME.colors.textPrimary,
    letterSpacing: -0.3,
  },
  playerSubtitle: {
    fontSize: 12,
    color: THEME.colors.primaryRed,
    marginTop: 2,
    fontFamily: THEME.fonts.semibold,
  },
  topRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.primaryRed,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: THEME.radii.full,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
    marginRight: 5,
  },
  liveIndicatorText: {
    fontSize: 9,
    fontFamily: THEME.fonts.extrabold,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  qualityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: THEME.radii.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  qualityPillText: {
    fontSize: 11,
    fontFamily: THEME.fonts.extrabold,
    color: THEME.colors.primaryRed,
    letterSpacing: 0.3,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(25, 28, 36, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  iconBtnActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderColor: THEME.colors.primaryRed,
  },
  centerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 34,
    zIndex: 10,
  },
  seekButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(25, 28, 36, 0.88)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  seekText: {
    fontSize: 10,
    fontFamily: THEME.fonts.extrabold,
    color: '#FFFFFF',
    marginTop: 2,
  },
  playPauseBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: THEME.colors.primaryRed,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  bottomBar: {
    zIndex: 10,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 30 : 12,
  },
  scrubberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  slider: {
    flex: 1,
    height: 40,
    marginHorizontal: 8,
  },
  timeText: {
    fontSize: 12,
    fontFamily: THEME.fonts.bold,
    color: '#FFFFFF',
    minWidth: 42,
    textAlign: 'center',
  },
  bottomActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  timePill: {
    backgroundColor: 'rgba(25, 28, 36, 0.75)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  timePillText: {
    fontSize: 12,
    fontFamily: THEME.fonts.bold,
    color: '#FFFFFF',
  },
  timePillMuted: {
    color: THEME.colors.textMuted,
    fontFamily: THEME.fonts.medium,
  },
  speedPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(25, 28, 36, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  speedPillText: {
    fontSize: 12,
    fontFamily: THEME.fonts.extrabold,
    color: '#FFFFFF',
  },
  settingsOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 100,
    justifyContent: 'flex-end',
  },
  settingsBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
  },
  settingsSheet: {
    backgroundColor: '#11141D',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: 22,
    paddingHorizontal: 22,
    paddingBottom: Platform.OS === 'ios' ? 36 : 22,
    maxHeight: '80%',
    borderTopWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 20,
  },
  settingsSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  settingsSheetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingsTitle: {
    fontSize: 16,
    fontFamily: THEME.fonts.extrabold,
    color: '#FFFFFF',
  },
  settingsCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTabsRow: {
    flexDirection: 'row',
    backgroundColor: '#191C24',
    borderRadius: 12,
    padding: 4,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalTab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 10,
  },
  modalTabActive: {
    backgroundColor: THEME.colors.primaryRed,
  },
  modalTabText: {
    fontSize: 12,
    fontFamily: THEME.fonts.semibold,
    color: THEME.colors.textMuted,
  },
  modalTabTextActive: {
    color: '#09090F',
    fontFamily: THEME.fonts.extrabold,
  },
  sheetScroll: {
    paddingBottom: 20,
  },
  sectionContainer: {
    gap: 8,
  },
  sectionHelpText: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    marginBottom: 6,
    fontFamily: THEME.fonts.semibold,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 15,
    borderRadius: 12,
    backgroundColor: '#1A1F29',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  optionRowSelected: {
    borderColor: THEME.colors.primaryRed,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  optionText: {
    fontSize: 13,
    color: THEME.colors.textPrimary,
    fontFamily: THEME.fonts.semibold,
  },
  optionTextSelected: {
    color: THEME.colors.primaryRed,
    fontFamily: THEME.fonts.extrabold,
  },
  optBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  optBadgeSelected: {
    backgroundColor: THEME.colors.primaryRed,
  },
  optBadgeText: {
    fontSize: 10,
    fontFamily: THEME.fonts.bold,
    color: THEME.colors.textSecondary,
  },
  optBadgeTextSelected: {
    color: '#09090F',
    fontFamily: THEME.fonts.extrabold,
  },
  speedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  speedCard: {
    width: '31%',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#1A1F29',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  speedCardSelected: {
    backgroundColor: THEME.colors.primaryRed,
    borderColor: THEME.colors.primaryRed,
  },
  speedCardText: {
    fontSize: 13,
    fontFamily: THEME.fonts.bold,
    color: '#FFFFFF',
  },
  speedCardTextSelected: {
    color: '#09090F',
    fontFamily: THEME.fonts.extrabold,
  },
  trackSubtext: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  activeBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: THEME.colors.primaryRed,
  },
  activeBadgeText: {
    fontSize: 10,
    fontFamily: THEME.fonts.extrabold,
    color: THEME.colors.primaryRed,
    letterSpacing: 0.5,
  },
  emptyTrackBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    backgroundColor: '#191C24',
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  emptyTrackText: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    flex: 1,
    lineHeight: 17,
  },
});
