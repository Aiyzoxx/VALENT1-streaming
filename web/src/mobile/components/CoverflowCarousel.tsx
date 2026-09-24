import React, { useRef, useEffect, useState, useCallback } from 'react';
import { MediaItem } from '../../shared/types/media';

interface CoverflowCarouselProps {
  items: MediaItem[];
  onSelectItem: (item: MediaItem) => void;
}

export const CoverflowCarousel: React.FC<CoverflowCarouselProps> = ({
  items,
  onSelectItem,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollX, setScrollX] = useState(0);
  const [cardWidth, setCardWidth] = useState(230);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);

  const SPACING = 14;
  const snapInterval = cardWidth + SPACING;

  // Calculate card width based on screen width (60%)
  useEffect(() => {
    const updateSize = () => {
      const w = window.innerWidth;
      const calculated = Math.min(320, Math.max(200, Math.round(w * 0.60)));
      setCardWidth(calculated);
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Initialize scroll centered on index 1 (Money Heist)
  useEffect(() => {
    if (containerRef.current) {
      const initialScroll = snapInterval;
      containerRef.current.scrollLeft = initialScroll;
      setScrollX(initialScroll);
    }
  }, [snapInterval]);

  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      setScrollX(containerRef.current.scrollLeft);
    }
  }, []);

  // Touch / Pointer drag support for smooth swiping
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!containerRef.current) return;
    setIsDragging(true);
    startXRef.current = e.pageX - containerRef.current.offsetLeft;
    scrollLeftRef.current = containerRef.current.scrollLeft;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !containerRef.current) return;
    e.preventDefault();
    const x = e.pageX - containerRef.current.offsetLeft;
    const walk = (x - startXRef.current) * 1.2;
    containerRef.current.scrollLeft = scrollLeftRef.current - walk;
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    // Snap to nearest item smoothly
    if (containerRef.current) {
      const currentScroll = containerRef.current.scrollLeft;
      const nearestIdx = Math.round(currentScroll / snapInterval);
      const targetScroll = Math.max(0, Math.min((items.length - 1) * snapInterval, nearestIdx * snapInterval));
      containerRef.current.scrollTo({ left: targetScroll, behavior: 'smooth' });
    }
  };

  const getPosterSource = (item: MediaItem) => {
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

  const cardHeight = Math.round(cardWidth * 1.48);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      style={{
        display: 'flex',
        overflowX: 'auto',
        scrollSnapType: isDragging ? 'none' : 'x mandatory',
        scrollBehavior: isDragging ? 'auto' : 'smooth',
        paddingLeft: `calc(50vw - ${cardWidth / 2}px)`,
        paddingRight: `calc(50vw - ${cardWidth / 2}px)`,
        paddingTop: 16,
        paddingBottom: 24,
        perspective: '900px',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        cursor: isDragging ? 'grabbing' : 'grab',
        touchAction: 'pan-x',
        userSelect: 'none',
      }}
    >
      {items.map((item, idx) => {
        // Compute delta from center in units of snapInterval
        const itemCenter = idx * snapInterval;
        const delta = (scrollX - itemCenter) / snapInterval; // 0 when centered, -1 when to right, +1 when to left
        const clampedDelta = Math.max(-1.5, Math.min(1.5, delta));

        // When item is on right (scrollX < itemCenter -> delta < 0): rotateZ -6.5deg, rotateY -12deg
        // When item is on left (scrollX > itemCenter -> delta > 0): rotateZ +6.5deg, rotateY +12deg
        const rotateZ = clampedDelta * 6.5;
        const rotateY = clampedDelta * 12;
        const scale = 1 - Math.min(0.12, Math.abs(clampedDelta) * 0.12);
        const translateY = Math.min(14, Math.abs(clampedDelta) * 12);
        const opacity = 1 - Math.min(0.3, Math.abs(clampedDelta) * 0.28);

        return (
          <div
            key={item.id}
            onClick={() => {
              if (Math.abs(delta) < 0.3) {
                onSelectItem(item);
              } else if (containerRef.current) {
                containerRef.current.scrollTo({ left: itemCenter, behavior: 'smooth' });
              }
            }}
            style={{
              flexShrink: 0,
              width: cardWidth,
              height: cardHeight,
              marginRight: idx === items.length - 1 ? 0 : SPACING,
              scrollSnapAlign: 'center',
              transform: `translate3d(0, ${translateY}px, 0) scale(${scale}) rotateY(${rotateY}deg) rotateZ(${rotateZ}deg)`,
              transformStyle: 'preserve-3d',
              transition: isDragging ? 'none' : 'transform 0.15s ease-out, opacity 0.15s ease-out',
              opacity,
              borderRadius: 28,
              boxShadow: '0 16px 25px rgba(0, 0, 0, 0.7)',
              overflow: 'hidden',
              position: 'relative',
              cursor: 'pointer',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <img
              src={getPosterSource(item)}
              alt={item.title}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                pointerEvents: 'none',
              }}
            />
            {/* Ambient Gradient overlay */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to bottom, transparent 0%, rgba(14, 17, 23, 0.1) 65%, rgba(14, 17, 23, 0.65) 100%)',
                pointerEvents: 'none',
              }}
            />
          </div>
        );
      })}
    </div>
  );
};
