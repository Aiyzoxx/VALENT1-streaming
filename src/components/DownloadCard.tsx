import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../constants/theme';
import { DownloadRecord } from '../downloads/DownloadsContext';

export function formatBytes(b: number): string {
  if (b >= 1024 * 1024 * 1024) return `${(b / 1024 / 1024 / 1024).toFixed(1)} Go`;
  if (b >= 1024 * 1024) return `${Math.round(b / 1024 / 1024)} Mo`;
  if (b >= 1024) return `${Math.round(b / 1024)} Ko`;
  return `${Math.round(b)} o`;
}

// Ligne de téléchargement : état, progression, actions.
export const DownloadCard: React.FC<{
  rec: DownloadRecord;
  onPause: () => void;
  onResume: () => void;
  onDelete: () => void;
  onPlay?: () => void;
}> = ({ rec, onPause, onResume, onDelete, onPlay }) => {
  const pct = Math.round((rec.progress || 0) * 100);
  const statusText =
    rec.status === 'done'
      ? `${formatBytes(rec.bytesTotal ?? rec.bytesDownloaded)} · ${rec.qualityLabel}`
      : rec.status === 'downloading'
        ? `${pct}% · ${formatBytes(rec.bytesDownloaded)}`
        : rec.status === 'queued'
          ? 'En file d\u2019attente…'
          : rec.status === 'paused'
            ? rec.error ?? `En pause · ${pct}%`
            : rec.error ?? 'Échec';

  return (
    <View style={styles.dlCard}>
      {rec.localCoverUri || rec.posterUrl ? (
        <Image source={{ uri: rec.localCoverUri ?? rec.posterUrl ?? '' }} style={styles.dlPoster} resizeMode="cover" />
      ) : (
        <View style={[styles.dlPoster, styles.dlPosterFallback]}>
          <Ionicons name="film-outline" size={22} color={THEME.colors.textMuted} />
        </View>
      )}
      <View style={styles.dlInfos}>
        <Text style={styles.dlTitle} numberOfLines={1}>{rec.title}</Text>
        {!!rec.subtitle && (
          <Text style={styles.dlSubtitle} numberOfLines={1}>{rec.subtitle}</Text>
        )}
        <Text style={styles.dlStatus} numberOfLines={2}>{statusText}</Text>
        {(rec.status === 'downloading' || rec.status === 'queued' || rec.status === 'paused') && (
          <View style={styles.dlBarBg}>
            <View style={[styles.dlBarFill, { width: `${pct}%` }]} />
          </View>
        )}
        <View style={styles.dlActions}>
          {(rec.status === 'downloading' || rec.status === 'queued') && (
            <TouchableOpacity style={styles.dlActionBtn} onPress={onPause} activeOpacity={0.8}>
              <Ionicons name="pause" size={15} color={THEME.colors.textPrimary} />
              <Text style={styles.dlActionText}>Pause</Text>
            </TouchableOpacity>
          )}
          {(rec.status === 'paused' || rec.status === 'error') && (
            <TouchableOpacity style={styles.dlActionBtnPrimary} onPress={onResume} activeOpacity={0.8}>
              <Ionicons name="arrow-down" size={15} color={THEME.colors.background} />
              <Text style={styles.dlActionTextPrimary}>{rec.status === 'error' ? 'Réessayer' : 'Reprendre'}</Text>
            </TouchableOpacity>
          )}
          {rec.status === 'done' && onPlay && (
            <TouchableOpacity style={styles.dlActionBtnPrimary} onPress={onPlay} activeOpacity={0.8}>
              <Ionicons name="play" size={15} color={THEME.colors.background} />
              <Text style={styles.dlActionTextPrimary}>Regarder</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.dlActionBtn} onPress={onDelete} activeOpacity={0.8}>
            <Ionicons name="trash-outline" size={15} color={THEME.colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  dlCard: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.card,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
    borderRadius: THEME.radii.card,
    padding: 10,
    marginHorizontal: THEME.spacing.screen,
    marginBottom: THEME.spacing.sm,
    gap: 12,
  },
  dlPoster: {
    width: 56,
    height: 84,
    borderRadius: THEME.radii.sm,
  },
  dlPosterFallback: {
    backgroundColor: THEME.colors.searchBar,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dlInfos: {
    flex: 1,
  },
  dlTitle: {
    fontSize: THEME.typography.sizes.cardTitle,
    fontFamily: THEME.fonts.bold,
    color: THEME.colors.textPrimary,
  },
  dlSubtitle: {
    marginTop: 1,
    fontSize: THEME.typography.sizes.small,
    fontFamily: THEME.fonts.medium,
    color: THEME.colors.textSecondary,
  },
  dlStatus: {
    marginTop: 3,
    fontSize: THEME.typography.sizes.small,
    fontFamily: THEME.fonts.medium,
    color: THEME.colors.textMuted,
  },
  dlBarBg: {
    marginTop: 6,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  dlBarFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: THEME.colors.primary,
  },
  dlActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  dlActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: THEME.radii.full,
    backgroundColor: THEME.colors.surfaceActive,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
  },
  dlActionText: {
    fontSize: THEME.typography.sizes.small,
    fontFamily: THEME.fonts.semibold,
    color: THEME.colors.textPrimary,
  },
  dlActionBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: THEME.radii.full,
    backgroundColor: THEME.colors.primary,
  },
  dlActionTextPrimary: {
    fontSize: THEME.typography.sizes.small,
    fontFamily: THEME.fonts.bold,
    color: THEME.colors.background,
  },
});
