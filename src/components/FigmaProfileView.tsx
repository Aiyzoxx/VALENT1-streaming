import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Platform,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MediaItem, WatchProgress } from '../types/media';
import { THEME } from '../constants/theme';
import { ScreenBackground, MediaPosterCard, AvatarPlaceholder } from './common';
import { StreamTesterView } from './StreamTesterView';

interface FigmaProfileViewProps {
  favoriteItems: MediaItem[];
  continueWatchingItems: { media: MediaItem; progress: WatchProgress }[];
  onSelectItem: (item: MediaItem) => void;
  onPlayItem: (item: MediaItem) => void;
  onPlayCustomStream: (stream: { url: string; title: string; isLive: boolean }) => void;
  onRemoveHistoryItem?: (id: string) => void;
  accountName?: string;
  accountEmail?: string;
  onLogout?: () => void;
}

const { width } = Dimensions.get('window');
const GRID_GAP = THEME.spacing.md;
const COLUMN_WIDTH = (width - THEME.spacing.screen * 2 - GRID_GAP) / 2;
const POSTER_HEIGHT = COLUMN_WIDTH * 1.48;

const AnimatedSubTabBtn: React.FC<{
  label: string;
  isActive: boolean;
  onPress: () => void;
}> = ({ label, isActive, onPress }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
      speed: 35,
      bounciness: 0,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 6,
    }).start();
  };

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={{ flex: 1 }}
    >
      <Animated.View
        style={[
          styles.subTabBtn,
          isActive && styles.subTabBtnActive,
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
        <Text style={[styles.subTabText, isActive && styles.subTabTextActive]}>
          {label}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

// Carte d'historique avec sortie animée (fondu + rétrécissement)
// avant la suppression effective.
const HistoryCard: React.FC<{
  media: MediaItem;
  progress: WatchProgress;
  onPress: (item: MediaItem) => void;
  onRemove?: (id: string) => void;
}> = ({ media, progress, onPress, onRemove }) => {
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handleRemove = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (_) {}
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.85,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => onRemove?.(media.id));
  };

  return (
    <Animated.View
      style={{
        width: COLUMN_WIDTH,
        marginBottom: THEME.spacing.lg,
        opacity: fadeAnim,
        transform: [{ scale: scaleAnim }],
      }}
    >
      <MediaPosterCard
        item={media}
        width={COLUMN_WIDTH}
        height={POSTER_HEIGHT}
        onPress={onPress}
        showRating
      />
      {onRemove && (
        <TouchableOpacity
          style={styles.historyRemoveBtn}
          onPress={handleRemove}
          activeOpacity={0.8}
        >
          <Ionicons name="close" size={14} color="#FFFFFF" />
        </TouchableOpacity>
      )}
      <Text style={styles.historyTimeText}>
        Progression : {Math.round((progress.currentTime / (progress.duration || 1)) * 100)}%
      </Text>
    </Animated.View>
  );
};

export const FigmaProfileView: React.FC<FigmaProfileViewProps> = ({
  favoriteItems,
  continueWatchingItems,
  onSelectItem,
  onPlayItem,
  onPlayCustomStream,
  accountName,
  accountEmail,
  onLogout,
  onRemoveHistoryItem,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'favorites' | 'history' | 'studio'>('favorites');
  const insets = useSafeAreaInsets();
  const topPad = insets.top > 0 ? insets.top + 8 : Platform.OS === 'ios' ? 14 : 8;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const transYAnim = useRef(new Animated.Value(0)).current;

  const handleTabChange = (tab: 'favorites' | 'history' | 'studio') => {
    if (tab === activeSubTab) return;
    try {
      Haptics.selectionAsync();
    } catch (_) {}
    fadeAnim.setValue(0.25);
    transYAnim.setValue(8);
    setActiveSubTab(tab);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(transYAnim, {
        toValue: 0,
        speed: 20,
        bounciness: 5,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <ScreenBackground showSpotlight>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingTop: topPad }]}
      >
        {/* 1. En-tête typographique signature Figma */}
        <View style={styles.headerRow}>
          <View>
            <View style={styles.titleRow}>
              <Text style={styles.headerTitleBold}>Mon </Text>
              <Text style={styles.headerTitleLight}>Profil</Text>
            </View>
            <Text style={styles.subtitleText}>Gérez vos favoris et préférences.</Text>
          </View>
        </View>

        {/* 2. Carte de Profil */}
        <View style={styles.profileHeader}>
          <View style={styles.profileAvatar}>
            <AvatarPlaceholder size={84} label={accountName} />
          </View>
          <Text style={styles.userNameText}>{accountName || 'Daizy'}</Text>
          <Text style={styles.userEmailText}>{accountEmail || 'daizy.heist@streamflow.app'}</Text>

          {/* Stats Bar */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{favoriteItems.length}</Text>
              <Text style={styles.statLabel}>Favoris</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{continueWatchingItems.length}</Text>
              <Text style={styles.statLabel}>En cours</Text>
            </View>
          </View>

          {onLogout && (
            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={onLogout}
              activeOpacity={0.85}
            >
              <Ionicons
                name="log-out-outline"
                size={16}
                color={THEME.colors.textSecondary}
                style={{ marginRight: 8 }}
              />
              <Text style={styles.logoutText}>Se déconnecter</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 3. Sub-Tabs Switcher épuré */}
        <View style={styles.subTabsRow}>
          <AnimatedSubTabBtn
            label={`Favoris (${favoriteItems.length})`}
            isActive={activeSubTab === 'favorites'}
            onPress={() => handleTabChange('favorites')}
          />
          <AnimatedSubTabBtn
            label={`Historique (${continueWatchingItems.length})`}
            isActive={activeSubTab === 'history'}
            onPress={() => handleTabChange('history')}
          />
          <AnimatedSubTabBtn
            label="M3U8 Studio"
            isActive={activeSubTab === 'studio'}
            onPress={() => handleTabChange('studio')}
          />
        </View>

        {/* 4. Contenu avec transition animée fluide */}
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: transYAnim }] }}>
          {/* Tab 1: Favoris */}
          {activeSubTab === 'favorites' && (
            <View style={styles.itemsGrid}>
              {favoriteItems.length > 0 ? (
                favoriteItems.map(item => (
                  <MediaPosterCard
                    key={item.id}
                    item={item}
                    width={COLUMN_WIDTH}
                    height={POSTER_HEIGHT}
                    onPress={onSelectItem}
                    showRating
                  />
                ))
              ) : (
                <View style={styles.emptyContainer}>
                  <Ionicons name="heart-outline" size={48} color={THEME.colors.textMuted} />
                  <Text style={styles.emptyTitle}>Aucun favori pour le moment</Text>
                  <Text style={styles.emptySubtitle}>Ajoutez des séries et films en favoris depuis leur fiche détaillée.</Text>
                </View>
              )}
            </View>
          )}

          {/* Tab 2: Historique */}
          {activeSubTab === 'history' && (
            <View style={styles.itemsGrid}>
              {continueWatchingItems.length > 0 ? (
                continueWatchingItems.map(({ media, progress }) => (
                  <HistoryCard
                    key={media.id}
                    media={media}
                    progress={progress}
                    onPress={onSelectItem}
                    onRemove={onRemoveHistoryItem}
                  />
                ))
              ) : (
                <View style={styles.emptyContainer}>
                  <Ionicons name="time-outline" size={48} color={THEME.colors.textMuted} />
                  <Text style={styles.emptyTitle}>Historique vide</Text>
                  <Text style={styles.emptySubtitle}>Les vidéos que vous commencez à regarder apparaîtront ici.</Text>
                </View>
              )}
            </View>
          )}

          {/* Tab 3: M3U8 Studio */}
          {activeSubTab === 'studio' && (
            <View style={styles.studioContainer}>
              <StreamTesterView onPlayStream={onPlayCustomStream} />
            </View>
          )}
        </Animated.View>

        <View style={{ height: THEME.spacing.bottomNavPadding }} />
      </ScrollView>
    </ScreenBackground>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
  },
  headerRow: {
    paddingHorizontal: THEME.spacing.screen,
    marginBottom: THEME.spacing.lg,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitleBold: {
    fontSize: THEME.typography.sizes.h1,
    fontFamily: THEME.fonts.extrabold,
    color: THEME.colors.textPrimary,
    letterSpacing: THEME.typography.letterSpacing.tight,
  },
  headerTitleLight: {
    fontSize: THEME.typography.sizes.h1,
    fontFamily: THEME.fonts.regular,
    color: THEME.colors.textPrimary,
    letterSpacing: THEME.typography.letterSpacing.tight,
  },
  subtitleText: {
    fontSize: THEME.typography.sizes.caption,
    color: THEME.colors.textMuted,
    marginTop: 3,
    fontFamily: THEME.fonts.medium,
  },
  profileHeader: {
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.screen,
    marginBottom: THEME.spacing.xl,
  },
  profileAvatar: {
    marginBottom: THEME.spacing.md,
  },
  userNameText: {
    fontSize: THEME.typography.sizes.h1,
    fontFamily: THEME.fonts.extrabold,
    color: THEME.colors.textPrimary,
    letterSpacing: THEME.typography.letterSpacing.tight,
  },
  userEmailText: {
    fontSize: THEME.typography.sizes.caption,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radii.squircle,
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginTop: 20,
    width: '100%',
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
    ...THEME.shadows.card,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: THEME.typography.sizes.h3,
    fontFamily: THEME.fonts.extrabold,
    color: THEME.colors.textPrimary,
  },
  statLabel: {
    fontSize: THEME.typography.sizes.small,
    color: THEME.colors.textMuted,
    marginTop: 2,
    fontFamily: THEME.fonts.semibold,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: THEME.colors.borderMedium,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: THEME.spacing.lg,
    paddingVertical: 11,
    paddingHorizontal: 20,
    borderRadius: THEME.radii.full,
    backgroundColor: THEME.colors.searchBar,
    borderWidth: 1,
    borderColor: THEME.colors.searchBorder,
  },
  logoutText: {
    fontSize: THEME.typography.sizes.label,
    fontFamily: THEME.fonts.semibold,
    color: THEME.colors.textSecondary,
  },
  subTabsRow: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.searchBar,
    marginHorizontal: THEME.spacing.screen,
    borderRadius: THEME.radii.squircle,
    padding: 4,
    marginBottom: THEME.spacing.xl,
    borderWidth: 1,
    borderColor: THEME.colors.searchBorder,
  },
  subTabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: THEME.radii.card - 4,
  },
  subTabBtnActive: {
    backgroundColor: THEME.colors.filterCardActive,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  subTabText: {
    fontSize: THEME.typography.sizes.railTitle,
    fontFamily: THEME.fonts.semibold,
    color: THEME.colors.textMuted,
  },
  subTabTextActive: {
    color: THEME.colors.textPrimary,
    fontFamily: THEME.fonts.extrabold,
  },
  itemsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: THEME.spacing.screen,
    justifyContent: 'space-between',
  },
  historyTimeText: {
    fontSize: THEME.typography.sizes.small,
    color: THEME.colors.textSecondary,
    marginTop: 4,
    fontFamily: THEME.fonts.semibold,
  },
  historyRemoveBtn: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  studioContainer: {
    paddingHorizontal: THEME.spacing.screen,
  },
  emptyContainer: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 50,
    gap: THEME.spacing.sm,
  },
  emptyTitle: {
    fontSize: THEME.typography.sizes.h3,
    fontFamily: THEME.fonts.bold,
    color: THEME.colors.textPrimary,
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: THEME.typography.sizes.caption,
    color: THEME.colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 30,
  },
});
