import React, { useState, useMemo, useEffect, useRef } from 'react';
import { MediaItem } from '../../shared/types/media';
import { CATEGORIES } from '../../shared/data/catalog';
import { DesktopPosterCard } from '../components/DesktopPosterCard';

interface DesktopCatalogViewProps {
  catalog: MediaItem[];
  searchQuery: string;
  isFavorite: (id: string) => boolean;
  onToggleFavorite: (id: string) => void;
  onSelectItem: (item: MediaItem) => void;
  onPlayDirect: (item: MediaItem) => void;
  defaultTypeFilter?: 'all' | 'movie' | 'series';
}

export const DesktopCatalogView: React.FC<DesktopCatalogViewProps> = ({
  catalog,
  searchQuery,
  isFavorite,
  onToggleFavorite,
  onSelectItem,
  onPlayDirect,
  defaultTypeFilter = 'all',
}) => {
  const [typeFilter, setTypeFilter] = useState<'all' | 'movie' | 'series'>(defaultTypeFilter);
  const [selectedCategory, setSelectedCategory] = useState<string>('Tout');
  const [visibleCount, setVisibleCount] = useState(48);

  useEffect(() => {
    setTypeFilter(defaultTypeFilter);
  }, [defaultTypeFilter]);

  const filteredItems = useMemo(() => {
    let list = catalog;

    if (typeFilter === 'movie') {
      list = list.filter((item) => item.type === 'movie');
    } else if (typeFilter === 'series') {
      list = list.filter((item) => item.type === 'series');
    }

    if (selectedCategory !== 'Tout') {
      list = list.filter((item) =>
        item.genres?.some((g) => g.toLowerCase().includes(selectedCategory.toLowerCase()))
      );
    }

    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.synopsis?.toLowerCase().includes(q) ||
          item.genres?.some((g) => g.toLowerCase().includes(q)) ||
          item.cast?.some((c) => c.toLowerCase().includes(q))
      );
    }

    return list;
  }, [catalog, typeFilter, selectedCategory, searchQuery]);

  useEffect(() => {
    setVisibleCount(48);
  }, [typeFilter, selectedCategory, searchQuery]);

  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => Math.min(filteredItems.length, prev + 36));
        }
      },
      { threshold: 0.1 }
    );

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    return () => observer.disconnect();
  }, [filteredItems.length]);

  return (
    <div style={{ padding: '0 40px 60px' }}>
      {/* Title & Filter Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
            {typeFilter === 'movie'
              ? 'Films'
              : typeFilter === 'series'
              ? 'Séries'
              : searchQuery
              ? `Recherche : "${searchQuery}"`
              : 'Catalogue Complet'}
          </h1>
          <div style={{ fontSize: 13, color: '#7C8394', marginTop: 4 }}>
            {filteredItems.length} {filteredItems.length > 1 ? 'titres disponibles' : 'titre disponible'}
          </div>
        </div>

        {/* Type Filter Buttons */}
        <div
          style={{
            display: 'flex',
            backgroundColor: '#191C24',
            borderRadius: 14,
            padding: 4,
            border: '1px solid #262B36',
          }}
        >
          {(
            [
              { id: 'all', label: 'Tous' },
              { id: 'movie', label: 'Films' },
              { id: 'series', label: 'Séries' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTypeFilter(tab.id)}
              style={{
                padding: '8px 18px',
                borderRadius: 10,
                backgroundColor: typeFilter === tab.id ? '#2B303C' : 'transparent',
                color: typeFilter === tab.id ? '#FFFFFF' : '#7C8394',
                fontSize: 13,
                fontWeight: typeFilter === tab.id ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Category Pills Rail */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          paddingBottom: 14,
          marginBottom: 28,
        }}
      >
        {CATEGORIES.map((cat) => {
          const isActive = selectedCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                padding: '6px 16px',
                borderRadius: 9999,
                backgroundColor: isActive ? '#FFFFFF' : '#1A1F29',
                color: isActive ? '#09090F' : '#9EA4B3',
                fontSize: 13,
                fontWeight: isActive ? 700 : 500,
                border: '1px solid rgba(255, 255, 255, 0.08)',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all 0.15s ease',
              }}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 20,
        }}
      >
        {filteredItems.slice(0, visibleCount).map((item) => (
          <DesktopPosterCard
            key={item.id}
            item={item}
            onPress={onSelectItem}
            onPlayDirect={onPlayDirect}
            isFavorite={isFavorite(item.id)}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </div>

      {/* Sentinel for infinite scroll */}
      {visibleCount < filteredItems.length && (
        <div
          ref={sentinelRef}
          style={{
            height: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#7C8394',
            fontSize: 13,
            marginTop: 20,
          }}
        >
          Chargement de la suite du catalogue...
        </div>
      )}
    </div>
  );
};
