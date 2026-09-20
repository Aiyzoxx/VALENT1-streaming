import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  Image,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { MediaItem, Episode } from '../types/media';
import { THEME } from '../constants/theme';

interface DetailModalProps {
  item: MediaItem | null;
  visible: boolean;
  onClose: () => void;
  onPlay: (item: MediaItem, episode?: Episode) => void;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
}

const { width, height } = Dimensions.get('window');

export const DetailModal: React.FC<DetailModalProps> = ({
  item,
  visible,
  onClose,
  onPlay,
  isFavorite,
  onToggleFavorite,
}) => {
  const handleToggleFav = () => {
    if (!item) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_) {}
    onToggleFavorite(item.id);
  };

  const allEpisodes: Episode[] = React.useMemo(() => {
    if (!item) return [];
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
          title: `Épisode ${eNum}`,
          duration: ep.name || 'HD',
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
  }, [item]);

  const seasons = React.useMemo(() => {
    const set = new Set<number>();
    allEpisodes.forEach(ep => set.add(ep.season));
    return Array.from(set).sort((a, b) => a - b);
  }, [allEpisodes]);

  const [selectedSeason, setSelectedSeason] = React.useState<number>(1);

  React.useEffect(() => {
    if (seasons.length > 0) {
      setSelectedSeason(seasons[0]);
    }
  }, [item?.id, seasons]);

  const displayedEpisodes = React.useMemo(() => {
    if (seasons.length <= 1) return allEpisodes;
    return allEpisodes.filter(ep => ep.season === selectedSeason);
  }, [allEpisodes, selectedSeason, seasons]);

  if (!item) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Bouton Fermer fixé en haut à droite */}
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
          activeOpacity={0.8}
        >
          <Ionicons name="close" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Header Image */}
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: item.backdropUrl || item.posterUrl }}
              style={styles.backdrop}
              resizeMode="cover"
            />
            <LinearGradient
              colors={['transparent', 'rgba(8, 11, 16, 0.6)', '#080B10']}
              locations={[0, 0.7, 1]}
              style={styles.imageGradient}
            />

            {/* Bouton lecture central au dessus de l'image */}
            <TouchableOpacity
              style={styles.centerPlayBtn}
              onPress={() => onPlay(item)}
              activeOpacity={0.85}
            >
              <Ionicons name="play" size={32} color="#080B10" />
            </TouchableOpacity>
          </View>

          {/* Informations détaillées */}
          <View style={styles.body}>
            <Text style={styles.title}>{item.title}</Text>

            {item.originalTitle && (
              <Text style={styles.originalTitle}>{item.originalTitle}</Text>
            )}

            {/* Badges de métadonnées */}
            <View style={styles.metaRow}>
              <Text style={styles.matchScore}>{item.matchScore}% Recommandé</Text>
              <Text style={styles.metaText}>{item.year}</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.ageRating}</Text>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.quality}</Text>
              </View>
              <Text style={styles.metaText}>{item.duration}</Text>
            </View>

            {/* Actions principales */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.primaryPlayButton}
                onPress={() => onPlay(item)}
                activeOpacity={0.85}
              >
                <Ionicons name="play" size={20} color="#080B10" />
                <Text style={styles.primaryPlayText}>
                  {item.type === 'live' ? 'Regarder le Direct' : 'Lecture'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.favoriteButton, isFavorite && styles.favoriteButtonActive]}
                onPress={handleToggleFav}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={isFavorite ? "checkmark" : "add"}
                  size={20}
                  color={isFavorite ? THEME.colors.primary : THEME.colors.text}
                />
                <Text style={[styles.favoriteText, isFavorite && { color: THEME.colors.primary }]}>
                  {isFavorite ? 'Dans Ma Liste' : 'Ma Liste'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Synopsis */}
            <Text style={styles.synopsisHeader}>Synopsis</Text>
            <Text style={styles.synopsis}>{item.synopsis}</Text>

            {/* Distribution / Acteurs */}
            {item.cast && item.cast.length > 0 && (
              <View style={styles.castContainer}>
                <Text style={styles.castLabel}>Avec : </Text>
                <Text style={styles.castNames}>{item.cast.join(', ')}</Text>
              </View>
            )}

            {/* Genres */}
            <View style={styles.genrePills}>
              {item.genres.map(g => (
                <View key={g} style={styles.genrePill}>
                  <Text style={styles.genrePillText}>{g}</Text>
                </View>
              ))}
            </View>

            {/* Liste des épisodes (si série) */}
            {item.type === 'series' && allEpisodes.length > 0 && (
              <View style={styles.episodesSection}>
                <View style={styles.episodesHeader}>
                  <Text style={styles.episodesTitle}>
                    Épisodes ({displayedEpisodes.length})
                  </Text>
                  <View style={styles.seasonBadge}>
                    <Text style={styles.seasonBadgeText}>
                      {seasons.length > 1 ? `${seasons.length} Saisons disponibles` : 'Saison 1'}
                    </Text>
                  </View>
                </View>

                {/* Onglets de sélection de la Saison si plusieurs saisons */}
                {seasons.length > 1 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.seasonsScroll}
                  >
                    {seasons.map(s => {
                      const isActive = s === selectedSeason;
                      const count = allEpisodes.filter(e => e.season === s).length;
                      return (
                        <TouchableOpacity
                          key={s}
                          style={[styles.seasonTab, isActive && styles.seasonTabActive]}
                          onPress={() => {
                            try {
                              Haptics.selectionAsync();
                            } catch (_) {}
                            setSelectedSeason(s);
                          }}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.seasonTabText, isActive && styles.seasonTabTextActive]}>
                            Saison {s}
                          </Text>
                          <View style={[styles.seasonTabBadge, isActive && styles.seasonTabBadgeActive]}>
                            <Text style={[styles.seasonTabBadgeText, isActive && styles.seasonTabBadgeTextActive]}>
                              {count}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}

                {displayedEpisodes.map(ep => (
                  <TouchableOpacity
                    key={ep.id}
                    style={styles.episodeCard}
                    onPress={() => onPlay(item, ep)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.episodeThumbWrapper}>
                      <Image source={{ uri: ep.thumbnailUrl }} style={styles.episodeThumb} />
                      <View style={styles.episodePlayIcon}>
                        <Ionicons name="play" size={14} color="#080B10" />
                      </View>
                    </View>

                    <View style={styles.episodeInfo}>
                      <View style={styles.episodeTitleRow}>
                        <Text style={styles.episodeTitle} numberOfLines={1}>
                          {ep.title}
                        </Text>
                        <Text style={styles.episodeDuration}>{ep.duration}</Text>
                      </View>
                      <Text style={styles.episodeSynopsis} numberOfLines={2}>
                        {ep.synopsis}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* URL du flux (Transparence & Test) */}
            <View style={styles.streamInfoBox}>
              <View style={styles.streamInfoHead}>
                <Ionicons name="shield-checkmark" size={16} color={THEME.colors.primary} />
                <Text style={styles.streamInfoTitle}>Flux HLS (.m3u8) actif</Text>
              </View>
              <Text style={styles.streamUrl} numberOfLines={2}>
                {item.streamUrl}
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  closeButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    right: 20,
    zIndex: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  imageContainer: {
    width: width,
    height: 320,
    position: 'relative',
    backgroundColor: THEME.colors.card,
  },
  backdrop: {
    width: '100%',
    height: '100%',
  },
  imageGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 180,
  },
  centerPlayBtn: {
    position: 'absolute',
    top: '40%',
    left: '50%',
    marginLeft: -32,
    marginTop: -32,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  body: {
    paddingHorizontal: THEME.spacing.md,
    marginTop: -20,
  },
  title: {
    fontSize: 26,
    fontFamily: THEME.fonts.extrabold,
    color: THEME.colors.text,
    letterSpacing: -0.3,
  },
  originalTitle: {
    fontSize: 13,
    color: THEME.colors.textMuted,
    marginTop: 2,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 10,
  },
  matchScore: {
    fontSize: 13,
    fontFamily: THEME.fonts.extrabold,
    color: THEME.colors.accentGreen,
  },
  metaText: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    fontFamily: THEME.fonts.semibold,
  },
  badge: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: THEME.fonts.bold,
    color: THEME.colors.textSecondary,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 14,
  },
  primaryPlayButton: {
    flex: 1.5,
    height: 46,
    borderRadius: THEME.radii.md,
    backgroundColor: THEME.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryPlayText: {
    fontSize: 15,
    fontFamily: THEME.fonts.extrabold,
    color: '#080B10',
  },
  favoriteButton: {
    flex: 1,
    height: 46,
    borderRadius: THEME.radii.md,
    backgroundColor: THEME.colors.card,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  favoriteButtonActive: {
    borderColor: THEME.colors.primary,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
  },
  favoriteText: {
    fontSize: 13,
    fontFamily: THEME.fonts.bold,
    color: THEME.colors.text,
  },
  synopsisHeader: {
    fontSize: 15,
    fontFamily: THEME.fonts.extrabold,
    color: THEME.colors.text,
    marginTop: 10,
    marginBottom: 4,
  },
  synopsis: {
    fontSize: 14,
    lineHeight: 22,
    color: THEME.colors.textSecondary,
  },
  castContainer: {
    flexDirection: 'row',
    marginTop: 12,
  },
  castLabel: {
    fontSize: 13,
    color: THEME.colors.textMuted,
    fontFamily: THEME.fonts.semibold,
  },
  castNames: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    flex: 1,
  },
  genrePills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  genrePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: THEME.radii.full,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  genrePillText: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    fontFamily: THEME.fonts.semibold,
  },
  episodesSection: {
    marginTop: 24,
  },
  episodesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  episodesTitle: {
    fontSize: 18,
    fontFamily: THEME.fonts.extrabold,
    color: THEME.colors.text,
  },
  seasonBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  seasonBadgeText: {
    fontSize: 12,
    color: THEME.colors.primary,
    fontFamily: THEME.fonts.bold,
  },
  seasonsScroll: {
    gap: 8,
    paddingBottom: 14,
  },
  seasonTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  seasonTabActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.16)',
    borderColor: THEME.colors.primary,
  },
  seasonTabText: {
    fontSize: 13,
    fontFamily: THEME.fonts.semibold,
    color: THEME.colors.textMuted,
  },
  seasonTabTextActive: {
    color: THEME.colors.primary,
    fontFamily: THEME.fonts.extrabold,
  },
  seasonTabBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  seasonTabBadgeActive: {
    backgroundColor: THEME.colors.primary,
  },
  seasonTabBadgeText: {
    fontSize: 11,
    fontFamily: THEME.fonts.bold,
    color: THEME.colors.textMuted,
  },
  seasonTabBadgeTextActive: {
    color: '#080B10',
  },
  episodeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    gap: 12,
  },
  episodeThumbWrapper: {
    width: 110,
    height: 65,
    borderRadius: THEME.radii.sm,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: THEME.colors.card,
  },
  episodeThumb: {
    width: '100%',
    height: '100%',
  },
  episodePlayIcon: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -12,
    marginTop: -12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  episodeInfo: {
    flex: 1,
  },
  episodeTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  episodeTitle: {
    fontSize: 13,
    fontFamily: THEME.fonts.bold,
    color: THEME.colors.text,
    flex: 1,
    marginRight: 6,
  },
  episodeDuration: {
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  episodeSynopsis: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    lineHeight: 16,
  },
  streamInfoBox: {
    marginTop: 24,
    padding: 12,
    borderRadius: THEME.radii.md,
    backgroundColor: 'rgba(56, 189, 248, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.2)',
  },
  streamInfoHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  streamInfoTitle: {
    fontSize: 11,
    fontFamily: THEME.fonts.extrabold,
    color: THEME.colors.primary,
    letterSpacing: 0.5,
  },
  streamUrl: {
    fontSize: 10,
    color: THEME.colors.textSecondary,
    fontFamily: THEME.fonts.regular,
  },
});
