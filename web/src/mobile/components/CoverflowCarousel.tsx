import React, { useRef, useEffect, useState, useCallback } from 'react';
import { MediaItem } from '../../shared/types/media';
import { optimizeImageUrl } from '../../shared/utils/image';

interface CoverflowCarouselProps {
  items: MediaItem[];
  onSelectItem: (item: MediaItem) => void;
}

export const CoverflowCarousel: React.FC<CoverflowCarouselProps> = ({
  items,
  onSelectItem,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [cardWidth, setCardWidth] = useState(230);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  const SPACING = 14;
  const snapInterval = cardWidth + SPACING;

  // Responsive card width (60% of viewport, 200-320px)
  useEffect(() => {
    const updateSize = () => {
      const w = window.innerWidth;
      const calculated = Math.min(320, Math.max(200, Math.round(w * 0.6)));
      setCardWidth(calculated);
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Update card 3D coverflow transforms (tilt, rotation, scale, depth) directly on DOM
  const updateCardTransforms = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const currentScroll = container.scrollLeft;

    cardRefs.current.forEach((el, idx) => {
      if (!el) return;
      const itemCenter = idx * snapInterval;
      const delta = (currentScroll - itemCenter) / snapInterval;
      const clampedDelta = Math.max(-1.5, Math.min(1.5, delta));

      // 3D Coverflow geometry: rotateZ & rotateY with perspective
      const rotateZ = clampedDelta * 6.5;
      const rotateY = clampedDelta * 12;
      const scale = 1 - Math.min(0.12, Math.abs(clampedDelta) * 0.12);
      const translateY = Math.min(14, Math.abs(clampedDelta) * 12);
      const opacity = 1 - Math.min(0.3, Math.abs(clampedDelta) * 0.28);

      el.style.transform = `translate3d(0, ${translateY}px, 0) scale(${scale}) rotateY(${rotateY}deg) rotateZ(${rotateZ}deg)`;
      el.style.opacity = `${opacity}`;
    });
  }, [snapInterval]);

  // High-performance scroll listener with requestAnimationFrame
  const handleScroll = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(updateCardTransforms);
  }, [updateCardTransforms]);

  // Native passive scroll listener for 60/120fps fluid scrolling
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll]);

  // Initial centering on index 1 (Money Heist)
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollLeft = snapInterval;
      updateCardTransforms();
    }
  }, [snapInterval, updateCardTransforms]);

  // Desktop mouse drag support (keeping mobile touch native and frictionless)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    isDraggingRef.current = true;
    startXRef.current = e.pageX - containerRef.current.offsetLeft;
    scrollLeftRef.current = containerRef.current.scrollLeft;
    containerRef.current.style.scrollSnapType = 'none';
    containerRef.current.style.cursor = 'grabbing';

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current || !containerRef.current) return;
      ev.preventDefault();
      const x = ev.pageX - containerRef.current.offsetLeft;
      const walk = (x - startXRef.current) * 1.2;
      containerRef.current.scrollLeft = scrollLeftRef.current - walk;
      handleScroll();
    };

    const onMouseUp = () => {
      isDraggingRef.current = false;
      if (containerRef.current) {
        containerRef.current.style.scrollSnapType = 'x mandatory';
        containerRef.current.style.cursor = 'grab';

        const currentScroll = containerRef.current.scrollLeft;
        const nearestIdx = Math.round(currentScroll / snapInterval);
        const targetScroll = Math.max(0, Math.min((items.length - 1) * snapInterval, nearestIdx * snapInterval));
        containerRef.current.scrollTo({ left: targetScroll, behavior: 'smooth' });
      }
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const getPosterSource = (item: MediaItem) => {
    if (
      item.id === '3695' ||
      item.title?.toLowerCase().includes('money heist') ||
      item.title?.toLowerCase().includes('casa de papel')
    ) {
      return '/assets/figma/poster_money_heist.webp';
    }
    if (item.id === '3629' || item.id === 'lucifer-figma' || item.title?.toLowerCase() === 'lucifer') {
      return '/assets/figma/poster_lucifer.webp';
    }
    if (item.id === '3595' || item.id === 'sex-ed-figma' || item.title?.toLowerCase().includes('sex education')) {
      return '/assets/figma/poster_sex_education.webp';
    }
    return optimizeImageUrl(item.posterUrl, 'poster');
  };

  const cardHeight = Math.round(cardWidth * 1.48);

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      style={{
        display: 'flex',
        overflowX: 'auto',
        scrollSnapType: 'x mandatory',
        WebkitOverflowScrolling: 'touch',
        overscrollBehaviorX: 'contain',
        paddingLeft: `calc(50vw - ${cardWidth / 2}px)`,
        paddingRight: `calc(50vw - ${cardWidth / 2}px)`,
        paddingTop: 16,
        paddingBottom: 24,
        perspective: '900px',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        cursor: 'grab',
        touchAction: 'pan-x',
        userSelect: 'none',
      }}
    >
      {items.map((item, idx) => {
        const itemCenter = idx * snapInterval;
        return (
          <div
            key={item.id}
            ref={(el) => {
              cardRefs.current[idx] = el;
            }}
            onClick={() => {
              const currentScroll = containerRef.current?.scrollLeft ?? 0;
              const delta = Math.abs((currentScroll - itemCenter) / snapInterval);
              if (delta < 0.3) {
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
              scrollSnapStop: 'normal',
              borderRadius: 28,
              boxShadow: '0 16px 30px rgba(0, 0, 0, 0.7)',
              overflow: 'hidden',
              position: 'relative',
              cursor: 'pointer',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              transformStyle: 'preserve-3d',
              willChange: 'transform, opacity',
              backgroundColor: '#1A1F29',
            }}
          >
            <img
              src={getPosterSource(item)}
              alt={item.title}
              loading={idx < 3 ? 'eager' : 'lazy'}
              decoding="async"
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
                background:
                  'linear-gradient(to bottom, transparent 0%, rgba(14, 17, 23, 0.1) 65%, rgba(14, 17, 23, 0.65) 100%)',
                pointerEvents: 'none',
              }}
            />
          </div>
        );
      })}
    </div>
  );
};
