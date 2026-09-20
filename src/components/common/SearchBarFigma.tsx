import React from 'react';
import {
  StyleSheet,
  View,
  ViewStyle,
  TextInput,
  TouchableOpacity,
  TextInputProps,
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
}

export const SearchBarFigma: React.FC<SearchBarFigmaProps> = ({
  value,
  onChangeText,
  onClear,
  onMicPress,
  placeholder = 'Search',
  style,
  ...rest
}) => {
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
            <Ionicons name="mic-outline" size={20} color={THEME.colors.textMuted} />
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
