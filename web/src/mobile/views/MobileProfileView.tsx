import React, { useState } from 'react';
import { IoLogOutOutline, IoClose, IoHeartOutline, IoTrophyOutline } from 'react-icons/io5';
import { MediaItem, WatchProgress } from '../../shared/types/media';
import { AvatarPlaceholder } from '../components/AvatarPlaceholder';
import { MediaPosterCard } from '../components/MediaPosterCard';

interface MobileProfileViewProps {
  favoriteItems: MediaItem[];
  continueWatchingItems: { media: MediaItem; progress: WatchProgress }[];
  onSelectItem: (item: MediaItem) => void;
  accountName?: string;
  accountEmail?: string;
  onLogout?: () => void;
  onRemoveHistoryItem?: (id: string) => void;
}

type ProfileSubTab = 'favorites' | 'history';

export const MobileProfileView: React.FC<MobileProfileViewProps> = ({
  favoriteItems,
  continueWatchingItems,
  onSelectItem,
  accountName,
  accountEmail,
  onLogout,
  onRemoveHistoryItem,
}) => {
  const [subTab, setSubTab] = useState<ProfileSubTab>('favorites');

  return (
    <div
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 20px) + 24px)',
        paddingBottom: 120,
        paddingLeft: 22,
        paddingRight: 22,
        width: '100%',
        minHeight: '100vh',
        boxSizing: 'border-box',
      }}
    >
      {/* Profile Card Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#1A1F29',
          borderRadius: 24,
          padding: '20px 20px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 8px 16px rgba(0, 0, 0, 0.4)',
          marginBottom: 24,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <AvatarPlaceholder size={64} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#FFFFFF' }}>
                {accountName || 'Daizy'}
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: '#FFB800',
                  backgroundColor: 'rgba(255, 184, 0, 0.15)',
                  padding: '2px 6px',
                  borderRadius: 6,
                  border: '1px solid rgba(255, 184, 0, 0.3)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                <IoTrophyOutline size={10} /> VIP
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#7C8394', marginTop: 2 }}>
              {accountEmail || 'daizy@streamflow.xyz'}
            </div>
          </div>
        </div>

        {onLogout && (
          <button
            onClick={onLogout}
            title="Se déconnecter"
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: '#2B303C',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#9EA4B3',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <IoLogOutOutline size={20} />
          </button>
        )}
      </div>

      {/* Sub Tabs */}
      <div
        style={{
          display: 'flex',
          backgroundColor: '#191C24',
          borderRadius: 18,
          padding: 4,
          marginBottom: 20,
          border: '1px solid #262B36',
        }}
      >
        {(
          [
            { id: 'favorites', label: `Favoris (${favoriteItems.length})` },
            { id: 'history', label: `Historique (${continueWatchingItems.length})` },
          ] as const
        ).map((t) => {
          const isActive = subTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id)}
              style={{
                flex: 1,
                padding: '10px 0',
                fontSize: 13,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? '#FFFFFF' : '#7C8394',
                backgroundColor: isActive ? '#2B303C' : 'transparent',
                borderRadius: 14,
                transition: 'all 0.15s ease',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {subTab === 'favorites' && (
        <div>
          {favoriteItems.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '60px 20px',
                color: '#7C8394',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <IoHeartOutline size={48} color="#555C6E" />
              <div style={{ fontSize: 16, fontWeight: 700, color: '#FFFFFF' }}>
                Aucun favori pour le moment
              </div>
              <div style={{ fontSize: 13, maxWidth: 280 }}>
                Cliquez sur le cœur dans la fiche d'un film ou d'une série pour l'ajouter ici.
              </div>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 14,
                width: '100%',
                boxSizing: 'border-box',
              }}
            >
              {favoriteItems.map((item) => (
                <MediaPosterCard
                  key={item.id}
                  item={item}
                  onPress={onSelectItem}
                  showRating
                />
              ))}
            </div>
          )}
        </div>
      )}

      {subTab === 'history' && (
        <div>
          {continueWatchingItems.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '60px 20px',
                color: '#7C8394',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 700, color: '#FFFFFF' }}>
                Aucun historique de visionnage
              </div>
              <div style={{ fontSize: 13, maxWidth: 280 }}>
                Les contenus commencés s'afficheront ici avec votre progression.
              </div>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 14,
                width: '100%',
                boxSizing: 'border-box',
              }}
            >
              {continueWatchingItems.map(({ media, progress }) => {
                const percent = Math.min(
                  100,
                  Math.round((progress.currentTime / (progress.duration || 1)) * 100)
                );
                return (
                  <div key={progress.mediaId} style={{ position: 'relative', minWidth: 0 }}>
                    <MediaPosterCard
                      item={media}
                      onPress={onSelectItem}
                      showRating
                    />
                    {onRemoveHistoryItem && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveHistoryItem(progress.mediaId);
                        }}
                        style={{
                          position: 'absolute',
                          top: 8,
                          left: 8,
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          backgroundColor: 'rgba(0, 0, 0, 0.75)',
                          color: '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        <IoClose size={14} />
                      </button>
                    )}
                    <div
                      style={{
                        fontSize: 11,
                        color: '#9EA4B3',
                        marginTop: -10,
                        marginBottom: 12,
                      }}
                    >
                      Progression : {percent}%
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );
};
