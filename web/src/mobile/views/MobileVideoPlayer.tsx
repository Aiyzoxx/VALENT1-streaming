import React, { useState, useEffect, useRef, useCallback } from 'react';
import Hls from 'hls.js';
import {
  IoClose,
  IoPlay,
  IoPause,
  IoPlayBack,
  IoPlayForward,
  IoSettingsOutline,
  IoExpandOutline,
  IoContractOutline,
  IoChatbubbleEllipsesOutline,
  IoScanOutline,
  IoCropOutline,
  IoCheckmarkCircle,
  IoEllipseOutline,
  IoChevronDown,
  IoReloadOutline,
} from 'react-icons/io5';
import { formatTime } from '../../shared/utils/format';
import {
  fetchAndSanitizeStream,
  resolvePlayableStreamUrl,
  resolveVariantUrl,
  ExternalSubtitle,
} from '../../shared/api/hls';

interface MobileVideoPlayerProps {
  streamUrl: string;
  title: string;
  subtitle?: string;
  initialTime?: number;
  isLive?: boolean;
  onClose: () => void;
  onProgressUpdate?: (currentTime: number, duration: number) => void;
}

type SettingsTab = 'quality' | 'speed' | 'audio';

const SPEED_OPTIONS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

interface OptionRowProps {
  index: number;
  selected: boolean;
  title: string;
  description: string;
  badge: string;
  onPress: () => void;
}

const OptionRow: React.FC<OptionRowProps> = ({
  index,
  selected,
  title,
  description,
  badge,
  onPress,
}) => (
  <button
    onClick={onPress}
    className="animate-option-stagger"
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '13px 15px',
      borderRadius: 18,
      backgroundColor: selected ? '#1E2330' : 'rgba(255, 255, 255, 0.05)',
      border: selected ? '1.5px solid rgba(255, 255, 255, 0.35)' : '1px solid rgba(255, 255, 255, 0.08)',
      cursor: 'pointer',
      width: '100%',
      textAlign: 'left',
      transition: 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
      animationDelay: `${Math.min(index, 8) * 35}ms`,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
      {selected ? (
        <IoCheckmarkCircle size={21} style={{ color: '#FFFFFF', flexShrink: 0 }} />
      ) : (
        <IoEllipseOutline size={21} style={{ color: '#7C8394', flexShrink: 0 }} />
      )}
      <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: selected ? 700 : 600,
            color: '#FFFFFF',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: '#9EA4B3',
            marginTop: 2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {description}
        </div>
      </div>
    </div>
    <div
      style={{
        padding: '3px 9px',
        borderRadius: 8,
        backgroundColor: selected ? '#FFFFFF' : '#222631',
        color: selected ? '#09090F' : '#9EA4B3',
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: '0.04em',
        flexShrink: 0,
      }}
    >
      {badge}
    </div>
  </button>
);

export const MobileVideoPlayer: React.FC<MobileVideoPlayerProps> = ({
  streamUrl,
  title,
  subtitle,
  initialTime = 0,
  isLive = false,
  onClose,
  onProgressUpdate,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(initialTime);
  const [duration, setDuration] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>('quality');
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [contentFit, setContentFit] = useState<'contain' | 'cover'>('contain');
  const [levels, setLevels] = useState<{ id: number; label: string }[]>([]);
  const [currentLevel, setCurrentLevel] = useState(-1); // -1 = Auto
  const [audioTracks, setAudioTracks] = useState<{ id: number; name: string }[]>([]);
  const [currentAudio, setCurrentAudio] = useState(0);
  const [subtitles, setSubtitles] = useState<{ id: number; name: string }[]>([]);
  const [currentSub, setCurrentSub] = useState(-1); // -1 = Off
  const [isBuffering, setIsBuffering] = useState(true);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [externalSubs, setExternalSubs] = useState<ExternalSubtitle[]>([]);
  const [seekingLeft, setSeekingLeft] = useState(false);
  const [seekingRight, setSeekingRight] = useState(false);
  const [centerFeedback, setCenterFeedback] = useState<{
    type: 'play' | 'pause' | 'seek-10' | 'seek+10';
    key: number;
  } | null>(null);

  const fallbackTriedRef = useRef(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectSubtitle = useCallback((subId: number) => {
    if (hlsRef.current) {
      hlsRef.current.subtitleTrack = subId;
    }
    if (videoRef.current && videoRef.current.textTracks) {
      for (let i = 0; i < videoRef.current.textTracks.length; i++) {
        videoRef.current.textTracks[i].mode = i === subId ? 'showing' : 'disabled';
      }
    }
    setCurrentSub(subId);
    setShowSettings(false);
  }, []);

  const resetHideTimer = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (isPlaying && !showSettings) {
        setControlsVisible(false);
      }
    }, 3500);
  }, [isPlaying, showSettings]);

  const tryFallbackVariant = useCallback(async () => {
    if (fallbackTriedRef.current) return false;
    fallbackTriedRef.current = true;
    try {
      const variant = await resolveVariantUrl(streamUrl);
      if (variant && variant !== resolvedUrl) {
        console.log('Mobile player falling back to variant URL:', variant);
        setResolvedUrl(variant);
        return true;
      }
    } catch (e) {
      console.warn('Mobile fallback variant error:', e);
    }
    return false;
  }, [streamUrl, resolvedUrl]);

  // Resolve stream URL for incompatible playlists
  useEffect(() => {
    let alive = true;
    let createdBlobUrl: string | null = null;
    fallbackTriedRef.current = false;

    fetchAndSanitizeStream(streamUrl).then((res) => {
      if (!alive) {
        if (res.url.startsWith('blob:')) URL.revokeObjectURL(res.url);
        return;
      }
      if (res.url.startsWith('blob:')) {
        createdBlobUrl = res.url;
      }
      setResolvedUrl(res.url);
      if (res.subtitles && res.subtitles.length > 0) {
        setExternalSubs(res.subtitles);
        setSubtitles(res.subtitles.map((s) => ({ id: s.id, name: s.label })));
        setCurrentSub(-1);
      }
    });

    return () => {
      alive = false;
      if (createdBlobUrl) {
        URL.revokeObjectURL(createdBlobUrl);
      }
    };
  }, [streamUrl]);

  // Init HLS player
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !resolvedUrl) return;

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: Boolean(isLive),
        backBufferLength: 90,
        maxBufferSize: 50 * 1000 * 1000,
        renderTextTracksNatively: false,
      });

      hlsRef.current = hls;
      hls.loadSource(resolvedUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        hls.subtitleTrack = -1;
        setIsBuffering(false);
        setStreamError(null);
        const parsedLevels = data.levels.map((lvl, idx) => ({
          id: idx,
          label: `${lvl.height ? lvl.height + 'p' : Math.round(lvl.bitrate / 1000) + ' kbps'}`,
        }));
        setLevels(parsedLevels);

        if (initialTime > 0) {
          video.currentTime = initialTime;
        }
        video
          .play()
          .then(() => setIsPlaying(true))
          .catch(() => {
            setIsPlaying(false);
            setControlsVisible(true);
          });
      });

      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_, data) => {
        setAudioTracks(data.audioTracks.map((t, idx) => ({ id: idx, name: t.name || t.lang || `Piste ${idx + 1}` })));
      });

      hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (_, data) => {
        setSubtitles(data.subtitleTracks.map((s, idx) => ({ id: idx, name: s.name || s.lang || `Sous-titre ${idx + 1}` })));
        if (currentSub === -1) {
          hls.subtitleTrack = -1;
        }
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
        setCurrentLevel(hls.autoLevelEnabled ? -1 : data.level);
      });

      hls.on(Hls.Events.ERROR, async (_, data) => {
        console.warn('Mobile HLS Event Error:', data.type, data.details, 'fatal:', data.fatal);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              const recovered = await tryFallbackVariant();
              if (!recovered) {
                setStreamError('Impossible de charger la vidéo. Vérifiez votre connexion.');
                setIsBuffering(false);
                setControlsVisible(true);
              }
              break;
          }
        }
      });

      return () => {
        hls.destroy();
        hlsRef.current = null;
        if (video) {
          video.removeAttribute('src');
          video.load();
        }
      };
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = resolvedUrl;
      const onLoaded = () => {
        setIsBuffering(false);
        setStreamError(null);
        if (initialTime > 0) video.currentTime = initialTime;
        video
          .play()
          .then(() => setIsPlaying(true))
          .catch(() => {
            setIsPlaying(false);
            setControlsVisible(true);
          });
      };
      const onErr = async () => {
        const recovered = await tryFallbackVariant();
        if (!recovered) {
          setStreamError('Erreur de lecture sur le lecteur vidéo.');
          setIsBuffering(false);
          setControlsVisible(true);
        }
      };

      video.addEventListener('loadedmetadata', onLoaded);
      video.addEventListener('error', onErr);

      return () => {
        video.removeEventListener('loadedmetadata', onLoaded);
        video.removeEventListener('error', onErr);
      };
    }
  }, [resolvedUrl, initialTime, tryFallbackVariant]);

  // Video event handlers
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const cur = videoRef.current.currentTime;
      const dur = videoRef.current.duration || 0;
      setCurrentTime(cur);
      setDuration(dur);
      if (onProgressUpdate) {
        onProgressUpdate(cur, dur);
      }
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
    resetHideTimer();
  };

  const seek = (secondsDelta: number) => {
    if (!videoRef.current) return;
    const target = Math.max(0, Math.min(duration, videoRef.current.currentTime + secondsDelta));
    videoRef.current.currentTime = target;
    setCurrentTime(target);
    if (secondsDelta > 0) {
      setSeekingRight(true);
      setCenterFeedback({ type: 'seek+10', key: Date.now() });
      setTimeout(() => setSeekingRight(false), 350);
    } else {
      setSeekingLeft(true);
      setCenterFeedback({ type: 'seek-10', key: Date.now() });
      setTimeout(() => setSeekingLeft(false), 350);
    }
    resetHideTimer();
  };

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    if (videoRef.current) {
      videoRef.current.currentTime = val;
    }
    resetHideTimer();
  };

  const toggleFullscreen = () => {
    const container = document.getElementById('player-container');
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const toggleContentFit = () => {
    setContentFit((prev) => (prev === 'contain' ? 'cover' : 'contain'));
  };

  const setSpeed = (spd: number) => {
    setPlaybackSpeed(spd);
    if (videoRef.current) {
      videoRef.current.playbackRate = spd;
    }
    setShowSettings(false);
  };

  const setQualityLevel = (lvlId: number) => {
    if (!hlsRef.current) return;
    if (lvlId === -1) {
      hlsRef.current.currentLevel = -1; // Auto
      setCurrentLevel(-1);
    } else {
      hlsRef.current.currentLevel = lvlId;
      setCurrentLevel(lvlId);
    }
    setShowSettings(false);
  };

  const bestLevel = levels.length > 0 ? levels[levels.length - 1] : null;

  return (
    <div
      id="player-container"
      onClick={resetHideTimer}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#000000',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
        overflow: 'hidden',
      }}
    >
      <video
        ref={videoRef}
        playsInline
        crossOrigin="anonymous"
        onTimeUpdate={handleTimeUpdate}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onCanPlay={() => setIsBuffering(false)}
        onLoadedData={() => setIsBuffering(false)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: contentFit,
          transition: 'object-fit 0.2s ease',
        }}
      >
        {externalSubs.map((s) => (
          <track
            key={s.id}
            kind="subtitles"
            label={s.label}
            src={s.src}
            srcLang={s.lang}
            default={false}
          />
        ))}
      </video>

      {/* Buffering spinner */}
      {isBuffering && !streamError && (
        <div
          style={{
            position: 'absolute',
            width: 48,
            height: 48,
            borderRadius: '50%',
            border: '4px solid rgba(255, 255, 255, 0.2)',
            borderTopColor: '#FFFFFF',
            animation: 'spin 0.8s linear infinite',
          }}
        />
      )}

      {/* Stream Error Modal */}
      {streamError && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(9, 9, 15, 0.94)',
            backdropFilter: 'blur(16px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 24,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 700, color: '#FFFFFF', marginBottom: 8 }}>
            Lecture indisponible
          </div>
          <p style={{ fontSize: 13, color: '#9EA4B3', maxWidth: 320, marginBottom: 20 }}>
            {streamError}
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={async () => {
                setStreamError(null);
                setIsBuffering(true);
                fallbackTriedRef.current = false;
                const freshUrl = await resolvePlayableStreamUrl(streamUrl);
                setResolvedUrl(freshUrl);
                if (hlsRef.current) {
                  hlsRef.current.loadSource(freshUrl);
                  if (videoRef.current) hlsRef.current.attachMedia(videoRef.current);
                } else if (videoRef.current) {
                  videoRef.current.src = freshUrl;
                  videoRef.current.load();
                  videoRef.current.play().catch(() => {});
                }
              }}
              style={{
                backgroundColor: '#E50914',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 12,
                padding: '10px 20px',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Réessayer
            </button>
            <button
              onClick={onClose}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.12)',
                color: '#FFFFFF',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: 12,
                padding: '10px 20px',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Retour
            </button>
          </div>
        </div>
      )}

      {/* Top Bar Controls (Screenshot 4 exact layout) */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          padding: 'calc(env(safe-area-inset-top, 20px) + 10px) 16px 20px',
          background: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.85) 0%, transparent 100%)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          opacity: controlsVisible ? 1 : 0,
          pointerEvents: controlsVisible ? 'auto' : 'none',
          transition: 'opacity 0.25s ease',
          zIndex: 10,
        }}
      >
        <button
          onClick={onClose}
          className="player-glass-btn"
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            flexShrink: 0,
          }}
          title="Fermer"
        >
          <IoClose size={20} />
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: '#FFFFFF',
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {title}
          </div>
          {subtitle && (
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#9EA4B3',
                marginTop: 1,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {subtitle}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {isLive ? (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                backgroundColor: '#FFFFFF',
                color: '#09090F',
                padding: '6px 12px',
                borderRadius: 9999,
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.04em',
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#10B981' }} />
              DIRECT
            </div>
          ) : (
            <button
              onClick={() => {
                setActiveTab('quality');
                setShowSettings(true);
                setControlsVisible(true);
              }}
              className="player-glass-btn"
              style={{
                height: 38,
                padding: '0 12px',
                borderRadius: 19,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
              title="Changer la qualité"
            >
              <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.04em' }}>
                {currentLevel === -1 ? 'AUTO' : levels.find((l) => l.id === currentLevel)?.label || 'HD'}
              </span>
              <IoChevronDown size={12} style={{ color: '#9EA4B3' }} />
            </button>
          )}

          <button
            onClick={() => {
              setShowSettings(true);
              setControlsVisible(true);
            }}
            className="player-glass-btn"
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
            }}
            title="Réglages"
          >
            <IoSettingsOutline size={19} />
          </button>
        </div>
      </div>

      {/* Transient Action Feedback Pop (Seek only) */}
      {centerFeedback && (centerFeedback.type === 'seek-10' || centerFeedback.type === 'seek+10') && (
        <div
          key={centerFeedback.key}
          className="animate-play-pop"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 76,
            height: 76,
            borderRadius: '50%',
            backgroundColor: 'rgba(9, 9, 15, 0.75)',
            backdropFilter: 'blur(14px)',
            border: '1.5px solid rgba(255, 255, 255, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            pointerEvents: 'none',
            zIndex: 30,
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.6)',
          }}
        >
          {centerFeedback.type === 'seek-10' && (
            <>
              <IoReloadOutline size={26} style={{ transform: 'scaleX(-1)' }} />
              <span style={{ fontSize: 11, fontWeight: 800 }}>-10s</span>
            </>
          )}
          {centerFeedback.type === 'seek+10' && (
            <>
              <IoReloadOutline size={26} />
              <span style={{ fontSize: 11, fontWeight: 800 }}>+10s</span>
            </>
          )}
        </div>
      )}

      {/* Center Controls (Screenshot 4 exact layout: Seek -10s, Giant White Play/Pause, Seek +10s) */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          display: 'flex',
          alignItems: 'center',
          gap: 28,
          opacity: controlsVisible ? 1 : 0,
          pointerEvents: controlsVisible ? 'auto' : 'none',
          transition: 'opacity 0.25s ease',
          zIndex: 10,
        }}
      >
        {!isLive && (
          <button
            onClick={() => seek(-10)}
            className={`player-glass-btn ${seekingLeft ? 'animate-seek-left' : ''}`}
            style={{
              width: 58,
              height: 58,
              borderRadius: 29,
              flexDirection: 'column',
              gap: 1,
            }}
            title="Reculer de 10s"
          >
            <IoPlayBack size={22} />
            <span style={{ fontSize: 10, fontWeight: 800, marginTop: 1 }}>10s</span>
          </button>
        )}

        <button
          onClick={togglePlay}
          className="player-main-play-btn"
          style={{
            width: 78,
            height: 78,
          }}
          title={isPlaying ? 'Pause' : 'Lecture'}
        >
          {isPlaying ? <IoPause size={34} /> : <IoPlay size={34} style={{ marginLeft: 4 }} />}
        </button>

        {!isLive && (
          <button
            onClick={() => seek(10)}
            className={`player-glass-btn ${seekingRight ? 'animate-seek-right' : ''}`}
            style={{
              width: 58,
              height: 58,
              borderRadius: 29,
              flexDirection: 'column',
              gap: 1,
            }}
            title="Avancer de 10s"
          >
            <IoPlayForward size={22} />
            <span style={{ fontSize: 10, fontWeight: 800, marginTop: 1 }}>10s</span>
          </button>
        )}
      </div>

      {/* Bottom Bar Controls (Screenshot 4 exact layout) */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '24px 20px calc(env(safe-area-inset-bottom, 14px) + 14px)',
          background: 'linear-gradient(to top, rgba(0, 0, 0, 0.9) 0%, transparent 100%)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          opacity: controlsVisible ? 1 : 0,
          pointerEvents: controlsVisible ? 'auto' : 'none',
          transition: 'opacity 0.25s ease',
          zIndex: 10,
        }}
      >
        {/* Scrubber row with Pill Thumb */}
        {!isLive && duration > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span
              style={{
                color: '#FFFFFF',
                fontSize: 13,
                fontWeight: 700,
                minWidth: 44,
                textAlign: 'center',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formatTime(currentTime)}
            </span>
            <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type="range"
                min={0}
                max={duration || 100}
                step={0.1}
                value={currentTime}
                onChange={handleScrub}
                className="ios-video-scrubber"
                style={
                  {
                    '--track-bg': `linear-gradient(to right, #FFFFFF 0%, #FFFFFF ${(currentTime / (duration || 1)) * 100}%, rgba(255, 255, 255, 0.22) ${(currentTime / (duration || 1)) * 100}%, rgba(255, 255, 255, 0.22) 100%)`,
                  } as React.CSSProperties
                }
              />
            </div>
            <span
              style={{
                color: '#FFFFFF',
                fontSize: 13,
                fontWeight: 700,
                minWidth: 44,
                textAlign: 'center',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formatTime(duration)}
            </span>
          </div>
        )}

        {/* Actions Row (Screenshot 4 exact layout) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Audio & Sous-titres */}
          <button
            onClick={() => {
              setActiveTab('audio');
              setShowSettings(true);
              setControlsVisible(true);
            }}
            className="player-glass-btn"
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
            }}
            title="Audio & Sous-titres"
          >
            <IoChatbubbleEllipsesOutline size={17} />
          </button>

          {/* Vitesse */}
          <button
            onClick={() => {
              setActiveTab('speed');
              setShowSettings(true);
              setControlsVisible(true);
            }}
            className="player-glass-btn"
            style={{
              height: 38,
              padding: '0 14px',
              borderRadius: 19,
            }}
            title="Vitesse de lecture"
          >
            <span style={{ fontSize: 13, fontWeight: 800 }}>{playbackSpeed}x</span>
          </button>

          <div style={{ flex: 1 }} />

          {/* Aspect / Format Cinéma */}
          <button
            onClick={toggleContentFit}
            className="player-glass-btn"
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
            }}
            title={contentFit === 'contain' ? 'Format cinéma' : 'Plein écran zoomé'}
          >
            {contentFit === 'contain' ? <IoScanOutline size={17} /> : <IoCropOutline size={17} />}
          </button>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="player-glass-btn"
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
            }}
            title={isFullscreen ? 'Quitter plein écran' : 'Plein écran'}
          >
            {isFullscreen ? <IoContractOutline size={17} /> : <IoExpandOutline size={17} />}
          </button>
        </div>
      </div>

      {/* Settings Bottom Sheet (Screenshots 1, 2, 3 exact replica) */}
      {showSettings && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.72)',
            backdropFilter: 'blur(16px)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            zIndex: 100,
          }}
          onClick={() => setShowSettings(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="animate-sheet-up no-scrollbar"
            style={{
              backgroundColor: 'rgba(19, 23, 32, 0.96)',
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              borderTop: '1px solid rgba(255, 255, 255, 0.14)',
              borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
              borderRight: '1px solid rgba(255, 255, 255, 0.08)',
              padding: '18px 20px calc(env(safe-area-inset-bottom, 20px) + 20px)',
              maxHeight: '76vh',
              overflowY: 'auto',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.7)',
            }}
          >
            {/* Header: Réglages + Close X */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
              }}
            >
              <span style={{ fontSize: 20, fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.02em' }}>
                Réglages
              </span>
              <button
                onClick={() => setShowSettings(false)}
                className="player-glass-btn"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                }}
                title="Fermer"
              >
                <IoClose size={18} />
              </button>
            </div>

            {/* Segmented Pill Tabs (Screenshot 1, 2, 3) */}
            <div
              style={{
                display: 'flex',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 9999,
                padding: 4,
                marginBottom: 16,
              }}
            >
              {[
                { id: 'quality', label: 'Qualité' },
                { id: 'speed', label: `Vitesse · ${playbackSpeed}x` },
                { id: 'audio', label: 'Audio' },
              ].map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as SettingsTab)}
                    style={{
                      flex: 1,
                      padding: '9px 0',
                      fontSize: 13,
                      fontWeight: active ? 700 : 600,
                      color: active ? '#FFFFFF' : '#9EA4B3',
                      backgroundColor: active ? '#222631' : 'transparent',
                      border: active ? '1px solid rgba(255, 255, 255, 0.16)' : '1px solid transparent',
                      borderRadius: 9999,
                      transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                      textAlign: 'center',
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Tab 1: Qualité (Screenshot 1 replica) */}
            {activeTab === 'quality' && (
              <div key="quality" className="animate-tab-fade" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <OptionRow
                  index={0}
                  selected={currentLevel !== -1}
                  title={bestLevel ? `${bestLevel.label} · Source` : 'Qualité source · Source'}
                  description="Détection en cours"
                  badge="HD"
                  onPress={() => {
                    if (levels.length > 0) {
                      const highest = levels[levels.length - 1];
                      setQualityLevel(highest.id);
                    }
                  }}
                />

                <OptionRow
                  index={1}
                  selected={currentLevel === -1}
                  title="Auto · Adaptatif"
                  description="Ajuste le débit selon la connexion"
                  badge="AUTO"
                  onPress={() => setQualityLevel(-1)}
                />

                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#7C8394',
                    marginTop: 8,
                    marginBottom: 2,
                  }}
                >
                  Affichage
                </div>

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
                  onPress={() => {
                    if (document.pictureInPictureElement) {
                      document.exitPictureInPicture().catch(() => {});
                    } else if (videoRef.current) {
                      videoRef.current.requestPictureInPicture().catch(() => {});
                    }
                  }}
                />
              </div>
            )}

            {/* Tab 2: Vitesse (Screenshot 2 replica: 2x3 Grid) */}
            {activeTab === 'speed' && (
              <div key="speed" className="animate-tab-fade" style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {SPEED_OPTIONS.map((spd, idx) => {
                  const active = playbackSpeed === spd;
                  const label = spd === 1.0 ? '1x · Normal' : `${spd}x`;
                  return (
                    <button
                      key={spd}
                      onClick={() => setSpeed(spd)}
                      className="animate-option-stagger"
                      style={{
                        flex: '1 0 calc(33.333% - 8px)',
                        maxWidth: 'calc(33.333% - 6px)',
                        padding: '16px 0',
                        borderRadius: 16,
                        backgroundColor: active ? '#FFFFFF' : 'rgba(255, 255, 255, 0.05)',
                        border: active ? '1px solid #FFFFFF' : '1px solid rgba(255, 255, 255, 0.08)',
                        color: active ? '#09090F' : '#FFFFFF',
                        fontSize: 14,
                        fontWeight: active ? 800 : 700,
                        boxShadow: active ? '0 4px 18px rgba(255, 255, 255, 0.25)' : 'none',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
                        animationDelay: `${idx * 30}ms`,
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Tab 3: Audio & Sous-titres (Screenshot 3 replica) */}
            {activeTab === 'audio' && (
              <div key="audio" className="animate-tab-fade" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#7C8394', marginBottom: 2 }}>
                  Pistes audio ({audioTracks.length})
                </div>
                {audioTracks.length === 0 ? (
                  <div
                    style={{
                      padding: '16px',
                      borderRadius: 18,
                      backgroundColor: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.07)',
                      color: '#9EA4B3',
                      fontSize: 14,
                      fontWeight: 500,
                    }}
                  >
                    Piste audio principale active.
                  </div>
                ) : (
                  audioTracks.map((t, idx) => (
                    <OptionRow
                      key={t.id}
                      index={idx}
                      selected={currentAudio === t.id}
                      title={t.name}
                      description="Piste audio du flux"
                      badge={`PISTE ${t.id + 1}`}
                      onPress={() => {
                        if (hlsRef.current) hlsRef.current.audioTrack = t.id;
                        setCurrentAudio(t.id);
                      }}
                    />
                  ))
                )}

                <div style={{ fontSize: 13, fontWeight: 600, color: '#7C8394', marginTop: 14, marginBottom: 2 }}>
                  Sous-titres ({subtitles.length})
                </div>

                <OptionRow
                  index={0}
                  selected={currentSub === -1}
                  title="Désactivés"
                  description="Aucun sous-titre affiché"
                  badge="OFF"
                  onPress={() => selectSubtitle(-1)}
                />

                {subtitles.map((s, idx) => (
                  <OptionRow
                    key={s.id}
                    index={idx + 1}
                    selected={currentSub === s.id}
                    title={s.name}
                    description="Sous-titres synchronisés"
                    badge={s.name.toUpperCase().includes('FR') ? 'FR' : 'SUB'}
                    onPress={() => selectSubtitle(s.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
