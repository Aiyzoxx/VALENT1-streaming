import React from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '../constants/theme';
import { ScreenBackground } from './common';
import { DownloadCard, formatBytes } from './DownloadCard';
import { useDownloads, DownloadRecord, OFFLINE_QUOTA_BYTES } from '../downloads/DownloadsContext';

interface OfflineViewProps {
  onPlayDownload: (rec: DownloadRecord) => void;
}

/**
 * Page affichée automatiquement quand l'appareil est hors-ligne :
 * uniquement les contenus téléchargés, lisibles sans connexion.
 */
export const OfflineView: React.FC<OfflineViewProps> = ({ onPlayDownload }) => {
  const insets = useSafeAreaInsets();
  const topPad = insets.top > 0 ? insets.top + 8 : Platform.OS === 'ios' ? 14 : 8;
  const { downloads, totalBytes, pauseDownload, resumeDownload, removeDownload } = useDownloads();

  const ready = downloads.filter(r => r.status === 'done');
  const pending = downloads.filter(r => r.status !== 'done');

  return (
    <ScreenBackground showSpotlight>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingTop: topPad }]}
      >
        <View style={styles.headerRow}>
          <View style={styles.titleRow}>
            <Text style={styles.headerTitleBold}>Hors-</Text>
            <Text style={styles.headerTitleLight}>ligne</Text>
          </View>
          <Text style={styles.subtitleText}>
            Pas de connexion — voici vos téléchargements.
          </Text>
        </View>

        <View style={styles.quotaRow}>
          <Ionicons name="save-outline" size={15} color={THEME.colors.textMuted} />
          <Text style={styles.quotaText}>
            {formatBytes(totalBytes)} / {formatBytes(OFFLINE_QUOTA_BYTES)}
          </Text>
        </View>

        {ready.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Prêts à regarder ({ready.length})</Text>
            {ready.map(rec => (
              <DownloadCard
                key={rec.key}
                rec={rec}
                onPause={() => pauseDownload(rec.key)}
                onResume={() => resumeDownload(rec.key)}
                onDelete={() => removeDownload(rec.key)}
                onPlay={() => onPlayDownload(rec)}
              />
            ))}
          </>
        )}

        {pending.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>En cours ou en pause ({pending.length})</Text>
            {pending.map(rec => (
              <DownloadCard
                key={rec.key}
                rec={rec}
                onPause={() => pauseDownload(rec.key)}
                onResume={() => resumeDownload(rec.key)}
                onDelete={() => removeDownload(rec.key)}
              />
            ))}
          </>
        )}

        {downloads.length === 0 && (
          <View style={styles.emptyContainer}>
            <Ionicons name="cloud-offline-outline" size={48} color={THEME.colors.textMuted} />
            <Text style={styles.emptyTitle}>Rien en hors-ligne</Text>
            <Text style={styles.emptySubtitle}>
              Reconnectez-vous puis téléchargez films et épisodes depuis leur fiche pour les retrouver ici.
            </Text>
          </View>
        )}
      </ScrollView>
    </ScreenBackground>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: THEME.spacing.bottomNavPadding,
  },
  headerRow: {
    paddingHorizontal: THEME.spacing.screen,
    marginBottom: THEME.spacing.lg,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitleBold: {
    fontSize: THEME.typography.sizes.h1,
    fontFamily: THEME.fonts.extrabold,
    color: THEME.colors.textPrimary,
    letterSpacing: THEME.typography.letterSpacing.tight,
  },
  headerTitleLight: {
    fontSize: THEME.typography.sizes.h1,
    fontFamily: THEME.fonts.regular,
    color: THEME.colors.textPrimary,
    letterSpacing: THEME.typography.letterSpacing.tight,
  },
  subtitleText: {
    marginTop: 4,
    fontSize: THEME.typography.sizes.caption,
    fontFamily: THEME.fonts.medium,
    color: THEME.colors.textMuted,
  },
  quotaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: THEME.spacing.screen,
    marginBottom: THEME.spacing.md,
  },
  quotaText: {
    fontSize: THEME.typography.sizes.small,
    fontFamily: THEME.fonts.medium,
    color: THEME.colors.textMuted,
  },
  sectionTitle: {
    paddingHorizontal: THEME.spacing.screen,
    marginBottom: THEME.spacing.sm,
    fontSize: THEME.typography.sizes.h3,
    fontFamily: THEME.fonts.bold,
    color: THEME.colors.textPrimary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: THEME.spacing.sm,
  },
  emptyTitle: {
    fontSize: THEME.typography.sizes.h3,
    fontFamily: THEME.fonts.extrabold,
    color: THEME.colors.textPrimary,
    marginTop: THEME.spacing.sm,
  },
  emptySubtitle: {
    fontSize: THEME.typography.sizes.caption,
    color: THEME.colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 30,
  },
});
