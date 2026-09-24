import React from 'react';
import { AuthProvider } from './shared/hooks/useAuth';
import { useDeviceMode } from './router/DeviceDetector';
import { MobileApp } from './mobile/MobileApp';
import { DesktopApp } from './desktop/DesktopApp';

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}

function AppRouter() {
  const { mode } = useDeviceMode();

  return (
    <div style={{ position: 'relative', width: '100%', minHeight: '100%' }}>
      {/* Background ambient lighting */}
      <div className="ambient-glow" />

      {/* Render automatically selected version */}
      {mode === 'mobile' ? (
        <div
          style={{
            maxWidth: typeof window !== 'undefined' && window.innerWidth > 820 ? 480 : '100%',
            margin: '0 auto',
            minHeight: '100vh',
            boxShadow: typeof window !== 'undefined' && window.innerWidth > 820 ? '0 0 50px rgba(0, 0, 0, 0.8)' : 'none',
            position: 'relative',
          }}
        >
          <MobileApp />
        </div>
      ) : (
        <DesktopApp />
      )}
    </div>
  );
}

