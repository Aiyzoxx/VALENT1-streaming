import React, { lazy, Suspense } from 'react';
import { AuthProvider } from './shared/hooks/useAuth';
import { useDeviceMode } from './router/DeviceDetector';

const MobileApp = lazy(() => import('./mobile/MobileApp').then((m) => ({ default: m.MobileApp })));
const DesktopApp = lazy(() => import('./desktop/DesktopApp').then((m) => ({ default: m.DesktopApp })));

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
      <Suspense
        fallback={
          <div
            style={{
              minHeight: '100vh',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#09090F',
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                border: '3px solid rgba(229, 9, 20, 0.2)',
                borderTopColor: '#E50914',
                animation: 'spin 0.8s linear infinite',
              }}
            />
          </div>
        }
      >
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
      </Suspense>
    </div>
  );
}

