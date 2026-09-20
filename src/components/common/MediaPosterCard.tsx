import React, { useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  ImageSourcePropType,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { THEME } from '../../constants/theme';
import { MediaItem } from '../../types/media';

interface MediaPosterCardProps {
  item: MediaItem;
  onPress: (item: MediaItem) => void;
  width?: number;
  height?: number;
  imageSource?: ImageSourcePropType;
  showRating?: boolean;
  hideQuality?: boolean;
}

const MediaPosterCardInner: React.FC<MediaPosterCardProps> = ({
  item,
  onPress,
  width,
  height = 200,
  imageSource,
  showRating = false,
  hideQuality = false,
}) => {
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
      bounciness: 5,
    }).start();
  };

  const handlePress = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_) {}
    onPress(item);
  };

  const source = imageSource || (item.posterUrl ? { uri: item.posterUrl } : undefined);

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, width ? { width } : styles.flexWidth]}>
      <TouchableOpacity
        style={styles.container}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        activeOpacity={0.9}
      >
        <View style={[styles.posterWrapper, { height }]}>
          {source ? (
            <Image source={source} style={styles.posterImage} resizeMode="cover" fadeDuration={0} />
          ) : (
            <View style={styles.placeholderContainer}>
              <Ionicons name="film-outline" size={32} color={THEME.colors.textMuted} />
            </View>
          )}

          {showRating && item.matchScore !== undefined && (
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={10} color={THEME.colors.goldStar} style={{ marginRight: 3 }} />
              <Text style={styles.ratingText}>
                {item.matchScore}%
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.title} numberOfLines={1}>
          {item.title}
        </Text>

        {item.year && (
          <Text style={styles.subtitle} numberOfLines={1}>
            {item.year}{!hideQuality && item.quality ? ` • ${item.quality}` : ''}
          </Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

// Memoïsé : les items du catalogue sont des références stables,
// on évite de re-rendre les ~5000 cartes à chaque frappe / changement de filtre.
export const MediaPosterCard = React.memo(MediaPosterCardInner);

const styles = StyleSheet.create({
  container: {
    marginBottom: THEME.spacing.lg,
    width: '100%',
  },
  flexWidth: {
    width: '100%',
  },
  posterWrapper: {
    width: '100%',
    borderRadius: THEME.radii.card,
    backgroundColor: THEME.colors.card,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
    ...THEME.shadows.card,
  },
  posterImage: {
    width: '100%',
    height: '100%',
  },
  placeholderContainer: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.card,
  },
  ratingBadge: {
    position: 'absolute',
    top: THEME.spacing.sm,
    right: THEME.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: THEME.radii.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  ratingText: {
    color: THEME.colors.textPrimary,
    fontSize: THEME.typography.sizes.badge,
    fontFamily: THEME.fonts.bold,
  },
  title: {
    fontSize: THEME.typography.sizes.cardTitle,
    fontFamily: THEME.fonts.semibold,
    color: THEME.colors.textPrimary,
    marginTop: THEME.spacing.xs + 2,
  },
  subtitle: {
    fontSize: THEME.typography.sizes.small,
    fontFamily: THEME.fonts.medium,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
});
