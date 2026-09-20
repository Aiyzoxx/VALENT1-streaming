import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCustomStreams } from '../hooks/useCustomStreams';
import { CustomStream } from '../types/media';
import { THEME } from '../constants/theme';
import { PrimaryButton } from './common';

interface StreamTesterViewProps {
  onPlayStream: (stream: { url: string; title: string; isLive: boolean }) => void;
}

export const StreamTesterView: React.FC<StreamTesterViewProps> = ({ onPlayStream }) => {
  const { streams, addStream, removeStream } = useCustomStreams();
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [isLive, setIsLive] = useState(false);

  const handlePlay = () => {
    if (!url.trim()) {
      Alert.alert('Erreur', 'Veuillez saisir une URL de flux .m3u8 valide.');
      return;
    }
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (_) {}

    onPlayStream({
      url: url.trim(),
      title: title.trim() || 'Flux M3U8 personnalisé',
      isLive,
    });
  };

  const handleSave = async () => {
    if (!url.trim()) {
      Alert.alert('Erreur', 'Veuillez saisir une URL de flux .m3u8.');
      return;
    }
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (_) {}

    await addStream(title, url, isLive);
    Alert.alert('Succès', 'Flux m3u8 enregistré dans votre bibliothèque !');
    setTitle('');
    setUrl('');
  };

  const handleSelectPreset = (preset: CustomStream) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_) {}
    setUrl(preset.url);
    setTitle(preset.title);
    setIsLive(preset.isLive);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Titre & Description */}
        <View style={styles.header}>
          <View style={styles.badge}>
            <Ionicons name="flash" size={12} color={THEME.colors.primaryRed} style={{ marginRight: 4 }} />
            <Text style={styles.badgeText}>M3U8 STUDIO & TESTEUR</Text>
          </View>
          <Text style={styles.title}>Testez Vos Flux HLS</Text>
          <Text style={styles.subtitle}>
            Collez n’importe quel lien de flux .m3u8 (IPTV, caméra, direct ou VOD) pour le lancer instantanément dans le lecteur avec accélération matérielle iOS.
          </Text>
        </View>

        {/* Formulaire de saisie */}
        <View style={styles.formCard}>
          <Text style={styles.inputLabel}>URL du flux HLS (.m3u8 ou mp4)</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="link-outline" size={20} color={THEME.colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="https://domaine.com/playlist.m3u8"
              placeholderTextColor={THEME.colors.textPlaceholder}
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            {url.length > 0 && (
              <TouchableOpacity onPress={() => setUrl('')} style={{ padding: 4 }}>
                <Ionicons name="close-circle" size={18} color={THEME.colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          <Text style={[styles.inputLabel, { marginTop: THEME.spacing.md }]}>Titre du flux (optionnel)</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="text-outline" size={20} color={THEME.colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Ex: BeIN Sports 1, Canal+, Caméra Live..."
              placeholderTextColor={THEME.colors.textPlaceholder}
              value={title}
              onChangeText={setTitle}
            />
          </View>

          {/* Sélecteur Direct / VOD */}
          <View style={styles.typeSelectorRow}>
            <TouchableOpacity
              style={[styles.typeButton, !isLive && styles.typeButtonActive]}
              onPress={() => setIsLive(false)}
              activeOpacity={0.8}
            >
              <Ionicons
                name="film-outline"
                size={16}
                color={!isLive ? THEME.colors.textPrimary : THEME.colors.textMuted}
              />
              <Text style={[styles.typeButtonText, !isLive && styles.typeButtonTextActive]}>
                VOD / Vidéo
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.typeButton, isLive && styles.typeButtonActiveLive]}
              onPress={() => setIsLive(true)}
              activeOpacity={0.8}
            >
              <View style={styles.liveDot} />
              <Text style={[styles.typeButtonText, isLive && styles.typeButtonTextActive]}>
                Flux Direct (Live)
              </Text>
            </TouchableOpacity>
          </View>

          {/* Boutons d'actions */}
          <View style={styles.actionButtonsRow}>
            <PrimaryButton
              label="Lancer le flux"
              iconName="play"
              onPress={handlePlay}
              style={{ flex: 1.3 }}
            />
            <PrimaryButton
              label="Enregistrer"
              iconName="bookmark-outline"
              variant="secondary"
              onPress={handleSave}
              style={{ flex: 1 }}
            />
          </View>
        </View>

        {/* Liste des flux enregistrés */}
        <View style={styles.savedSection}>
          <Text style={styles.sectionTitle}>Flux enregistrés ({streams.length})</Text>
          <Text style={styles.sectionSubtitle}>
            Touchez un flux pour le charger ou appuyez sur Lecture pour le visionner.
          </Text>

          {streams.map(item => (
            <View key={item.id} style={styles.streamItem}>
              <TouchableOpacity
                style={styles.streamItemMain}
                onPress={() => handleSelectPreset(item)}
                activeOpacity={0.7}
              >
                <View style={styles.streamItemIcon}>
                  <Ionicons
                    name={item.isLive ? 'radio-outline' : 'play-outline'}
                    size={20}
                    color={item.isLive ? THEME.colors.primaryRed : THEME.colors.textPrimary}
                  />
                </View>
                <View style={styles.streamItemInfo}>
                  <View style={styles.streamItemTitleRow}>
                    <Text style={styles.streamItemTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    {item.isLive && (
                      <View style={styles.liveBadgeSmall}>
                        <Text style={styles.liveBadgeSmallText}>LIVE</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.streamItemUrl} numberOfLines={1}>
                    {item.url}
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.streamPlayAction}
                onPress={() =>
                  onPlayStream({
                    url: item.url,
                    title: item.title,
                    isLive: item.isLive,
                  })
                }
                activeOpacity={0.8}
              >
                <Ionicons name="play" size={16} color={THEME.colors.textPrimary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.streamDeleteAction}
                onPress={() => removeStream(item.id)}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={18} color={THEME.colors.textMuted} />
              </TouchableOpacity>
            </View>
          ))}

          {streams.length === 0 && (
            <View style={styles.emptyStreamsBox}>
              <Ionicons name="folder-open-outline" size={36} color={THEME.colors.textMuted} />
              <Text style={styles.emptyStreamsText}>
                Aucun flux enregistré pour le moment. Vos flux IPTV et tests apparaîtront ici.
              </Text>
            </View>
          )}
        </View>

        <View style={{ height: THEME.spacing.bottomNavPadding }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  header: {
    marginBottom: THEME.spacing.xl,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: THEME.radii.full,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: THEME.colors.primaryRed,
    marginBottom: THEME.spacing.sm,
  },
  badgeText: {
    fontSize: THEME.typography.sizes.badge,
    fontFamily: THEME.fonts.extrabold,
    color: THEME.colors.primaryRed,
    letterSpacing: THEME.typography.letterSpacing.wide,
  },
  title: {
    fontSize: THEME.typography.sizes.h1,
    fontFamily: THEME.fonts.extrabold,
    color: THEME.colors.textPrimary,
    letterSpacing: THEME.typography.letterSpacing.tight,
  },
  subtitle: {
    fontSize: THEME.typography.sizes.caption,
    color: THEME.colors.textMuted,
    marginTop: 6,
    lineHeight: 18,
  },
  formCard: {
    padding: THEME.spacing.lg,
    borderRadius: THEME.radii.squircle,
    backgroundColor: THEME.colors.card,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
    marginBottom: THEME.spacing.xl,
    ...THEME.shadows.card,
  },
  inputLabel: {
    fontSize: THEME.typography.sizes.small,
    fontFamily: THEME.fonts.semibold,
    color: THEME.colors.textSecondary,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: THEME.radii.squircle,
    backgroundColor: THEME.colors.searchBar,
    paddingHorizontal: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.searchBorder,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: THEME.typography.sizes.body,
    color: THEME.colors.textPrimary,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    gap: THEME.spacing.md,
    marginTop: THEME.spacing.lg,
  },
  typeButton: {
    flex: 1,
    height: 40,
    borderRadius: THEME.radii.squircle,
    backgroundColor: THEME.colors.filterCard,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
  },
  typeButtonActive: {
    backgroundColor: THEME.colors.filterCardActive,
    borderColor: THEME.colors.borderActive,
  },
  typeButtonActiveLive: {
    backgroundColor: THEME.colors.filterCardActive,
    borderColor: THEME.colors.primaryRed,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME.colors.primaryRed,
  },
  typeButtonText: {
    fontSize: THEME.typography.sizes.railTitle,
    fontFamily: THEME.fonts.semibold,
    color: THEME.colors.textMuted,
  },
  typeButtonTextActive: {
    color: THEME.colors.textPrimary,
    fontFamily: THEME.fonts.extrabold,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: THEME.spacing.md,
    marginTop: THEME.spacing.lg,
  },
  savedSection: {
    marginTop: THEME.spacing.sm,
  },
  sectionTitle: {
    fontSize: THEME.typography.sizes.h3,
    fontFamily: THEME.fonts.bold,
    color: THEME.colors.textPrimary,
  },
  sectionSubtitle: {
    fontSize: THEME.typography.sizes.small,
    color: THEME.colors.textMuted,
    marginTop: 2,
    marginBottom: THEME.spacing.md,
  },
  streamItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radii.squircle,
    padding: 12,
    marginBottom: THEME.spacing.sm,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
    gap: 8,
    ...THEME.shadows.filter,
  },
  streamItemMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  streamItemIcon: {
    width: 38,
    height: 38,
    borderRadius: THEME.radii.squircle - 4,
    backgroundColor: THEME.colors.filterCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
  },
  streamItemInfo: {
    flex: 1,
  },
  streamItemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  streamItemTitle: {
    fontSize: THEME.typography.sizes.cardTitle,
    fontFamily: THEME.fonts.bold,
    color: THEME.colors.textPrimary,
    flex: 1,
  },
  liveBadgeSmall: {
    backgroundColor: THEME.colors.primaryRed,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  liveBadgeSmallText: {
    fontSize: 9,
    fontFamily: THEME.fonts.extrabold,
    color: THEME.colors.textPrimary,
  },
  streamItemUrl: {
    fontSize: 10,
    color: THEME.colors.textMuted,
    marginTop: 2,
    fontFamily: THEME.fonts.regular,
  },
  streamPlayAction: {
    width: 36,
    height: 36,
    borderRadius: THEME.radii.squircle - 4,
    backgroundColor: THEME.colors.primaryRed,
    alignItems: 'center',
    justifyContent: 'center',
    ...THEME.shadows.filter,
  },
  streamDeleteAction: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStreamsBox: {
    padding: 24,
    borderRadius: THEME.radii.squircle,
    backgroundColor: THEME.colors.card,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyStreamsText: {
    fontSize: THEME.typography.sizes.small,
    color: THEME.colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
