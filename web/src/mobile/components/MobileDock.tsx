import React from 'react';
import {
  IoHome,
  IoHomeOutline,
  IoGrid,
  IoGridOutline,
  IoPerson,
  IoPersonOutline,
} from 'react-icons/io5';

export type MobileTab = 'home' | 'catalog' | 'profile';

interface MobileDockProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
}

export const MobileDock: React.FC<MobileDockProps> = ({ activeTab, onTabChange }) => {
  const tabs = [
    {
      id: 'home' as MobileTab,
      activeIcon: IoHome,
      inactiveIcon: IoHomeOutline,
      size: 24,
      label: 'Accueil',
    },
    {
      id: 'catalog' as MobileTab,
      activeIcon: IoGrid,
      inactiveIcon: IoGridOutline,
      size: 23,
      label: 'Catalogue',
    },
    {
      id: 'profile' as MobileTab,
      activeIcon: IoPerson,
      inactiveIcon: IoPersonOutline,
      size: 24,
      label: 'Compte',
    },
  ];

  const handleTabPress = (tab: MobileTab) => {
    if (navigator.vibrate) {
      try {
        navigator.vibrate(10);
      } catch {
        /* ignore */
      }
    }
    onTabChange(tab);
  };

  return (
    <div
      style={{
        position: 'fixed',
        left: '50%',
        transform: 'translateX(-50%)',
        bottom: 'calc(env(safe-area-inset-bottom, 12px) + 8px)',
        width: 300,
        height: 68,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        backgroundColor: 'rgba(9, 9, 15, 0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRadius: 9999,
        border: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '0 20px',
        zIndex: 100,
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
      }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const IconComponent = isActive ? tab.activeIcon : tab.inactiveIcon;

        return (
          <button
            key={tab.id}
            onClick={() => handleTabPress(tab.id)}
            aria-label={tab.label}
            style={{
              flex: 1,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              position: 'relative',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              padding: 0,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transform: isActive ? 'scale(1.12)' : 'scale(1)',
                transition: 'transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)',
                color: isActive ? '#FFFFFF' : '#555C6E',
              }}
            >
              <IconComponent size={tab.size} />
            </div>

            {/* Active Dot */}
            <div
              style={{
                width: 4,
                height: 4,
                borderRadius: 2,
                backgroundColor: '#FFFFFF',
                marginTop: 2,
                opacity: isActive ? 1 : 0,
                transform: isActive ? 'scale(1)' : 'scale(0)',
                transition: 'transform 0.15s ease, opacity 0.15s ease',
              }}
            />
          </button>
        );
      })}
    </div>
  );
};
