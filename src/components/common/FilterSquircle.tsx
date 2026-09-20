import React, { useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { THEME } from '../../constants/theme';

interface FilterSquircleProps {
  label: string;
  iconName: keyof typeof Ionicons.glyphMap;
  isActive: boolean;
  onPress: () => void;
  activeColor?: string;
}

export const FilterSquircle: React.FC<FilterSquircleProps> = ({
  label,
  iconName,
  isActive,
  onPress,
  activeColor = THEME.colors.textPrimary,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isActive) {
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.08,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 4,
          tension: 80,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isActive]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.90,
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
      bounciness: 6,
    }).start();
  };

  const handlePress = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_) {}
    onPress();
  };

  return (
    <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        activeOpacity={0.9}
      >
        <View
          style={[
            styles.squircleBox,
            isActive && styles.squircleBoxActive,
          ]}
        >
          <Ionicons
            name={iconName}
            size={22}
            color={isActive ? activeColor : THEME.colors.iconWhite}
          />
        </View>
        <Text
          style={[
            styles.label,
            isActive && styles.labelActive,
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  squircleBox: {
    width: 60,
    height: 60,
    borderRadius: THEME.radii.squircle,
    backgroundColor: THEME.colors.filterCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
    ...THEME.shadows.filter,
  },
  squircleBoxActive: {
    borderColor: THEME.colors.borderActive,
    backgroundColor: THEME.colors.filterCardActive,
  },
  label: {
    fontSize: THEME.typography.sizes.label,
    color: THEME.colors.textMuted,
    marginTop: THEME.spacing.sm,
    fontFamily: THEME.fonts.semibold,
    textAlign: 'center',
  },
  labelActive: {
    color: THEME.colors.textPrimary,
    fontFamily: THEME.fonts.extrabold,
  },
});
