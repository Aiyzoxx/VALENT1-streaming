import { useState, useEffect } from 'react';
import * as Font from 'expo-font';

const BASE = 'https://raw.githubusercontent.com/google/fonts/main/ofl/poppins';

const POPPINS = {
  'Poppins-Regular': `${BASE}/Poppins-Regular.ttf`,
  'Poppins-Medium': `${BASE}/Poppins-Medium.ttf`,
  'Poppins-SemiBold': `${BASE}/Poppins-SemiBold.ttf`,
  'Poppins-Bold': `${BASE}/Poppins-Bold.ttf`,
  'Poppins-ExtraBold': `${BASE}/Poppins-ExtraBold.ttf`,
};

// Charge Poppins au démarrage. En cas d'échec (offline, CDN down),
// l'app démarre quand même avec la police système.
export function useAppFonts(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await Promise.race([
          Font.loadAsync(POPPINS),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('font timeout')), 8000)
          ),
        ]);
      } catch (e) {
        console.warn('Poppins load failed, system fallback:', e);
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return ready;
}
