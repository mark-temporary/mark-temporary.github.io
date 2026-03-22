import type { ReactNode } from 'react';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import styles from './styles.module.css';
import AgeVerification from '@site/src/components/AgeVerification';

export interface ResponsiveSize {
  /** Viewport width (px) at or above which this size applies. */
  minWidth: number;
  width:    number;
  height:   number;
}

export interface IframeCarouselProps {
  /** Array of iframe src URLs to cycle through. */
  srcs: string[];
  /**
   * Optional per-slide age verification.
   * Array index matches srcs index. Omit an entry (or set to undefined)
   * to leave that slide unprotected.
   *
   * Each entry is the minimumAge integer, e.g.:
   *   ageVerification={[undefined, 18, undefined]}
   *   → only slide 2 requires age verification.
   */
  ageVerification?: (number | undefined)[];
  /**
   * Responsive size breakpoints, sorted largest-first.
   */
  responsiveSizes?: ResponsiveSize[];
  /** Transition duration in ms. Default: 700 */
  transitionMs?: number;
}

const DEFAULT_SIZES: ResponsiveSize[] = [
  { minWidth: 1200, width: 960, height: 720 },
  { minWidth: 700,  width: 640, height: 480 },
  { minWidth: 0,    width: 320, height: 240 },
];

function pickSize(sizes: ResponsiveSize[]): ResponsiveSize {
  // During SSR window is undefined — fall back to the largest size
  if (typeof window === 'undefined') return sizes[0];
  const vw = window.innerWidth;
  // Find the first (largest) breakpoint that fits
  const sorted = [...sizes].sort((a, b) => b.minWidth - a.minWidth);
  return sorted.find(s => vw >= s.minWidth) ?? sorted[sorted.length - 1];
}

export default function IframeCarousel({
  srcs,
  ageVerification  = [],
  responsiveSizes  = DEFAULT_SIZES,
  transitionMs     = 700,
}: IframeCarouselProps): ReactNode {
  const n = srcs.length;

  // ── Responsive size ───────────────────────────────────────────────────────
  const [size, setSize] = useState<ResponsiveSize>(() => pickSize(responsiveSizes));

  useEffect(() => {
    const onResize = () => setSize(pickSize(responsiveSizes));
    window.addEventListener('resize', onResize);
    // Also run once on mount to handle any SSR/hydration mismatch
    onResize();
    return () => window.removeEventListener('resize', onResize);
  }, [responsiveSizes]);

  const { width, height } = size;

  // ── Geometry ──────────────────────────────────────────────────────────────
  const GAP    = 1.05;
  const theta  = (2 * Math.PI) / n;
  const radius = Math.round((width * GAP) / (2 * Math.tan(theta / 2)));

  // ── Carousel state ────────────────────────────────────────────────────────
  const [current, setCurrent]   = useState(0);
  const [rotating, setRotating] = useState(false);
  const angleRef                = useRef(0);

  // One ref per iframe so fullscreen always targets the active one
  const iframeRefs = useRef<(HTMLIFrameElement | null)[]>([]);

  const rotate = useCallback((dir: 1 | -1) => {
    if (rotating) return;
    setRotating(true);
    angleRef.current -= dir * (360 / n);
    setCurrent(prev => ((prev + dir) % n + n) % n);
    setTimeout(() => setRotating(false), transitionMs);
  }, [rotating, n, transitionMs]);

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')  rotate(-1);
      if (e.key === 'ArrowRight') rotate(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rotate]);

  // Pointer swipe
  const swipeStart = useRef<number | null>(null);
  const onPointerDown = (e: React.PointerEvent) => { swipeStart.current = e.clientX; };
  const onPointerUp   = (e: React.PointerEvent) => {
    if (swipeStart.current === null) return;
    const dx = e.clientX - swipeStart.current;
    if (Math.abs(dx) > 40) rotate(dx < 0 ? 1 : -1);
    swipeStart.current = null;
  };

  // Fullscreen targets the active iframe specifically
  const handleFullscreen = () => {
    iframeRefs.current[current]?.requestFullscreen?.();
  };

  const stageStyle: React.CSSProperties = {
    width,
    height,
    perspective: Math.round(radius * 3.5),
  };

  const drumStyle: React.CSSProperties = {
    transform:  `translateZ(-${radius}px) rotateY(${angleRef.current}deg)`,
    transition: `transform ${transitionMs}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`,
  };

  return (
    <div className={styles.wrapper}>

      {/* Left arrow */}
      <button
        className={`${styles.arrow} ${styles.arrowLeft}`}
        onClick={() => rotate(-1)}
        disabled={rotating}
        aria-label="Previous"
      >
        <span className={styles.arrowGlyph}>&#9664;</span>
      </button>

      {/* 3-D stage */}
      <div
        className={styles.stage}
        style={stageStyle}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        <div className={styles.drum} style={drumStyle}>
          {srcs.map((src, i) => {
            const panelStyle: React.CSSProperties = {
              transform: `rotateY(${(360 / n) * i}deg) translateZ(${radius}px)`,
              width,
              height,
            };
            const isActive  = i === current;
            const minAge    = ageVerification[i];
            const iframe = (
              <iframe
                ref={el => { iframeRefs.current[i] = el; }}
                src={src}
                title={`Slide ${i + 1}`}
                className={styles.iframe}
                style={{ pointerEvents: isActive ? 'auto' : 'none' }}
              />
            );
            return (
              <div
                key={src}
                className={`${styles.panel} ${isActive ? styles.panelActive : ''}`}
                style={panelStyle}
                aria-hidden={!isActive}
              >
                {minAge !== undefined ? (
                  <AgeVerification
                    minimumAge={minAge}
                    variant="inline"
                    storageKey={`hf-age-verified-${minAge}-slide-${i}`}
                  >
                    {iframe}
                  </AgeVerification>
                ) : iframe}
                <div className={styles.scanlines} aria-hidden />
              </div>
            );
          })}
        </div>

        <div className={styles.vignette} aria-hidden />

        {/* Fullscreen button — bottom-right overlay, shown on stage hover */}
        <button
          className={styles.fullscreenBtn}
          onClick={handleFullscreen}
          aria-label="Fullscreen"
          title="Fullscreen"
        >
          ⛶
        </button>
      </div>

      {/* Right arrow */}
      <button
        className={`${styles.arrow} ${styles.arrowRight}`}
        onClick={() => rotate(1)}
        disabled={rotating}
        aria-label="Next"
      >
        <span className={styles.arrowGlyph}>&#9654;</span>
      </button>

      {/* Dot indicators */}
      <div className={styles.dots} role="tablist" aria-label="Slides">
        {srcs.map((_, i) => (
          <button
            key={i}
            role="tab"
            aria-selected={i === current}
            aria-label={`Go to slide ${i + 1}`}
            className={`${styles.dot} ${i === current ? styles.dotActive : ''}`}
            onClick={() => {
              if (rotating || i === current) return;
              const fwd   = ((i - current) % n + n) % n;
              const bwd   = n - fwd;
              const dir   = fwd <= bwd ? 1 : -1;
              const steps = Math.min(fwd, bwd);
              let step = 0;
              const chain = () => {
                if (step >= steps) return;
                step++;
                rotate(dir);
                setTimeout(chain, transitionMs + 50);
              };
              chain();
            }}
          />
        ))}
      </div>
    </div>
  );
}