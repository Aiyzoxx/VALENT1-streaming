import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  Platform,
  Image,
  Animated,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

// Data & Types
import { CATALOG } from './src/data/catalog';
import { MediaItem, Episode } from './src/types/media';
import { THEME } from './src/constants/theme';

// Hooks
import { useFavorites } from './src/hooks/useFavorites';
import { useWatchHistory } from './src/hooks/useWatchHistory';
import { useAppFonts } from './src/hooks/useAppFonts';
import { AuthProvider, useAuth } from './src/hooks/useAuth';
import {
  pullAndMerge,
  pushFavorites,
  pushWatch,
  resetSyncCache,
} from './src/sync/accountSync';

// Figma Views & Components
import { FigmaHomeView } from './src/components/FigmaHomeView';
import { FigmaDetailView } from './src/components/FigmaDetailView';
import { FigmaProfileView } from './src/components/FigmaProfileView';
import { SearchView } from './src/components/SearchView';
import { VideoPlayerView } from './src/components/VideoPlayerView';
import { AuthView } from './src/components/AuthView';

type TabType = 'home' | 'catalog' | 'profile';

interface ActiveStream {
  streamUrl: string;
  title: string;
  subtitle?: string;
  initialTime?: number;
  isLive?: boolean;
  mediaId?: string;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <GatedApp />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

// Attend polices + session, fusionne compte<->local AVANT le montage
// des hooks (ils chargent AsyncStorage au mount).
function GatedApp() {
  const fontsReady = useAppFonts();
  const { user, token, loading: authLoading } = useAuth();
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    if (!fontsReady || authLoading) return;
    let alive = true;
    (async () => {
      resetSyncCache();
      if (user && token) {
        // Masque pendant la fusion pour remonter MainApp sur données fusionnées.
        setSynced(false);
        try {
          await pullAndMerge(user.id, token);
        } catch (e) {
          console.warn('Account sync failed, local only:', e);
        }
      }
      if (alive) setSynced(true);
    })();
    return () => {
      alive = false;
    };
  }, [fontsReady, authLoading, user, token]);

  if (!fontsReady || authLoading || !synced) return null;
  return <MainApp key={user?.id ?? 'guest'} />;
}

function MainApp() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [detailItem, setDetailItem] = useState<MediaItem | null>(null);
  const [activeStream, setActiveStream] = useState<ActiveStream | null>(null);

  const { isFavorite, toggleFavorite, favoriteItems, favoriteIds } = useFavorites();
  const { continueWatchingItems, updateProgress, getProgress, history, clearItem } = useWatchHistory();
  const { user, token, logout } = useAuth();

  // Push compte en debounce quand le local change (connecté uniquement).
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

  // Animation fluide de transition entre les onglets
  const tabFadeAnim = useRef(new Animated.Value(1)).current;
  const tabTranslateY = useRef(new Animated.Value(0)).current;

  // Tab change handler avec transition douce (Fade + Micro-Slide)
  const handleTabChange = (tab: TabType | 'search') => {
    try {
      Haptics.selectionAsync();
    } catch (_) {}
    const newTab = tab === 'search' ? 'catalog' : tab;
    if (newTab === activeTab) return;

    tabFadeAnim.setValue(0.2);
    tabTranslateY.setValue(6);
    setActiveTab(newTab);

    Animated.parallel([
      Animated.timing(tabFadeAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.spring(tabTranslateY, {
        toValue: 0,
        friction: 8,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Launch video player for a MediaItem
  const handlePlayMedia = (item: MediaItem, episode?: Episode) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (_) {}

    const progress = getProgress(item.id);
    const initialTime = progress && !progress.completed ? progress.currentTime : 0;

    setActiveStream({
      streamUrl: episode ? episode.streamUrl : item.streamUrl,
      title: item.title,
      subtitle: episode ? `${episode.title} (${episode.duration})` : undefined,
      initialTime,
      isLive: item.type === 'live',
      mediaId: item.id,
    });
  };

  // Launch video player from M3U8 Tester
  const handlePlayCustomStream = (stream: { url: string; title: string; isLive: boolean }) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (_) {}

    setActiveStream({
      streamUrl: stream.url,
      title: stream.title,
      subtitle: stream.isLive ? 'Flux Direct M3U8' : 'Flux HLS Externe',
      isLive: stream.isLive,
    });
  };

  // Dock flottant type îlot centré au-dessus de la zone safe-area
  const dockBottomOffset = (insets.bottom > 0 ? insets.bottom : (Platform.OS === 'ios' ? 20 : 12)) + 4;

  return (
    <View style={styles.rootContainer}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={THEME.colors.background}
        hidden={activeStream !== null}
      />

      {/* 1. Moteur Vidéo HLS Plein Écran Custom */}
      {activeStream && (
        <View style={styles.playerFullscreenWrapper}>
          <VideoPlayerView
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
        </View>
      )}

      {/* 2. Fiche Détails Figma (Screen 2) */}
      {detailItem && !activeStream && (
        <View style={styles.detailFullscreenWrapper}>
          <FigmaDetailView
            item={detailItem}
            isFavorite={isFavorite(detailItem.id)}
            onClose={() => setDetailItem(null)}
            onPlay={handlePlayMedia}
            onToggleFavorite={toggleFavorite}
          />
        </View>
      )}

      {/* 3. Contenu Principal de l'Application (Screen 1 & Onglets) */}
      {!activeStream && !detailItem && (
        <View style={styles.safeArea}>
          <View style={styles.mainContent}>
            {/* Conteneur animé pour les changements d'onglets */}
            <Animated.View
              style={[
                styles.tabContentContainer,
                { opacity: tabFadeAnim, transform: [{ translateY: tabTranslateY }] },
              ]}
            >
              {/* Onglet 1: Accueil (Home Figma Replica) */}
              {activeTab === 'home' && (
                <FigmaHomeView
                  catalog={CATALOG}
                  history={continueWatchingItems.map(c => ({
                    item: c.media,
                    position: c.progress.currentTime,
                  }))}
                  onSelectItem={setDetailItem}
                  onOpenVoiceSearch={() => handleTabChange('catalog')}
                  accountName={user?.name}
                />
              )}

              {/* Onglet 2: Catalogue & Recherche */}
              {activeTab === 'catalog' && (
                <SearchView
                  onSelectItem={setDetailItem}
                  onPlayItem={handlePlayMedia}
                />
              )}

              {/* Onglet 3: Compte — login si déconnecté, profil sinon */}
              {activeTab === 'profile' && !user && <AuthView />}
              {activeTab === 'profile' && user && (
                <FigmaProfileView
                  favoriteItems={favoriteItems}
                  continueWatchingItems={continueWatchingItems}
                  onSelectItem={setDetailItem}
                  onPlayItem={handlePlayMedia}
                  onPlayCustomStream={handlePlayCustomStream}
                  accountName={user.name}
                  accountEmail={user.email}
                  onLogout={logout}
                  onRemoveHistoryItem={clearItem}
                />
              )}
            </Animated.View>
          </View>

          {/* 4. Dock de Navigation Flottant — Îlot centré compact */}
          <View style={[styles.bottomNavDock, { bottom: dockBottomOffset }]}>
            {/* Accueil */}
            <NavDockItem
              isActive={activeTab === 'home'}
              onPress={() => handleTabChange('home')}
              iconActive="home"
              iconInactive="home-outline"
              iconSize={24}
            />

            {/* Catalogue */}
            <NavDockItem
              isActive={activeTab === 'catalog'}
              onPress={() => handleTabChange('catalog')}
              iconActive="grid"
              iconInactive="grid-outline"
              iconSize={23}
            />

            {/* Compte */}
            <NavDockItem
              isActive={activeTab === 'profile'}
              onPress={() => handleTabChange('profile')}
              iconActive="person"
              iconInactive="person-outline"
              iconSize={24}
            />
          </View>
        </View>
      )}
    </View>
  );
}

interface NavDockItemProps {
  isActive: boolean;
  onPress: () => void;
  iconActive: keyof typeof Ionicons.glyphMap;
  iconInactive: keyof typeof Ionicons.glyphMap;
  iconSize: number;
}

const NavDockItem: React.FC<NavDockItemProps> = ({
  isActive,
  onPress,
  iconActive,
  iconInactive,
  iconSize,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const dotScale = useRef(new Animated.Value(isActive ? 1 : 0)).current;

  useEffect(() => {
    if (isActive) {
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.12, duration: 110, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
      ]).start();

      Animated.spring(dotScale, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true }).start();
    } else {
      Animated.timing(scaleAnim, { toValue: 1, duration: 90, useNativeDriver: true }).start();
      Animated.timing(dotScale, { toValue: 0, duration: 90, useNativeDriver: true }).start();
    }
  }, [isActive]);

  return (
    <TouchableOpacity
      style={styles.navDockItem}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.navIconWrapper}>
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <Ionicons
            name={isActive ? iconActive : iconInactive}
            size={iconSize}
            color={isActive ? THEME.colors.navIconActive : THEME.colors.navIconInactive}
          />
        </Animated.View>
      </View>
      <Animated.View style={[styles.activeDot, { transform: [{ scale: dotScale }] }]} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  playerFullscreenWrapper: {
    ...StyleSheet.absoluteFill,
    zIndex: 99999,
    backgroundColor: '#000000',
  },
  detailFullscreenWrapper: {
    ...StyleSheet.absoluteFill,
    zIndex: 1000,
    backgroundColor: THEME.colors.background,
  },
  safeArea: {
    flex: 1,
    backgroundColor: THEME.colors.background,
    position: 'relative',
  },
  mainContent: {
    flex: 1,
  },
  tabContentContainer: {
    flex: 1,
  },
  bottomNavDock: {
    position: 'absolute',
    alignSelf: 'center',
    width: 300,
    height: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: THEME.colors.overlay,
    borderRadius: THEME.radii.full,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
    paddingHorizontal: 20,
    zIndex: 100,
    ...THEME.shadows.card,
  },
  navDockItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    backgroundColor: 'transparent',
  },
  navIconWrapper: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    position: 'relative',
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: THEME.colors.activeDot,
    marginTop: 2,
  },
});
