# Design System — StreamFlow (Figma Money Heist Edition)

Source unique de vérité : [`src/constants/theme.ts`](file:///c:/Users/Valentin/Documents/VALENT1%20streaming/src/constants/theme.ts)

Ce document répertorie tous les tokens de conception extraits de la page de référence Figma et applicables à toutes les pages de l'application.

---

## 1. Couleurs (`THEME.colors`)

| Catégorie | Token | Valeur | Usage |
| :--- | :--- | :--- | :--- |
| **Fond** | `background` | `#09090F` | Fond velouté le plus profond de la maquette Figma SVG |
| | `backgroundExact` | `figma_background_exact.png` | Rendu Retina 3x sans perte avec les 3 ellipses et flous gaussiens exacts de Figma |
| **Surfaces** | `card` | `#1A1F29` | Fond des affiches, cartes de film et modales |
| | `filterCard` | `#2B303C` | Boutons 60x60 des filtres squircle |
| | `filterCardActive` | `#1E232F` | Fond du filtre ou onglet actif |
| | `searchBar` | `#191C24` | Champ de recherche et barres d'inputs |
| | `navDock` | `transparent` | Barre de navigation inférieure sans fond (icônes flottantes) |
| **Accents** | `primary` / `primaryRed` | `#FFFFFF` | Blanc neutre / Bouton CTA principal |
| | `primaryGlow` | `rgba(255,255,255,0.25)` | Halo blanc subtil |
| | `goldStar` | `#FFB800` | Étoile dorée Top IMDB / Notation |
| | `matchGreen` | `#10B981` | Pourcentage de recommandation (Match 98%) |
| **Textes** | `textPrimary` | `#FFFFFF` | Titres, texte d'accent, icônes actives |
| | `textSecondary` | `#9EA4B3` | Titres secondaires, sous-titres de cartes |
| | `textMuted` | `#7C8394` | Textes d'aide, placeholders, labels inactifs |
| **Bordures** | `borderSubtle` | `rgba(255, 255, 255, 0.08)` | Bordure fine des cartes et séparateurs |
| | `borderMedium` | `rgba(255, 255, 255, 0.12)` | Séparateurs verticaux |
| | `searchBorder` | `#262B36` | Contour du conteneur de recherche |
| | `borderAvatar` | `rgba(255, 255, 255, 0.25)` | Anneau circulaire profil Daizy |

---

## 2. Typographie (`THEME.typography`)

| Token | Taille | Graisse | Espacement | Usage |
| :--- | :--- | :--- | :--- | :--- |
| `sizes.h1` | 24px | `extrabold` (800) / `regular` (400) | `-0.3px` | Titres d'en-tête principaux |
| `sizes.h2` | 20px | `extrabold` (800) / `regular` (400) | `-0.3px` | Titres de sections ("Featured Series") |
| `sizes.h3` | 18px | `bold` (700) | `-0.2px` | Titres de filtres, sous-sections |
| `sizes.body` | 15px | `medium` (500) | `0px` | Saisie de texte, synopsis |
| `sizes.cardTitle` | 13px | `semibold` (600) | `0px` | Titres des affiches en grille |
| `sizes.caption` | 13px | `medium` (500) | `0px` | Sous-titres ("Check for latest addition.") |
| `sizes.label` | 11.5px | `semibold` (600) / `extrabold` (800) | `0px` | Labels sous les filtres |
| `sizes.badge` | 10px | `bold` (700) | `0.5px` | Badges "16+", "4K", "MATCH" |

---

## 3. Espacements (`THEME.spacing`)

- `xs`: **4px**
- `sm`: **8px**
- `md`: **14px**
- `lg`: **16px**
- `screen`: **22px** (Marge latérale globale de l'écran Figma)
- `xl`: **24px**
- `hero`: **32px**
- `bottomNavPadding`: **110px** (Dégagement du ScrollView au-dessus du dock)

---

## 4. Formes & Arrondis (`THEME.radii`)

- `card`: **16px** (Affiches et cartes en grille)
- `squircle`: **18px** (Boutons de filtre 60x60, barre de recherche 52px)
- `avatar`: **24px** (Cercle 48x48)
- `heroCard`: **28px** (Grande carte carrousel 3D Coverflow)
- `full`: **9999px** (Badges arrondis et pilules)

---

## 5. Profondeur & Ombres (`THEME.shadows`)

- `shadows.filter`: Élévation subtile des filtres 60x60 (`radius: 6`, `opacity: 0.3`).
- `shadows.card`: Ombre moyenne pour cartes de films (`radius: 10`, `opacity: 0.4`).
- `shadows.heroCard`: Ombre intense de la carte vedette Coverflow (`radius: 20`, `opacity: 0.7`).
