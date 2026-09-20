import React from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MediaCard } from './MediaCard';
import { MediaItem, WatchProgress } from '../types/media';
import { THEME } from '../constants/theme';

interface MediaRowProps {
  title: string;
  items: MediaItem[];
  onPressItem: (item: MediaItem) => void;
  onPlayItem?: (item: MediaItem) => void;
  getProgress?: (mediaId: string) => WatchProgress | null;
  cardSize?: 'normal' | 'large' | 'compact';
  showRanking?: boolean;
  iconName?: keyof typeof Ionicons.glyphMap;
  badgeText?: string;
}

export const MediaRow: React.FC<MediaRowProps> = ({
  title,
  items,
  onPressItem,
  onPlayItem,
  getProgress,
  cardSize = 'normal',
  showRanking = false,
  iconName,
  badgeText,
}) => {
  if (!items || items.length === 0) return null;

  return (
    <View style={styles.container}>
      {/* En-tête de section */}
      <View style={styles.headerRow}>
        <View style={styles.titleWrapper}>
          {iconName && (
            <Ionicons name={iconName} size={18} color={THEME.colors.primary} style={styles.icon} />
          )}
          <Text style={styles.title}>{title}</Text>
          {badgeText && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badgeText}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Carrousel horizontal virtualisé FlatList (optimisé mémoire 60fps) */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        data={items.slice(0, 30)}
        keyExtractor={(item) => item.id}
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={3}
        renderItem={({ item, index }) => (
          <MediaCard
            item={item}
            onPress={onPressItem}
            onPlayPress={onPlayItem}
            progress={getProgress ? getProgress(item.id) : null}
            size={cardSize}
            ranking={showRanking ? index + 1 : undefined}
          />
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: THEME.spacing.md,
    marginBottom: 10,
  },
  titleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  icon: {
    marginRight: 2,
  },
  title: {
    fontSize: 18,
    fontFamily: THEME.fonts.extrabold,
    color: THEME.colors.text,
    letterSpacing: -0.2,
  },
  badge: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: THEME.radii.full,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  badgeText: {
    fontSize: 10,
    fontFamily: THEME.fonts.extrabold,
    color: THEME.colors.primary,
  },
  scrollContent: {
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: 4,
  },
});
