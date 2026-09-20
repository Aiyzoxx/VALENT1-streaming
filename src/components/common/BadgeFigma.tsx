import React from 'react';
import { StyleSheet, Text, View, ViewStyle, TextStyle } from 'react-native';
import { THEME } from '../../constants/theme';

interface BadgeFigmaProps {
  label: string;
  variant?: 'match' | 'neutral' | 'accent' | 'gold';
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const BadgeFigma: React.FC<BadgeFigmaProps> = ({
  label,
  variant = 'neutral',
  style,
  textStyle,
}) => {
  return (
    <View
      style={[
        styles.badgeBase,
        variant === 'match' && styles.badgeMatch,
        variant === 'neutral' && styles.badgeNeutral,
        variant === 'accent' && styles.badgeAccent,
        variant === 'gold' && styles.badgeGold,
        style,
      ]}
    >
      <Text
        style={[
          styles.textBase,
          variant === 'match' && styles.textMatch,
          variant === 'neutral' && styles.textNeutral,
          variant === 'accent' && styles.textAccent,
          variant === 'gold' && styles.textGold,
          textStyle,
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badgeBase: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: THEME.radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeMatch: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: THEME.colors.matchGreen,
  },
  badgeNeutral: {
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
  },
  badgeAccent: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  badgeGold: {
    backgroundColor: 'rgba(255, 184, 0, 0.15)',
    borderWidth: 1,
    borderColor: THEME.colors.goldStar,
  },
  textBase: {
    fontSize: THEME.typography.sizes.small,
    fontFamily: THEME.fonts.bold,
    letterSpacing: THEME.typography.letterSpacing.wide,
  },
  textMatch: {
    color: THEME.colors.matchGreen,
  },
  textNeutral: {
    color: THEME.colors.textPrimary,
  },
  textAccent: {
    color: THEME.colors.textPrimary,
  },
  textGold: {
    color: THEME.colors.goldStar,
  },
});
