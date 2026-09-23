import React, { useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '../constants/theme';
import { OfflineQuality, OFFLINE_QUALITY_LABEL } from '../api/hlsOffline';

interface DownloadSheetProps {
  visible: boolean;
  title: string;
  subtitle?: string | null;
  onPick: (quality: OfflineQuality) => void;
  onClose: () => void;
}

const OPTIONS: { id: OfflineQuality; hint: string }[] = [
  { id: 'eco', hint: 'Fichier léger · idéal voyage' },
  { id: 'hd', hint: 'Bon compromis · ~1 Go / film' },
  { id: 'source', hint: 'Qualité max · fichier lourd' },
];

export const DownloadSheet: React.FC<DownloadSheetProps> = ({
  visible,
  title,
  subtitle,
  onPick,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(380)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    slide.setValue(380);
    fade.setValue(0);
    Animated.parallel([
      Animated.spring(slide, { toValue: 0, speed: 18, bounciness: 4, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [visible, slide, fade]);

  if (!visible) return null;

  const handlePick = (q: OfflineQuality) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_) {}
    onPick(q);
  };

  return (
    <Animated.View style={[styles.overlay, { opacity: fade }]}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <Animated.View
        style={[
          styles.sheet,
          { transform: [{ translateY: slide }], paddingBottom: Math.max(insets.bottom + 16, 24) },
        ]}
      >
        <View style={styles.handle} />
        <View style={styles.header}>
          <View style={styles.headerTexts}>
            <Text style={styles.sheetTitle}>Télécharger</Text>
            <Text style={styles.sheetSubtitle} numberOfLines={2}>{title}{subtitle ? ` · ${subtitle}` : ''}</Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
            <Ionicons name="close" size={18} color={THEME.colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {OPTIONS.map((opt, i) => (
          <AnimatedOptionRow key={opt.id} index={i} onPress={() => handlePick(opt.id)}>
            <View style={styles.optionLeft}>
              <Ionicons name="arrow-down-circle-outline" size={20} color={THEME.colors.primary} />
              <View style={styles.optionTexts}>
                <Text style={styles.optionTitle}>{OFFLINE_QUALITY_LABEL[opt.id]}</Text>
                <Text style={styles.optionDesc}>{opt.hint}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={THEME.colors.textMuted} />
          </AnimatedOptionRow>
        ))}

        <View style={styles.wifiNote}>
          <Ionicons name="cloud-download-outline" size={15} color={THEME.colors.textMuted} />
          <Text style={styles.wifiText}>Téléchargement hors-ligne · quota de 8 Go · reprise auto</Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
};

const AnimatedOptionRow: React.FC<{ index: number; onPress: () => void; children: React.ReactNode }> = ({
  index,
  onPress,
  children,
}) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 220,
      delay: index * 40,
      useNativeDriver: true,
    }).start();
  }, [anim, index]);
  return (
    <Animated.View
      style={{ opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}
    >
      <TouchableOpacity style={styles.optionRow} onPress={onPress} activeOpacity={0.8}>
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 200,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: THEME.colors.overlayDark,
  },
  sheet: {
    backgroundColor: 'rgba(19,23,32,0.96)',
    borderTopLeftRadius: THEME.radii.xl,
    borderTopRightRadius: THEME.radii.xl,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: THEME.spacing.screen,
    paddingTop: THEME.spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: THEME.colors.surfaceActive,
    marginBottom: THEME.spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: THEME.spacing.md,
  },
  headerTexts: {
    flex: 1,
    marginRight: THEME.spacing.sm,
  },
  sheetTitle: {
    color: THEME.colors.textPrimary,
    fontSize: THEME.typography.sizes.h3,
    fontFamily: THEME.fonts.extrabold,
    letterSpacing: THEME.typography.letterSpacing.tight,
  },
  sheetSubtitle: {
    marginTop: 2,
    color: THEME.colors.textMuted,
    fontSize: THEME.typography.sizes.caption,
    fontFamily: THEME.fonts.medium,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: THEME.colors.surfaceActive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.colors.card,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
    borderRadius: THEME.radii.squircle,
    paddingVertical: 13,
    paddingHorizontal: 15,
    marginBottom: 8,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  optionTexts: {
    flex: 1,
  },
  optionTitle: {
    color: THEME.colors.textPrimary,
    fontSize: THEME.typography.sizes.cardTitle,
    fontFamily: THEME.fonts.semibold,
  },
  optionDesc: {
    marginTop: 2,
    color: THEME.colors.textMuted,
    fontSize: THEME.typography.sizes.small,
    fontFamily: THEME.fonts.medium,
  },
  wifiNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: THEME.spacing.sm,
  },
  wifiText: {
    color: THEME.colors.textMuted,
    fontSize: THEME.typography.sizes.small,
    fontFamily: THEME.fonts.medium,
  },
});
