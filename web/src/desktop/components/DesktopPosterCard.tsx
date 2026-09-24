import React, { useState } from 'react';
import { IoPlay, IoStar, IoHeart, IoHeartOutline, IoFilmOutline } from 'react-icons/io5';
import { MediaItem } from '../../shared/types/media';

interface DesktopPosterCardProps {
  item: MediaItem;
  onPress: (item: MediaItem) => void;
  onPlayDirect?: (item: MediaItem) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (id: string) => void;
}

export const DesktopPosterCard: React.FC<DesktopPosterCardProps> = ({
  item,
  onPress,
  onPlayDirect,
  isFavorite = false,
  onToggleFavorite,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  const getPosterUrl = () => {
    if (item.id === '3695' || item.title?.toLowerCase().includes('money heist') || item.title?.toLowerCase().includes('casa de papel')) {
      return '/assets/figma/poster_money_heist.png';
    }
    if (item.id === 'lucifer-figma' || item.title?.toLowerCase() === 'lucifer') {
      return '/assets/figma/poster_lucifer.png';
    }
    if (item.id === 'sex-ed-figma' || item.title?.toLowerCase().includes('sex education')) {
      return '/assets/figma/poster_sex_education.png';
    }
    return item.posterUrl || '';
  };

  const posterSrc = getPosterUrl();

  const handleClick = () => {
    setIsPressed(true);
    setTimeout(() => {
      setIsPressed(false);
      onPress(item);
    }, 110);
  };

  return (
    <div
      onClick={handleClick}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsPressed(false);
      }}
      style={{
        cursor: 'pointer',
        userSelect: 'none',
        transition: 'transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.18s ease',
        transform: isPressed
          ? 'scale(0.93)'
          : isHovered
          ? 'translateY(-6px)'
          : 'translateY(0)',
        filter: isPressed ? 'brightness(1.15)' : 'none',
      }}
    >
      {/* Poster Image Container */}
      <div
        style={{
          width: '100%',
          aspectRatio: '2 / 3',
          borderRadius: 16,
          backgroundColor: '#1A1F29',
          overflow: 'hidden',
          position: 'relative',
          border: isHovered ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: isHovered
            ? '0 16px 30px rgba(0, 0, 0, 0.6)'
            : '0 8px 16px rgba(0, 0, 0, 0.35)',
          transition: 'all 0.2s ease',
        }}
      >
        {posterSrc ? (
          <img
            src={posterSrc}
            alt={item.title}
            loading="lazy"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: isHovered ? 'scale(1.05)' : 'scale(1)',
              transition: 'transform 0.3s ease',
            }}
            onError={(e) => {
              (e.currentTarget as HTMLElement).style.display = 'none';
            }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IoFilmOutline size={36} color="#7C8394" />
          </div>
        )}

        {/* Rating Badge */}
        {item.matchScore !== undefined && (
          <div
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(6px)',
              padding: '4px 8px',
              borderRadius: 8,
              border: '1px solid rgba(255, 255, 255, 0.1)',
              zIndex: 2,
            }}
          >
            <IoStar size={12} color="#FFB800" />
            <span style={{ color: '#FFFFFF', fontSize: 11, fontWeight: 700, lineHeight: 1 }}>
              {item.matchScore}%
            </span>
          </div>
        )}

        {/* Hover Quick Action Overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(9, 9, 15, 0.55)',
            backdropFilter: 'blur(3px)',
            opacity: isHovered ? 1 : 0,
            transition: 'opacity 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            zIndex: 3,
          }}
        >
          {onPlayDirect && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPlayDirect(item);
              }}
              title="Lire directement"
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                backgroundColor: '#FFFFFF',
                color: '#09090F',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 20px rgba(255, 255, 255, 0.4)',
                cursor: 'pointer',
                transform: isHovered ? 'scale(1)' : 'scale(0.8)',
                transition: 'transform 0.15s ease',
              }}
            >
              <IoPlay size={22} color="#09090F" style={{ marginLeft: 2 }} />
            </button>
          )}

          {onToggleFavorite && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(item.id);
              }}
              title={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              style={{
                width: 42,
                height: 42,
                borderRadius: '50%',
                backgroundColor: 'rgba(26, 31, 41, 0.85)',
                color: isFavorite ? '#FFFFFF' : 'rgba(255, 255, 255, 0.7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                cursor: 'pointer',
              }}
            >
              {isFavorite ? <IoHeart size={20} color="#FFFFFF" /> : <IoHeartOutline size={20} />}
            </button>
          )}
        </div>
      </div>

      {/* Title & Metadata */}
      <div style={{ marginTop: 8 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: isHovered ? '#FFFFFF' : '#F1F3F7',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            transition: 'color 0.15s ease',
          }}
        >
          {item.title}
        </div>
        <div
          style={{
            fontSize: 12,
            color: '#7C8394',
            marginTop: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span>{item.year || 2021}</span>
          {item.quality && <span>• {item.quality}</span>}
        </div>
      </div>
    </div>
  );
};
