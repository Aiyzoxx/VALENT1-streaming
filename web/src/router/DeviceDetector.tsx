import { useState, useEffect } from 'react';

export type DeviceMode = 'mobile' | 'desktop';

export function useDeviceMode(): {
  mode: DeviceMode;
} {
  const detectDefaultMode = (): DeviceMode => {
    if (typeof window === 'undefined') return 'desktop';

    // 1. Detect mobile user agent (smartphones & tablets)
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );

    // 2. Detect small viewport width (responsive threshold)
    const isSmallScreen = window.innerWidth <= 820;

    return isMobileUA || isSmallScreen ? 'mobile' : 'desktop';
  };

  const [mode, setMode] = useState<DeviceMode>(detectDefaultMode);

  useEffect(() => {
    const handleResize = () => {
      setMode(detectDefaultMode());
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return { mode };
}

