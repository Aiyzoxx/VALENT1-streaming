export const THEME = {
  colors: {
    // 1. Fond de page exact Figma (#09090F)
    background: '#09090F',
    backgroundSecondary: '#131720',
    backgroundBlue: '#04060C',
    backgroundGradient: ['#151721', '#12141C', '#0E0F16', '#09090F'] as const,
    
    // 2. Surfaces & Cartes
    card: '#1A1F29',
    cardHover: '#232938',
    filterCard: '#2B303C',
    filterCardActive: '#1E232F',
    searchBar: '#191C24',
    surfaceGlass: 'rgba(26, 31, 41, 0.85)',
    surfaceSubtle: 'rgba(255, 255, 255, 0.04)',
    surfaceActive: 'rgba(255, 255, 255, 0.1)',
    overlay: 'rgba(9, 9, 15, 0.80)',
    overlayDark: 'rgba(0, 0, 0, 0.88)',
    navDock: 'transparent',
    
    // 3. Accents & Actions (Palette épurée Monochrome / Blanc / Gris / Ardoise)
    primary: '#FFFFFF',
    primaryRed: '#FFFFFF',
    primaryGlow: 'rgba(255, 255, 255, 0.25)',
    goldStar: '#FFB800',
    accentGold: '#FFB800',
    accentRed: '#FFFFFF',
    accentGreen: '#10B981',
    matchGreen: '#10B981',
    
    // 4. Textes
    text: '#FFFFFF',
    textPrimary: '#FFFFFF',
    textSecondary: '#9EA4B3',
    textMuted: '#7C8394',
    textPlaceholder: '#7C8394',
    
    // 5. Navigation & Icônes
    navIconActive: '#FFFFFF',
    navIconInactive: '#555C6E',
    activeDot: '#FFFFFF',
    iconWhite: '#FFFFFF',
    iconMuted: '#7C8394',
    
    // 6. Bordures & Lignes
    border: 'rgba(255, 255, 255, 0.08)',
    borderSubtle: 'rgba(255, 255, 255, 0.08)',
    borderMedium: 'rgba(255, 255, 255, 0.12)',
    borderActive: 'rgba(255, 255, 255, 0.45)',
    borderAvatar: 'rgba(255, 255, 255, 0.25)',
    borderCard: 'rgba(255, 255, 255, 0.1)',
    searchBorder: '#262B36',
    searchDivider: 'rgba(255, 255, 255, 0.12)',

    // 7. Lumières et reflets d'ambiance
    ambientTopGlow: ['rgba(255, 255, 255, 0.06)', 'rgba(180, 200, 240, 0.015)', 'transparent'] as const,
    ambientMidGlow: 'rgba(255, 255, 255, 0.03)',
    ambientSpotlight: 'rgba(255, 255, 255, 0.04)',
  },

  typography: {
    sizes: {
      h1: 24,
      h2: 20,
      h3: 18,
      body: 15,
      caption: 13,
      cardTitle: 13,
      railTitle: 12,
      label: 11.5,
      small: 11,
      badge: 10,
    },
    weights: {
      regular: '400' as const,
      medium: '500' as const,
      semibold: '600' as const,
      bold: '700' as const,
      extrabold: '800' as const,
    },
    letterSpacing: {
      tight: -0.3,
      subtle: -0.2,
      normal: 0,
      wide: 0.5,
    },
  },

  fonts: {
    regular: 'Poppins-Regular',
    medium: 'Poppins-Medium',
    semibold: 'Poppins-SemiBold',
    bold: 'Poppins-Bold',
    extrabold: 'Poppins-ExtraBold',
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 14,
    lg: 16,
    screen: 22,
    xl: 24,
    xxl: 26,
    hero: 32,
    bottomNavPadding: 110,
  },

  radii: {
    xs: 4,
    sm: 8,
    card: 16,
    md: 14,
    squircle: 18,
    lg: 20,
    xl: 26,
    avatar: 24,
    heroCard: 28,
    full: 9999,
  },

  shadows: {
    filter: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
      elevation: 4,
    },
    card: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4,
      shadowRadius: 10,
      elevation: 6,
    },
    heroCard: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: 0.7,
      shadowRadius: 20,
      elevation: 12,
    },
    glowRed: {
      shadowColor: '#FFFFFF',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 10,
      elevation: 6,
    },
    glowPrimary: {
      shadowColor: '#FFFFFF',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 10,
      elevation: 6,
    },
  },
} as const;

export type ThemeType = typeof THEME;
