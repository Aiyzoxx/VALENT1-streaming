import React, { useState, useEffect, useRef, useCallback } from 'react';
import Hls from 'hls.js';
import {
  IoArrowBack,
  IoPlay,
  IoPause,
  IoSettingsOutline,
  IoExpandOutline,
  IoContractOutline,
  IoTvOutline,
  IoReloadOutline,
} from 'react-icons/io5';
import { formatTime } from '../../shared/utils/format';
import { resolvePlayableStreamUrl } from '../../shared/api/hls';

interface MobileVideoPlayerProps {
  streamUrl: string;
  title: string;
  subtitle?: string;
  initialTime?: number;
  isLive?: boolean;
  onClose: () => void;
  onProgressUpdate?: (currentTime: number, duration: number) => void;
}

type SettingsTab = 'quality' | 'speed' | 'audio' | 'subtitles';

const SPEED_OPTIONS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

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
  const [levels, setLevels] = useState<{ id: number; label: string }[]>([]);
  const [currentLevel, setCurrentLevel] = useState(-1); // -1 = Auto
  const [audioTracks, setAudioTracks] = useState<{ id: number; name: string }[]>([]);
  const [currentAudio, setCurrentAudio] = useState(0);
  const [subtitles, setSubtitles] = useState<{ id: number; name: string }[]>([]);
  const [currentSub, setCurrentSub] = useState(-1); // -1 = Off
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

  // Resolve stream URL for incompatible playlists
  useEffect(() => {
    let alive = true;
    resolvePlayableStreamUrl(streamUrl).then((url) => {
      if (alive) setResolvedUrl(url);
    });
    return () => {
      alive = false;
    };
  }, [streamUrl]);

  // Init HLS player
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !resolvedUrl) return;

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
      });

      hlsRef.current = hls;
      hls.loadSource(resolvedUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
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
        video.play()
          .then(() => setIsPlaying(true))
          .catch(() => {
            // Autoplay was blocked by browser policy; reveal controls so user can tap
            setIsPlaying(false);
            setControlsVisible(true);
          });
      });

      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_, data) => {
        setAudioTracks(data.audioTracks.map((t, idx) => ({ id: idx, name: t.name || t.lang || `Piste ${idx + 1}` })));
      });

      hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (_, data) => {
        setSubtitles(data.subtitleTracks.map((s, idx) => ({ id: idx, name: s.name || s.lang || `Sous-titre ${idx + 1}` })));
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
        setCurrentLevel(hls.autoLevelEnabled ? -1 : data.level);
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
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
              setStreamError('Impossible de charger la vidéo. Vérifiez votre connexion.');
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
      // Native Safari support
      video.src = resolvedUrl;
      video.addEventListener('loadedmetadata', () => {
        setIsBuffering(false);
        setStreamError(null);
        if (initialTime > 0) video.currentTime = initialTime;
        video.play()
          .then(() => setIsPlaying(true))
          .catch(() => {
            setIsPlaying(false);
            setControlsVisible(true);
          });
      });
      video.addEventListener('error', () => {
        setStreamError('Erreur de lecture sur le lecteur vidéo.');
        setIsBuffering(false);
        setControlsVisible(true);
      });
    }
  }, [resolvedUrl, initialTime]);

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
      setCenterFeedback({ type: 'play', key: Date.now() });
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
      setCenterFeedback({ type: 'pause', key: Date.now() });
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

  const togglePiP = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (e) {
      console.warn('PiP error:', e);
    }
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
        onTimeUpdate={handleTimeUpdate}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
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

      {/* Top Bar Controls */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          padding: 'calc(env(safe-area-inset-top, 20px) + 12px) 20px 20px',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            onClick={onClose}
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              cursor: 'pointer',
            }}
          >
            <IoArrowBack size={22} />
          </button>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#FFFFFF' }}>{title}</div>
            {subtitle && <div style={{ fontSize: 12, color: '#9EA4B3' }}>{subtitle}</div>}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={togglePiP}
            title="Picture in Picture"
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              cursor: 'pointer',
            }}
          >
            <IoTvOutline size={20} />
          </button>
          <button
            onClick={() => {
              setShowSettings(true);
              setControlsVisible(true);
            }}
            title="Réglages"
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              cursor: 'pointer',
            }}
          >
            <IoSettingsOutline size={20} />
          </button>
        </div>
      </div>

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
            width: 76,
            height: 76,
            borderRadius: '50%',
            backgroundColor: 'rgba(9, 9, 15, 0.72)',
            backdropFilter: 'blur(12px)',
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
          {centerFeedback.type === 'play' && <IoPlay size={38} style={{ marginLeft: 3 }} />}
          {centerFeedback.type === 'pause' && <IoPause size={38} />}
          {centerFeedback.type === 'seek-10' && (
            <>
              <IoReloadOutline size={28} style={{ transform: 'scaleX(-1)' }} />
              <span style={{ fontSize: 11, fontWeight: 800 }}>-10s</span>
            </>
          )}
          {centerFeedback.type === 'seek+10' && (
            <>
              <IoReloadOutline size={28} />
              <span style={{ fontSize: 11, fontWeight: 800 }}>+10s</span>
            </>
          )}
        </div>
      )}

      {/* Center Controls (Play/Pause, +/- 10s) */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          display: 'flex',
          alignItems: 'center',
          gap: 36,
          opacity: controlsVisible ? 1 : 0,
          pointerEvents: controlsVisible ? 'auto' : 'none',
          transition: 'opacity 0.25s ease',
          zIndex: 10,
        }}
      >
        <button
          onClick={() => seek(-10)}
          className={seekingLeft ? 'animate-seek-left' : ''}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            color: '#FFFFFF',
            cursor: 'pointer',
            transition: 'transform 0.15s ease',
          }}
        >
          <IoReloadOutline size={30} style={{ transform: 'scaleX(-1)' }} />
          <span style={{ fontSize: 10, fontWeight: 700, marginTop: 2 }}>-10s</span>
        </button>

        <button
          onClick={togglePlay}
          style={{
            width: 68,
            height: 68,
            borderRadius: '50%',
            backgroundColor: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#09090F',
            boxShadow: '0 0 25px rgba(255, 255, 255, 0.35)',
            cursor: 'pointer',
            transition: 'transform 0.1s ease',
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = 'scale(0.9)';
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          {isPlaying ? <IoPause size={32} /> : <IoPlay size={32} style={{ marginLeft: 3 }} />}
        </button>

        <button
          onClick={() => seek(10)}
          className={seekingRight ? 'animate-seek-right' : ''}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            color: '#FFFFFF',
            cursor: 'pointer',
            transition: 'transform 0.15s ease',
          }}
        >
          <IoReloadOutline size={30} />
          <span style={{ fontSize: 10, fontWeight: 700, marginTop: 2 }}>+10s</span>
        </button>
      </div>

      {/* Bottom Bar Controls */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '20px 20px calc(env(safe-area-inset-bottom, 12px) + 12px)',
          background: 'linear-gradient(to top, rgba(0, 0, 0, 0.85) 0%, transparent 100%)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
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
            height: 4,
            cursor: 'pointer',
          }}
        />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 4,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#9EA4B3' }}>
            {isLive ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  color: '#E50914',
                  fontWeight: 700,
                  fontSize: 11,
                  backgroundColor: 'rgba(229, 9, 20, 0.15)',
                  padding: '2px 8px',
                  borderRadius: 6,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    backgroundColor: '#E50914',
                  }}
                />
                EN DIRECT
              </span>
            ) : (
              <span>
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            )}
          </div>

          <button
            onClick={toggleFullscreen}
            style={{
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
            }}
          >
            {isFullscreen ? <IoContractOutline size={22} /> : <IoExpandOutline size={22} />}
          </button>
        </div>
      </div>

      {/* Settings Bottom Sheet */}
      {showSettings && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            zIndex: 100,
          }}
          onClick={() => setShowSettings(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="animate-sheet-up"
            style={{
              backgroundColor: '#1A1F29',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: '24px 20px calc(env(safe-area-inset-bottom, 20px) + 20px)',
              maxHeight: '65vh',
              overflowY: 'auto',
            }}
          >
            {/* Sheet Tabs */}
            <div
              style={{
                display: 'flex',
                backgroundColor: '#191C24',
                borderRadius: 14,
                padding: 4,
                marginBottom: 20,
              }}
            >
              {(
                [
                  { id: 'quality', label: 'Qualité' },
                  { id: 'speed', label: 'Vitesse' },
                  { id: 'audio', label: 'Audio' },
                  { id: 'subtitles', label: 'Sous-titres' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    flex: 1,
                    padding: '8px 0',
                    fontSize: 12,
                    fontWeight: activeTab === tab.id ? 700 : 500,
                    color: activeTab === tab.id ? '#FFFFFF' : '#7C8394',
                    backgroundColor: activeTab === tab.id ? '#2B303C' : 'transparent',
                    borderRadius: 10,
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Quality List */}
            {activeTab === 'quality' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  onClick={() => setQualityLevel(-1)}
                  style={{
                    padding: '12px 16px',
                    borderRadius: 12,
                    backgroundColor: currentLevel === -1 ? '#2B303C' : 'transparent',
                    color: currentLevel === -1 ? '#FFFFFF' : '#9EA4B3',
                    fontWeight: currentLevel === -1 ? 700 : 500,
                    textAlign: 'left',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>Automatique (Recommandé)</span>
                  {currentLevel === -1 && <span>✓</span>}
                </button>
                {levels.map((lvl) => (
                  <button
                    key={lvl.id}
                    onClick={() => setQualityLevel(lvl.id)}
                    style={{
                      padding: '12px 16px',
                      borderRadius: 12,
                      backgroundColor: currentLevel === lvl.id ? '#2B303C' : 'transparent',
                      color: currentLevel === lvl.id ? '#FFFFFF' : '#9EA4B3',
                      fontWeight: currentLevel === lvl.id ? 700 : 500,
                      textAlign: 'left',
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>{lvl.label}</span>
                    {currentLevel === lvl.id && <span>✓</span>}
                  </button>
                ))}
              </div>
            )}

            {/* Speed List */}
            {activeTab === 'speed' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {SPEED_OPTIONS.map((spd) => (
                  <button
                    key={spd}
                    onClick={() => setSpeed(spd)}
                    style={{
                      padding: '12px 16px',
                      borderRadius: 12,
                      backgroundColor: playbackSpeed === spd ? '#2B303C' : 'transparent',
                      color: playbackSpeed === spd ? '#FFFFFF' : '#9EA4B3',
                      fontWeight: playbackSpeed === spd ? 700 : 500,
                      textAlign: 'left',
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>{spd}x {spd === 1.0 ? '(Normal)' : ''}</span>
                    {playbackSpeed === spd && <span>✓</span>}
                  </button>
                ))}
              </div>
            )}

            {/* Audio Tracks */}
            {activeTab === 'audio' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {audioTracks.length === 0 ? (
                  <div style={{ color: '#7C8394', textAlign: 'center', padding: '20px 0', fontSize: 13 }}>
                    Piste audio par défaut (stéréo)
                  </div>
                ) : (
                  audioTracks.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        if (hlsRef.current) hlsRef.current.audioTrack = t.id;
                        setCurrentAudio(t.id);
                        setShowSettings(false);
                      }}
                      style={{
                        padding: '12px 16px',
                        borderRadius: 12,
                        backgroundColor: currentAudio === t.id ? '#2B303C' : 'transparent',
                        color: currentAudio === t.id ? '#FFFFFF' : '#9EA4B3',
                        fontWeight: currentAudio === t.id ? 700 : 500,
                        textAlign: 'left',
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>{t.name}</span>
                      {currentAudio === t.id && <span>✓</span>}
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Subtitles */}
            {activeTab === 'subtitles' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  onClick={() => {
                    if (hlsRef.current) hlsRef.current.subtitleTrack = -1;
                    setCurrentSub(-1);
                    setShowSettings(false);
                  }}
                  style={{
                    padding: '12px 16px',
                    borderRadius: 12,
                    backgroundColor: currentSub === -1 ? '#2B303C' : 'transparent',
                    color: currentSub === -1 ? '#FFFFFF' : '#9EA4B3',
                    fontWeight: currentSub === -1 ? 700 : 500,
                    textAlign: 'left',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>Désactivé</span>
                  {currentSub === -1 && <span>✓</span>}
                </button>
                {subtitles.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      if (hlsRef.current) hlsRef.current.subtitleTrack = s.id;
                      setCurrentSub(s.id);
                      setShowSettings(false);
                    }}
                    style={{
                      padding: '12px 16px',
                      borderRadius: 12,
                      backgroundColor: currentSub === s.id ? '#2B303C' : 'transparent',
                      color: currentSub === s.id ? '#FFFFFF' : '#9EA4B3',
                      fontWeight: currentSub === s.id ? 700 : 500,
                      textAlign: 'left',
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>{s.name}</span>
                    {currentSub === s.id && <span>✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
