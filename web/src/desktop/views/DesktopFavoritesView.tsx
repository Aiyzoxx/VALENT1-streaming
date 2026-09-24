import React from 'react';
import { IoHeartOutline } from 'react-icons/io5';
import { MediaItem } from '../../shared/types/media';
import { DesktopPosterCard } from '../components/DesktopPosterCard';

interface DesktopFavoritesViewProps {
  favoriteItems: MediaItem[];
  isFavorite: (id: string) => boolean;
  onToggleFavorite: (id: string) => void;
  onSelectItem: (item: MediaItem) => void;
  onPlayDirect: (item: MediaItem) => void;
}

export const DesktopFavoritesView: React.FC<DesktopFavoritesViewProps> = ({
  favoriteItems,
  isFavorite,
  onToggleFavorite,
  onSelectItem,
  onPlayDirect,
}) => {
  return (
    <div style={{ padding: '0 40px 60px' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
          Mes Favoris
        </h1>
        <div style={{ fontSize: 13, color: '#7C8394', marginTop: 4 }}>
          {favoriteItems.length} {favoriteItems.length > 1 ? 'titres enregistrés' : 'titre enregistré'}
        </div>
      </div>

      {favoriteItems.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '100px 20px',
            color: '#7C8394',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <IoHeartOutline size={64} color="#555C6E" />
          <div style={{ fontSize: 20, fontWeight: 700, color: '#FFFFFF' }}>
            Aucun favori pour le moment
          </div>
          <p style={{ fontSize: 14, maxWidth: 360, margin: 0, lineHeight: 1.6 }}>
            Explorez le catalogue et cliquez sur l'icône cœur pour retrouver vos films et séries préférés ici.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 20,
          }}
        >
          {favoriteItems.map((item) => (
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
      )}
    </div>
  );
};
