import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
  StatusBar,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { MediaItem, Episode } from '../types/media';
import { THEME } from '../constants/theme';
import { tmdb, tmdbImage } from '../api/tmdb';
import { AmbientGlow } from './common/AmbientGlow';

interface FigmaDetailViewProps {
  item: MediaItem;
  isFavorite: boolean;
  onClose: () => void;
  onPlay: (item: MediaItem, episode?: Episode) => void;
  onToggleFavorite: (id: string) => void;
}

const { width, height } = Dimensions.get('window');
// Hauteur arrondie au pixel entier : une hauteur fractionnaire crée
// une ligne d'antialiasing d'1px à la jonction du hero.
const HERO_HEIGHT = Math.round(height * 0.46);

// Assets locaux haute définition extraits directement du fichier Figma SVG
const HERO_MONEY_HEIST = require('../../assets/figma/hero_money_heist.jpg');
const EPISODE_1 = require('../../assets/figma/episode_1.png');
const EPISODE_2 = require('../../assets/figma/episode_2.png');
const EPISODE_3 = require('../../assets/figma/episode_3.png');

export const FigmaDetailView: React.FC<FigmaDetailViewProps> = ({
  item,
  isFavorite,
  onClose,
  onPlay,
  onToggleFavorite,
}) => {
  const entranceFade = React.useRef(new Animated.Value(0)).current;
  const entranceSlide = React.useRef(new Animated.Value(25)).current;
  const playPulse = React.useRef(new Animated.Value(1)).current;
  const playBtnPressScale = React.useRef(new Animated.Value(1)).current;

  // Scroll pilotant la dissolution du hero (parallax + fondu).
  const scrollY = React.useRef(new Animated.Value(0)).current;
  const heroOpacity = React.useMemo(
    () =>
      scrollY.interpolate({
        inputRange: [0, HERO_HEIGHT * 0.7],
        outputRange: [1, 0],
        extrapolate: 'clamp',
      }),
    [scrollY]
  );
  const heroTranslate = React.useMemo(
    () =>
      scrollY.interpolate({
        inputRange: [0, HERO_HEIGHT],
        outputRange: [0, HERO_HEIGHT * 0.35],
        extrapolate: 'clamp',
      }),
    [scrollY]
  );

  React.useEffect(() => {
    // 1. Animation d'entrée fluide de la modale
    Animated.parallel([
      Animated.timing(entranceFade, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.spring(entranceSlide, {
        toValue: 0,
        friction: 8,
        tension: 65,
        useNativeDriver: true,
      }),
    ]).start();

    // 2. Respiration lumineuse du bouton Play rouge
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(playPulse, {
          toValue: 1.06,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(playPulse, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();

    return () => pulseLoop.stop();
  }, []);

  // Animation de fermeture fluide (Exit transition)
  const handleClose = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_) {}

    Animated.parallel([
      Animated.timing(entranceFade, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(entranceSlide, {
        toValue: 35,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  const isMoneyHeist =
    item.id === '3695' ||
    item.title.toLowerCase().includes('money heist') ||
    item.title.toLowerCase().includes('casa de papel');

  const handleToggleFav = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_) {}
    onToggleFavorite(item.id);
  };

  const handlePlayMain = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (_) {}
    const firstEp = seasonEpisodes[0] ?? allEpisodes[0];
    onPlay(item, firstEp);
  };

  const handlePlayEpisode = (ep: Episode) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_) {}
    onPlay(item, ep);
  };

  // Traitement et parsing des épisodes réels
  // Pour Money Heist, on utilise les vignettes et titres exacts de l'écran 2 de Figma
  const allEpisodes: Episode[] = React.useMemo(() => {
    if (!item) return [];

    if (isMoneyHeist) {
      const baseStream = item.streamUrl || 'https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8';
      return [
        {
          id: '3695-s5-e1',
          season: 5,
          episodeNumber: 1,
          title: 'The End of the Road',
          duration: '50m',
          synopsis: 'The Professor faces Sierra while Tamayo raises the stakes of the negotiation by calling in the army.',
          streamUrl: item.episodeUrls?.[0]?.url || item.episodes?.[0]?.streamUrl || baseStream,
          thumbnailUrl: '',
        },
        {
          id: '3695-s5-e2',
          season: 5,
          episodeNumber: 2,
          title: 'Do You Believe in Reincarnation?',
          duration: '52m',
          synopsis: 'Arturo seizes an opportunity to fight back while escalating a personal vendetta.',
          streamUrl: item.episodeUrls?.[1]?.url || item.episodes?.[1]?.streamUrl || baseStream,
          thumbnailUrl: '',
        },
        {
          id: '3695-s5-e3',
          season: 5,
          episodeNumber: 3,
          title: 'Welcome to the Show of Life',
          duration: '50m',
          synopsis: 'A betrayal and an emergency catch Sierra off guard. Palermo rallies the troops as the army closes in.',
          streamUrl: item.episodeUrls?.[2]?.url || item.episodes?.[2]?.streamUrl || baseStream,
          thumbnailUrl: '',
        },
        {
          id: '3695-s5-e4',
          season: 5,
          episodeNumber: 4,
          title: 'Your Place in Heaven',
          duration: '52m',
          synopsis: 'Helsinki’s life hangs in the balance as the team faces intense crossfire from the military unit.',
          streamUrl: item.episodeUrls?.[3]?.url || item.episodes?.[3]?.streamUrl || baseStream,
          thumbnailUrl: '',
        },
      ];
    }

    if (item.episodes && item.episodes.length > 0) {
      return [...item.episodes].sort((a, b) => {
        if (a.season !== b.season) return a.season - b.season;
        return a.episodeNumber - b.episodeNumber;
      });
    }
    if (item.episodeUrls && item.episodeUrls.length > 0) {
      const parsed = item.episodeUrls.map((ep, idx) => {
        const match = ep.url.match(/S(\d+)\/E(\d+)/i);
        const sNum = match ? parseInt(match[1], 10) : 1;
        const eNum = match ? parseInt(match[2], 10) : idx + 1;
        return {
          id: `${item.id}-s${sNum}-e${eNum}`,
          season: sNum,
          episodeNumber: eNum,
          title: ep.name?.trim() ? ep.name : `Épisode ${eNum}`,
          duration: '45m',
          synopsis: `Épisode ${eNum} de la saison ${sNum}`,
          streamUrl: ep.url,
          thumbnailUrl: item.backdropUrl || item.posterUrl,
        };
      });

      return parsed.sort((a, b) => {
        if (a.season !== b.season) return a.season - b.season;
        return a.episodeNumber - b.episodeNumber;
      });
    }
    return [];
  }, [item, isMoneyHeist]);

  // Saisons disponibles + sélection (défaut : 1re saison, sans effet de reset : dérivé).
  const seasons = React.useMemo(
    () => Array.from(new Set(allEpisodes.map(ep => ep.season))).sort((a, b) => a - b),
    [allEpisodes]
  );
  const [selectedSeason, setSelectedSeason] = React.useState<number | null>(null);
  const activeSeason =
    selectedSeason != null && seasons.includes(selectedSeason)
      ? selectedSeason
      : seasons[0];
  const seasonEpisodes = React.useMemo(
    () => allEpisodes.filter(ep => ep.season === activeSeason),
    [allEpisodes, activeSeason]
  );

  const handleSeasonPress = (s: number) => {
    if (s === activeSeason) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_) {}
    setSelectedSeason(s);
  };

  // Stills d'épisodes TMDB : apparie la série par titre, récupère le still
  // de chaque épisode (plafonné à 20 requêtes). Money Heist garde ses visuels Figma.
  const [stills, setStills] = React.useState<Record<string, string>>({});
  const [epTitles, setEpTitles] = React.useState<Record<string, string>>({});

  // Reset à chaque fiche.
  React.useEffect(() => {
    setStills({});
    setEpTitles({});
  }, [item?.id]);

  // Stills de la saison affichée uniquement (fusionnés au cache) : plus de
  // plafond global qui affame les saisons suivantes, ≤25 requêtes par saison.
  React.useEffect(() => {
    if (!item || isMoneyHeist || seasonEpisodes.length === 0) return;
    let alive = true;
    (async () => {
      try {
        const search = await tmdb.searchSeries(item.title);
        const match = search.results?.[0];
        if (!alive || !match) return;
        const entries = await Promise.all(
          seasonEpisodes.slice(0, 25).map(async ep => {
            try {
              const det = await tmdb.seriesEpisode(match.id, ep.season, ep.episodeNumber);
              return {
                id: ep.id,
                still: tmdbImage(det.still_path, 'w500'),
                title: det.name?.trim() ? det.name : null,
              };
            } catch {
              return null;
            }
          })
        );
        if (!alive) return;
        const mapStills: Record<string, string> = {};
        const mapTitles: Record<string, string> = {};
        for (const e of entries) {
          if (!e) continue;
          if (e.still) mapStills[e.id] = e.still;
          if (e.title) mapTitles[e.id] = e.title;
        }
        setStills(prev => ({ ...prev, ...mapStills }));
        setEpTitles(prev => ({ ...prev, ...mapTitles }));
      } catch (e) {
        console.warn('Episode stills failed, fallback local:', e);
      }
    })();
    return () => {
      alive = false;
    };
  }, [item, isMoneyHeist, seasonEpisodes]);

  // Nombre d'étoiles dorées selon le score (4 dorées pour Money Heist comme dans Figma)
  const starCount = React.useMemo(() => {
    if (isMoneyHeist) return 4;
    const score = item.matchScore || 80;
    if (score >= 90) return 5;
    if (score >= 75) return 4;
    if (score >= 60) return 3;
    return 3;
  }, [item.matchScore, isMoneyHeist]);

  // Format des métadonnées comme dans Figma: "2021 | Action, Crime, Drama | Episode - 8"
  const metaString = React.useMemo(() => {
    if (isMoneyHeist) {
      return '2021  |  Action, Crime, Drama  |  Episode - 8';
    }
    const year = item.year || 2021;
    const genres = item.genres && item.genres.length > 0 ? item.genres.slice(0, 3).join(', ') : 'Action, Drame';
    const epCount = allEpisodes.length > 0 ? `Episode - ${allEpisodes.length}` : (item.duration || 'Film');
    return `${year}  |  ${genres}  |  ${epCount}`;
  }, [item, allEpisodes, isMoneyHeist]);

  const displayTitle = isMoneyHeist ? 'Money Heist : Part 5' : item.title;

  const getEpisodeImage = (ep: Episode, idx: number) => {
    if (isMoneyHeist) {
      if (idx === 0) return EPISODE_1;
      if (idx === 1) return EPISODE_2;
      if (idx === 2) return EPISODE_3;
      return EPISODE_1;
    }
    if (stills[ep.id]) return { uri: stills[ep.id] };
    return { uri: ep.thumbnailUrl || item.backdropUrl || item.posterUrl };
  };

  return (
    <Animated.View style={[styles.container, { opacity: entranceFade, transform: [{ translateY: entranceSlide }] }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <AmbientGlow />

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        bounces={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
      >
        {/* Grande Affiche Hero (Haut 46% de l'écran) : se dissout au scroll */}
        <Animated.View
          style={[
            styles.heroContainer,
            { opacity: heroOpacity, transform: [{ translateY: heroTranslate }] },
          ]}
        >
          <Image
            source={isMoneyHeist ? HERO_MONEY_HEIST : { uri: item.backdropUrl || item.posterUrl }}
            style={styles.heroImage}
            resizeMode="cover"
          />

          <LinearGradient
            colors={['rgba(4,6,12,0.92)', 'transparent', 'rgba(4,6,12,1)']}
            locations={[0, 0.32, 0.78]}
            style={styles.heroGradient}
          />

          {/* Barre d'action supérieure (Back & Favorite) */}
          <View style={styles.topActionsRow}>
            <TouchableOpacity
              style={styles.iconCircleBtn}
              onPress={handleClose}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.iconCircleBtn}
              onPress={handleToggleFav}
              activeOpacity={0.8}
            >
              <Ionicons
                name={isFavorite ? "heart" : "heart-outline"}
                size={22}
                color={isFavorite ? "#FFFFFF" : "rgba(255, 255, 255, 0.7)"}
              />
            </TouchableOpacity>
          </View>

          {/* Grand Bouton PLAY Rouge Central Figma avec pulsation et feedback tactile */}
          <View style={styles.playButtonWrapper}>
            <Animated.View style={{ transform: [{ scale: Animated.multiply(playPulse, playBtnPressScale) }] }}>
              <TouchableOpacity
                style={styles.playButtonRed}
                onPressIn={() => {
                  Animated.spring(playBtnPressScale, { toValue: 0.90, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
                }}
                onPressOut={() => {
                  Animated.spring(playBtnPressScale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 6 }).start();
                }}
                onPress={handlePlayMain}
                activeOpacity={0.9}
              >
                <Ionicons name="play" size={28} color="#09090F" style={{ marginLeft: 3 }} />
              </TouchableOpacity>
            </Animated.View>
          </View>
        </Animated.View>

        {/* Titre et Détails Centrés */}
        <View style={styles.titleSection}>
          <Text style={styles.titleText}>{displayTitle}</Text>
          <Text style={styles.metaText}>{metaString}</Text>

          {/* Étoiles dorées de notation fidèles au SVG Figma */}
          <View style={styles.ratingRow}>
            {[1, 2, 3, 4, 5].map(index => (
              <Ionicons
                key={index}
                name="star"
                size={18}
                color={index <= starCount ? THEME.colors.goldStar : THEME.colors.navIconInactive}
                style={styles.starIcon}
              />
            ))}
          </View>
        </View>

        {/* Section Episodes (si série) */}
        {allEpisodes.length > 0 && (
          <View style={styles.episodesSection}>
            <Text style={styles.sectionHeaderTitle}>Episodes</Text>

            {seasons.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.seasonRow}
              >
                {seasons.map(s => {
                  const isActive = s === activeSeason;
                  return (
                    <TouchableOpacity
                      key={s}
                      style={[styles.seasonBtn, isActive && styles.seasonBtnActive]}
                      onPress={() => handleSeasonPress(s)}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.seasonText, isActive && styles.seasonTextActive]}>
                        Saison {s}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.episodesScroll}
            >
              {seasonEpisodes.map((ep, idx) => {
                const displayTitle = epTitles[ep.id];
                return (
                  <AnimatedEpisodeCard
                    key={ep.id || idx}
                    ep={displayTitle ? { ...ep, title: displayTitle } : ep}
                    imageSource={getEpisodeImage(ep, idx)}
                    onPress={() => handlePlayEpisode(ep)}
                  />
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Section Plot (Synopsis) */}
        <View style={styles.plotSection}>
          <Text style={styles.sectionHeaderTitle}>Plot</Text>
          <Text style={styles.plotText}>
            {item.synopsis || "Huit voleurs font une prise d'otages dans la Maison royale de la Monnaie d'Espagne, tandis qu'un génie du crime manipule la police pour mettre son plan à exécution."}
          </Text>
        </View>

        <View style={{ height: THEME.spacing.bottomNavPadding }} />
      </Animated.ScrollView>
    </Animated.View>
  );
};

const AnimatedEpisodeCard: React.FC<{
  ep: Episode;
  imageSource: any;
  onPress: () => void;
}> = ({ ep, imageSource, onPress }) => {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.94,
      useNativeDriver: true,
      speed: 40,
      bounciness: 0,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 5,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={styles.episodeCard}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        activeOpacity={0.9}
      >
        <Image
          source={imageSource}
          style={styles.episodeImage}
          resizeMode="cover"
        />
        <LinearGradient
          colors={['transparent', THEME.colors.overlay]}
          style={styles.episodeGradient}
        />
        <View style={styles.episodeCardInfo}>
          <Text style={styles.episodeNumberText}>Episode – {ep.episodeNumber}</Text>
          <Text style={styles.episodeTitleText} numberOfLines={2}>
            {ep.title}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.backgroundBlue,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  heroContainer: {
    width: width,
    height: HERO_HEIGHT,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  topActionsRow: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 52 : 36,
    left: THEME.spacing.screen,
    right: THEME.spacing.screen,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  iconCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: THEME.colors.surfaceGlass,
    borderWidth: 1,
    borderColor: THEME.colors.borderMedium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonWrapper: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 24,
    zIndex: 5,
  },
  playButtonRed: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
  },
  titleSection: {
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.screen,
    // Remonte sur la fin du voile pour absorber la micro-ligne de jonction
    marginTop: -4,
  },
  titleText: {
    fontSize: THEME.typography.sizes.h1,
    fontFamily: THEME.fonts.extrabold,
    color: THEME.colors.textPrimary,
    textAlign: 'center',
    letterSpacing: THEME.typography.letterSpacing.tight,
  },
  metaText: {
    fontSize: THEME.typography.sizes.caption,
    color: THEME.colors.textMuted,
    marginTop: THEME.spacing.sm,
    fontFamily: THEME.fonts.medium,
    textAlign: 'center',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 4,
  },
  starIcon: {
    marginHorizontal: 1,
  },
  episodesSection: {
    marginTop: 26,
  },
  sectionHeaderTitle: {
    fontSize: THEME.typography.sizes.h3,
    fontFamily: THEME.fonts.bold,
    color: THEME.colors.textPrimary,
    paddingHorizontal: THEME.spacing.screen,
    marginBottom: THEME.spacing.md,
    letterSpacing: THEME.typography.letterSpacing.subtle,
  },
  episodesScroll: {
    paddingLeft: THEME.spacing.screen,
    paddingRight: 16,
    gap: THEME.spacing.md,
  },
  seasonRow: {
    paddingLeft: THEME.spacing.screen,
    paddingRight: THEME.spacing.screen,
    gap: THEME.spacing.sm,
    marginBottom: THEME.spacing.md,
  },
  seasonBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: THEME.radii.full,
    backgroundColor: THEME.colors.filterCard,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
  },
  seasonBtnActive: {
    backgroundColor: THEME.colors.filterCardActive,
    borderColor: THEME.colors.borderActive,
  },
  seasonText: {
    fontSize: THEME.typography.sizes.label,
    fontFamily: THEME.fonts.semibold,
    color: THEME.colors.textSecondary,
  },
  seasonTextActive: {
    color: THEME.colors.textPrimary,
    fontFamily: THEME.fonts.bold,
  },
  episodeCard: {
    width: 140,
    height: 180,
    borderRadius: THEME.radii.squircle,
    overflow: 'hidden',
    backgroundColor: THEME.colors.card,
    position: 'relative',
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
    ...THEME.shadows.card,
  },
  episodeImage: {
    width: '100%',
    height: '100%',
  },
  episodeGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '65%',
  },
  episodeCardInfo: {
    position: 'absolute',
    bottom: 12,
    left: 10,
    right: 10,
  },
  episodeNumberText: {
    fontSize: THEME.typography.sizes.railTitle,
    fontFamily: THEME.fonts.bold,
    color: THEME.colors.textPrimary,
  },
  episodeTitleText: {
    fontSize: THEME.typography.sizes.badge,
    color: THEME.colors.textMuted,
    marginTop: 2,
    lineHeight: 14,
  },
  plotSection: {
    marginTop: 24,
    paddingHorizontal: THEME.spacing.screen,
  },
  plotText: {
    fontSize: 13.5,
    color: THEME.colors.textSecondary,
    lineHeight: 22,
    letterSpacing: 0.1,
  },
});
