import React from 'react';
import { StyleSheet, Text, ScrollView, TouchableOpacity } from 'react-native';
import { THEME } from '../constants/theme';

interface CategoryPillsProps {
  categories: string[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
}

export const CategoryPills: React.FC<CategoryPillsProps> = ({
  categories,
  selectedCategory,
  onSelectCategory,
}) => {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {categories.map(cat => {
        const isSelected = selectedCategory === cat;
        return (
          <TouchableOpacity
            key={cat}
            style={[styles.pill, isSelected && styles.pillActive]}
            onPress={() => onSelectCategory(cat)}
            activeOpacity={0.7}
          >
            <Text style={[styles.pillText, isSelected && styles.pillTextActive]}>
              {cat}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: THEME.spacing.sm,
    gap: 8,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: THEME.radii.full,
    backgroundColor: THEME.colors.card,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  pillActive: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  pillText: {
    fontSize: 13,
    fontFamily: THEME.fonts.semibold,
    color: THEME.colors.textSecondary,
  },
  pillTextActive: {
    color: '#080B10',
    fontFamily: THEME.fonts.extrabold,
  },
});
