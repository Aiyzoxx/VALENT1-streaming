import React from 'react';
import {
  StyleSheet,
  View,
  ViewStyle,
  TextInput,
  TouchableOpacity,
  TextInputProps,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../../constants/theme';

interface SearchBarFigmaProps extends TextInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onClear?: () => void;
  onMicPress?: () => void;
  placeholder?: string;
  style?: ViewStyle;
  /** true quand la dictée vocale est active — l'icône micro devient rouge */
  micActive?: boolean;
  /** Animated.Value (scale) pour la pulsation du micro — optionnel */
  micPulse?: Animated.Value;
}

export const SearchBarFigma: React.FC<SearchBarFigmaProps> = ({
  value,
  onChangeText,
  onClear,
  onMicPress,
  placeholder = 'Search',
  style,
  micActive = false,
  micPulse,
  ...rest
}) => {
  const micColor = micActive ? THEME.colors.primary ?? '#E50914' : THEME.colors.textMuted;
  const micName = micActive ? 'mic' : 'mic-outline';

  return (
    <View style={[styles.container, style]}>
      <Ionicons
        name="search-outline"
        size={20}
        color={THEME.colors.textMuted}
        style={styles.searchIcon}
      />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={THEME.colors.textPlaceholder}
        value={value}
        onChangeText={onChangeText}
        returnKeyType="search"
        autoCorrect={false}
        {...rest}
      />

      {value.length > 0 && onClear && (
        <TouchableOpacity
          onPress={onClear}
          activeOpacity={0.7}
          style={styles.clearButton}
        >
          <Ionicons name="close-circle" size={18} color={THEME.colors.textMuted} />
        </TouchableOpacity>
      )}

      {onMicPress && (
        <>
          <View style={styles.divider} />
          <TouchableOpacity
            onPress={onMicPress}
            activeOpacity={0.7}
            style={styles.micButton}
          >
            {micPulse ? (
              <Animated.View style={{ transform: [{ scale: micPulse }] }}>
                <Ionicons name={micName} size={20} color={micColor} />
              </Animated.View>
            ) : (
              <Ionicons name={micName} size={20} color={micColor} />
            )}
          </TouchableOpacity>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.searchBar,
    borderRadius: THEME.radii.squircle,
    borderWidth: 1,
    borderColor: THEME.colors.searchBorder,
    height: 52,
    paddingHorizontal: THEME.spacing.lg,
    marginHorizontal: THEME.spacing.screen,
    marginBottom: THEME.spacing.xl,
  },
  searchIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: THEME.colors.textPrimary,
    fontSize: THEME.typography.sizes.body,
    fontFamily: THEME.fonts.medium,
    paddingVertical: 0,
  },
  clearButton: {
    padding: THEME.spacing.xs,
  },
  divider: {
    width: 1,
    height: 22,
    backgroundColor: THEME.colors.searchDivider,
    marginHorizontal: 10,
  },
  micButton: {
    padding: THEME.spacing.xs,
  },
});
