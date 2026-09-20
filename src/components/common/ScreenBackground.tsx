import React from 'react';
import { StyleSheet, View } from 'react-native';
import { THEME } from '../../constants/theme';
import { AmbientGlow } from './AmbientGlow';

interface ScreenBackgroundProps {
  children?: React.ReactNode;
  showSpotlight?: boolean;
}

// Fond custom : base navy statique (aucun banding) + lueurs blanches
// ultra-diffuses fondues dans la teinte.
export const ScreenBackground: React.FC<ScreenBackgroundProps> = ({
  children,
}) => {
  return (
    <View style={styles.container}>
      <AmbientGlow />
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.backgroundBlue,
    position: 'relative',
  },
});
