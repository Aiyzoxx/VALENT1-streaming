import React, { useState } from 'react';
import { IoStar, IoFilmOutline } from 'react-icons/io5';
import { MediaItem } from '../../shared/types/media';
import { optimizeImageUrl } from '../../shared/utils/image';

interface MediaPosterCardProps {
  item: MediaItem;
  onPress: (item: MediaItem) => void;
  width?: number | string;
  height?: number;
  showRating?: boolean;
  hideQuality?: boolean;
}

export const MediaPosterCard: React.FC<MediaPosterCardProps> = ({
  item,
  onPress,
  width,
  height,
  showRating = false,
  hideQuality = false,
}) => {
  const [isPressed, setIsPressed] = useState(false);

  const getPosterUrl = () => {
    if (item.id === '3695' || item.title?.toLowerCase().includes('money heist') || item.title?.toLowerCase().includes('casa de papel')) {
      return '/assets/figma/poster_money_heist.webp';
    }
    if (item.id === 'lucifer-figma' || item.title?.toLowerCase() === 'lucifer') {
      return '/assets/figma/poster_lucifer.webp';
    }
    if (item.id === 'sex-ed-figma' || item.title?.toLowerCase().includes('sex education')) {
      return '/assets/figma/poster_sex_education.webp';
    }
    return optimizeImageUrl(item.posterUrl, 'poster');
  };

  const posterSrc = getPosterUrl();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsPressed(true);
    if (navigator.vibrate) {
      try {
        navigator.vibrate(12);
      } catch {
        /* ignore */
      }
    }
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
      onTouchStart={() => setIsPressed(true)}
      onTouchEnd={() => setIsPressed(false)}
      style={{
        width: width ?? '100%',
        minWidth: 0,
        marginBottom: 16,
        cursor: 'pointer',
        userSelect: 'none',
        transform: isPressed ? 'scale(0.92)' : 'scale(1)',
        filter: isPressed ? 'brightness(1.15)' : 'none',
        transition: 'transform 0.16s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.16s ease',
        boxSizing: 'border-box',
      }}
      className="media-poster-card"
    >
      <div
        style={{
          width: '100%',
          height: height ?? undefined,
          aspectRatio: height ? undefined : '2 / 3',
          borderRadius: 16,
          backgroundColor: '#1A1F29',
          overflow: 'hidden',
          position: 'relative',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 8px 10px rgba(0, 0, 0, 0.4)',
        }}
      >
        {posterSrc ? (
          <img
            src={posterSrc}
            alt={item.title}
            loading="lazy"
            decoding="async"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
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
              backgroundColor: '#1A1F29',
            }}
          >
            <IoFilmOutline size={32} color="#7C8394" />
          </div>
        )}

        {showRating && item.matchScore !== undefined && (
          <div
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(4px)',
              padding: '3px 6px',
              borderRadius: 8,
              border: '1px solid rgba(255, 255, 255, 0.1)',
              gap: 4,
            }}
          >
            <IoStar size={10} color="#FFB800" />
            <span
              style={{
                color: '#FFFFFF',
                fontSize: 10,
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              {item.matchScore}%
            </span>
          </div>
        )}
      </div>

      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: '#FFFFFF',
          marginTop: 6,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          width: '100%',
          display: 'block',
        }}
      >
        {item.title}
      </div>

      {item.year && (
        <div
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: '#9EA4B3',
            marginTop: 2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            width: '100%',
            display: 'block',
          }}
        >
          {item.year}
          {!hideQuality && item.quality ? ` • ${item.quality}` : ''}
        </div>
      )}
    </div>
  );
};

