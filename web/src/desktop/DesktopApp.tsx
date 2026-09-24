import React, { useState, useEffect } from 'react';
import { MediaItem, Episode } from '../shared/types/media';
import { useCatalog } from '../shared/data/catalog';
import { useFavorites } from '../shared/hooks/useFavorites';
import { useWatchHistory } from '../shared/hooks/useWatchHistory';
import { useAuth } from '../shared/hooks/useAuth';
import { useVoiceSearch } from '../shared/hooks/useVoiceSearch';
import { pullAndMerge, pushFavorites, pushWatch, resetSyncCache } from '../shared/sync/accountSync';
import { DesktopSidebar, DesktopNavTab } from './components/DesktopSidebar';
import { DesktopHeader } from './components/DesktopHeader';
import { DesktopHomeView } from './views/DesktopHomeView';
import { DesktopCatalogView } from './views/DesktopCatalogView';
import { DesktopFavoritesView } from './views/DesktopFavoritesView';
import { DesktopHistoryView } from './views/DesktopHistoryView';
import { DesktopProfileView } from './views/DesktopProfileView';
import { DesktopDetailModal } from './components/DesktopDetailModal';
import { DesktopVideoPlayer } from './components/DesktopVideoPlayer';

interface ActiveStream {
  streamUrl: string;
  title: string;
  subtitle?: string;
  initialTime?: number;
  isLive?: boolean;
  mediaId?: string;
}

export const DesktopApp: React.FC = () => {
  const { catalog } = useCatalog();
  const { user, token, logout } = useAuth();

  const [activeTab, setActiveTab] = useState<DesktopNavTab>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [detailItem, setDetailItem] = useState<MediaItem | null>(null);
  const [activeStream, setActiveStream] = useState<ActiveStream | null>(null);

  const { isFavorite, toggleFavorite, favoriteItems, favoriteIds } = useFavorites();
  const { continueWatchingItems, updateProgress, getProgress, history, clearItem } = useWatchHistory();

  const { isListening, startListening, stopListening, isSupported } = useVoiceSearch((text) => {
    setSearchQuery(text);
    if (activeTab !== 'catalog') setActiveTab('catalog');
  });

  const handleMicPress = () => {
    if (isListening) stopListening();
    else if (isSupported) startListening();
  };

  // Sync on user change
  useEffect(() => {
    resetSyncCache();
    if (user && token) {
      pullAndMerge(user.id, token).catch((e) => console.warn('Account sync failed:', e));
    }
  }, [user, token]);

  // Push favorites
  useEffect(() => {
    if (!user || !token) return;
    const t = setTimeout(() => {
      pushFavorites(user.id, token, favoriteIds);
    }, 1500);
    return () => clearTimeout(t);
  }, [user, token, favoriteIds]);

  // Push watch
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

  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
    if (q.trim().length > 0 && activeTab !== 'catalog') {
      setActiveTab('catalog');
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        backgroundColor: '#09090F',
        color: '#FFFFFF',
      }}
    >
      {/* 1. Left Sidebar */}
      <DesktopSidebar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          if (tab !== 'catalog') setSearchQuery('');
        }}
        accountName={user?.name}
        accountEmail={user?.email}
        onLogout={logout}
        favoritesCount={favoriteItems.length}
      />

      {/* 2. Main Content Area */}
      <div
        style={{
          marginLeft: 250,
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        <DesktopHeader
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          onOpenVoiceSearch={handleMicPress}
          isListening={isListening}
        />

        <main style={{ flex: 1, paddingTop: 24 }}>
          {activeTab === 'home' && (
            <DesktopHomeView
              catalog={catalog}
              continueWatchingItems={continueWatchingItems}
              isFavorite={isFavorite}
              onToggleFavorite={toggleFavorite}
              onSelectItem={setDetailItem}
              onPlayDirect={handlePlayMedia}
            />
          )}

          {activeTab === 'catalog' && (
            <DesktopCatalogView
              catalog={catalog}
              searchQuery={searchQuery}
              isFavorite={isFavorite}
              onToggleFavorite={toggleFavorite}
              onSelectItem={setDetailItem}
              onPlayDirect={handlePlayMedia}
              defaultTypeFilter="all"
            />
          )}

          {activeTab === 'movies' && (
            <DesktopCatalogView
              catalog={catalog}
              searchQuery={searchQuery}
              isFavorite={isFavorite}
              onToggleFavorite={toggleFavorite}
              onSelectItem={setDetailItem}
              onPlayDirect={handlePlayMedia}
              defaultTypeFilter="movie"
            />
          )}

          {activeTab === 'series' && (
            <DesktopCatalogView
              catalog={catalog}
              searchQuery={searchQuery}
              isFavorite={isFavorite}
              onToggleFavorite={toggleFavorite}
              onSelectItem={setDetailItem}
              onPlayDirect={handlePlayMedia}
              defaultTypeFilter="series"
            />
          )}

          {activeTab === 'favorites' && (
            <DesktopFavoritesView
              favoriteItems={favoriteItems}
              isFavorite={isFavorite}
              onToggleFavorite={toggleFavorite}
              onSelectItem={setDetailItem}
              onPlayDirect={handlePlayMedia}
            />
          )}

          {activeTab === 'history' && (
            <DesktopHistoryView
              continueWatchingItems={continueWatchingItems}
              isFavorite={isFavorite}
              onToggleFavorite={toggleFavorite}
              onSelectItem={setDetailItem}
              onPlayDirect={handlePlayMedia}
              onRemoveItem={clearItem}
            />
          )}

          {activeTab === 'profile' && (
            <DesktopProfileView
              favoritesCount={favoriteItems.length}
              historyCount={continueWatchingItems.length}
            />
          )}
        </main>
      </div>

      {/* 3. Detail Modal */}
      {detailItem && !activeStream && (
        <DesktopDetailModal
          item={detailItem}
          isFavorite={isFavorite(detailItem.id)}
          onClose={() => setDetailItem(null)}
          onPlay={handlePlayMedia}
          onToggleFavorite={toggleFavorite}
        />
      )}

      {/* 4. Fullscreen Video Player */}
      {activeStream && (
        <DesktopVideoPlayer
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
    </div>
  );
};
