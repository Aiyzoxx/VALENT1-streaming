import React, { useState, useMemo, useEffect, useDeferredValue } from 'react';
import { MediaItem } from '../../shared/types/media';
import { tmdb } from '../../shared/api/tmdb';
import { normTitle } from '../../shared/utils/format';
import { AvatarPlaceholder } from '../components/AvatarPlaceholder';
import { SearchBarFigma } from '../components/SearchBarFigma';
import { CoverflowCarousel } from '../components/CoverflowCarousel';
import { MediaPosterCard } from '../components/MediaPosterCard';
import { useVoiceSearch } from '../../shared/hooks/useVoiceSearch';

interface MobileHomeViewProps {
  catalog: MediaItem[];
  onSelectItem: (item: MediaItem) => void;
  onOpenVoiceSearch?: () => void;
  accountName?: string | null;
}

export const MobileHomeView: React.FC<MobileHomeViewProps> = ({
  catalog,
  onSelectItem,
  onOpenVoiceSearch,
  accountName,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearch = useDeferredValue(searchQuery);

  const { isListening, startListening, stopListening, isSupported } = useVoiceSearch((text) => {
    setSearchQuery(text);
  });

  const handleMicPress = () => {
    if (isListening) {
      stopListening();
    } else {
      if (isSupported) {
        startListening();
      } else if (onOpenVoiceSearch) {
        onOpenVoiceSearch();
      }
    }
  };

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
        console.warn('Trending fetch fallback:', e);
      }
    })();
    return () => {
      alive = false;
    };
  }, [seriesByName, moviesByName]);

  const featuredSeries = useMemo(() => {
    const moneyHeistOriginal = catalog.find(
      (item) => item.id === '3695' || item.title.toLowerCase().includes('casa de papel')
    ) || catalog[0] || {
      id: '3695',
      title: 'Money Heist : Part 5',
      type: 'series',
      streamUrl: '',
      backdropUrl: '',
      posterUrl: '',
      synopsis: '',
      genres: ['Action', 'Crime'],
      year: 2021,
      matchScore: 98,
      quality: '4K HDR',
      duration: '5 Saisons',
      ageRating: '16+',
    };

    const moneyHeistItem: MediaItem = {
      ...moneyHeistOriginal,
      id: '3695',
      title: 'Money Heist : Part 5',
      matchScore: 98,
      year: 2021,
    };

    const luciferOriginal = catalog.find(
      (item) => item.id === '3629' || item.title.toLowerCase() === 'lucifer'
    );
    const luciferItem: MediaItem = luciferOriginal
      ? {
          ...luciferOriginal,
          id: luciferOriginal.id,
          title: 'Lucifer',
          matchScore: 92,
          quality: '1080p FHD',
        }
      : {
          id: '3629',
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
          streamUrl: moneyHeistOriginal.streamUrl,
          synopsis:
            "In the City of Angels, he's not one. Lucifer Morningstar abandons his throne in Hell to live in Los Angeles.",
        };

    const sexEdOriginal = catalog.find(
      (item) => item.id === '3595' || item.title.toLowerCase().includes('sex education')
    );
    const sexEdItem: MediaItem = sexEdOriginal
      ? {
          ...sexEdOriginal,
          id: sexEdOriginal.id,
          title: 'Sex Education',
          matchScore: 94,
          quality: '1080p FHD',
        }
      : {
          id: '3595',
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
          streamUrl: moneyHeistOriginal.streamUrl,
          synopsis:
            'Growth is a group project. Otis and Maeve run an underground sex therapy clinic at school.',
        };

    const initialHero = [luciferItem, moneyHeistItem, sexEdItem];
    const liveOthers = liveFeatured
      ? liveFeatured.filter((item) => item.id !== '3695' && item.id !== '3629' && item.id !== '3595')
      : catalog
          .filter((item) => item.type === 'series' && item.id !== '3695' && item.id !== '3629' && item.id !== '3595')
          .slice(0, 8);

    return [...initialHero, ...liveOthers];
  }, [catalog, liveFeatured]);

  const filteredCatalog = useMemo(() => {
    if (deferredSearch.trim().length > 0) {
      const q = deferredSearch.toLowerCase();
      const matched = catalog.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.genres?.some((g) => g.toLowerCase().includes(q))
      );
      return {
        items: matched.slice(0, 30),
        total: matched.length,
      };
    }
    return null;
  }, [catalog, deferredSearch]);

  const popularMovies = useMemo(() => {
    if (livePopular) return livePopular;
    return catalog.filter((item) => item.type === 'movie').slice(0, 15);
  }, [catalog, livePopular]);

  return (
    <div
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 20px) + 24px)',
        paddingBottom: 120,
        width: '100%',
        minHeight: '100vh',
        boxSizing: 'border-box',
        overflowX: 'hidden',
      }}
    >
      {/* 1. Header Figma : "Hello Daizy!" + Avatar original */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0 22px',
          marginBottom: 20,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: 24,
                fontWeight: 800,
                color: '#FFFFFF',
                letterSpacing: -0.3,
              }}
            >
              Hello&nbsp;
            </span>
            <span
              style={{
                fontSize: 24,
                fontWeight: 500,
                color: '#FFFFFF',
                letterSpacing: -0.3,
              }}
            >
              {accountName ? `${accountName} !` : 'Daizy !'}
            </span>
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: '#7C8394',
              marginTop: 4,
            }}
          >
            Check for latest addition.
          </div>
        </div>

        <AvatarPlaceholder size={48} />
      </div>

      {/* 2. Search Bar Figma */}
      <div style={{ padding: '0 22px', marginBottom: 24 }}>
        <SearchBarFigma
          value={searchQuery}
          onChangeText={setSearchQuery}
          onOpenVoiceSearch={handleMicPress}
          isListening={isListening}
        />
      </div>

      {/* 3. Résultats de recherche si frappe en cours */}
      {filteredCatalog ? (
        <div style={{ padding: '0 22px' }}>
          <div
            style={{
              fontSize: 20,
              fontWeight: 800,
              color: '#FFFFFF',
              letterSpacing: -0.3,
            }}
          >
            Résultats de recherche
          </div>
          <div
            style={{
              fontSize: 13,
              color: '#7C8394',
              marginTop: 4,
              marginBottom: 16,
            }}
          >
            {filteredCatalog.total} {filteredCatalog.total > 1 ? 'résultats' : 'résultat'}
            {filteredCatalog.total > filteredCatalog.items.length
              ? ` — ${filteredCatalog.items.length} affichés (affinez la recherche)`
              : ''}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 14,
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            {filteredCatalog.items.map((item) => (
              <MediaPosterCard
                key={item.id}
                item={item}
                onPress={onSelectItem}
                showRating
              />
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* 4. Section "Featured Series" avec Carrousel 3D Coverflow Figma */}
          <div style={{ padding: '0 22px', marginBottom: 4 }}>
            <span
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: '#FFFFFF',
                letterSpacing: -0.3,
              }}
            >
              Featured{' '}
            </span>
            <span
              style={{
                fontSize: 20,
                fontWeight: 400,
                color: '#FFFFFF',
                letterSpacing: -0.3,
              }}
            >
              Series
            </span>
          </div>

          <CoverflowCarousel
            items={featuredSeries}
            onSelectItem={onSelectItem}
          />

          {/* 5. Section Secondaire : Popular Movies */}
          <div
            style={{
              padding: '0 22px',
              marginTop: 20,
              marginBottom: 14,
            }}
          >
            <span
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: '#FFFFFF',
                letterSpacing: -0.3,
              }}
            >
              Popular{' '}
            </span>
            <span
              style={{
                fontSize: 20,
                fontWeight: 400,
                color: '#FFFFFF',
                letterSpacing: -0.3,
              }}
            >
              Movies
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              overflowX: 'auto',
              padding: '0 22px',
              gap: 14,
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            {popularMovies.map((movie) => (
              <div key={movie.id} style={{ width: 130, flexShrink: 0 }}>
                <MediaPosterCard
                  item={movie}
                  width={130}
                  height={192}
                  onPress={onSelectItem}
                  showRating
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
