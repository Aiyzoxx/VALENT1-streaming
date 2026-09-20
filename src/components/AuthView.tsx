import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '../constants/theme';
import { ScreenBackground } from './common';
import { useAuth } from '../hooks/useAuth';

export const AuthView: React.FC = () => {
  const { login, register, error, clearError } = useAuth();
  const insets = useSafeAreaInsets();
  const topPad = insets.top > 0 ? insets.top + 8 : Platform.OS === 'ios' ? 14 : 8;
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const switchMode = (m: 'login' | 'register') => {
    if (m === mode) return;
    try {
      Haptics.selectionAsync();
    } catch (_) {}
    clearError();
    setMode(m);
  };

  const canSubmit =
    email.trim().length > 3 &&
    email.includes('@') &&
    password.length >= 8 &&
    !busy;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password, name);
      }
    } catch {
      /* erreur affichée via le contexte */
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenBackground showSpotlight>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingTop: topPad }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headerRow}>
            <View style={styles.titleRow}>
              <Text style={styles.headerTitleBold}>Mon </Text>
              <Text style={styles.headerTitleLight}>Compte</Text>
            </View>
            <Text style={styles.subtitleText}>
              Connecte-toi pour synchroniser favoris et historique.
            </Text>
          </View>

          {/* Switch Connexion / Inscription */}
          <View style={styles.segmented}>
            <TouchableOpacity
              style={[styles.segmentBtn, mode === 'login' && styles.segmentBtnActive]}
              onPress={() => switchMode('login')}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.segmentText, mode === 'login' && styles.segmentTextActive]}
              >
                Connexion
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segmentBtn, mode === 'register' && styles.segmentBtnActive]}
              onPress={() => switchMode('register')}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.segmentText, mode === 'register' && styles.segmentTextActive]}
              >
                Inscription
              </Text>
            </TouchableOpacity>
          </View>

          {/* Champs */}
          {mode === 'register' && (
            <View style={styles.field}>
              <Ionicons
                name="person-outline"
                size={18}
                color={THEME.colors.textMuted}
                style={styles.fieldIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Pseudo"
                placeholderTextColor={THEME.colors.textPlaceholder}
                value={name}
                onChangeText={setName}
                autoCapitalize="none"
                returnKeyType="next"
              />
            </View>
          )}

          <View style={styles.field}>
            <Ionicons
              name="mail-outline"
              size={18}
              color={THEME.colors.textMuted}
              style={styles.fieldIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={THEME.colors.textPlaceholder}
              value={email}
              onChangeText={t => {
                setEmail(t);
                if (error) clearError();
              }}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              returnKeyType="next"
            />
          </View>

          <View style={styles.field}>
            <Ionicons
              name="lock-closed-outline"
              size={18}
              color={THEME.colors.textMuted}
              style={styles.fieldIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Mot de passe (8 caractères min)"
              placeholderTextColor={THEME.colors.textPlaceholder}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={handleSubmit}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(v => !v)}
              activeOpacity={0.7}
              style={styles.eyeButton}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={18}
                color={THEME.colors.textMuted}
              />
            </TouchableOpacity>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            activeOpacity={0.88}
            disabled={!canSubmit}
          >
            {busy ? (
              <ActivityIndicator size="small" color="#09090F" />
            ) : (
              <Text style={styles.submitText}>
                {mode === 'login' ? 'Se connecter' : "Créer mon compte"}
              </Text>
            )}
          </TouchableOpacity>

          <Text style={styles.hintText}>
            Tes favoris et ta progression actuels seront fusionnés avec ton compte.
          </Text>

          <View style={{ height: THEME.spacing.bottomNavPadding }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: THEME.spacing.screen,
  },
  headerRow: {
    marginBottom: THEME.spacing.xl,
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
    fontSize: THEME.typography.sizes.caption,
    color: THEME.colors.textMuted,
    marginTop: 3,
    fontFamily: THEME.fonts.medium,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.searchBar,
    borderRadius: THEME.radii.full,
    borderWidth: 1,
    borderColor: THEME.colors.searchBorder,
    padding: 4,
    marginBottom: THEME.spacing.xl,
  },
  segmentBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: THEME.radii.full,
  },
  segmentBtnActive: {
    backgroundColor: THEME.colors.surfaceActive,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle,
  },
  segmentText: {
    fontSize: 12,
    fontFamily: THEME.fonts.semibold,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: THEME.colors.textMuted,
  },
  segmentTextActive: {
    color: THEME.colors.textPrimary,
    fontFamily: THEME.fonts.bold,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.searchBar,
    borderRadius: THEME.radii.squircle,
    borderWidth: 1,
    borderColor: THEME.colors.searchBorder,
    paddingHorizontal: THEME.spacing.lg,
    height: 52,
    marginBottom: THEME.spacing.md,
  },
  fieldIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: THEME.colors.textPrimary,
    fontSize: THEME.typography.sizes.body,
    fontFamily: THEME.fonts.medium,
    paddingVertical: 0,
  },
  eyeButton: {
    padding: THEME.spacing.xs,
  },
  errorText: {
    fontSize: THEME.typography.sizes.caption,
    color: '#FF7A7A',
    fontFamily: THEME.fonts.semibold,
    marginBottom: THEME.spacing.md,
  },
  submitBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: THEME.radii.full,
    backgroundColor: THEME.colors.primary,
    marginTop: THEME.spacing.sm,
  },
  submitBtnDisabled: {
    opacity: 0.4,
  },
  submitText: {
    fontSize: THEME.typography.sizes.body,
    fontFamily: THEME.fonts.bold,
    color: '#09090F',
  },
  hintText: {
    fontSize: THEME.typography.sizes.small,
    color: THEME.colors.textMuted,
    fontFamily: THEME.fonts.medium,
    textAlign: 'center',
    marginTop: THEME.spacing.lg,
    paddingHorizontal: 20,
  },
});
