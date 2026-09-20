import React, { useState, useMemo, useRef, useEffect, useCallback, useDeferredValue, memo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Dimensions,
  Platform,
  Animated,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CATALOG } from '../data/catalog';
import { MediaItem } from '../types/media';
import { THEME } from '../constants/theme';
import { ScreenBackground, SearchBarFigma, MediaPosterCard, AvatarPlaceholder } from './common';
import { useVoiceSearch } from '../hooks/useVoiceSearch';

interface SearchViewProps {
  onSelectItem: (item: MediaItem) => void;
  onPlayItem: (item: MediaItem) => void;
}

const { width } = Dimensions.get('window');
const GRID_GAP = THEME.spacing.md;
const COLUMN_WIDTH = (width - THEME.spacing.screen * 2 - GRID_GAP) / 2;
const POSTER_HEIGHT = COLUMN_WIDTH * 1.48;

interface CategoryFilter {
  id: string;
  label: string;
}

// Constante module : évite de recréer le tableau à chaque rendu.
const FILTERS: CategoryFilter[] = [
  { id: 'Tous', label: 'Tous' },
  { id: 'Films', label: 'Films' },
  { id: 'Séries', label: 'Séries' },
];

// Largeur d'un segment calculée une fois : écran - marges - padding interne, / 3.
// Évite toute mesure onLayout (pas de boucle de layout, pas d'état intermédiaire).
const SEGMENT_COUNT = FILTERS.length;
const SEG_WIDTH = (width - THEME.spacing.screen * 2 - 8) / SEGMENT_COUNT;

// Index de recherche pré-calculé une seule fois : évite les toLowerCase()
// répétés sur les ~5000 synopsis à chaque frappe / changement de filtre.
interface SearchEntry {
  item: MediaItem;
  title: string;
  blob: string;
}
let cachedSearchIndex: SearchEntry[] | null = null;
function getSearchIndex(): SearchEntry[] {
  if (!cachedSearchIndex) {
    cachedSearchIndex = CATALOG.map(item => ({
      item,
      title: item.title.toLowerCase(),
      blob: `${item.title} ${item.synopsis} ${item.genres.join(' ')} ${(item.cast || []).join(' ')}`.toLowerCase(),
    }));
  }
  return cachedSearchIndex;
}

function matchesCategory(item: MediaItem, filter: string): boolean {
  if (filter === 'Films') return item.type === 'movie';
  if (filter === 'Séries') return item.type === 'series';
  return true;
}

const keyExtractor = (item: MediaItem) => item.id;

export const SearchView: React.FC<SearchViewProps> = ({ onSelectItem, onPlayItem }) => {
  const insets = useSafeAreaInsets();
  // Marge haute = encoche réelle (Dynamic Island) + respiration.
  const topPad = insets.top > 0 ? insets.top + 8 : Platform.OS === 'ios' ? 14 : 8;
  const [query, setQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<string>('Tous');
  // Ref non typée : Animated.FlatList requise pour le onScroll natif.
  const listRef = useRef<any>(null);

  // La frappe reste fluide : le filtrage lourd utilise la valeur différée.
  const deferredQuery = useDeferredValue(query);
  // Pagination : petits ajouts réguliers (~30 cartes) plutôt qu'une avalanche.
  const PAGE_SIZE = 30;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Pastille coulissante du segmenté : largeur fixe connue, seul le X s'anime.
  const indicatorX = useRef(new Animated.Value(0)).current;
  const activeIndex = Math.max(
    0,
    FILTERS.findIndex(f => f.id === selectedFilter)
  );

  useEffect(() => {
    Animated.spring(indicatorX, {
      toValue: activeIndex * SEG_WIDTH,
      useNativeDriver: true,
      speed: 26,
      bounciness: 5,
    }).start();
  }, [activeIndex, indicatorX]);

  // Décroché de LA search bar (la même, pas un doublon visuel) :
  // position de fin mesurée une fois en ref, overlay identique épinglé sous le titre.
  // Le segmenté reste dans le flux : il ne descend pas avec.
  const searchEndY = useRef(0);
  const detachedRef = useRef(false);
  const [detached, setDetached] = useState(false);
  const [titleH, setTitleH] = useState(84);
  const detachAnim = useRef(new Animated.Value(0)).current;

  const handleDetachScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    // Seuil avancé de 60px : la barre se décroche un peu avant la sortie totale.
    const should = y > searchEndY.current - 60;
    if (should === detachedRef.current) return;
    detachedRef.current = should;
    setDetached(should);
  }, []);

  // Overlay monté pendant le fondu de sortie : l'apparition comme la
  // disparition sont animées (opacité + micro-glissé vertical).
  const [renderDetached, setRenderDetached] = useState(false);
  const detachSlide = useMemo(
    () =>
      detachAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [-10, 0],
      }),
    [detachAnim]
  );

  // Fondu de sortie des éléments du flux quand ils atteignent le bord haut :
  // plus de découpe franche, crossfade avec l'overlay épinglé.
  const scrollY = useRef(new Animated.Value(0)).current;
  const [segTop, setSegTop] = useState(160);
  const searchFade = useMemo(
    () =>
      scrollY.interpolate({
        inputRange: [0, 45],
        outputRange: [1, 0],
        extrapolate: 'clamp',
      }),
    [scrollY]
  );
  const segFade = useMemo(
    () =>
      scrollY.interpolate({
        inputRange: [segTop - 60, segTop - 5],
        outputRange: [1, 0],
        extrapolate: 'clamp',
      }),
    [scrollY, segTop]
  );

  useEffect(() => {
    if (detached) {
      setRenderDetached(true);
      detachAnim.setValue(0);
      Animated.timing(detachAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(detachAnim, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && !detachedRef.current) setRenderDetached(false);
      });
    }
  }, [detached, detachAnim]);

  const handleFilterPress = useCallback((filterId: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_) {}
    setSelectedFilter(prev => (prev === filterId ? prev : filterId));
  }, []);

  const handleClear = useCallback(() => setQuery(''), []);

  // ── Dictée vocale ──────────────────────────────────────────────────────────
  const { isListening, error: voiceError, startListening, stopListening, isSupported: voiceSupported } =
    useVoiceSearch(setQuery);

  // Animation pulsation rouge quand le micro est actif
  const micPulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (isListening) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(micPulse, { toValue: 1.35, duration: 550, useNativeDriver: true }),
          Animated.timing(micPulse, { toValue: 1, duration: 550, useNativeDriver: true }),
        ])
      ).start();
    } else {
      micPulse.stopAnimation();
      Animated.timing(micPulse, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    }
  }, [isListening, micPulse]);

  const handleMicPress = useCallback(async () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (_) {}
    if (!voiceSupported) return;
    if (isListening) {
      stopListening();
    } else {
      await startListening();
    }
  }, [isListening, voiceSupported, startListening, stopListening]);

  // Retour en haut + reset pagination quand la catégorie change.
  // (Pas sur la frappe : pour ne pas arracher la liste pendant la saisie.)
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    const t = setTimeout(() => {
      try {
        listRef.current?.scrollToOffset({ offset: 0, animated: false });
      } catch (_) {}
    }, 0);
    return () => clearTimeout(t);
  }, [selectedFilter]);

  const filteredItems = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();

    if (!q) {
      if (selectedFilter === 'Tous') return CATALOG;
      return CATALOG.filter(i => matchesCategory(i, selectedFilter));
    }

    // Une seule passe : catégorie + recherche + rang de pertinence.
    const scored: { item: MediaItem; rank: number }[] = [];
    const index = getSearchIndex();
    for (let n = 0; n < index.length; n++) {
      const entry = index[n];
      if (!matchesCategory(entry.item, selectedFilter)) continue;
      if (!entry.blob.includes(q)) continue;
      let rank = 3;
      if (entry.title === q) rank = 0;
      else if (entry.title.startsWith(q)) rank = 1;
      else if (entry.title.includes(q)) rank = 2;
      scored.push({ item: entry.item, rank });
    }
    scored.sort(
      (a, b) =>
        a.rank - b.rank ||
        a.item.title.length - b.item.title.length ||
        (b.item.matchScore || 0) - (a.item.matchScore || 0)
    );
    return scored.map(s => s.item);
  }, [deferredQuery, selectedFilter]);

  // Sous-ensemble réellement rendu par la FlatList.
  const visibleItems = useMemo(
    () => filteredItems.slice(0, visibleCount),
    [filteredItems, visibleCount]
  );

  const handleLoadMore = useCallback(() => {
    setVisibleCount(prev =>
      prev < filteredItems.length ? Math.min(prev + PAGE_SIZE, filteredItems.length) : prev
    );
  }, [filteredItems.length]);

  const renderItem = useCallback(
    ({ item }: { item: MediaItem }) => (
      <MediaPosterCard
        item={item}
        width={COLUMN_WIDTH}
        height={POSTER_HEIGHT}
        onPress={onSelectItem}
        showRating
        hideQuality
      />
    ),
    [onSelectItem]
  );

  return (
    <ScreenBackground showSpotlight>
      <View style={[styles.container, { paddingTop: topPad }]}>
        {/* Titre fixe : la liste commence en dessous, rien ne glisse dessous */}
        <View
          style={styles.headerRow}
          onLayout={e => {
            const h = topPad + e.nativeEvent.layout.height + 4;
            if (Math.abs(h - titleH) > 1) setTitleH(h);
          }}
        >
          <View>
            <View style={styles.titleRow}>
              <Text style={styles.headerTitleBold}>Catalogue </Text>
              <Text style={styles.headerTitleLight}>& Recherche</Text>
            </View>
          </View>

          <View style={styles.avatarWrapper}>
            <AvatarPlaceholder size={44} />
          </View>
        </View>

        {/* La VRAIE search bar + segmenté : défile puis se colle en haut (sticky).
            Bloc opaque pour que les cartes glissent derrière proprement. */}
        <Animated.FlatList
          ref={listRef}
          data={visibleItems}
          keyExtractor={keyExtractor}
          numColumns={2}
          initialNumToRender={8}
          maxToRenderPerBatch={12}
          updateCellsBatchingPeriod={30}
          windowSize={9}
          removeClippedSubviews
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.columnWrapper}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true, listener: handleDetachScroll }
          )}
          renderItem={renderItem}
          ListHeaderComponent={
            <View>
              <Animated.View
                style={{ opacity: searchFade }}
                onLayout={e => {
                  searchEndY.current =
                    e.nativeEvent.layout.y +
                    e.nativeEvent.layout.height +
                    THEME.spacing.xl;
                }}
              >
                <SearchBarFigma
                  value={query}
                  onChangeText={setQuery}
                  onClear={handleClear}
                  onMicPress={handleMicPress}
                  micActive={isListening}
                  micPulse={micPulse}
                  placeholder="Rechercher un film, série, genre..."
                />
                {voiceError && (
                  <Text style={styles.voiceError}>{voiceError}</Text>
                )}
              </Animated.View>
              <Animated.View
                style={[{ opacity: segFade }]}
                onLayout={e => {
                  const y = e.nativeEvent.layout.y;
                  if (Math.abs(y - segTop) > 1) setSegTop(y);
                }}
              >
                <View style={styles.filterSection}>
                <View style={styles.segmented}>
                  <Animated.View
                    style={[
                      styles.segmentIndicator,
                      { width: SEG_WIDTH, transform: [{ translateX: indicatorX }] },
                    ]}
                  />
                  {FILTERS.map(filter => (
                    <FilterSegment
                      key={filter.id}
                      filterId={filter.id}
                      label={filter.label}
                      isActive={selectedFilter === filter.id}
                      onSelect={handleFilterPress}
                    />
                  ))}
                </View>
              </View>
              </Animated.View>
            </View>
          }
          ListFooterComponent={
            visibleCount < filteredItems.length ? (
              <TouchableOpacity
                style={styles.loadMoreBtn}
                onPress={handleLoadMore}
                activeOpacity={0.85}
              >
                <Text style={styles.loadMoreText}>
                  Charger plus ({visibleCount}/{filteredItems.length})
                </Text>
              </TouchableOpacity>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="film-outline" size={48} color={THEME.colors.textMuted} />
              <Text style={styles.emptyTitle}>Aucun titre trouvé</Text>
              <Text style={styles.emptySubtitle}>
                Essayez un autre mot-clé ou retirez les filtres appliqués.
              </Text>
            </View>
          }
        />

        {/* La même search bar, épinglée sous le titre quand l'originale a défilé.
            Pilule flottante (mêmes marges, ombre) : aucun bandeau noir,
            le fond d'ambiance reste visible autour.
            Le segmenté ne suit pas : il reste en haut du contenu. */}
        {renderDetached && (
          <Animated.View
            pointerEvents={detached ? 'auto' : 'none'}
            style={[
              styles.detachBar,
              {
                top: titleH - 2,
                opacity: detachAnim,
                transform: [{ translateY: detachSlide }],
              },
            ]}
          >
            <SearchBarFigma
              value={query}
              onChangeText={setQuery}
              onClear={handleClear}
              onMicPress={handleMicPress}
              micActive={isListening}
              micPulse={micPulse}
              placeholder="Rechercher un film, série, genre..."
              style={styles.detachPill}
            />
          </Animated.View>
        )}
      </View>
    </ScreenBackground>
  );
};

const FilterSegment = memo<{
  filterId: string;
  label: string;
  isActive: boolean;
  onSelect: (filterId: string) => void;
}>(function FilterSegment({ filterId, label, isActive, onSelect }) {
  const handlePress = useCallback(() => {
    onSelect(filterId);
  }, [onSelect, filterId]);

  return (
    <TouchableOpacity
      style={styles.segmentBtn}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  avatarWrapper: {
    width: 44,
    height: 44,
  },
  filterSection: {
    marginBottom: THEME.spacing.md,
    paddingHorizontal: THEME.spacing.screen,
  },
  segmented: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.searchBar,
    borderRadius: THEME.radii.full,
    borderWidth: 1,
    borderColor: THEME.colors.searchBorder,
    padding: 4,
  },
  segmentIndicator: {
    position: 'absolute',
    left: 4,
    top: 4,
    bottom: 4,
    borderRadius: THEME.radii.full,
    backgroundColor: THEME.colors.surfaceActive,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
  },
  segmentBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: THEME.radii.full,
    zIndex: 1,
  },
  segmentText: {
    fontSize: 12,
    fontFamily: THEME.fonts.semibold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: THEME.colors.textMuted,
  },
  segmentTextActive: {
    color: THEME.colors.textPrimary,
    fontFamily: THEME.fonts.bold,
  },
  listContent: {
    paddingBottom: THEME.spacing.bottomNavPadding,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    paddingHorizontal: THEME.spacing.screen,
  },
  detachBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 50,
  },
  detachPill: {
    marginBottom: 0,
    ...THEME.shadows.card,
  },
  voiceError: {
    fontSize: THEME.typography.sizes.caption,
    fontFamily: THEME.fonts.medium,
    color: '#E50914',
    paddingHorizontal: THEME.spacing.screen + THEME.spacing.lg,
    marginTop: -THEME.spacing.sm,
    marginBottom: THEME.spacing.sm,
  },
  loadMoreBtn: {
    alignSelf: 'center',
    marginTop: THEME.spacing.md,
    marginBottom: THEME.spacing.lg,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: THEME.radii.squircle,
    backgroundColor: THEME.colors.filterCard,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
  },
  loadMoreText: {
    fontSize: THEME.typography.sizes.label,
    fontFamily: THEME.fonts.bold,
    color: THEME.colors.textPrimary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: THEME.spacing.sm,
  },
  emptyTitle: {
    fontSize: THEME.typography.sizes.h3,
    fontFamily: THEME.fonts.extrabold,
    color: THEME.colors.textPrimary,
    marginTop: THEME.spacing.sm,
  },
  emptySubtitle: {
    fontSize: THEME.typography.sizes.caption,
    color: THEME.colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 30,
  },
});
