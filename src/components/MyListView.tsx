import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MediaCard } from './MediaCard';
import { MediaItem, WatchProgress } from '../types/media';
import { THEME } from '../constants/theme';

interface MyListViewProps {
  favoriteItems: MediaItem[];
  continueWatchingItems: { media: MediaItem; progress: WatchProgress }[];
  onSelectItem: (item: MediaItem) => void;
  onPlayItem: (item: MediaItem) => void;
  onClearHistoryItem?: (id: string) => void;
}

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = (width - 32 - 12) / 2;

export const MyListView: React.FC<MyListViewProps> = ({
  favoriteItems,
  continueWatchingItems,
  onSelectItem,
  onPlayItem,
  onClearHistoryItem,
}) => {
  const [activeTab, setActiveTab] = useState<'favorites' | 'history'>('favorites');

  return (
    <View style={styles.container}>
      {/* Tab Switcher */}
      <View style={styles.tabSwitcher}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'favorites' && styles.tabBtnActive]}
          onPress={() => setActiveTab('favorites')}
        >
          <Ionicons
            name="bookmark"
            size={16}
            color={activeTab === 'favorites' ? '#080B10' : THEME.colors.textSecondary}
          />
          <Text style={[styles.tabBtnText, activeTab === 'favorites' && styles.tabBtnTextActive]}>
            Ma Liste ({favoriteItems.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'history' && styles.tabBtnActive]}
          onPress={() => setActiveTab('history')}
        >
          <Ionicons
            name="time-outline"
            size={16}
            color={activeTab === 'history' ? '#080B10' : THEME.colors.textSecondary}
          />
          <Text style={[styles.tabBtnText, activeTab === 'history' && styles.tabBtnTextActive]}>
            Historique ({continueWatchingItems.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content for Favorites */}
      {activeTab === 'favorites' && (
        <FlatList
          data={favoriteItems}
          keyExtractor={item => item.id}
          numColumns={2}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.columnWrapper}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={{ width: COLUMN_WIDTH, marginBottom: 16 }}>
              <MediaCard
                item={item}
                onPress={onSelectItem}
                onPlayPress={onPlayItem}
                size="normal"
              />
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="bookmark-outline" size={48} color={THEME.colors.textMuted} />
              <Text style={styles.emptyTitle}>Votre liste est vide</Text>
              <Text style={styles.emptySubtitle}>
                Ajoutez des films et séries depuis l’accueil ou la recherche en appuyant sur "+ Ma Liste".
              </Text>
            </View>
          }
        />
      )}

      {/* Content for History */}
      {activeTab === 'history' && (
        <FlatList
          data={continueWatchingItems}
          keyExtractor={item => item.media.id}
          numColumns={2}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.columnWrapper}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={{ width: COLUMN_WIDTH, marginBottom: 16 }}>
              <MediaCard
                item={item.media}
                progress={item.progress}
                onPress={onSelectItem}
                onPlayPress={onPlayItem}
                size="normal"
              />
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="play-circle-outline" size={48} color={THEME.colors.textMuted} />
              <Text style={styles.emptyTitle}>Aucune lecture récente</Text>
              <Text style={styles.emptySubtitle}>
                Dès que vous lancez un film ou un flux vidéo, votre progression s’affichera ici pour reprendre la lecture.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
    paddingHorizontal: THEME.spacing.md,
    paddingTop: THEME.spacing.sm,
  },
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radii.lg,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  tabBtn: {
    flex: 1,
    height: 38,
    borderRadius: THEME.radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  tabBtnActive: {
    backgroundColor: THEME.colors.primary,
  },
  tabBtnText: {
    fontSize: 13,
    fontFamily: THEME.fonts.bold,
    color: THEME.colors.textSecondary,
  },
  tabBtnTextActive: {
    color: '#080B10',
    fontFamily: THEME.fonts.extrabold,
  },
  listContent: {
    paddingBottom: 40,
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 70,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: THEME.fonts.extrabold,
    color: THEME.colors.text,
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: THEME.colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 30,
    lineHeight: 18,
  },
});
