import React, { useState, useEffect, useRef, useCallback } from 'react';
import Hls from 'hls.js';
import {
  IoArrowBack,
  IoPlay,
  IoPause,
  IoVolumeHigh,
  IoVolumeMute,
  IoSettingsOutline,
  IoExpandOutline,
  IoContractOutline,
  IoTvOutline,
  IoReloadOutline,
} from 'react-icons/io5';
import { formatTime } from '../../shared/utils/format';
import { resolvePlayableStreamUrl } from '../../shared/api/hls';

interface DesktopVideoPlayerProps {
  streamUrl: string;
  title: string;
  subtitle?: string;
  initialTime?: number;
  isLive?: boolean;
  onClose: () => void;
  onProgressUpdate?: (currentTime: number, duration: number) => void;
}

const SPEED_OPTIONS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

export const DesktopVideoPlayer: React.FC<DesktopVideoPlayerProps> = ({
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
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [levels, setLevels] = useState<{ id: number; label: string }[]>([]);
  const [currentLevel, setCurrentLevel] = useState(-1);
  const [audioTracks, setAudioTracks] = useState<{ id: number; name: string }[]>([]);
  const [currentAudio, setCurrentAudio] = useState(0);
  const [subtitles, setSubtitles] = useState<{ id: number; name: string }[]>([]);
  const [currentSub, setCurrentSub] = useState(-1);
  const [isBuffering, setIsBuffering] = useState(true);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [resolvedUrl, setResolvedUrl] = useState<string>(streamUrl);
  const [seekingLeft, setSeekingLeft] = useState(false);
  const [seekingRight, setSeekingRight] = useState(false);
  const [centerFeedback, setCenterFeedback] = useState<{
    type: 'play' | 'pause' | 'seek-10' | 'seek+10';
    key: number;
  } | null>(null);

  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetHideTimer = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (isPlaying && !showSettings) {
        setControlsVisible(false);
      }
    }, 3500);
  }, [isPlaying, showSettings]);

  useEffect(() => {
    let alive = true;
    resolvePlayableStreamUrl(streamUrl).then((url) => {
      if (alive) setResolvedUrl(url);
    });
    return () => {
      alive = false;
    };
  }, [streamUrl]);

  // Init HLS
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !resolvedUrl) return;

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      });

      hlsRef.current = hls;
      hls.loadSource(resolvedUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        setIsBuffering(false);
        setStreamError(null);
        setLevels(
          data.levels.map((lvl, idx) => ({
            id: idx,
            label: lvl.height ? `${lvl.height}p` : `${Math.round(lvl.bitrate / 1000)}k`,
          }))
        );
        if (initialTime > 0) video.currentTime = initialTime;
        video.play()
          .then(() => setIsPlaying(true))
          .catch(() => {
            setIsPlaying(false);
            setControlsVisible(true);
          });
      });

      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_, data) => {
        setAudioTracks(
          data.audioTracks.map((t, idx) => ({ id: idx, name: t.name || t.lang || `Piste ${idx + 1}` }))
        );
      });

      hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (_, data) => {
        setSubtitles(
          data.subtitleTracks.map((s, idx) => ({ id: idx, name: s.name || s.lang || `Sous-titre ${idx + 1}` }))
        );
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
        setCurrentLevel(hls.autoLevelEnabled ? -1 : data.level);
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        console.warn('Desktop HLS Event Error:', data.type, data.details, 'fatal:', data.fatal);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              setStreamError('Impossible de charger le flux vidéo.');
              setIsBuffering(false);
              setControlsVisible(true);
              break;
          }
        }
      });

      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = resolvedUrl;
      const onLoaded = () => {
        setIsBuffering(false);
        setStreamError(null);
        if (initialTime > 0) video.currentTime = initialTime;
        video.play()
          .then(() => setIsPlaying(true))
          .catch(() => {
            setIsPlaying(false);
            setControlsVisible(true);
          });
      };
      const onErr = () => {
        setStreamError('Erreur de lecture sur le lecteur vidéo.');
        setIsBuffering(false);
        setControlsVisible(true);
      };

      video.addEventListener('loadedmetadata', onLoaded);
      video.addEventListener('error', onErr);

      return () => {
        video.removeEventListener('loadedmetadata', onLoaded);
        video.removeEventListener('error', onErr);
      };
    }
  }, [resolvedUrl, initialTime]);

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
      setCenterFeedback({ type: 'play', key: Date.now() });
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
      setCenterFeedback({ type: 'pause', key: Date.now() });
    }
    resetHideTimer();
  }, [resetHideTimer]);

  const seek = useCallback((delta: number) => {
    if (!videoRef.current) return;
    const target = Math.max(0, Math.min(duration, videoRef.current.currentTime + delta));
    videoRef.current.currentTime = target;
    setCurrentTime(target);
    if (delta > 0) {
      setSeekingRight(true);
      setCenterFeedback({ type: 'seek+10', key: Date.now() });
      setTimeout(() => setSeekingRight(false), 350);
    } else {
      setSeekingLeft(true);
      setCenterFeedback({ type: 'seek-10', key: Date.now() });
      setTimeout(() => setSeekingLeft(false), 350);
    }
    resetHideTimer();
  }, [duration, resetHideTimer]);

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    const nextMute = !isMuted;
    videoRef.current.muted = nextMute;
    setIsMuted(nextMute);
  }, [isMuted]);

  const toggleFullscreen = useCallback(() => {
    const container = document.getElementById('desktop-player-container');
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      if (e.code === 'Space' || e.key === 'k') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'ArrowLeft' || e.key === 'j') {
        e.preventDefault();
        seek(-10);
      } else if (e.key === 'ArrowRight' || e.key === 'l') {
        e.preventDefault();
        seek(10);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (videoRef.current) {
          const v = Math.min(1, videoRef.current.volume + 0.1);
          videoRef.current.volume = v;
          setVolume(v);
          setIsMuted(false);
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (videoRef.current) {
          const v = Math.max(0, videoRef.current.volume - 0.1);
          videoRef.current.volume = v;
          setVolume(v);
        }
      } else if (e.key === 'm') {
        e.preventDefault();
        toggleMute();
      } else if (e.key === 'f') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === 'Escape') {
        if (!document.fullscreenElement) {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, seek, toggleMute, toggleFullscreen, onClose]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const cur = videoRef.current.currentTime;
      const dur = videoRef.current.duration || 0;
      setCurrentTime(cur);
      setDuration(dur);
      if (onProgressUpdate) onProgressUpdate(cur, dur);
    }
  };

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    if (videoRef.current) videoRef.current.currentTime = val;
    resetHideTimer();
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  return (
    <div
      id="desktop-player-container"
      onMouseMove={resetHideTimer}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#000000',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
        cursor: controlsVisible ? 'default' : 'none',
      }}
    >
      <video
        ref={videoRef}
        playsInline
        onTimeUpdate={handleTimeUpdate}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onClick={togglePlay}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
        }}
      />

      {/* Buffering spinner */}
      {isBuffering && !streamError && (
        <div
          style={{
            position: 'absolute',
            width: 54,
            height: 54,
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
            padding: 30,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 700, color: '#FFFFFF', marginBottom: 8 }}>
            Lecture indisponible
          </div>
          <p style={{ fontSize: 14, color: '#9EA4B3', maxWidth: 360, marginBottom: 24 }}>
            {streamError}
          </p>
          <div style={{ display: 'flex', gap: 14 }}>
            <button
              onClick={() => {
                setStreamError(null);
                setIsBuffering(true);
                if (hlsRef.current && resolvedUrl) {
                  hlsRef.current.loadSource(resolvedUrl);
                  if (videoRef.current) hlsRef.current.attachMedia(videoRef.current);
                }
              }}
              style={{
                backgroundColor: '#E50914',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 14,
                padding: '12px 24px',
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
                borderRadius: 14,
                padding: '12px 24px',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Transient Action Feedback Pop (Play, Pause, Seek) */}
      {centerFeedback && (
        <div
          key={centerFeedback.key}
          className="animate-play-pop"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 88,
            height: 88,
            borderRadius: '50%',
            backgroundColor: 'rgba(9, 9, 15, 0.75)',
            backdropFilter: 'blur(16px)',
            border: '1.5px solid rgba(255, 255, 255, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            pointerEvents: 'none',
            zIndex: 30,
            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.6)',
          }}
        >
          {centerFeedback.type === 'play' && <IoPlay size={44} style={{ marginLeft: 4 }} />}
          {centerFeedback.type === 'pause' && <IoPause size={44} />}
          {centerFeedback.type === 'seek-10' && (
            <>
              <IoReloadOutline size={32} style={{ transform: 'scaleX(-1)' }} />
              <span style={{ fontSize: 12, fontWeight: 800 }}>-10s</span>
            </>
          )}
          {centerFeedback.type === 'seek+10' && (
            <>
              <IoReloadOutline size={32} />
              <span style={{ fontSize: 12, fontWeight: 800 }}>+10s</span>
            </>
          )}
        </div>
      )}

      {/* Top Bar Controls */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          padding: '24px 36px 36px',
          background: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.85) 0%, transparent 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          opacity: controlsVisible ? 1 : 0,
          pointerEvents: controlsVisible ? 'auto' : 'none',
          transition: 'opacity 0.25s ease',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={onClose}
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            }}
          >
            <IoArrowBack size={24} />
          </button>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#FFFFFF' }}>{title}</div>
            {subtitle && <div style={{ fontSize: 13, color: '#9EA4B3' }}>{subtitle}</div>}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => setShowSettings(!showSettings)}
            title="Réglages (Qualité, Audio, Sous-titres)"
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              cursor: 'pointer',
            }}
          >
            <IoSettingsOutline size={22} />
          </button>
        </div>
      </div>

      {/* Bottom Bar Controls */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '30px 36px 28px',
          background: 'linear-gradient(to top, rgba(0, 0, 0, 0.9) 0%, transparent 100%)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          opacity: controlsVisible ? 1 : 0,
          pointerEvents: controlsVisible ? 'auto' : 'none',
          transition: 'opacity 0.25s ease',
          zIndex: 10,
        }}
      >
        {/* Scrubber slider */}
        <input
          type="range"
          min={0}
          max={duration || 100}
          step={0.1}
          value={currentTime}
          onChange={handleScrub}
          style={{
            width: '100%',
            accentColor: '#FFFFFF',
            height: 5,
            cursor: 'pointer',
          }}
        />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Left Controls: Play/Pause, Seek +/- 10s, Volume, Time */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <button
              onClick={togglePlay}
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                backgroundColor: '#FFFFFF',
                color: '#09090F',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              {isPlaying ? <IoPause size={22} /> : <IoPlay size={22} style={{ marginLeft: 2 }} />}
            </button>

            <button
              onClick={() => seek(-10)}
              title="Reculer de 10s (Flèche Gauche)"
              className={seekingLeft ? 'animate-seek-left' : ''}
              style={{
                color: '#FFFFFF',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                transition: 'transform 0.15s ease',
              }}
            >
              <IoReloadOutline size={24} style={{ transform: 'scaleX(-1)' }} />
            </button>

            <button
              onClick={() => seek(10)}
              title="Avancer de 10s (Flèche Droite)"
              className={seekingRight ? 'animate-seek-right' : ''}
              style={{
                color: '#FFFFFF',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                transition: 'transform 0.15s ease',
              }}
            >
              <IoReloadOutline size={24} />
            </button>

            {/* Volume control */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={toggleMute}
                style={{ color: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                {isMuted || volume === 0 ? <IoVolumeMute size={22} /> : <IoVolumeHigh size={22} />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                style={{
                  width: 80,
                  accentColor: '#FFFFFF',
                  cursor: 'pointer',
                }}
              />
            </div>

            {/* Time readout */}
            <div style={{ fontSize: 13, color: '#9EA4B3', marginLeft: 8 }}>
              {isLive ? (
                <span style={{ color: '#E50914', fontWeight: 700 }}>• EN DIRECT</span>
              ) : (
                <span>
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              )}
            </div>
          </div>

          {/* Right Controls: Fullscreen, PiP */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button
              onClick={async () => {
                if (videoRef.current) {
                  try {
                    await videoRef.current.requestPictureInPicture();
                  } catch (e) {
                    console.warn(e);
                  }
                }
              }}
              title="Picture-in-Picture"
              style={{ color: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              <IoTvOutline size={22} />
            </button>

            <button
              onClick={toggleFullscreen}
              title="Plein écran (F)"
              style={{ color: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              {isFullscreen ? <IoContractOutline size={24} /> : <IoExpandOutline size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Settings Modal (Right slide panel on desktop) */}
      {showSettings && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: 80,
            right: 36,
            width: 320,
            backgroundColor: '#1A1F29',
            borderRadius: 18,
            border: '1px solid rgba(255, 255, 255, 0.12)',
            padding: 20,
            boxShadow: '0 16px 32px rgba(0, 0, 0, 0.7)',
            zIndex: 100,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700, color: '#FFFFFF', marginBottom: 14 }}>
            Réglages de lecture
          </div>

          {/* Speed */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, color: '#9EA4B3', fontWeight: 600, marginBottom: 8 }}>
              Vitesse de lecture
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {SPEED_OPTIONS.map((spd) => (
                <button
                  key={spd}
                  onClick={() => {
                    setPlaybackSpeed(spd);
                    if (videoRef.current) videoRef.current.playbackRate = spd;
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    backgroundColor: playbackSpeed === spd ? '#FFFFFF' : '#2B303C',
                    color: playbackSpeed === spd ? '#09090F' : '#FFFFFF',
                    fontSize: 12,
                    fontWeight: playbackSpeed === spd ? 700 : 500,
                    cursor: 'pointer',
                  }}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>

          {/* Quality */}
          {levels.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, color: '#9EA4B3', fontWeight: 600, marginBottom: 8 }}>
                Qualité vidéo
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button
                  onClick={() => {
                    if (hlsRef.current) hlsRef.current.currentLevel = -1;
                    setCurrentLevel(-1);
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    backgroundColor: currentLevel === -1 ? '#FFFFFF' : '#2B303C',
                    color: currentLevel === -1 ? '#09090F' : '#FFFFFF',
                    fontSize: 12,
                    fontWeight: currentLevel === -1 ? 700 : 500,
                    cursor: 'pointer',
                  }}
                >
                  Auto
                </button>
                {levels.map((lvl) => (
                  <button
                    key={lvl.id}
                    onClick={() => {
                      if (hlsRef.current) hlsRef.current.currentLevel = lvl.id;
                      setCurrentLevel(lvl.id);
                    }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 8,
                      backgroundColor: currentLevel === lvl.id ? '#FFFFFF' : '#2B303C',
                      color: currentLevel === lvl.id ? '#09090F' : '#FFFFFF',
                      fontSize: 12,
                      fontWeight: currentLevel === lvl.id ? 700 : 500,
                      cursor: 'pointer',
                    }}
                  >
                    {lvl.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Subtitles */}
          {subtitles.length > 0 && (
            <div>
              <div style={{ fontSize: 12, color: '#9EA4B3', fontWeight: 600, marginBottom: 8 }}>
                Sous-titres
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button
                  onClick={() => {
                    if (hlsRef.current) hlsRef.current.subtitleTrack = -1;
                    setCurrentSub(-1);
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    backgroundColor: currentSub === -1 ? '#FFFFFF' : '#2B303C',
                    color: currentSub === -1 ? '#09090F' : '#FFFFFF',
                    fontSize: 12,
                    fontWeight: currentSub === -1 ? 700 : 500,
                    cursor: 'pointer',
                  }}
                >
                  Désactivé
                </button>
                {subtitles.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      if (hlsRef.current) hlsRef.current.subtitleTrack = s.id;
                      setCurrentSub(s.id);
                    }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 8,
                      backgroundColor: currentSub === s.id ? '#FFFFFF' : '#2B303C',
                      color: currentSub === s.id ? '#09090F' : '#FFFFFF',
                      fontSize: 12,
                      fontWeight: currentSub === s.id ? 700 : 500,
                      cursor: 'pointer',
                    }}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
