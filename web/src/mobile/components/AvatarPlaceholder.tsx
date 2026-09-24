import React from 'react';

interface AvatarPlaceholderProps {
  size?: number;
}

export const AvatarPlaceholder: React.FC<AvatarPlaceholderProps> = ({ size = 48 }) => {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        overflow: 'hidden',
        border: '1.5px solid rgba(255, 255, 255, 0.25)',
        backgroundColor: '#1A1F29',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow: '0 4px 10px rgba(0, 0, 0, 0.4)',
      }}
    >
      <img
        src="/assets/figma/avatar_daizy.jpg"
        alt="Daizy Avatar"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
        onError={(e) => {
          // Fallback if image fails
          (e.currentTarget as HTMLElement).style.display = 'none';
        }}
      />
    </div>
  );
};
