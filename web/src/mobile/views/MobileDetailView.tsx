import React, { useState, useMemo, useEffect } from 'react';
import { IoArrowBack, IoHeart, IoHeartOutline, IoPlay, IoStar } from 'react-icons/io5';
import { MediaItem, Episode } from '../../shared/types/media';
import { tmdb, tmdbImage } from '../../shared/api/tmdb';
import { optimizeImageUrl } from '../../shared/utils/image';

interface MobileDetailViewProps {
  item: MediaItem;
  isFavorite: boolean;
  onClose: () => void;
  onPlay: (item: MediaItem, episode?: Episode) => void;
  onToggleFavorite: (id: string) => void;
}

export const MobileDetailView: React.FC<MobileDetailViewProps> = ({
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
          thumbnailUrl: '/assets/figma/episode_1.webp',
        },
        {
          id: '3695-s5-e2',
          season: 5,
          episodeNumber: 2,
          title: 'Do You Believe in Reincarnation?',
          duration: '52m',
          synopsis: 'Arturo seizes an opportunity to fight back while escalating a personal vendetta.',
          streamUrl: item.episodeUrls?.[1]?.url || item.episodes?.[1]?.streamUrl || baseStream,
          thumbnailUrl: '/assets/figma/episode_2.webp',
        },
        {
          id: '3695-s5-e3',
          season: 5,
          episodeNumber: 3,
          title: 'Welcome to the Show of Life',
          duration: '50m',
          synopsis: 'A betrayal and an emergency catch Sierra off guard. Palermo rallies the troops as the army closes in.',
          streamUrl: item.episodeUrls?.[2]?.url || item.episodes?.[2]?.streamUrl || baseStream,
          thumbnailUrl: '/assets/figma/episode_3.webp',
        },
        {
          id: '3695-s5-e4',
          season: 5,
          episodeNumber: 4,
          title: 'Your Place in Heaven',
          duration: '52m',
          synopsis: 'Helsinki’s life hangs in the balance as the team faces intense crossfire from the military unit.',
          streamUrl: item.episodeUrls?.[3]?.url || item.episodes?.[3]?.streamUrl || baseStream,
          thumbnailUrl: '/assets/figma/episode_1.webp',
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

  // TMDB stills & metadata fetching for series
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

        // Fetch full season data in ONE request (covers, titles, overviews)
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

  const metaString = useMemo(() => {
    if (isMoneyHeist) {
      return '2021  |  Action, Crime, Drama  |  Episode - 8';
    }
    const year = item.year || 2021;
    const genres =
      item.genres && item.genres.length > 0
        ? item.genres.slice(0, 3).join(', ')
        : 'Action, Drame';
    const epCount =
      allEpisodes.length > 0 ? `Episode - ${allEpisodes.length}` : item.duration || 'Film';
    return `${year}  |  ${genres}  |  ${epCount}`;
  }, [item, allEpisodes, isMoneyHeist]);

  const heroImageSrc = isMoneyHeist
    ? '/assets/figma/hero_money_heist.webp'
    : optimizeImageUrl(item.backdropUrl || item.posterUrl, 'backdrop');

  const handlePlayMain = () => {
    const firstEp = seasonEpisodes[0] ?? allEpisodes[0];
    onPlay(item, firstEp);
  };

  return (
    <div
      className="animate-detail-enter"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#09090F',
        zIndex: 1000,
        overflowY: 'auto',
        overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {/* Hero Header */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '46vh',
          minHeight: 280,
          maxHeight: 460,
          backgroundColor: '#04060C',
        }}
      >
        <img
          src={heroImageSrc}
          alt={item.title}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />

        {/* Multi-stop Linear Gradient */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(to bottom, rgba(4,6,12,0.85) 0%, transparent 35%, rgba(9,9,15,1) 85%)',
          }}
        />

        {/* Top Action Bar */}
        <div
          style={{
            position: 'absolute',
            top: 'calc(env(safe-area-inset-top, 20px) + 12px)',
            left: 20,
            right: 20,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            zIndex: 10,
          }}
        >
          <button
            onClick={onClose}
            aria-label="Retour"
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              backgroundColor: 'rgba(9, 9, 15, 0.65)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              cursor: 'pointer',
            }}
          >
            <IoArrowBack size={22} />
          </button>

          <button
            onClick={() => {
              setAnimatingHeart(true);
              if (navigator.vibrate) {
                try {
                  navigator.vibrate(15);
                } catch {
                  /* ignore */
                }
              }
              onToggleFavorite(item.id);
              setTimeout(() => setAnimatingHeart(false), 420);
            }}
            aria-label="Favori"
            className={animatingHeart ? 'heart-pop-anim' : ''}
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              backgroundColor: isFavorite ? 'rgba(229, 9, 20, 0.25)' : 'rgba(9, 9, 15, 0.65)',
              backdropFilter: 'blur(10px)',
              border: isFavorite
                ? '1px solid rgba(229, 9, 20, 0.6)'
                : '1px solid rgba(255, 255, 255, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isFavorite ? '#E50914' : 'rgba(255, 255, 255, 0.7)',
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          >
            {isFavorite ? <IoHeart size={22} color="#E50914" /> : <IoHeartOutline size={22} />}
          </button>
        </div>

        {/* Center Big Play Button (White with subtle glow as in Figma) */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 10,
          }}
        >
          <button
            onClick={handlePlayMain}
            aria-label="Lire la vidéo"
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              backgroundColor: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 35px rgba(255, 255, 255, 0.45), 0 8px 24px rgba(0, 0, 0, 0.6)',
              cursor: 'pointer',
              transition: 'transform 0.15s ease',
            }}
          >
            <IoPlay size={34} color="#09090F" style={{ marginLeft: 4 }} />
          </button>
        </div>
      </div>

      {/* Details & Title */}
      <div
        style={{
          padding: '0 24px',
          textAlign: 'center',
          marginTop: -20,
          position: 'relative',
          zIndex: 5,
        }}
      >
        <h1
          style={{
            fontSize: 24,
            fontWeight: 800,
            color: '#FFFFFF',
            letterSpacing: -0.3,
            lineHeight: 1.25,
            marginBottom: 8,
          }}
        >
          {isMoneyHeist ? 'Money Heist : Part 5' : item.title}
        </h1>

        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: '#9EA4B3',
            marginBottom: 12,
          }}
        >
          {metaString}
        </div>

        {/* 5-star rating */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 4,
            marginBottom: 20,
          }}
        >
          {[1, 2, 3, 4, 5].map((index) => (
            <IoStar
              key={index}
              size={18}
              color={index <= starCount ? '#FFB800' : '#555C6E'}
            />
          ))}
        </div>

        {/* Synopsis */}
        {item.synopsis && (
          <div
            style={{
              fontSize: 14,
              lineHeight: 1.6,
              color: '#9EA4B3',
              textAlign: 'left',
              marginBottom: 24,
              backgroundColor: 'rgba(26, 31, 41, 0.6)',
              padding: 16,
              borderRadius: 16,
              border: '1px solid rgba(255, 255, 255, 0.05)',
            }}
          >
            {item.synopsis}
          </div>
        )}
      </div>

      {/* Episodes Section for series */}
      {allEpisodes.length > 0 && (
        <div style={{ padding: '0 24px', paddingBottom: 60 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 700, color: '#FFFFFF' }}>
              Episodes
            </div>
            <div style={{ fontSize: 13, color: '#7C8394' }}>
              {seasonEpisodes.length} épisodes
            </div>
          </div>

          {/* Season Pills */}
          {seasons.length > 1 && (
            <div
              style={{
                display: 'flex',
                gap: 8,
                overflowX: 'auto',
                paddingBottom: 14,
                marginBottom: 10,
              }}
            >
              {seasons.map((s) => {
                const isActive = s === activeSeason;
                return (
                  <button
                    key={s}
                    onClick={() => setSelectedSeason(s)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 14,
                      backgroundColor: isActive ? '#FFFFFF' : '#1A1F29',
                      color: isActive ? '#09090F' : '#9EA4B3',
                      fontSize: 13,
                      fontWeight: isActive ? 700 : 500,
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    Saison {s}
                  </button>
                );
              })}
            </div>
          )}

          {/* Episode List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {seasonEpisodes.map((ep, idx) => {
              const rawEpImage = isMoneyHeist
                ? `/assets/figma/episode_${(idx % 3) + 1}.webp`
                : stills[ep.id] ||
                  (ep.thumbnailUrl &&
                  ep.thumbnailUrl !== item.backdropUrl &&
                  ep.thumbnailUrl !== item.posterUrl
                    ? ep.thumbnailUrl
                    : item.backdropUrl || item.posterUrl);
              const epImage = optimizeImageUrl(rawEpImage, 'thumb');

              const epDisplayTitle = epTitles[ep.id] || ep.title;
              const epDisplaySynopsis = epSynopses[ep.id] || ep.synopsis;

              return (
                <div
                  key={ep.id}
                  onClick={() => onPlay(item, ep)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    backgroundColor: '#1A1F29',
                    borderRadius: 16,
                    padding: 10,
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    cursor: 'pointer',
                    boxShadow: '0 4px 10px rgba(0, 0, 0, 0.3)',
                    transition: 'transform 0.15s ease, background-color 0.15s ease',
                  }}
                  onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
                  onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                  onTouchStart={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
                  onTouchEnd={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  <div
                    style={{
                      width: 110,
                      height: 72,
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
                        backgroundColor: 'rgba(0, 0, 0, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <IoPlay size={20} color="#FFFFFF" />
                    </div>
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
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
                        lineHeight: 1.35,
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
  );
};
