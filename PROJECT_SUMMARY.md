# StreamFlow Project Summary

## Overview
**StreamFlow** is a React Native video streaming application built with Expo 57, featuring a Figma-designed UI clone with full playback capabilities, favorites, watch history, and custom M3U8 stream support.

## Project Structure

```
streamflow/
├── package.json          # Expo 57.0.24, React 19, RN 0.86.3
├── App.tsx              # Main entry point with tab navigation
├── src/
│   ├── app/             # (not present, App is root)
│   ├── data/            # Catalog data
│   │   ├── catalog.json  # ~5000 media items
│   │   └── catalog.ts    # Export + categories
│   ├── types/           # TypeScript interfaces
│   │   └── media.ts      # MediaItem, Episode, WatchProgress, CustomStream
│   ├── constants/       # Theme configuration
│   │   └── theme.ts      # Complete color, typography, spacing system
│   ├── hooks/           # Custom React hooks
│   │   ├── useFavorites.ts   # Favorite management via AsyncStorage
│   │   ├── useWatchHistory.ts # Watch progress tracking via AsyncStorage
│   │   └── useCustomStreams.ts # Custom M3U8 stream management
│   ├── components/      # UI components
│   │   ├── FigmaHomeView.tsx   # Home screen (cover flow, filters)
│   │   ├── FigmaProfileView.tsx # Profile (favorites, history, M3U8 Studio)
│   │   ├── SearchView.tsx      # Catalog search with typed index
│   │   ├── VideoPlayerView.tsx # Custom HLS player with full UI
│   │   ├── FigmaDetailView.tsx # Media detail screen
│   │   ├── common/             # Reusable primitives
│   │   │   ├── MediaPosterCard.tsx
│   │   │   ├── ScreenBackground.tsx
│   │   │   ├── SearchBarFigma.tsx
│   │   │   ├── FilterSquircle.tsx
│   │   │   ├── BadgeFigma.tsx
│   │   │   └── PrimaryButton.tsx
│   │   ├── Header.tsx
│   │   ├── HeroBanner.tsx
│   │   ├── MediaCard.tsx
│   │   ├── MediaRow.tsx
│   │   ├── MyListView.tsx
│   │   └── StreamTesterView.tsx
│   └── index.ts         # Barrel export
```

## Key Features

### 1. Home Screen (`FigmaHomeView`)
- **Cover Flow Carousel**: 3D carousel of featured series (Lucifer, Money Heist, Sex Education) with physics-based scrolling
- **Filter System**: Genre, Top IMDb, Language (French), Watched filters with animated squircle chips
- **Search Bar**: With microphone button and clear cross
- **Popular Movies Section**: Horizontal scroll grid
- **Featured Series**: Fidelius-styled 3D perspective with snap-to-interval

### 2. Catalog / Search (`SearchView`)
- **Pre-computed Search Index**: Inverted index over titles, synopses, genres, and cast for ~5000 items
- **Category Filters**: All, Films, Séries, Direct, 4K Ultra
- **Ranked Search Results**: Exact match > startsWith > contains, then by matchScore
- **FlatGrid Layout**: 2-column layout with uniform item height

### 3. Profile (`FigmaProfileView`)
- **Sub-tabs**: Favorites, Continue Watching, M3U8 Studio
- **Stats Bar**: Favorite count, continue watching count, quality badge
- **M3U8 Studio**: Add/manage custom streaming URLs
- **Profile Header**: Daizy avatar, VIP badge, statistics

### 4. Video Player (`VideoPlayerView`)
- **Custom HLS Player**: Using `expo-video` with full UI customization
- **Control Auto-hide**: Fades after 3.5s inactivity
- **Settings Modal**: Quality (Source/Auto), Speed (0.5x-2.0x), Audio tracks, Subtitles
- **Picture-in-Picture**: Supported via `startPictureInPicture`
- **Fullscreen Landscape**: Orientation lock toggling
- **Seek**: ±10 seconds backward/forward
- **Live indicator**: RED badge for live streams

### 5. Favorites (`useFavorites`)
- AsyncStorage persistence
- `toggleFavorite(id)` - adds/removes from favorites
- `isFavorite(id)` - checks status
- `favoriteItems` - computed from catalog

### 6. Watch History (`useWatchHistory`)
- Tracks progress per media item
- Auto-complete at 95% watched
- `continueWatchingItems` - filters non-completed items watched > 5s
- `updateProgress(id, currentTime, duration)` - saves progress
- `getProgress(id)` - retrieves saved progress

### 7. Custom M3U8 Streams (`useCustomStreams`)
- Add custom stream URLs with title, isLive flag
- Remove streams
- Persisted in AsyncStorage

## Design System

### Theme (`theme.ts`)
- **Primary color**: `#09090F` (almost black dark)
- **Accent**: `#FFFFFF` (white), `#FFB800` (gold star)
- **Typography Scale**: h1(24) → small(11)
- **Spacing**: xs(4) → bottomNavPadding(110)
- **Radii**: squircle(18), card(16), heroCard(28), full(9999)
- **Shadows**: card, heroCard, glowPrimary, glowRed

### Reusable Components
- **`MediaPosterCard`**: Poster with title/year/quality, rating badge, hover scale animation
- **`ScreenBackground`**: Figma-exact background image with ambient glows
- **`SearchBarFigma`**: Search with icon, clear cross, microphone button
- **`FilterSquircle`**: Filter chip with scale animation on active state
- **`PrimaryButton**: Primary/secondary/ghost variants with ripple animation

## Navigation Structure

```
App
  └── MainApp (tab navigator)
        ├── activeTab: 'home' | 'catalog' | 'profile'
        ├── activeStream: {streamUrl, title, ...} | null  (video player overlay)
        └── detailItem: MediaItem | null (detail modal)
              ├── FigmaHomeView (when activeTab='home')
              ├── SearchView (when activeTab='catalog')
              └── FigmaProfileView (when activeTab='profile')
```

## Key Technical Decisions

1. **Performance**: 
   - `React.memo` on `MediaPosterCard` to prevent re-renders of ~5000 items
   - Pre-computed search index (`cachedSearchIndex`) avoiding `toLowerCase()` on every keystroke
   - `useMemo` for filtered catalog calculations

2. **Animations**: 
   - `Animated` library throughout (cover flow, tab transitions, scale animations)
   - `useNativeDriver: true` where possible for performance
   - Spring physics for interactive feedback

3. **Data Persistence**:
   - AsyncStorage for favorites, watch history, custom streams
   - JSON serialization/deserialization

4. **Video Playback**:
   - `expo-video` `VideoView` + `useVideoPlayer` for HLS streams
   - Full custom UI (no native controls)
   - Audio track, subtitle track selection from real HLS metadata
   - Resolution detection and display

## Assets
- `assets/figma/`: Figma-exact assets (background, avatars, posters)
- Figma design reference for complete UI/UX consistency

## TODO / Potential Improvements
- Detail view (`FigmaDetailView`) not fully explored but likely shows media metadata
- Voice search integration (`onOpenVoiceSearch` prop exists but may need implementation)
- Backend API integration for real streams (currently uses catalog URLs)
- Offline caching strategy