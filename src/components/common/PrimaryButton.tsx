import React, { useRef } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  ViewStyle,
  TextStyle,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { THEME } from '../../constants/theme';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  iconName?: keyof typeof Ionicons.glyphMap;
  variant?: 'primary' | 'secondary' | 'ghost';
  style?: ViewStyle;
  textStyle?: TextStyle;
  disabled?: boolean;
}

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  label,
  onPress,
  iconName,
  variant = 'primary',
  style,
  textStyle,
  disabled = false,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (disabled) return;
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
      speed: 40,
      bounciness: 0,
    }).start();
  };

  const handlePressOut = () => {
    if (disabled) return;
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 6,
    }).start();
  };

  const handlePress = () => {
    if (disabled) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (_) {}
    onPress();
  };

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
      <TouchableOpacity
        style={[
          styles.buttonBase,
          variant === 'primary' && styles.buttonPrimary,
          variant === 'secondary' && styles.buttonSecondary,
          variant === 'ghost' && styles.buttonGhost,
          disabled && styles.buttonDisabled,
        ]}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        activeOpacity={0.9}
        disabled={disabled}
      >
        {iconName && (
          <Ionicons
            name={iconName}
            size={18}
            color={variant === 'primary' ? '#09090F' : variant === 'ghost' ? THEME.colors.textMuted : THEME.colors.textPrimary}
            style={styles.icon}
          />
        )}
        <Text
          style={[
            styles.textBase,
            variant === 'primary' && styles.textPrimary,
            variant === 'secondary' && styles.textSecondary,
            variant === 'ghost' && styles.textGhost,
            disabled && styles.textDisabled,
            textStyle,
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  buttonBase: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    paddingHorizontal: THEME.spacing.xl,
    borderRadius: THEME.radii.squircle,
    width: '100%',
  },
  buttonPrimary: {
    backgroundColor: '#FFFFFF',
    ...THEME.shadows.card,
  },
  buttonSecondary: {
    backgroundColor: THEME.colors.filterCard,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
    ...THEME.shadows.filter,
  },
  buttonGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  icon: {
    marginRight: THEME.spacing.sm,
  },
  textBase: {
    fontSize: THEME.typography.sizes.body,
    fontFamily: THEME.fonts.bold,
  },
  textPrimary: {
    color: '#09090F',
  },
  textSecondary: {
    color: THEME.colors.textPrimary,
  },
  textGhost: {
    color: THEME.colors.textMuted,
  },
  textDisabled: {
    color: THEME.colors.textMuted,
  },
});
