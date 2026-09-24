import React, { useState, useMemo, useEffect } from 'react';
import {
  IoClose,
  IoPlay,
  IoHeart,
  IoHeartOutline,
  IoStar,
} from 'react-icons/io5';
import { MediaItem, Episode } from '../../shared/types/media';
import { tmdb, tmdbImage } from '../../shared/api/tmdb';

interface DesktopDetailModalProps {
  item: MediaItem;
  isFavorite: boolean;
  onClose: () => void;
  onPlay: (item: MediaItem, episode?: Episode) => void;
  onToggleFavorite: (id: string) => void;
}

export const DesktopDetailModal: React.FC<DesktopDetailModalProps> = ({
  item,
  isFavorite,
  onClose,
  onPlay,
  onToggleFavorite,
}) => {
  const [animatingHeart, setAnimatingHeart] = useState(false);

  const isMoneyHeist =
    item.id === '3695' ||
    item.title.toLowerCase().includes('money heist') ||
    item.title.toLowerCase().includes('casa de papel');

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const allEpisodes: Episode[] = useMemo(() => {
    if (isMoneyHeist) {
      const baseStream = item.streamUrl || 'https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8';
      return [
        {
          id: '3695-s5-e1',
          season: 5,
          episodeNumber: 1,
          title: 'The End of the Road',
          duration: '50m',
          synopsis: 'The Professor faces Sierra while Tamayo raises the stakes of the negotiation by calling in the army.',
          streamUrl: item.episodeUrls?.[0]?.url || item.episodes?.[0]?.streamUrl || baseStream,
          thumbnailUrl: '/assets/figma/episode_1.png',
        },
        {
          id: '3695-s5-e2',
          season: 5,
          episodeNumber: 2,
          title: 'Do You Believe in Reincarnation?',
          duration: '52m',
          synopsis: 'Arturo seizes an opportunity to fight back while escalating a personal vendetta.',
          streamUrl: item.episodeUrls?.[1]?.url || item.episodes?.[1]?.streamUrl || baseStream,
          thumbnailUrl: '/assets/figma/episode_2.png',
        },
        {
          id: '3695-s5-e3',
          season: 5,
          episodeNumber: 3,
          title: 'Welcome to the Show of Life',
          duration: '50m',
          synopsis: 'A betrayal and an emergency catch Sierra off guard. Palermo rallies the troops as the army closes in.',
          streamUrl: item.episodeUrls?.[2]?.url || item.episodes?.[2]?.streamUrl || baseStream,
          thumbnailUrl: '/assets/figma/episode_3.png',
        },
        {
          id: '3695-s5-e4',
          season: 5,
          episodeNumber: 4,
          title: 'Your Place in Heaven',
          duration: '52m',
          synopsis: 'Helsinki’s life hangs in the balance as the team faces intense crossfire from the military unit.',
          streamUrl: item.episodeUrls?.[3]?.url || item.episodes?.[3]?.streamUrl || baseStream,
          thumbnailUrl: '/assets/figma/episode_1.png',
        },
      ];
    }

    if (item.episodes && item.episodes.length > 0) {
      return [...item.episodes].sort((a, b) => {
        if (a.season !== b.season) return a.season - b.season;
        return a.episodeNumber - b.episodeNumber;
      });
    }

    if (item.episodeUrls && item.episodeUrls.length > 0) {
      const parsed = item.episodeUrls.map((ep, idx) => {
        const match = ep.url.match(/S(\d+)\/E(\d+)/i);
        const sNum = match ? parseInt(match[1], 10) : 1;
        const eNum = match ? parseInt(match[2], 10) : idx + 1;
        const isTechnicalName = !ep.name || /pulse\s*\|/i.test(ep.name);
        const epTitle = !isTechnicalName && ep.name?.trim() ? ep.name.trim() : `Épisode ${eNum}`;
        return {
          id: `${item.id}-s${sNum}-e${eNum}`,
          season: sNum,
          episodeNumber: eNum,
          title: epTitle,
          duration: '',
          synopsis: `Épisode ${eNum} de la saison ${sNum}`,
          streamUrl: ep.url,
          thumbnailUrl: item.backdropUrl || item.posterUrl,
        };
      });

      return parsed.sort((a, b) => {
        if (a.season !== b.season) return a.season - b.season;
        return a.episodeNumber - b.episodeNumber;
      });
    }
    return [];
  }, [item, isMoneyHeist]);

  const seasons = useMemo(
    () => Array.from(new Set(allEpisodes.map((ep) => ep.season))).sort((a, b) => a - b),
    [allEpisodes]
  );

  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const activeSeason =
    selectedSeason != null && seasons.includes(selectedSeason)
      ? selectedSeason
      : seasons[0] ?? 1;

  const seasonEpisodes = useMemo(
    () => allEpisodes.filter((ep) => ep.season === activeSeason),
    [allEpisodes, activeSeason]
  );

  const [stills, setStills] = useState<Record<string, string>>({});
  const [epTitles, setEpTitles] = useState<Record<string, string>>({});
  const [epSynopses, setEpSynopses] = useState<Record<string, string>>({});

  useEffect(() => {
    setStills({});
    setEpTitles({});
    setEpSynopses({});
  }, [item?.id]);

  useEffect(() => {
    if (!item || isMoneyHeist || seasonEpisodes.length === 0) return;
    let alive = true;

    (async () => {
      try {
        const cleanTitle = item.title
          .replace(/\s*:\s*(Saison|Season|Part|Partie).*$/i, '')
          .replace(/\s*:\s*Rien n[’']a changé.*$/i, '')
          .trim();

        let search = await tmdb.searchSeries(cleanTitle);
        let match = search.results?.[0];
        if (!match && cleanTitle !== item.title) {
          search = await tmdb.searchSeries(item.title);
          match = search.results?.[0];
        }
        if (!alive || !match) return;

        const seasonData = await tmdb.seriesSeason(match.id, activeSeason);
        if (!alive || !seasonData?.episodes) return;

        const mapStills: Record<string, string> = {};
        const mapTitles: Record<string, string> = {};
        const mapSynopses: Record<string, string> = {};

        for (const tmdbEp of seasonData.episodes) {
          const localEp = seasonEpisodes.find(
            (e) => e.episodeNumber === tmdbEp.episode_number
          );
          if (localEp) {
            if (tmdbEp.still_path) {
              mapStills[localEp.id] = tmdbImage(tmdbEp.still_path, 'w500');
            }
            if (tmdbEp.name && tmdbEp.name.trim()) {
              mapTitles[localEp.id] = tmdbEp.name.trim();
            }
            if (tmdbEp.overview && tmdbEp.overview.trim()) {
              mapSynopses[localEp.id] = tmdbEp.overview.trim();
            }
          }
        }

        setStills((prev) => ({ ...prev, ...mapStills }));
        setEpTitles((prev) => ({ ...prev, ...mapTitles }));
        setEpSynopses((prev) => ({ ...prev, ...mapSynopses }));
      } catch (e) {
        console.warn('Episode stills failed:', e);
      }
    })();

    return () => {
      alive = false;
    };
  }, [item, isMoneyHeist, activeSeason, seasonEpisodes]);

  const starCount = useMemo(() => {
    if (isMoneyHeist) return 4;
    const score = item.matchScore || 80;
    if (score >= 90) return 5;
    if (score >= 75) return 4;
    return 3;
  }, [item.matchScore, isMoneyHeist]);

  const heroImageSrc = isMoneyHeist
    ? '/assets/figma/hero_money_heist.jpg'
    : item.backdropUrl || item.posterUrl;

  const handlePlayMain = () => {
    const firstEp = seasonEpisodes[0] ?? allEpisodes[0];
    onPlay(item, firstEp);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(4, 6, 12, 0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '30px 40px',
        boxSizing: 'border-box',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 1060,
          maxHeight: '92vh',
          backgroundColor: '#131720',
          borderRadius: 28,
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.8)',
          overflowY: 'auto',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 20,
            right: 20,
            width: 44,
            height: 44,
            borderRadius: '50%',
            backgroundColor: 'rgba(9, 9, 15, 0.7)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            cursor: 'pointer',
            zIndex: 30,
            transition: 'transform 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <IoClose size={24} />
        </button>

        {/* Hero Banner inside modal */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: 380,
            backgroundColor: '#09090F',
            flexShrink: 0,
          }}
        >
          <img
            src={heroImageSrc}
            alt={item.title}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(to top, #131720 0%, rgba(19, 23, 32, 0.6) 40%, rgba(19, 23, 32, 0.1) 100%)',
            }}
          />

          <div
            style={{
              position: 'absolute',
              bottom: 30,
              left: 40,
              right: 40,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              zIndex: 10,
            }}
          >
            <div>
              {/* Badges */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                {item.matchScore && (
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      color: '#10B981',
                      backgroundColor: 'rgba(16, 185, 129, 0.15)',
                      padding: '3px 8px',
                      borderRadius: 6,
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                    }}
                  >
                    {item.matchScore}% Recommandé
                  </span>
                )}
                <span style={{ fontSize: 13, color: '#9EA4B3', fontWeight: 600 }}>
                  {item.year || 2021}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    padding: '2px 6px',
                    borderRadius: 4,
                  }}
                >
                  {item.quality || '4K HDR'}
                </span>
                {item.duration && (
                  <span style={{ fontSize: 13, color: '#9EA4B3' }}>{item.duration}</span>
                )}
              </div>

              <h2
                style={{
                  fontSize: 34,
                  fontWeight: 800,
                  color: '#FFFFFF',
                  letterSpacing: -0.6,
                  margin: 0,
                }}
              >
                {isMoneyHeist ? 'Money Heist : Part 5' : item.title}
              </h2>

              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8 }}>
                {[1, 2, 3, 4, 5].map((index) => (
                  <IoStar
                    key={index}
                    size={16}
                    color={index <= starCount ? '#FFB800' : '#555C6E'}
                  />
                ))}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <button
                onClick={handlePlayMain}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  backgroundColor: '#FFFFFF',
                  color: '#09090F',
                  fontSize: 15,
                  fontWeight: 700,
                  padding: '12px 26px',
                  borderRadius: 14,
                  cursor: 'pointer',
                  boxShadow: '0 0 25px rgba(255, 255, 255, 0.35)',
                  transition: 'transform 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.04)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                <IoPlay size={20} color="#09090F" />
                <span>Lecture</span>
              </button>

              <button
                onClick={() => {
                  setAnimatingHeart(true);
                  onToggleFavorite(item.id);
                  setTimeout(() => setAnimatingHeart(false), 420);
                }}
                className={animatingHeart ? 'heart-pop-anim' : ''}
                title={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 14,
                  backgroundColor: isFavorite ? 'rgba(229, 9, 20, 0.25)' : 'rgba(26, 31, 41, 0.85)',
                  border: isFavorite
                    ? '1px solid rgba(229, 9, 20, 0.6)'
                    : '1px solid rgba(255, 255, 255, 0.15)',
                  color: isFavorite ? '#E50914' : 'rgba(255, 255, 255, 0.7)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
              >
                {isFavorite ? <IoHeart size={22} color="#E50914" /> : <IoHeartOutline size={22} />}
              </button>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px 40px 40px' }}>
          {/* Synopsis */}
          <div style={{ marginBottom: 30 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#FFFFFF', marginBottom: 8 }}>
              Synopsis
            </h3>
            <p
              style={{
                fontSize: 15,
                lineHeight: 1.65,
                color: '#9EA4B3',
                margin: 0,
                maxWidth: 850,
              }}
            >
              {item.synopsis ||
                "Retrouvez l'intégralité de ce programme exclusif en qualité haute définition avec pistes audio et sous-titres originaux."}
            </p>
          </div>

          {/* Genres */}
          {item.genres && item.genres.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 30 }}>
              <span style={{ fontSize: 13, color: '#7C8394', fontWeight: 600 }}>Genres :</span>
              {item.genres.map((g) => (
                <span
                  key={g}
                  style={{
                    fontSize: 12,
                    color: '#FFFFFF',
                    backgroundColor: '#1A1F29',
                    padding: '4px 12px',
                    borderRadius: 8,
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                  }}
                >
                  {g}
                </span>
              ))}
            </div>
          )}

          {/* Episodes list if series */}
          {allEpisodes.length > 0 && (
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 16,
                }}
              >
                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#FFFFFF', margin: 0 }}>
                  Épisodes
                </h3>
                {seasons.length > 1 && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    {seasons.map((s) => (
                      <button
                        key={s}
                        onClick={() => setSelectedSeason(s)}
                        style={{
                          padding: '6px 14px',
                          borderRadius: 10,
                          backgroundColor: s === activeSeason ? '#FFFFFF' : '#1A1F29',
                          color: s === activeSeason ? '#09090F' : '#9EA4B3',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                        }}
                      >
                        Saison {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Episodes Grid (2 columns on Desktop) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 16,
                }}
              >
                {seasonEpisodes.map((ep, idx) => {
                  const epImage = isMoneyHeist
                    ? `/assets/figma/episode_${(idx % 3) + 1}.png`
                    : stills[ep.id] ||
                      (ep.thumbnailUrl &&
                      ep.thumbnailUrl !== item.backdropUrl &&
                      ep.thumbnailUrl !== item.posterUrl
                        ? ep.thumbnailUrl
                        : item.backdropUrl || item.posterUrl);

                  const epDisplayTitle = epTitles[ep.id] || ep.title;
                  const epDisplaySynopsis = epSynopses[ep.id] || ep.synopsis;

                  return (
                    <div
                      key={ep.id}
                      onClick={() => onPlay(item, ep)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 16,
                        backgroundColor: '#1A1F29',
                        borderRadius: 16,
                        padding: 12,
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#232938';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#1A1F29';
                      }}
                    >
                      <div
                        style={{
                          width: 140,
                          height: 85,
                          borderRadius: 12,
                          overflow: 'hidden',
                          position: 'relative',
                          flexShrink: 0,
                          backgroundColor: '#09090F',
                        }}
                      >
                        <img
                          src={epImage}
                          alt={epDisplayTitle}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                          onError={(e) => {
                            if (item.backdropUrl && e.currentTarget.src !== item.backdropUrl) {
                              e.currentTarget.src = item.backdropUrl;
                            } else if (item.posterUrl && e.currentTarget.src !== item.posterUrl) {
                              e.currentTarget.src = item.posterUrl;
                            }
                          }}
                        />
                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            backgroundColor: 'rgba(0, 0, 0, 0.35)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <IoPlay size={24} color="#FFFFFF" />
                        </div>
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: '#FFFFFF',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {ep.episodeNumber}. {epDisplayTitle}
                        </div>
                        {ep.duration && (
                          <div style={{ fontSize: 11, color: '#7C8394', marginTop: 2 }}>
                            {ep.duration}
                          </div>
                        )}
                        <div
                          style={{
                            fontSize: 12,
                            color: '#9EA4B3',
                            marginTop: 4,
                            lineHeight: 1.4,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {epDisplaySynopsis}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
