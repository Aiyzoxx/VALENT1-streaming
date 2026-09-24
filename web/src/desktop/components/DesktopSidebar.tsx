import React from 'react';
import {
  IoHome,
  IoHomeOutline,
  IoGrid,
  IoGridOutline,
  IoFilm,
  IoFilmOutline,
  IoTv,
  IoTvOutline,
  IoHeart,
  IoHeartOutline,
  IoTime,
  IoTimeOutline,
  IoLogOutOutline,
  IoTrophyOutline,
} from 'react-icons/io5';
import { AvatarPlaceholder } from '../../mobile/components/AvatarPlaceholder';

export type DesktopNavTab = 'home' | 'catalog' | 'movies' | 'series' | 'favorites' | 'history' | 'profile';

interface DesktopSidebarProps {
  activeTab: DesktopNavTab;
  onSelectTab: (tab: DesktopNavTab) => void;
  accountName?: string;
  accountEmail?: string;
  onLogout?: () => void;
  favoritesCount?: number;
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  activeTab,
  onSelectTab,
  accountName,
  accountEmail,
  onLogout,
  favoritesCount = 0,
}) => {
  const navItems = [
    { id: 'home' as DesktopNavTab, label: 'Accueil', activeIcon: IoHome, inactiveIcon: IoHomeOutline },
    { id: 'catalog' as DesktopNavTab, label: 'Explorer', activeIcon: IoGrid, inactiveIcon: IoGridOutline },
    { id: 'movies' as DesktopNavTab, label: 'Films', activeIcon: IoFilm, inactiveIcon: IoFilmOutline },
    { id: 'series' as DesktopNavTab, label: 'Séries', activeIcon: IoTv, inactiveIcon: IoTvOutline },
    {
      id: 'favorites' as DesktopNavTab,
      label: 'Mes Favoris',
      activeIcon: IoHeart,
      inactiveIcon: IoHeartOutline,
      badge: favoritesCount > 0 ? favoritesCount : undefined,
    },
    { id: 'history' as DesktopNavTab, label: 'Historique', activeIcon: IoTime, inactiveIcon: IoTimeOutline },
  ];

  return (
    <aside
      style={{
        width: 250,
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        backgroundColor: '#09090F',
        borderRight: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '28px 18px 24px',
        boxSizing: 'border-box',
        zIndex: 50,
      }}
    >
      <div>
        {/* Brand Logo */}
        <div
          onClick={() => onSelectTab('home')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            cursor: 'pointer',
            paddingLeft: 10,
            marginBottom: 36,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              backgroundColor: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 15px rgba(255, 255, 255, 0.4)',
            }}
          >
            <span style={{ color: '#09090F', fontWeight: 900, fontSize: 18 }}>S</span>
          </div>
          <span
            style={{
              fontSize: 19,
              fontWeight: 800,
              color: '#FFFFFF',
              letterSpacing: -0.5,
            }}
          >
            STREAM<span style={{ color: '#9EA4B3', fontWeight: 400 }}>FLOW</span>
          </span>
        </div>

        {/* Navigation List */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = isActive ? item.activeIcon : item.inactiveIcon;

            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderRadius: 14,
                  backgroundColor: isActive ? '#1A1F29' : 'transparent',
                  color: isActive ? '#FFFFFF' : '#7C8394',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: 14,
                  border: isActive ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = '#FFFFFF';
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = '#7C8394';
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <Icon size={20} color={isActive ? '#FFFFFF' : '#7C8394'} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      backgroundColor: '#2B303C',
                      color: '#FFFFFF',
                      padding: '2px 8px',
                      borderRadius: 9999,
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom section: User Profile */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* User Card */}
        <div
          onClick={() => onSelectTab('profile')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 12px',
            backgroundColor: activeTab === 'profile' ? '#1A1F29' : 'transparent',
            borderRadius: 16,
            border: '1px solid rgba(255, 255, 255, 0.06)',
            cursor: 'pointer',
            transition: 'background-color 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <AvatarPlaceholder size={38} />
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#FFFFFF',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {accountName || 'Daizy'}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: '#FFB800',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                <IoTrophyOutline size={10} /> VIP
              </div>
            </div>
          </div>

          {onLogout && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onLogout();
              }}
              title="Déconnexion"
              style={{
                color: '#7C8394',
                padding: 6,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IoLogOutOutline size={18} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};
