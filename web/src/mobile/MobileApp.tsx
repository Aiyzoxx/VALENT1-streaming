import React, { useState, useEffect } from 'react';
import { MediaItem, Episode } from '../shared/types/media';
import { useCatalog } from '../shared/data/catalog';
import { useFavorites } from '../shared/hooks/useFavorites';
import { useWatchHistory } from '../shared/hooks/useWatchHistory';
import { useAuth } from '../shared/hooks/useAuth';
import { useIsOffline } from '../shared/hooks/useIsOffline';
import { pullAndMerge, pushFavorites, pushWatch, resetSyncCache } from '../shared/sync/accountSync';
import { MobileDock, MobileTab } from './components/MobileDock';
import { MobileHomeView } from './views/MobileHomeView';
import { MobileSearchView } from './views/MobileSearchView';
import { MobileProfileView } from './views/MobileProfileView';
import { MobileAuthView } from './views/MobileAuthView';
import { MobileDetailView } from './views/MobileDetailView';
import { MobileVideoPlayer } from './views/MobileVideoPlayer';

interface ActiveStream {
  streamUrl: string;
  title: string;
  subtitle?: string;
  initialTime?: number;
  isLive?: boolean;
  mediaId?: string;
}

export const MobileApp: React.FC = () => {
  const { catalog, loading: catalogLoading } = useCatalog();
  const { user, token, logout } = useAuth();
  const isOffline = useIsOffline();

  const [activeTab, setActiveTab] = useState<MobileTab>('home');
  const [detailItem, setDetailItem] = useState<MediaItem | null>(null);
  const [activeStream, setActiveStream] = useState<ActiveStream | null>(null);

  const { isFavorite, toggleFavorite, favoriteItems, favoriteIds } = useFavorites();
  const { continueWatchingItems, updateProgress, getProgress, history, clearItem } = useWatchHistory();

  // Sync on login / user change
  useEffect(() => {
    resetSyncCache();
    if (user && token) {
      pullAndMerge(user.id, token).catch((e) => console.warn('Account sync failed:', e));
    }
  }, [user, token]);

  // Debounced push to PocketBase
  useEffect(() => {
    if (!user || !token) return;
    const t = setTimeout(() => {
      pushFavorites(user.id, token, favoriteIds);
    }, 1500);
    return () => clearTimeout(t);
  }, [user, token, favoriteIds]);

  useEffect(() => {
    if (!user || !token) return;
    const t = setTimeout(() => {
      pushWatch(user.id, token, history);
    }, 1500);
    return () => clearTimeout(t);
  }, [user, token, history]);

  const handlePlayMedia = (item: MediaItem, episode?: Episode) => {
    const progressKey = episode ? `${item.id}_ep_${episode.id}` : item.id;
    const progress = getProgress(progressKey) || getProgress(item.id);
    const initialTime = progress && !progress.completed ? progress.currentTime : 0;
    const streamUrl = episode ? episode.streamUrl : item.streamUrl;

    setActiveStream({
      streamUrl,
      title: item.title,
      subtitle: episode ? (episode.duration ? `${episode.title} (${episode.duration})` : episode.title) : undefined,
      initialTime,
      isLive: item.type === 'live',
      mediaId: progressKey,
    });
  };

  return (
    <div
      style={{
        width: '100%',
        minHeight: '100vh',
        backgroundColor: '#09090F',
        position: 'relative',
        color: '#FFFFFF',
      }}
    >
      {/* 1. Moteur Vidéo HLS Plein Écran */}
      {activeStream && (
        <MobileVideoPlayer
          streamUrl={activeStream.streamUrl}
          title={activeStream.title}
          subtitle={activeStream.subtitle}
          initialTime={activeStream.initialTime}
          isLive={activeStream.isLive}
          onClose={() => setActiveStream(null)}
          onProgressUpdate={(curr, dur) => {
            if (activeStream.mediaId) {
              updateProgress(activeStream.mediaId, curr, dur);
            }
          }}
        />
      )}

      {/* 2. Fiche Détails Figma (Screen 2) */}
      {detailItem && !activeStream && (
        <MobileDetailView
          item={detailItem}
          isFavorite={isFavorite(detailItem.id)}
          onClose={() => setDetailItem(null)}
          onPlay={handlePlayMedia}
          onToggleFavorite={toggleFavorite}
        />
      )}

      {/* 3. Contenu Principal de l'onglet actif */}
      {!activeStream && !detailItem && (
        <>
          {activeTab === 'home' && (
            <MobileHomeView
              catalog={catalog}
              onSelectItem={setDetailItem}
              onOpenVoiceSearch={() => setActiveTab('catalog')}
              accountName={user?.name}
            />
          )}

          {activeTab === 'catalog' && (
            <MobileSearchView
              catalog={catalog}
              onSelectItem={setDetailItem}
              onPlayItem={handlePlayMedia}
            />
          )}

          {activeTab === 'profile' && !user && <MobileAuthView />}

          {activeTab === 'profile' && user && (
            <MobileProfileView
              favoriteItems={favoriteItems}
              continueWatchingItems={continueWatchingItems}
              onSelectItem={setDetailItem}
              accountName={user.name}
              accountEmail={user.email}
              onLogout={logout}
              onRemoveHistoryItem={clearItem}
            />
          )}

          {/* 4. Dock de Navigation Flottant Îlot */}
          <MobileDock activeTab={activeTab} onTabChange={setActiveTab} />
        </>
      )}
    </div>
  );
};
