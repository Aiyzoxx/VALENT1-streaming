import React from 'react';
import { StyleSheet, Text, View, Image, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { MediaItem, WatchProgress } from '../types/media';
import { THEME } from '../constants/theme';

interface MediaCardProps {
  item: MediaItem;
  onPress: (item: MediaItem) => void;
  onPlayPress?: (item: MediaItem) => void;
  progress?: WatchProgress | null;
  size?: 'normal' | 'large' | 'compact';
  ranking?: number; // Pour le Top 10
}

const { width } = Dimensions.get('window');

export const MediaCard: React.FC<MediaCardProps> = ({
  item,
  onPress,
  onPlayPress,
  progress,
  size = 'normal',
  ranking,
}) => {
  const cardWidth = size === 'large' ? 170 : size === 'compact' ? 115 : 140;
  const cardHeight = cardWidth * 1.5;

  const progressPercent = progress && progress.duration > 0 
    ? Math.min(100, Math.max(0, (progress.currentTime / progress.duration) * 100))
    : 0;

  return (
    <TouchableOpacity
      style={[styles.container, { width: cardWidth }]}
      onPress={() => onPress(item)}
      activeOpacity={0.8}
    >
      {/* Classement Top 10 si fourni */}
      {ranking !== undefined && (
        <View style={styles.rankContainer}>
          <Text style={styles.rankText}>{ranking}</Text>
        </View>
      )}

      {/* Poster Image Container */}
      <View style={[styles.imageWrapper, { height: cardHeight }]}>
        <Image
          source={{ uri: item.posterUrl }}
          style={styles.image}
          resizeMode="cover"
        />

        <LinearGradient
          colors={['transparent', 'rgba(8, 11, 16, 0.4)', 'rgba(8, 11, 16, 0.95)']}
          style={styles.gradient}
        />

        {/* Badges Top (Live or Quality) */}
        <View style={styles.topBadges}>
          {item.type === 'live' ? (
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveBadgeText}>DIRECT</Text>
            </View>
          ) : (
            <View style={styles.qualityBadge}>
              <Text style={styles.qualityText}>{item.quality}</Text>
            </View>
          )}

          <View style={styles.ageBadge}>
            <Text style={styles.ageText}>{item.ageRating}</Text>
          </View>
        </View>

        {/* Quick Play Overlay Button */}
        {onPlayPress && (
          <TouchableOpacity
            style={styles.quickPlayBtn}
            onPress={(e) => {
              e.stopPropagation();
              onPlayPress(item);
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="play" size={14} color="#080B10" />
          </TouchableOpacity>
        )}

        {/* Barre de progression si visionné */}
        {progressPercent > 0 && (
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>
        )}
      </View>

      {/* Titre et détails sous la carte */}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {item.title}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.matchScore}>{item.matchScore}%</Text>
          <Text style={styles.metaDot}>•</Text>
          <Text style={styles.metaText}>{item.year}</Text>
          <Text style={styles.metaDot}>•</Text>
          <Text style={styles.metaText}>{item.duration}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    marginRight: 12,
  },
  rankContainer: {
    position: 'absolute',
    left: -14,
    bottom: 30,
    zIndex: 5,
  },
  rankText: {
    fontSize: 70,
    fontFamily: THEME.fonts.extrabold,
    color: '#1E293B',
    textShadowColor: THEME.colors.primary,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  imageWrapper: {
    width: '100%',
    borderRadius: THEME.radii.card,
    overflow: 'hidden',
    backgroundColor: THEME.colors.card,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
    position: 'relative',
    ...THEME.shadows.card,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '45%',
  },
  topBadges: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: THEME.radii.sm,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: THEME.colors.textPrimary,
    marginRight: 4,
  },
  liveBadgeText: {
    fontSize: THEME.typography.sizes.badge - 1,
    fontFamily: THEME.fonts.extrabold,
    color: THEME.colors.textPrimary,
    letterSpacing: 0.5,
  },
  qualityBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: THEME.radii.sm,
    borderWidth: 0.5,
    borderColor: THEME.colors.borderSubtle,
  },
  qualityText: {
    fontSize: THEME.typography.sizes.badge - 1.5,
    fontFamily: THEME.fonts.extrabold,
    color: THEME.colors.textPrimary,
    letterSpacing: 0.3,
  },
  cardInner: {
    width: '100%',
    height: '100%',
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  ageBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: THEME.colors.overlay,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 3,
    borderWidth: 0.5,
    borderColor: THEME.colors.borderSubtle,
  },
  ageText: {
    fontSize: THEME.typography.sizes.badge - 2,
    fontFamily: THEME.fonts.bold,
    color: THEME.colors.textSecondary,
  },
  quickPlayBtn: {
    position: 'absolute',
    right: 8,
    bottom: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  progressBarBg: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
  },
  info: {
    marginTop: 6,
  },
  title: {
    fontSize: THEME.typography.sizes.cardTitle,
    fontFamily: THEME.fonts.bold,
    color: THEME.colors.textPrimary,
    letterSpacing: 0.2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  matchScore: {
    fontSize: THEME.typography.sizes.small,
    fontFamily: THEME.fonts.extrabold,
    color: THEME.colors.matchGreen,
  },
  metaDot: {
    color: THEME.colors.textMuted,
    fontSize: 10,
    marginHorizontal: 4,
  },
  metaText: {
    fontSize: THEME.typography.sizes.small,
    color: THEME.colors.textSecondary,
    fontFamily: THEME.fonts.medium,
  },
});
