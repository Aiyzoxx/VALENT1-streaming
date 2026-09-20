import React, { useState, useMemo, useRef, useEffect, useDeferredValue } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  Platform,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { MediaItem } from '../types/media';
import { THEME } from '../constants/theme';
import { tmdb } from '../api/tmdb';
import { MediaPosterCard, ScreenBackground, AvatarPlaceholder } from './common';

interface FigmaHomeViewProps {
  catalog: MediaItem[];
  history: Array<{ item: MediaItem; position: number }>;
  onSelectItem: (item: MediaItem) => void;
  onOpenVoiceSearch?: () => void;
  accountName?: string | null;
}

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.60;
const CARD_HEIGHT = CARD_WIDTH * 1.48;
const SPACING = 14;
const SNAP_INTERVAL = CARD_WIDTH + SPACING;

// Normalisation pour apparier les titres TMDB (fr) avec le catalogue local.
const normTitle = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// Assets locaux haute définition extraits directement du fichier Figma SVG
const POSTER_MONEY_HEIST = require('../../assets/figma/poster_money_heist.png');
const POSTER_LUCIFER = require('../../assets/figma/poster_lucifer.png');
const POSTER_SEX_ED = require('../../assets/figma/poster_sex_education.png');

export const FigmaHomeView: React.FC<FigmaHomeViewProps> = ({
  catalog,
  onSelectItem,
  onOpenVoiceSearch,
  accountName,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  // Frappe fluide : le filtrage (5000 items) utilise la valeur différée.
  const deferredSearch = useDeferredValue(searchQuery);

  // Valeur animée native pour le carrousel 3D Coverflow
  // Initialisée à SNAP_INTERVAL pour centrer d'emblée Money Heist (index 1) avec Lucifer à gauche et Sex Education à droite
  const scrollX = useRef(new Animated.Value(SNAP_INTERVAL)).current;

  // Index séries du catalogue pour appariement avec TMDB (garde le streamUrl local).
  const seriesByName = useMemo(() => {
    const map = new Map<string, MediaItem>();
    for (const item of catalog) {
      if (item.type !== 'series') continue;
      const k = normTitle(item.title);
      if (k && !map.has(k)) map.set(k, item);
    }
    return map;
  }, [catalog]);

  // Index films du catalogue, même usage pour Popular Movies.
  const moviesByName = useMemo(() => {
    const map = new Map<string, MediaItem>();
    for (const item of catalog) {
      if (item.type !== 'movie') continue;
      const k = normTitle(item.title);
      if (k && !map.has(k)) map.set(k, item);
    }
    return map;
  }, [catalog]);

  // Séries du moment (TMDB trending semaine). Null = offline/échec → trio Figma.
  const [liveFeatured, setLiveFeatured] = useState<MediaItem[] | null>(null);
  // Films du moment, même logique → rail Popular Movies.
  const [livePopular, setLivePopular] = useState<MediaItem[] | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [tvRes, movieRes] = await Promise.all([
          tmdb.trending('tv', 'week'),
          tmdb.trending('movie', 'week'),
        ]);
        if (!alive) return;

        const pickedSeries: MediaItem[] = [];
        const seenSeries = new Set<string>();
        for (const r of tvRes.results) {
          const name = 'name' in r && r.name ? r.name : null;
          if (!name) continue;
          const m = seriesByName.get(normTitle(name));
          if (m && !seenSeries.has(m.id)) {
            seenSeries.add(m.id);
            pickedSeries.push(m);
          }
          if (pickedSeries.length >= 10) break;
        }

        const pickedMovies: MediaItem[] = [];
        const seenMovies = new Set<string>();
        for (const r of movieRes.results) {
          const title = 'title' in r && r.title ? r.title : null;
          if (!title) continue;
          const m = moviesByName.get(normTitle(title));
          if (m && !seenMovies.has(m.id)) {
            seenMovies.add(m.id);
            pickedMovies.push(m);
          }
          if (pickedMovies.length >= 15) break;
        }

        if (!alive) return;
        if (pickedSeries.length >= 3) setLiveFeatured(pickedSeries);
        if (pickedMovies.length >= 5) setLivePopular(pickedMovies);
      } catch (e) {
        console.warn('Trending failed, fallback catalogue:', e);
      }
    })();
    return () => {
      alive = false;
    };
  }, [seriesByName, moviesByName]);

  // Séries en vedette répliquant exactement le trio de l'écran 1 de la maquette Figma :
  // [0] Lucifer (incliné à gauche)
  // [1] Money Heist : Part 5 (au centre, droit)
  // [2] Sex Education (incliné à droite)
  const featuredSeries = useMemo(() => {
    // Données live : les séries du moment (mappées au catalogue pour la lecture).
    if (liveFeatured) return liveFeatured;

    const moneyHeistOriginal = catalog.find(
      item => item.id === '3695' || item.title.toLowerCase().includes('casa de papel')
    ) || catalog[0];

    const moneyHeistItem: MediaItem = {
      ...moneyHeistOriginal,
      id: '3695',
      title: 'Money Heist : Part 5',
      posterUrl: '',
      matchScore: 98,
      year: 2021,
    };

    const luciferItem: MediaItem = {
      id: 'lucifer-figma',
      title: 'Lucifer',
      type: 'series',
      posterUrl: '',
      backdropUrl: '',
      quality: '1080p FHD',
      duration: '45m',
      ageRating: '16+',
      genres: ['Crime', 'Drama', 'Fantasy'],
      matchScore: 92,
      year: 2021,
      streamUrl: moneyHeistOriginal.streamUrl,
      synopsis: "In the City of Angels, he's not one. Lucifer Morningstar abandons his throne in Hell to live in Los Angeles.",
    };

    const sexEdItem: MediaItem = {
      id: 'sex-ed-figma',
      title: 'Sex Education',
      type: 'series',
      posterUrl: '',
      backdropUrl: '',
      quality: '1080p FHD',
      duration: '52m',
      ageRating: '16+',
      genres: ['Comedy', 'Drama'],
      matchScore: 94,
      year: 2021,
      streamUrl: moneyHeistOriginal.streamUrl,
      synopsis: 'Growth is a group project. Otis and Maeve run an underground sex therapy clinic at school.',
    };

    const others = catalog.filter(item => item.type === 'series' && item.id !== '3695').slice(0, 10);
    return [luciferItem, moneyHeistItem, sexEdItem, ...others];
  }, [catalog, liveFeatured]);

  const getPosterSource = (item: MediaItem) => {
    if (item.id === '3695' || item.title.toLowerCase().includes('money heist') || item.title.toLowerCase().includes('casa de papel')) {
      return POSTER_MONEY_HEIST;
    }
    if (item.id === 'lucifer-figma') return POSTER_LUCIFER;
    if (item.id === 'sex-ed-figma') return POSTER_SEX_ED;
    return { uri: item.posterUrl };
  };

  // Recherche locale : résultats plafonnés à 30 cartes (grille non virtualisée).
  const capResults = (list: MediaItem[]) => ({
    items: list.slice(0, 30),
    total: list.length,
  });

  const filteredCatalog = useMemo((): { items: MediaItem[]; total: number } | null => {
    if (deferredSearch.trim().length > 0) {
      const q = deferredSearch.toLowerCase();
      return capResults(catalog.filter(item =>
        item.title.toLowerCase().includes(q) ||
        item.genres?.some(g => g.toLowerCase().includes(q))
      ));
    }
    return null;
  }, [catalog, deferredSearch]);

  // Films populaires : du moment (TMDB) si dispo, sinon début du catalogue.
  const popularMovies = useMemo(() => {
    if (livePopular) return livePopular;
    return catalog.filter(item => item.type === 'movie').slice(0, 15);
  }, [catalog, livePopular]);

  return (
    <ScreenBackground>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >

        {/* 1. Header Figma : "Hello Daizy!" + Avatar original */}
        <View style={styles.headerRow}>
          <View>
            <View style={styles.greetingRow}>
              <Text style={styles.helloBold}>Hello </Text>
              {accountName ? (
                <Text style={styles.helloLight}>{accountName}!</Text>
              ) : null}
            </View>
            <Text style={styles.subtitleText}>Check for latest addition.</Text>
          </View>

          <TouchableOpacity activeOpacity={0.85} style={styles.avatarWrapper}>
            <AvatarPlaceholder size={48} />
          </TouchableOpacity>
        </View>

        {/* 2. Search Bar Figma avec Micro et Séparateur */}
        <View style={styles.searchBarContainer}>
          <Ionicons name="search-outline" size={20} color={THEME.colors.textMuted} style={{ marginRight: 10 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search"
            placeholderTextColor={THEME.colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          <View style={styles.searchDivider} />
          <TouchableOpacity
            onPress={onOpenVoiceSearch}
            activeOpacity={0.7}
            style={styles.micButton}
          >
            <Ionicons name="mic-outline" size={20} color={THEME.colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* 3. Résultats de recherche (si frappe en cours) */}
        {filteredCatalog ? (
          <View style={styles.filteredResultsSection}>
            <Text style={styles.featuredTitleBold}>Résultats de recherche</Text>
            <Text style={styles.resultsCount}>
              {filteredCatalog.total} {filteredCatalog.total > 1 ? 'résultats' : 'résultat'}
              {filteredCatalog.total > filteredCatalog.items.length
                ? ` — ${filteredCatalog.items.length} affichés (affinez la recherche)`
                : ''}
            </Text>

            <View style={styles.gridContainer}>
              {filteredCatalog.items.map(item => (
                <MediaPosterCard
                  key={item.id}
                  item={item}
                  width={(width - THEME.spacing.screen * 2 - THEME.spacing.md) / 2}
                  height={((width - THEME.spacing.screen * 2 - THEME.spacing.md) / 2) * 1.48}
                  onPress={onSelectItem}
                  showRating
                />
              ))}
            </View>
          </View>
        ) : (
          <>
            {/* 4. Section "Featured Series" avec Carrousel 3D Coverflow Figma */}
            <View style={styles.featuredHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.featuredTitleBold}>Featured </Text>
                <Text style={styles.featuredTitleLight}>Series</Text>
              </View>
            </View>

            <Animated.ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={SNAP_INTERVAL}
              snapToAlignment="start"
              decelerationRate="fast"
              disableIntervalMomentum={true}
              contentOffset={{ x: SNAP_INTERVAL, y: 0 }}
              contentContainerStyle={styles.featuredCarouselScroll}
              onScroll={Animated.event(
                [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                { useNativeDriver: true }
              )}
              scrollEventThrottle={16}
            >
              {featuredSeries.map((item, idx) => {
                const inputRange = [
                  (idx - 1) * SNAP_INTERVAL,
                  idx * SNAP_INTERVAL,
                  (idx + 1) * SNAP_INTERVAL,
                ];

                // Rotation Coverflow Figma fidèle à la maquette :
                // - Quand la carte est à DROITE : inclinée vers le centre (-6.5deg)
                // - Quand la carte est au CENTRE : droite verticale (0deg)
                // - Quand la carte est à GAUCHE : inclinée vers le centre (+6.5deg)
                const rotateZ = scrollX.interpolate({
                  inputRange,
                  outputRange: ['-6.5deg', '0deg', '6.5deg'],
                  extrapolate: 'clamp',
                });

                // Perspective 3D subtile
                const rotateY = scrollX.interpolate({
                  inputRange,
                  outputRange: ['-12deg', '0deg', '12deg'],
                  extrapolate: 'clamp',
                });

                // Échelle dynamique : carte centrale plus grande
                const scale = scrollX.interpolate({
                  inputRange,
                  outputRange: [0.88, 1.0, 0.88],
                  extrapolate: 'clamp',
                });

                // Translation verticale : cartes latérales légèrement abaissées
                const translateY = scrollX.interpolate({
                  inputRange,
                  outputRange: [12, 0, 12],
                  extrapolate: 'clamp',
                });

                // Opacité douce pour focaliser le regard sur la carte centrale
                const opacity = scrollX.interpolate({
                  inputRange,
                  outputRange: [0.72, 1.0, 0.72],
                  extrapolate: 'clamp',
                });

                return (
                  <Animated.View
                    key={item.id}
                    style={[
                      styles.featuredCardAnimatedWrapper,
                      {
                        marginRight: idx === featuredSeries.length - 1 ? 0 : SPACING,
                        transform: [
                          { perspective: 900 },
                          { scale },
                          { rotateY },
                          { rotateZ },
                          { translateY },
                        ],
                        opacity,
                      },
                    ]}
                  >
                    <TouchableOpacity
                      style={styles.featuredCard}
                      onPress={() => onSelectItem(item)}
                      activeOpacity={0.88}
                    >
                      <Image
                        source={getPosterSource(item)}
                        style={styles.featuredPoster}
                        resizeMode="cover"
                      />
                      <LinearGradient
                        colors={['transparent', 'rgba(14, 17, 23, 0.1)', 'rgba(14, 17, 23, 0.65)']}
                        locations={[0, 0.65, 1]}
                        style={styles.cardGradient}
                      />
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </Animated.ScrollView>

            {/* 5. Section Secondaire : Popular Movies */}
            <View style={[styles.featuredHeaderRow, { marginTop: 28 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.featuredTitleBold}>Popular </Text>
                <Text style={styles.featuredTitleLight}>Movies</Text>
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalRailScroll}
            >
              {popularMovies.map(movie => (
                <View key={movie.id} style={{ width: 130, marginRight: THEME.spacing.md }}>
                  <MediaPosterCard
                    item={movie}
                    width={130}
                    height={192}
                    onPress={onSelectItem}
                    showRating
                  />
                </View>
              ))}
            </ScrollView>
          </>
        )}

        <View style={{ height: 110 }} />
      </ScrollView>
    </ScreenBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: Platform.OS === 'ios' ? 54 : 36,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.screen,
    marginBottom: 20,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  helloBold: {
    fontSize: THEME.typography.sizes.h1,
    fontFamily: THEME.fonts.extrabold,
    color: THEME.colors.textPrimary,
    letterSpacing: THEME.typography.letterSpacing.tight,
  },
  helloLight: {
    fontSize: THEME.typography.sizes.h1,
    fontFamily: THEME.fonts.regular,
    color: THEME.colors.textPrimary,
    letterSpacing: THEME.typography.letterSpacing.tight,
  },
  subtitleText: {
    fontSize: THEME.typography.sizes.caption,
    color: THEME.colors.textMuted,
    marginTop: THEME.spacing.xs,
    fontFamily: THEME.fonts.medium,
  },
  avatarWrapper: {
    width: 48,
    height: 48,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.searchBar,
    borderRadius: THEME.radii.squircle,
    borderWidth: 1,
    borderColor: THEME.colors.searchBorder,
    marginHorizontal: THEME.spacing.screen,
    paddingHorizontal: THEME.spacing.lg,
    height: 52,
    marginBottom: THEME.spacing.xl,
  },
  searchInput: {
    flex: 1,
    color: THEME.colors.textPrimary,
    fontSize: THEME.typography.sizes.body,
    fontFamily: THEME.fonts.medium,
    paddingVertical: 0,
  },
  searchDivider: {
    width: 1,
    height: 22,
    backgroundColor: THEME.colors.searchDivider,
    marginHorizontal: 10,
  },
  micButton: {
    padding: THEME.spacing.xs,
  },
  sectionHeaderRow: {
    paddingHorizontal: THEME.spacing.screen,
    marginBottom: THEME.spacing.md,
  },
  filtersSectionTitle: {
    fontSize: THEME.typography.sizes.h3,
    fontFamily: THEME.fonts.bold,
    color: THEME.colors.textPrimary,
    letterSpacing: THEME.typography.letterSpacing.subtle,
  },
  filtersRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 34,
    paddingHorizontal: THEME.spacing.screen,
    marginBottom: THEME.spacing.xxl,
  },
  filterColumn: {
    alignItems: 'center',
    width: (width - 44 - 36) / 4,
  },
  filterCard: {
    width: 60,
    height: 60,
    borderRadius: THEME.radii.squircle,
    backgroundColor: THEME.colors.filterCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
    ...THEME.shadows.filter,
  },
  filterCardActive: {
    borderColor: THEME.colors.borderActive,
    backgroundColor: THEME.colors.filterCardActive,
  },
  filterLabel: {
    fontSize: THEME.typography.sizes.label,
    color: THEME.colors.textMuted,
    marginTop: THEME.spacing.sm,
    fontFamily: THEME.fonts.semibold,
    textAlign: 'center',
  },
  filterLabelActive: {
    color: THEME.colors.textPrimary,
    fontFamily: THEME.fonts.extrabold,
  },
  featuredHeaderRow: {
    paddingHorizontal: THEME.spacing.screen,
    marginBottom: THEME.spacing.lg,
  },
  featuredTitleBold: {
    fontSize: THEME.typography.sizes.h2,
    fontFamily: THEME.fonts.extrabold,
    color: THEME.colors.textPrimary,
    letterSpacing: THEME.typography.letterSpacing.tight,
  },
  featuredTitleLight: {
    fontSize: THEME.typography.sizes.h2,
    fontFamily: THEME.fonts.regular,
    color: THEME.colors.textPrimary,
    letterSpacing: THEME.typography.letterSpacing.tight,
  },
  featuredCarouselScroll: {
    paddingHorizontal: (width - CARD_WIDTH) / 2,
    alignItems: 'center',
    paddingVertical: 14,
  },
  featuredCardAnimatedWrapper: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuredCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: THEME.radii.heroCard,
    overflow: 'hidden',
    backgroundColor: THEME.colors.card,
    borderWidth: 1,
    borderColor: THEME.colors.borderCard,
    ...THEME.shadows.heroCard,
  },
  featuredPoster: {
    width: '100%',
    height: '100%',
  },
  cardGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '50%',
  },
  horizontalRailScroll: {
    paddingLeft: THEME.spacing.screen,
    paddingRight: 12,
    gap: THEME.spacing.md,
  },
  railCard: {
    width: 120,
  },
  railPoster: {
    width: 120,
    height: 170,
    borderRadius: THEME.radii.card,
    backgroundColor: THEME.colors.card,
  },
  railTitle: {
    fontSize: THEME.typography.sizes.railTitle,
    fontFamily: THEME.fonts.semibold,
    color: THEME.colors.textSecondary,
    marginTop: 6,
  },
  filteredResultsSection: {
    paddingHorizontal: THEME.spacing.screen,
    marginTop: 10,
  },
  resultsCount: {
    fontSize: THEME.typography.sizes.small,
    color: THEME.colors.textMuted,
    fontFamily: THEME.fonts.semibold,
    marginTop: 4,
  },
  genreList: {
    gap: THEME.spacing.sm,
    marginTop: THEME.spacing.lg,
  },
  genreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: THEME.spacing.lg,
    paddingVertical: 14,
    borderRadius: THEME.radii.squircle,
    backgroundColor: THEME.colors.filterCard,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
  },
  genreRowText: {
    fontSize: THEME.typography.sizes.body,
    fontFamily: THEME.fonts.semibold,
    color: THEME.colors.textPrimary,
  },
  genreRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  genreRowCount: {
    fontSize: THEME.typography.sizes.caption,
    fontFamily: THEME.fonts.medium,
    color: THEME.colors.textMuted,
  },
  genreBack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginBottom: THEME.spacing.sm,
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  genreBackText: {
    fontSize: THEME.typography.sizes.caption,
    fontFamily: THEME.fonts.semibold,
    color: THEME.colors.textMuted,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: THEME.spacing.lg,
  },
  gridCard: {
    width: (width - THEME.spacing.screen * 2 - THEME.spacing.md) / 2,
    marginBottom: THEME.spacing.lg,
  },
  gridPoster: {
    width: '100%',
    height: 220,
    borderRadius: THEME.radii.card,
    backgroundColor: THEME.colors.card,
  },
  gridTitle: {
    fontSize: THEME.typography.sizes.cardTitle,
    color: THEME.colors.textPrimary,
    fontFamily: THEME.fonts.semibold,
    marginTop: 6,
  },
});
