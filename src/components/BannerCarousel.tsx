import { useState, useEffect, useRef, useMemo, memo } from 'react';
import { m, AnimatePresence } from 'motion/react';

interface BannerCarouselProps {
  images: string[];
  interval?: number;
  config?: Array<{ scale: number; x: number; y: number; stretch?: boolean; link?: string }>;
  isPausedExternally?: boolean;
}

const bannerVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? '100%' : '-100%',
    opacity: 0,
    scale: 0.94,
    zIndex: 1
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
    scale: 1,
    transition: {
      x: { duration: 0.65, ease: [0.16, 1, 0.3, 1] as any },
      opacity: { duration: 0.45 },
      scale: { duration: 0.65, ease: [0.16, 1, 0.3, 1] as any }
    }
  },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction > 0 ? '-100%' : '100%',
    opacity: 0,
    scale: 0.94,
    transition: {
      x: { duration: 0.65, ease: [0.16, 1, 0.3, 1] as any },
      opacity: { duration: 0.35 },
      scale: { duration: 0.65, ease: [0.16, 1, 0.3, 1] as any }
    }
  })
};

const BannerCarousel = memo(({ images, interval = 5000, config = [], isPausedExternally = false }: BannerCarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isTabHidden, setIsTabHidden] = useState(() => typeof document !== 'undefined' && document.visibilityState === 'hidden');

  const pointerStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const suppressClickUntilRef = useRef<number>(0);

  const validImages = useMemo(
    () => (images || []).filter((img) => Boolean(img && img.trim())),
    [images]
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handleVisibility = () => {
      setIsTabHidden(document.visibilityState === 'hidden');
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  useEffect(() => {
    if (currentIndex >= validImages.length && validImages.length > 0) {
      setCurrentIndex(0);
    }
  }, [validImages.length, currentIndex]);

  const effectivelyPaused = isPaused || isPausedExternally || isTabHidden;

  useEffect(() => {
    if (!validImages || validImages.length <= 1 || effectivelyPaused) return;

    // Pre-cache next slide image quietly
    const nextIndex = (currentIndex + 1) % validImages.length;
    if (validImages[nextIndex]) {
      const nextImg = new Image();
      nextImg.decoding = 'async';
      nextImg.referrerPolicy = 'no-referrer';
      nextImg.src = validImages[nextIndex];
    }

    const timer = setInterval(() => {
      setDirection(1);
      setCurrentIndex((prev) => (prev + 1) % validImages.length);
    }, interval);

    return () => clearInterval(timer);
  }, [validImages, interval, currentIndex, effectivelyPaused]);

  if (!validImages || validImages.length === 0) return null;

  const next = () => {
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % validImages.length);
  };
  const prev = () => {
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + validImages.length) % validImages.length);
  };

  const handleBannerClick = (link?: string) => {
    if (link && Date.now() > suppressClickUntilRef.current) {
      window.open(link, '_blank', 'noopener,noreferrer');
    }
  };

  const currentCfg = config[currentIndex];
  const baseScale = currentCfg?.scale ? currentCfg.scale / 100 : 1;

  return (
    <div
      className="relative w-full h-[44vh] md:h-[58vh] overflow-hidden bg-[#0b0c10] touch-pan-y select-none"
      onPointerDown={(e) => {
        pointerStartRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
        setIsPaused(true);
      }}
      onPointerUp={(e) => {
        setIsPaused(false);
        const start = pointerStartRef.current;
        pointerStartRef.current = null;
        if (!start || validImages.length <= 1) return;

        const dx = e.clientX - start.x;
        const dy = Math.abs(e.clientY - start.y);
        const dt = Math.max(1, Date.now() - start.time);
        const velocity = Math.abs(dx) / dt;

        // Trigger swipe if mostly horizontal and crossed distance or flick velocity threshold
        if (Math.abs(dx) > dy && (Math.abs(dx) > 40 || (Math.abs(dx) > 18 && velocity > 0.3))) {
          suppressClickUntilRef.current = Date.now() + 150;
          if (dx < 0) next();
          else prev();
        }
      }}
      onPointerCancel={() => {
        pointerStartRef.current = null;
        setIsPaused(false);
      }}
    >
      <div className="absolute inset-0">
        <AnimatePresence initial={false} custom={direction}>
          <m.div
            key={currentIndex}
            custom={direction}
            variants={bannerVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="absolute inset-0 w-full h-full will-change-[transform,opacity]"
            onClick={() => handleBannerClick(currentCfg?.link)}
          >
            <m.img
              src={validImages[currentIndex]}
              loading={currentIndex === 0 ? 'eager' : 'lazy'}
              fetchPriority={currentIndex === 0 ? 'high' : 'auto'}
              decoding="async"
              initial={false}
              animate={
                effectivelyPaused
                  ? { scale: currentCfg?.stretch ? 1 : baseScale }
                  : { scale: currentCfg?.stretch ? 1 : [baseScale, baseScale * 1.03] }
              }
              transition={
                effectivelyPaused
                  ? { duration: 0.2 }
                  : {
                      scale: {
                        duration: 20,
                        repeat: Infinity,
                        repeatType: 'reverse',
                        ease: 'linear'
                      }
                    }
              }
              style={{
                objectFit: currentCfg?.stretch ? 'fill' : 'cover',
                objectPosition: currentCfg?.stretch ? 'center' : (currentCfg ? `${currentCfg.x}% ${currentCfg.y}%` : '50% 50%'),
                transformOrigin: 'center center'
              }}
              className={`absolute inset-0 w-full h-full will-change-transform ${currentCfg?.link ? 'cursor-pointer' : ''}`}
              alt={`Banner ${currentIndex + 1}`}
              referrerPolicy="no-referrer"
              draggable={false}
            />
          </m.div>
        </AnimatePresence>
      </div>

      {/* Overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0b0c10] via-transparent to-transparent opacity-95 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0b0c10]/70 via-transparent to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0b0c10]/40 via-transparent to-[#0b0c10]/40 pointer-events-none" />
    </div>
  );
});

export default BannerCarousel;
