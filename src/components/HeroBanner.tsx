import React from 'react';
import { StyleSheet, Text, View, Image, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { MediaItem } from '../types/media';
import { THEME } from '../constants/theme';

interface HeroBannerProps {
  item: MediaItem;
  onPlayPress: (item: MediaItem) => void;
  onDetailsPress: (item: MediaItem) => void;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
}

const { width } = Dimensions.get('window');
const BANNER_HEIGHT = 440;

export const HeroBanner: React.FC<HeroBannerProps> = ({
  item,
  onPlayPress,
  onDetailsPress,
  isFavorite,
  onToggleFavorite,
}) => {
  const handleToggleFav = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (_) {}
    onToggleFavorite(item.id);
  };

  return (
    <View style={styles.container}>
      {/* Image de fond */}
      <Image
        source={{ uri: item.backdropUrl }}
        style={styles.backdrop}
        resizeMode="cover"
      />

      {/* Dégradés supérieurs et inférieurs */}
      <LinearGradient
        colors={['rgba(8, 11, 16, 0.7)', 'transparent']}
        style={styles.topGradient}
      />
      <LinearGradient
        colors={['transparent', 'rgba(8, 11, 16, 0.8)', '#080B10']}
        locations={[0, 0.65, 1]}
        style={styles.bottomGradient}
      />

      {/* Contenu textuel et actions */}
      <View style={styles.content}>
        {/* Badge Spot / Nouveauté */}
        <View style={styles.spotlightRow}>
          <View style={styles.spotlightBadge}>
            <Ionicons name="sparkles" size={12} color={THEME.colors.primary} />
            <Text style={styles.spotlightText}>À L'AFFICHE AUJOURD'HUI</Text>
          </View>
        </View>

        {/* Titre */}
        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>

        {/* Tags Genres & Qualité */}
        <View style={styles.metaRow}>
          <Text style={styles.matchScore}>{item.matchScore}% Recommandé</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.quality}</Text>
          </View>
          <Text style={styles.metaYear}>{item.year}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.ageRating}</Text>
          </View>
          <Text style={styles.metaDuration}>{item.duration}</Text>
        </View>

        {/* Genres sous forme de ligne */}
        <Text style={styles.genresText} numberOfLines={1}>
          {item.genres.join('  •  ')}
        </Text>

        {/* Boutons d'action */}
        <View style={styles.actionsRow}>
          {/* Bouton Regarder */}
          <TouchableOpacity
            style={styles.playButton}
            onPress={() => onPlayPress(item)}
            activeOpacity={0.85}
          >
            <Ionicons name="play" size={20} color="#080B10" />
            <Text style={styles.playButtonText}>Regarder</Text>
          </TouchableOpacity>

          {/* Bouton Ma Liste */}
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleToggleFav}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isFavorite ? "checkmark" : "add"}
              size={20}
              color={isFavorite ? THEME.colors.primary : THEME.colors.text}
            />
            <Text style={[styles.secondaryButtonText, isFavorite && { color: THEME.colors.primary }]}>
              {isFavorite ? 'Dans Ma Liste' : 'Ma Liste'}
            </Text>
          </TouchableOpacity>

          {/* Bouton Infos */}
          <TouchableOpacity
            style={styles.iconOnlyButton}
            onPress={() => onDetailsPress(item)}
            activeOpacity={0.7}
          >
            <Ionicons name="information-circle-outline" size={24} color={THEME.colors.text} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: width,
    height: BANNER_HEIGHT,
    position: 'relative',
    backgroundColor: THEME.colors.background,
  },
  backdrop: {
    width: '100%',
    height: '100%',
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 280,
  },
  content: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: THEME.spacing.md,
    paddingBottom: THEME.spacing.md,
  },
  spotlightRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  spotlightBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: THEME.radii.full,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  spotlightText: {
    fontSize: 10,
    fontFamily: THEME.fonts.extrabold,
    color: THEME.colors.primary,
    letterSpacing: 1,
  },
  title: {
    fontSize: 30,
    fontFamily: THEME.fonts.extrabold,
    color: THEME.colors.text,
    letterSpacing: -0.5,
    lineHeight: 34,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  matchScore: {
    fontSize: 13,
    fontFamily: THEME.fonts.extrabold,
    color: THEME.colors.accentGreen,
  },
  badge: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: THEME.fonts.bold,
    color: THEME.colors.textSecondary,
  },
  metaYear: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    fontFamily: THEME.fonts.semibold,
  },
  metaDuration: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    fontFamily: THEME.fonts.semibold,
  },
  genresText: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    fontFamily: THEME.fonts.medium,
    marginBottom: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  playButton: {
    flex: 1.2,
    height: 44,
    backgroundColor: THEME.colors.primary,
    borderRadius: THEME.radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    elevation: 5,
  },
  playButtonText: {
    fontSize: 15,
    fontFamily: THEME.fonts.extrabold,
    color: '#080B10',
    letterSpacing: 0.3,
  },
  secondaryButton: {
    flex: 1,
    height: 44,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: THEME.radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontFamily: THEME.fonts.bold,
    color: THEME.colors.text,
  },
  iconOnlyButton: {
    width: 44,
    height: 44,
    borderRadius: THEME.radii.md,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
});
