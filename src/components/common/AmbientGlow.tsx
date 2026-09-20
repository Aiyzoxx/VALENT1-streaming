import React from 'react';
import { StyleSheet, View } from 'react-native';

// Reproduction de la ref : base quasi-noire + 3 halos bleus en
// radial-gradient natif (GPU) — halo haut-droite, bande basse, coin bas-gauche.
// Interpolation continue, aucun bord. Si le moteur ignore la propriété,
// le fond uni reste (dégradation gracieuse).
export const AmbientGlow: React.FC = () => {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={styles.topRight} />
      <View style={styles.lowBand} />
      <View style={styles.bottomLeft} />
    </View>
  );
};

const TRANSPARENT_BLUE = 'rgba(58, 86, 158, 0)';

const styles = StyleSheet.create({
  topRight: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    experimental_backgroundImage:
      `radial-gradient(ellipse 55% 28% at 82% 12%, rgba(58, 86, 158, 0.55), ${TRANSPARENT_BLUE} 70%)`,
  },
  lowBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    experimental_backgroundImage:
      `radial-gradient(ellipse 60% 16% at 50% 73%, rgba(52, 76, 140, 0.35), ${TRANSPARENT_BLUE} 70%)`,
  },
  bottomLeft: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    experimental_backgroundImage:
      `radial-gradient(ellipse 30% 14% at 8% 94%, rgba(60, 88, 160, 0.4), ${TRANSPARENT_BLUE} 70%)`,
  },
});
