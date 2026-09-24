import React from 'react';
import { IoPlay, IoInformationCircleOutline, IoHeart, IoHeartOutline, IoStar } from 'react-icons/io5';
import { MediaItem } from '../../shared/types/media';
import { optimizeImageUrl } from '../../shared/utils/image';

interface DesktopHeroBannerProps {
  item: MediaItem;
  isFavorite: boolean;
  onPlay: (item: MediaItem) => void;
  onOpenDetails: (item: MediaItem) => void;
  onToggleFavorite: (id: string) => void;
}

export const DesktopHeroBanner: React.FC<DesktopHeroBannerProps> = ({
  item,
  isFavorite,
  onPlay,
  onOpenDetails,
  onToggleFavorite,
}) => {
  const isMoneyHeist =
    item.id === '3695' ||
    item.title?.toLowerCase().includes('money heist') ||
    item.title?.toLowerCase().includes('casa de papel');

  const backdropSrc = isMoneyHeist
    ? '/assets/figma/hero_money_heist.webp'
    : optimizeImageUrl(item.backdropUrl || item.posterUrl, 'backdrop');

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: 480,
        borderRadius: 28,
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
        marginBottom: 40,
        backgroundColor: '#1A1F29',
      }}
    >
      <img
        src={backdropSrc}
        alt={item.title}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
        }}
      />

      {/* Cinematic gradient overlays */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(90deg, rgba(9, 9, 15, 0.95) 0%, rgba(9, 9, 15, 0.75) 45%, rgba(9, 9, 15, 0.15) 100%), linear-gradient(0deg, rgba(9, 9, 15, 0.9) 0%, transparent 60%)',
        }}
      />

      {/* Hero Content */}
      <div
        style={{
          position: 'absolute',
          left: 48,
          bottom: 48,
          maxWidth: 620,
          zIndex: 10,
        }}
      >
        {/* Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          {item.matchScore && (
            <span
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: '#10B981',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                padding: '4px 8px',
                borderRadius: 6,
                border: '1px solid rgba(16, 185, 129, 0.3)',
              }}
            >
              Recommandé à {item.matchScore}%
            </span>
          )}
          <span style={{ fontSize: 13, color: '#9EA4B3', fontWeight: 600 }}>
            {item.year || 2021}
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              padding: '2px 6px',
              borderRadius: 4,
              color: '#FFFFFF',
            }}
          >
            {item.ageRating || '16+'}
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              padding: '2px 6px',
              borderRadius: 4,
              color: '#FFFFFF',
            }}
          >
            {item.quality || '4K HDR'}
          </span>
          {item.duration && (
            <span style={{ fontSize: 13, color: '#9EA4B3' }}>{item.duration}</span>
          )}
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: 40,
            fontWeight: 800,
            color: '#FFFFFF',
            letterSpacing: -0.8,
            lineHeight: 1.15,
            marginBottom: 14,
            textShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
          }}
        >
          {isMoneyHeist ? 'Money Heist : Part 5' : item.title}
        </h1>

        {/* Rating stars */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 16 }}>
          {[1, 2, 3, 4, 5].map((index) => (
            <IoStar
              key={index}
              size={16}
              color={index <= 4 ? '#FFB800' : '#555C6E'}
            />
          ))}
          <span style={{ fontSize: 13, color: '#FFB800', fontWeight: 700, marginLeft: 6 }}>
            Top Recommandations
          </span>
        </div>

        {/* Synopsis */}
        <p
          style={{
            fontSize: 15,
            lineHeight: 1.6,
            color: '#9EA4B3',
            marginBottom: 24,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {item.synopsis ||
            "L'armée s'apprête à donner l'assaut final. Alors que tout semble perdu, le Professeur et son équipe tentent l'impossible pour sauver leurs vies et boucler le casse le plus audacieux de l'histoire."}
        </p>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            onClick={() => onPlay(item)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              backgroundColor: '#FFFFFF',
              color: '#09090F',
              fontSize: 15,
              fontWeight: 700,
              padding: '14px 28px',
              borderRadius: 16,
              cursor: 'pointer',
              boxShadow: '0 0 30px rgba(255, 255, 255, 0.35)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.04)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <IoPlay size={20} color="#09090F" />
            <span>Regarder maintenant</span>
          </button>

          <button
            onClick={() => onOpenDetails(item)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              backgroundColor: 'rgba(26, 31, 41, 0.85)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#FFFFFF',
              fontSize: 14,
              fontWeight: 600,
              padding: '14px 22px',
              borderRadius: 16,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(26, 31, 41, 0.85)';
            }}
          >
            <IoInformationCircleOutline size={20} />
            <span>Détails & Épisodes</span>
          </button>

          <button
            onClick={() => onToggleFavorite(item.id)}
            title={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            style={{
              width: 50,
              height: 50,
              borderRadius: 16,
              backgroundColor: 'rgba(26, 31, 41, 0.85)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: isFavorite ? '#FFFFFF' : 'rgba(255, 255, 255, 0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(26, 31, 41, 0.85)';
            }}
          >
            {isFavorite ? <IoHeart size={24} color="#FFFFFF" /> : <IoHeartOutline size={24} />}
          </button>
        </div>
      </div>
    </div>
  );
};
