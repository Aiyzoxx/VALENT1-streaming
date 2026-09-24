import React, { useRef, useEffect } from 'react';
import { IoSearchOutline, IoMicOutline, IoCloseCircle } from 'react-icons/io5';

interface DesktopHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenVoiceSearch: () => void;
  isListening?: boolean;
}

export const DesktopHeader: React.FC<DesktopHeaderProps> = ({
  searchQuery,
  onSearchChange,
  onOpenVoiceSearch,
  isListening = false,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  // Global keyboard shortcut '/' to focus search bar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <header
      style={{
        height: 80,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 40px',
        position: 'sticky',
        top: 0,
        backgroundColor: 'rgba(9, 9, 15, 0.75)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        zIndex: 40,
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
      }}
    >
      {/* Search Input Container */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: '#191C24',
          borderRadius: 18,
          height: 48,
          width: 500,
          maxWidth: '100%',
          padding: '0 16px',
          border: '1px solid #262B36',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
          transition: 'border-color 0.15s ease',
        }}
      >
        <IoSearchOutline size={20} color="#7C8394" style={{ marginRight: 12, flexShrink: 0 }} />
        <input
          ref={inputRef}
          type="text"
          placeholder="Rechercher des films, séries, acteurs, genres..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{
            flex: 1,
            height: '100%',
            backgroundColor: 'transparent',
            color: '#FFFFFF',
            fontSize: 14,
            fontWeight: 500,
            border: 'none',
            outline: 'none',
          }}
        />

        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            style={{
              color: '#7C8394',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <IoCloseCircle size={18} />
          </button>
        )}

        <div
          style={{
            width: 1,
            height: 20,
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            margin: '0 10px',
          }}
        />

        <button
          onClick={onOpenVoiceSearch}
          title="Recherche vocale"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isListening ? '#E50914' : '#7C8394',
            cursor: 'pointer',
            padding: 4,
          }}
        >
          <IoMicOutline size={20} />
        </button>

        {/* Keyboard shortcut hint */}
        {!searchQuery && (
          <div
            style={{
              marginLeft: 8,
              padding: '2px 6px',
              borderRadius: 6,
              backgroundColor: '#262B36',
              color: '#7C8394',
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            /
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ fontSize: 13, color: '#9EA4B3' }}>
          Qualité streaming : <strong style={{ color: '#FFFFFF' }}>4K Ultra HD</strong>
        </div>
      </div>
    </header>
  );
};
