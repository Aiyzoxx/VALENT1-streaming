import React, { useState, useMemo, useDeferredValue, useEffect, useRef } from 'react';
import { MediaItem } from '../../shared/types/media';
import { AvatarPlaceholder } from '../components/AvatarPlaceholder';
import { SearchBarFigma } from '../components/SearchBarFigma';
import { MediaPosterCard } from '../components/MediaPosterCard';
import { useVoiceSearch } from '../../shared/hooks/useVoiceSearch';

interface MobileSearchViewProps {
  catalog: MediaItem[];
  onSelectItem: (item: MediaItem) => void;
  onPlayItem: (item: MediaItem) => void;
}

const FILTERS = [
  { id: 'Tous', label: 'Tous' },
  { id: 'Films', label: 'Films' },
  { id: 'Séries', label: 'Séries' },
];

export const MobileSearchView: React.FC<MobileSearchViewProps> = ({
  catalog,
  onSelectItem,
}) => {
  const [query, setQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('Tous');
  const [visibleCount, setVisibleCount] = useState(30);
  const deferredQuery = useDeferredValue(query);

  const { isListening, startListening, stopListening, isSupported } = useVoiceSearch((text) => {
    setQuery(text);
  });

  const handleMicPress = () => {
    if (isListening) stopListening();
    else if (isSupported) startListening();
  };

  // Pre-indexed search
  const filteredItems = useMemo(() => {
    let list = catalog;

    if (selectedFilter === 'Films') {
      list = list.filter((item) => item.type === 'movie');
    } else if (selectedFilter === 'Séries') {
      list = list.filter((item) => item.type === 'series');
    }

    if (deferredQuery.trim().length > 0) {
      const q = deferredQuery.toLowerCase().trim();
      list = list.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.synopsis?.toLowerCase().includes(q) ||
          item.genres?.some((g) => g.toLowerCase().includes(q)) ||
          item.cast?.some((c) => c.toLowerCase().includes(q))
      );
    }

    return list;
  }, [catalog, selectedFilter, deferredQuery]);

  // Reset pagination on filter or query change
  useEffect(() => {
    setVisibleCount(30);
  }, [selectedFilter, deferredQuery]);

  // Infinite scroll observer
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => Math.min(filteredItems.length, prev + 30));
        }
      },
      { threshold: 0.1 }
    );

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    return () => observer.disconnect();
  }, [filteredItems.length]);

  const activeIndex = Math.max(
    0,
    FILTERS.findIndex((f) => f.id === selectedFilter)
  );

  return (
    <div
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 20px) + 24px)',
        paddingBottom: 130,
        paddingLeft: 20,
        paddingRight: 20,
        width: '100%',
        minHeight: '100vh',
        boxSizing: 'border-box',
        overflowX: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <div>
          <span
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: '#FFFFFF',
              letterSpacing: -0.3,
            }}
          >
            Explorer{' '}
          </span>
          <span
            style={{
              fontSize: 24,
              fontWeight: 400,
              color: '#FFFFFF',
              letterSpacing: -0.3,
            }}
          >
            Catalogue
          </span>
          <div
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: '#7C8394',
              marginTop: 4,
            }}
          >
            Films, séries et documentaires en streaming
          </div>
        </div>

        <AvatarPlaceholder size={48} />
      </div>

      {/* Search Bar */}
      <div style={{ marginBottom: 16 }}>
        <SearchBarFigma
          value={query}
          onChangeText={setQuery}
          onOpenVoiceSearch={handleMicPress}
          isListening={isListening}
          placeholder="Rechercher un film, une série..."
        />
      </div>

      {/* Segmented Filter with sliding indicator */}
      <div
        style={{
          display: 'flex',
          backgroundColor: '#191C24',
          borderRadius: 18,
          padding: 4,
          position: 'relative',
          marginBottom: 20,
          border: '1px solid #262B36',
        }}
      >
        {/* Sliding pill */}
        <div
          style={{
            position: 'absolute',
            top: 4,
            bottom: 4,
            left: 4,
            width: `calc((100% - 8px) / 3)`,
            transform: `translateX(${activeIndex * 100}%)`,
            backgroundColor: '#2B303C',
            borderRadius: 14,
            transition: 'transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
          }}
        />

        {FILTERS.map((f) => {
          const isActive = selectedFilter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => {
                if (navigator.vibrate) {
                  try {
                    navigator.vibrate(10);
                  } catch {
                    /* ignore */
                  }
                }
                setSelectedFilter(f.id);
              }}
              style={{
                flex: 1,
                padding: '10px 0',
                textAlign: 'center',
                fontSize: 14,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? '#FFFFFF' : '#7C8394',
                position: 'relative',
                zIndex: 1,
                cursor: 'pointer',
                transition: 'color 0.15s ease',
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Results Count */}
      <div
        style={{
          fontSize: 13,
          color: '#7C8394',
          marginBottom: 14,
        }}
      >
        {filteredItems.length} {filteredItems.length > 1 ? 'résultats' : 'résultat'}
      </div>

      {/* 2-Column Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 14,
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {filteredItems.slice(0, visibleCount).map((item) => (
          <MediaPosterCard
            key={item.id}
            item={item}
            onPress={onSelectItem}
            showRating
          />
        ))}
      </div>

      {/* Intersection Sentinel */}
      {visibleCount < filteredItems.length && (
        <div
          ref={sentinelRef}
          style={{
            height: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#7C8394',
            fontSize: 12,
            marginTop: 16,
          }}
        >
          Chargement de la suite...
        </div>
      )}
    </div>
  );
};
