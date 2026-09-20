import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../constants/theme';

interface HeaderProps {
  onSearchPress?: () => void;
  onTesterPress?: () => void;
  activeTab?: string;
}

export const Header: React.FC<HeaderProps> = ({ onSearchPress, onTesterPress, activeTab }) => {
  return (
    <View style={styles.container}>
      <View style={styles.logoRow}>
        <View style={styles.logoBadge}>
          <Ionicons name="play" size={16} color="#080B10" />
        </View>
        <Text style={styles.logoText}>
          STREAM<Text style={styles.logoAccent}>FLOW</Text>
        </Text>
        <View style={styles.hlsPill}>
          <Text style={styles.hlsText}>HLS</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity 
          style={[styles.iconButton, activeTab === 'tester' && styles.iconButtonActive]} 
          onPress={onTesterPress}
          activeOpacity={0.7}
        >
          <Ionicons 
            name="link" 
            size={20} 
            color={activeTab === 'tester' ? THEME.colors.primary : THEME.colors.text} 
          />
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.iconButton, activeTab === 'search' && styles.iconButtonActive]} 
          onPress={onSearchPress}
          activeOpacity={0.7}
        >
          <Ionicons 
            name="search" 
            size={20} 
            color={activeTab === 'search' ? THEME.colors.primary : THEME.colors.text} 
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: THEME.spacing.md,
    backgroundColor: 'rgba(8, 11, 16, 0.9)',
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
    zIndex: 10,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    shadowColor: THEME.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 4,
  },
  logoText: {
    fontSize: 18,
    fontFamily: THEME.fonts.extrabold,
    letterSpacing: 1.5,
    color: THEME.colors.text,
  },
  logoAccent: {
    color: THEME.colors.primary,
  },
  hlsPill: {
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  hlsText: {
    fontSize: 9,
    fontFamily: THEME.fonts.extrabold,
    color: THEME.colors.primary,
    letterSpacing: 0.5,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: THEME.colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  iconButtonActive: {
    borderColor: THEME.colors.primary,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
  },
});
