import React from 'react';
import { IoTimeOutline, IoClose } from 'react-icons/io5';
import { MediaItem, WatchProgress } from '../../shared/types/media';
import { DesktopPosterCard } from '../components/DesktopPosterCard';

interface DesktopHistoryViewProps {
  continueWatchingItems: { media: MediaItem; progress: WatchProgress }[];
  isFavorite: (id: string) => boolean;
  onToggleFavorite: (id: string) => void;
  onSelectItem: (item: MediaItem) => void;
  onPlayDirect: (item: MediaItem) => void;
  onRemoveItem: (id: string) => void;
}

export const DesktopHistoryView: React.FC<DesktopHistoryViewProps> = ({
  continueWatchingItems,
  isFavorite,
  onToggleFavorite,
  onSelectItem,
  onPlayDirect,
  onRemoveItem,
}) => {
  return (
    <div style={{ padding: '0 40px 60px' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
          Historique de visionnage
        </h1>
        <div style={{ fontSize: 13, color: '#7C8394', marginTop: 4 }}>
          {continueWatchingItems.length} {continueWatchingItems.length > 1 ? 'programmes commencés' : 'programme commencé'}
        </div>
      </div>

      {continueWatchingItems.length === 0 ? (
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
          <IoTimeOutline size={64} color="#555C6E" />
          <div style={{ fontSize: 20, fontWeight: 700, color: '#FFFFFF' }}>
            Aucun historique de visionnage
          </div>
          <p style={{ fontSize: 14, maxWidth: 360, margin: 0, lineHeight: 1.6 }}>
            Lancez un film ou une série pour synchroniser votre progression et reprendre à tout moment.
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
          {continueWatchingItems.map(({ media, progress }) => {
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
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveItem(progress.mediaId);
                  }}
                  title="Supprimer de l'historique"
                  style={{
                    position: 'absolute',
                    top: 8,
                    left: 8,
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    backgroundColor: 'rgba(0, 0, 0, 0.75)',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    zIndex: 4,
                  }}
                >
                  <IoClose size={16} />
                </button>
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
                <div style={{ fontSize: 11, color: '#9EA4B3', marginTop: 4 }}>
                  Progression : {percent}%
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
