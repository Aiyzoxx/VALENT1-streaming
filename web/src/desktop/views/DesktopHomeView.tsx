import React, { useState, useMemo, useEffect } from 'react';
import { MediaItem, WatchProgress } from '../../shared/types/media';
import { tmdb } from '../../shared/api/tmdb';
import { normTitle } from '../../shared/utils/format';
import { DesktopHeroBanner } from '../components/DesktopHeroBanner';
import { DesktopPosterCard } from '../components/DesktopPosterCard';

interface DesktopHomeViewProps {
  catalog: MediaItem[];
  continueWatchingItems: { media: MediaItem; progress: WatchProgress }[];
  isFavorite: (id: string) => boolean;
  onToggleFavorite: (id: string) => void;
  onSelectItem: (item: MediaItem) => void;
  onPlayDirect: (item: MediaItem) => void;
}

export const DesktopHomeView: React.FC<DesktopHomeViewProps> = ({
  catalog,
  continueWatchingItems,
  isFavorite,
  onToggleFavorite,
  onSelectItem,
  onPlayDirect,
}) => {
  const seriesByName = useMemo(() => {
    const map = new Map<string, MediaItem>();
    for (const item of catalog) {
      if (item.type !== 'series') continue;
      const k = normTitle(item.title);
      if (k && !map.has(k)) map.set(k, item);
    }
    return map;
  }, [catalog]);

  const moviesByName = useMemo(() => {
    const map = new Map<string, MediaItem>();
    for (const item of catalog) {
      if (item.type !== 'movie') continue;
      const k = normTitle(item.title);
      if (k && !map.has(k)) map.set(k, item);
    }
    return map;
  }, [catalog]);

  const [liveFeatured, setLiveFeatured] = useState<MediaItem[] | null>(null);
  const [livePopular, setLivePopular] = useState<MediaItem[] | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [tvRes, movieRes] = await Promise.all([
          tmdb.trending('tv', 'week'),
          tmdb.trending('movie', 'week'),
        ]);
        if (!alive) return;

        const pickedSeries: MediaItem[] = [];
        const seenSeries = new Set<string>();
        for (const r of tvRes.results) {
          const name = 'name' in r && r.name ? r.name : null;
          if (!name) continue;
          const m = seriesByName.get(normTitle(name));
          if (m && !seenSeries.has(m.id)) {
            seenSeries.add(m.id);
            pickedSeries.push(m);
          }
          if (pickedSeries.length >= 10) break;
        }

        const pickedMovies: MediaItem[] = [];
        const seenMovies = new Set<string>();
        for (const r of movieRes.results) {
          const title = 'title' in r && r.title ? r.title : null;
          if (!title) continue;
          const m = moviesByName.get(normTitle(title));
          if (m && !seenMovies.has(m.id)) {
            seenMovies.add(m.id);
            pickedMovies.push(m);
          }
          if (pickedMovies.length >= 15) break;
        }

        if (!alive) return;
        if (pickedSeries.length >= 3) setLiveFeatured(pickedSeries);
        if (pickedMovies.length >= 5) setLivePopular(pickedMovies);
      } catch (e) {
        console.warn('Desktop trending fetch fallback:', e);
      }
    })();
    return () => {
      alive = false;
    };
  }, [seriesByName, moviesByName]);

  const heroItem: MediaItem = useMemo(() => {
    const moneyHeistOriginal = catalog.find(
      (item) => item.id === '3695' || item.title.toLowerCase().includes('casa de papel')
    ) || catalog[0] || {
      id: '3695',
      title: 'Money Heist : Part 5',
      type: 'series',
      streamUrl: '',
      backdropUrl: '',
      posterUrl: '',
      synopsis: "L'armée s'apprête à donner l'assaut final. Alors que tout semble perdu, le Professeur et son équipe tentent l'impossible.",
      genres: ['Action', 'Crime', 'Drame'],
      year: 2021,
      matchScore: 98,
      quality: '4K HDR',
      duration: '5 Saisons',
      ageRating: '16+',
    };

    return {
      ...moneyHeistOriginal,
      id: '3695',
      title: 'Money Heist : Part 5',
      matchScore: 98,
      year: 2021,
    };
  }, [catalog]);

  const featuredSeries = useMemo(() => {
    if (liveFeatured) return liveFeatured;

    const luciferItem: MediaItem = {
      id: 'lucifer-figma',
      title: 'Lucifer',
      type: 'series',
      posterUrl: '',
      backdropUrl: '',
      quality: '1080p FHD',
      duration: '45m',
      ageRating: '16+',
      genres: ['Crime', 'Drama', 'Fantasy'],
      matchScore: 92,
      year: 2021,
      streamUrl: heroItem.streamUrl,
      synopsis: "In the City of Angels, he's not one. Lucifer Morningstar abandons his throne in Hell to live in Los Angeles.",
    };

    const sexEdItem: MediaItem = {
      id: 'sex-ed-figma',
      title: 'Sex Education',
      type: 'series',
      posterUrl: '',
      backdropUrl: '',
      quality: '1080p FHD',
      duration: '52m',
      ageRating: '16+',
      genres: ['Comedy', 'Drama'],
      matchScore: 94,
      year: 2021,
      streamUrl: heroItem.streamUrl,
      synopsis: 'Growth is a group project. Otis and Maeve run an underground sex therapy clinic at school.',
    };

    const others = catalog.filter((item) => item.type === 'series' && item.id !== '3695').slice(0, 10);
    return [heroItem, luciferItem, sexEdItem, ...others];
  }, [catalog, liveFeatured, heroItem]);

  const popularMovies = useMemo(() => {
    if (livePopular) return livePopular;
    return catalog.filter((item) => item.type === 'movie').slice(0, 14);
  }, [catalog, livePopular]);

  return (
    <div style={{ padding: '0 40px 60px' }}>
      {/* 1. Cinematic Hero Banner */}
      <DesktopHeroBanner
        item={heroItem}
        isFavorite={isFavorite(heroItem.id)}
        onPlay={onPlayDirect}
        onOpenDetails={onSelectItem}
        onToggleFavorite={onToggleFavorite}
      />

      {/* 2. Reprendre la lecture (si historique présent) */}
      {continueWatchingItems.length > 0 && (
        <section style={{ marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
              Reprendre la lecture
            </h2>
            <span style={{ fontSize: 13, color: '#7C8394', fontWeight: 600 }}>
              ({continueWatchingItems.length})
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: 20,
            }}
          >
            {continueWatchingItems.slice(0, 6).map(({ media, progress }) => {
              const percent = Math.min(
                100,
                Math.round((progress.currentTime / (progress.duration || 1)) * 100)
              );
              return (
                <div key={progress.mediaId} style={{ position: 'relative' }}>
                  <DesktopPosterCard
                    item={media}
                    onPress={onSelectItem}
                    onPlayDirect={onPlayDirect}
                    isFavorite={isFavorite(media.id)}
                    onToggleFavorite={onToggleFavorite}
                  />
                  {/* Progress bar under card */}
                  <div
                    style={{
                      height: 4,
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: 2,
                      marginTop: 6,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${percent}%`,
                        backgroundColor: '#FFFFFF',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 3. Séries en vedette (Featured Series) */}
      <section style={{ marginBottom: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
            Séries en vedette
          </h2>
          <span style={{ fontSize: 13, color: '#7C8394', fontWeight: 600 }}>
            Les programmes les plus regardés
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 20,
          }}
        >
          {featuredSeries.slice(0, 7).map((series) => (
            <DesktopPosterCard
              key={series.id}
              item={series}
              onPress={onSelectItem}
              onPlayDirect={onPlayDirect}
              isFavorite={isFavorite(series.id)}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
      </section>

      {/* 4. Films Populaires (Popular Movies) */}
      <section style={{ marginBottom: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
            Films Populaires
          </h2>
          <span style={{ fontSize: 13, color: '#7C8394', fontWeight: 600 }}>
            Sélection haute définition
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 20,
          }}
        >
          {popularMovies.map((movie) => (
            <DesktopPosterCard
              key={movie.id}
              item={movie}
              onPress={onSelectItem}
              onPlayDirect={onPlayDirect}
              isFavorite={isFavorite(movie.id)}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
      </section>
    </div>
  );
};
