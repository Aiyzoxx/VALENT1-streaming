import React from 'react';
import { IoSearchOutline, IoMicOutline, IoCloseCircle } from 'react-icons/io5';

interface SearchBarFigmaProps {
  value: string;
  onChangeText: (text: string) => void;
  onOpenVoiceSearch?: () => void;
  isListening?: boolean;
  placeholder?: string;
}

export const SearchBarFigma: React.FC<SearchBarFigmaProps> = ({
  value,
  onChangeText,
  onOpenVoiceSearch,
  isListening = false,
  placeholder = 'Search',
}) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        backgroundColor: '#191C24',
        borderRadius: 18,
        height: 52,
        padding: '0 16px',
        border: '1px solid #262B36',
        boxShadow: '0 4px 10px rgba(0, 0, 0, 0.2)',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <IoSearchOutline size={20} color="#7C8394" style={{ marginRight: 10, flexShrink: 0 }} />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChangeText(e.target.value)}
        style={{
          flex: 1,
          height: '100%',
          backgroundColor: 'transparent',
          color: '#FFFFFF',
          fontSize: 15,
          fontFamily: 'inherit',
          fontWeight: 500,
          border: 'none',
          outline: 'none',
        }}
      />
      {value.length > 0 && (
        <button
          onClick={() => onChangeText('')}
          style={{
            padding: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#7C8394',
            cursor: 'pointer',
          }}
        >
          <IoCloseCircle size={18} />
        </button>
      )}
      <div
        style={{
          width: 1,
          height: 24,
          backgroundColor: 'rgba(255, 255, 255, 0.12)',
          margin: '0 12px',
          flexShrink: 0,
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
          animation: isListening ? 'pulse 1s infinite' : 'none',
        }}
      >
        <IoMicOutline size={20} />
      </button>
    </div>
  );
};
