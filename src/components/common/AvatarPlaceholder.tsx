import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../../constants/theme';

interface AvatarPlaceholderProps {
  size?: number;
  /** Initiale affichée à la place de l'icône (ex: 1re lettre du pseudo). */
  label?: string | null;
}

// Avatar neutre : cercle ardoise avec icône personne ou initiale.
// Remplace l'ancienne photo de profil.
export const AvatarPlaceholder: React.FC<AvatarPlaceholderProps> = ({
  size = 48,
  label = null,
}) => {
  const initial = label?.trim().charAt(0).toUpperCase() || null;
  return (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
    >
      {initial ? (
        <Text style={[styles.initial, { fontSize: size * 0.38 }]}>{initial}</Text>
      ) : (
        <Ionicons name="person" size={size * 0.52} color={THEME.colors.textMuted} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.card,
    borderWidth: 1.5,
    borderColor: THEME.colors.borderAvatar,
    overflow: 'hidden',
  },
  initial: {
    fontFamily: THEME.fonts.bold,
    color: THEME.colors.textSecondary,
  },
});
