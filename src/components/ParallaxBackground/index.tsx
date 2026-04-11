/**
 * ParallaxBackground
 *
 * Renders a theme-aware parallax scene:
 *   dark mode  → retro pixel-art night cityscape
 *   light mode → sunny rolling hills with river and trees
 *
 * Both scenes use five SVG layers shifted at different rates on
 * scroll + mouse-move. Snaps to 2-px grid for pixel-art feel.
 */

import type { ReactNode } from 'react';
import React, { useEffect, useRef, useCallback, useState } from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import styles from './styles.module.css';

import type { OpeningHours } from '@site/docusaurus.config';

const FACTORS = [0.02, 0.05, 0.09, 0.14, 0.20];
const snap = (n: number, grid = 2) => Math.round(n / grid) * grid;

// Deterministic LCG random — same sequence every render
function makeLCG(seed: number) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
}

// Returns { hour, day } in the given IANA timezone, derived from UTC
// so the result is consistent for all visitors regardless of their locale.
function getNowIn(timezone: string): { hour: number; day: number } {
    const now = new Date();
    const hour = parseInt(
      new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: 'numeric', hour12: false }).format(now),
      10,
    );
    // 'en-GB' weekday: 'long' gives e.g. "Monday" — we need the JS day number
    // (0=Sun … 6=Sat), so we use 'en-US' numeric which gives "1"–"7" (Sun=1).
    const dayStr = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' }).format(now);
    const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return { hour, day: dayMap[dayStr] ?? now.getDay() };
}
   
function checkIsOpen(oh: OpeningHours): boolean {
    const { hour, day } = getNowIn(oh.timezone);
    return oh.openDays.includes(day) && hour >= oh.openHour && hour < oh.closeHour;
}

export default function ParallaxBackground(): ReactNode {
  const layerRefs = useRef<(SVGGElement | null)[]>([]);
  const [dark, setDark] = useState(false);

  // Detect theme
  useEffect(() => {
    const check = () => setDark(document.documentElement.getAttribute('data-theme') === 'dark');
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  const applyOffsets = useCallback((scrollY: number, mouseX: number, mouseY: number) => {
    const cx = (mouseX / window.innerWidth  - 0.5) * 60;
    const cy = (mouseY / window.innerHeight - 0.5) * 30;
    FACTORS.forEach((f, i) => {
      const el = layerRefs.current[i];
      if (!el) return;
      el.style.transform = `translate(${snap(-cx * f)}px,${snap(-scrollY * f - cy * f)}px)`;
    });
  }, []);

  useEffect(() => {
    let lastScroll = window.scrollY;
    let lastMX = window.innerWidth / 2;
    let lastMY = window.innerHeight / 2;
    let rafId: number;
    const schedule = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => applyOffsets(lastScroll, lastMX, lastMY));
    };
    const onScroll = () => { lastScroll = window.scrollY; schedule(); };
    const onMouse  = (e: MouseEvent) => { lastMX = e.clientX; lastMY = e.clientY; schedule(); };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('mousemove', onMouse, { passive: true });
    applyOffsets(lastScroll, lastMX, lastMY);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('mousemove', onMouse);
      cancelAnimationFrame(rafId);
    };
  }, [applyOffsets]);

  const setRef = (i: number) => (el: SVGGElement | null) => { layerRefs.current[i] = el; };

  return (
    <div className={styles.root} aria-hidden="true">
      <svg
        className={styles.svg}
        viewBox="0 0 1440 600"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* ── Shared gradients ── */}
          <linearGradient id="pb-sky-night" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#050d1a" />
            <stop offset="60%"  stopColor="#071a2e" />
            <stop offset="100%" stopColor="#0a2a1e" />
          </linearGradient>
          <linearGradient id="pb-sky-day" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#87ceeb" />
            <stop offset="70%"  stopColor="#c8e8f8" />
            <stop offset="100%" stopColor="#d4f0c8" />
          </linearGradient>
          <radialGradient id="pb-moon-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#e8ffd6" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#e8ffd6" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="pb-sun-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#fff7a0" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#fff7a0" stopOpacity="0" />
          </radialGradient>
          {/* River gradient */}
          <linearGradient id="pb-river" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#4ab8d8" />
            <stop offset="100%" stopColor="#2a8aaa" />
          </linearGradient>
          {/* River shimmer */}
          <linearGradient id="pb-river-shimmer" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="rgba(255,255,255,0)" />
            <stop offset="40%"  stopColor="rgba(255,255,255,0.35)" />
            <stop offset="60%"  stopColor="rgba(255,255,255,0.35)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>

          {/* ── Filters ── */}
          <filter id="pb-bloom" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="pb-soft" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="pb-neon-green" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="pb-neon-pink" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>

          {/* CRT scanlines (night only) */}
          <pattern id="pb-scanlines" x="0" y="0" width="1" height="4" patternUnits="userSpaceOnUse">
            <rect x="0" y="2" width="1440" height="2" fill="rgba(0,0,0,0.10)" />
          </pattern>

          {/* ── Turtle shading ── */}
          {/* Drop shadow cast by the turtle body */}
          <filter id="pb-turtle-shadow" x="-15%" y="-15%" width="140%" height="140%">
            <feDropShadow dx="3" dy="4" stdDeviation="4" floodColor="#000d08" floodOpacity="0.7" />
          </filter>
        </defs>

        {/* Sky */}
        <rect width="1440" height="600" fill={dark ? "url(#pb-sky-night)" : "url(#pb-sky-day)"} />

        {dark ? (
          <>
            <g ref={setRef(0)} className={styles.layer}><Stars /></g>
            <g ref={setRef(1)} className={styles.layer}><Moon /></g>
            <g ref={setRef(2)} className={styles.layer}><FarCity /></g>
            <g ref={setRef(3)} className={styles.layer}><MidCity /></g>
            <g ref={setRef(4)} className={styles.layer}><CloseRooftop /></g>
            <rect width="1440" height="600" fill="url(#pb-scanlines)" style={{ pointerEvents: 'none' }} />
          </>
        ) : (
          <>
            <g ref={setRef(0)} className={styles.layer}><Clouds /></g>
            <g ref={setRef(1)} className={styles.layer}><Sun /></g>
            <BunBrush x={965} y={30} size={180} />
            <g ref={setRef(2)} className={styles.layer}><FarHills /></g>
            <g ref={setRef(3)} className={styles.layer}><MidHills /></g>
            <g ref={setRef(4)} className={styles.layer} />
          </>
        )}
      </svg>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// NIGHT SCENE
// ═══════════════════════════════════════════════════════════════════════════

function Stars() {
  const rand = makeLCG(42);
  const stars = Array.from({ length: 180 }, () => ({
    x: Math.floor(rand() * 1440),
    y: Math.floor(rand() * 360),
    r: rand() < 0.15 ? 2 : 1,
    o: 0.4 + rand() * 0.6,
  }));
  return (
    <g>
      {stars.map((st, i) => (
        <rect key={i} x={st.x} y={st.y} width={st.r} height={st.r}
          fill="#d0ffd0" opacity={st.o}
          className={i % 3 === 0 ? styles.starTwinkle : i % 3 === 1 ? styles.starTwinkleSlow : undefined}
        />
      ))}
    </g>
  );
}

function Moon() {
  return (
    <g>
      <circle cx="1100" cy="110" r="120" fill="url(#pb-moon-glow)" />
      <circle cx="1100" cy="110" r="42"  fill="#dff5c8" filter="url(#pb-bloom)" />
      <circle cx="1100" cy="110" r="40"  fill="#e8f8d0" />
      <rect x="1090" y="100" width="6" height="6" fill="#c8e8b0" rx="1" />
      <rect x="1108" y="118" width="4" height="4" fill="#c8e8b0" rx="1" />
      <rect x="1082" y="116" width="8" height="8" fill="#c8e8b0" rx="1" />
      <rect x="0" y="380" width="1440" height="40" fill="rgba(20,80,50,0.15)" />
    </g>
  );
}

function FarCity() {
  const buildings: [number, number, number][] = [
    [0,90,180],[80,60,140],[130,110,220],[220,50,160],[260,80,200],
    [320,55,130],[360,100,250],[440,70,170],[490,90,190],[560,60,150],
    [600,120,230],[700,80,200],[760,50,120],[790,100,260],[870,70,180],
    [920,90,210],[990,60,150],[1030,110,240],[1120,75,170],[1170,90,200],
    [1240,60,130],[1280,100,220],[1360,80,180],
  ];
  return (
    <g fill="#081420">
      {buildings.map(([x, w, h], i) => (
        <g key={i}>
          <rect x={x} y={600 - h} width={w} height={h} />
          {i % 3 === 0 && <rect x={x + w/2 - 1} y={600 - h - 20} width={2} height={20} />}
          {i % 2 === 0 && h > 160 && (
            <g opacity="0.5">
              <rect x={x+10} y={600-h+30} width={4} height={4} fill="#ffcc66" />
              <rect x={x+20} y={600-h+50} width={4} height={4} fill="#ffcc66" />
              <rect x={x+w-20} y={600-h+40} width={4} height={4} fill="#ffcc66" />
            </g>
          )}
        </g>
      ))}
    </g>
  );
}

/** Windows helper — deterministic lit/dim grid */
interface WinProps { x:number;y:number;cols:number;rows:number;gap:number;ww:number;wh:number;litColor:string;litChance:number; }
function Windows({ x, y, cols, rows, gap, ww, wh, litColor, litChance }: WinProps) {
  const flickerClasses = [styles.winFlicker, styles.winFlickerB, styles.winFlickerC];
  const els = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const seed = Math.abs((x * 7 + y * 13 + c * 31 + r * 17)) % 100;
      const lit  = (seed / 100) < litChance;
      if (!lit) continue;
      els.push(
        <rect key={`${r}-${c}`}
          x={x + c * (ww + gap)} y={y + r * (wh + gap)}
          width={ww} height={wh}
          fill={litColor}
          opacity={0.6 + (seed % 4) * 0.1}
          className={seed % 4 === 0 ? flickerClasses[seed % 3] : undefined}
        />
      );
    }
  }
  return <g>{els}</g>;
}

interface NeonProps { x:number;y:number;text:string;color:string;size:number;filterId:string;className?:string; }
function NeonSign({ x, y, text, color, size, filterId, className }: NeonProps) {
  return (
    <text x={x} y={y} fontFamily="monospace" fontSize={size} fill={color}
      filter={`url(#${filterId})`} letterSpacing="2" className={className}>
      {text}
    </text>
  );
}

function MidCity() {
  const { siteConfig } = useDocusaurusContext();
  // Evaluate against the opening hours defined in docusaurus.config.ts.
  const openingHours = siteConfig.customFields?.openingHours as OpeningHours;
  const [isOpen, setIsOpen] = useState(() => checkIsOpen(openingHours));

  return (
    <g>
      {/* ── Building A ── */}
      <rect x="-20" y="300" width="200" height="300" fill="#0b1c14" />
      <rect x="-20" y="300" width="200" height="8"   fill="#0f2a1c" />
      <Windows x={-10} y={316} cols={4} rows={6} gap={10} ww={14} wh={10} litColor="#ffe890" litChance={0.45} />
      <NeonSign x={20} y={422} text="HF" color="#39ff8a" size={22} filterId="pb-neon-green" className={styles.neonHF} />
      {/* HF road spill — green glow pooling on the ground */}
      <rect x="-10" y="536" width="160" height="8" rx="4"
        fill="rgba(57,255,138,0.18)" className={styles.spillHF} />

      {/* ── Building B ── */}
      <rect x="200" y="240" width="120" height="360" fill="#091912" />
      <rect x="200" y="240" width="120" height="6"   fill="#0e2a1a" />
      <Windows x={210} y={256} cols={3} rows={8} gap={10} ww={12} wh={8} litColor="#c8f0ff" litChance={0.35} />
      <NeonSign x={212} y={430} text="❤️Retro❤️" color="#ff4da6" size={16} filterId="pb-neon-pink" className={styles.neon24H} />
      {/* 24H road spill — pink */}
      <rect x="202" y="536" width="116" height="8" rx="4"
        fill="rgba(255,77,166,0.16)" className={styles.spill24H} />

      {/* ── Building C (wide, with setback) ── */}
      <rect x="340" y="260" width="220" height="340" fill="#0c1e16" />
      <rect x="340" y="260" width="220" height="10"  fill="#112a1e" />
      <rect x="390" y="200" width="120" height="62"  fill="#0e2218" />
      <Windows x={350} y={278} cols={6} rows={7} gap={9} ww={14} wh={9} litColor="#fff4b0" litChance={0.5} />
      <Windows x={398} y={212} cols={3} rows={4} gap={9} ww={14} wh={9} litColor="#fff4b0" litChance={0.6} />
      <rect x="449" y="182" width="2" height="20" fill="#1a3028" />
      <circle cx="450" cy="182" r="3" fill="#ff3333" className={styles.blinkRed} />

      {/* ── Building D ── */}
      <rect x="580" y="310" width="160" height="290" fill="#091610" />
      <Windows x={590} y={322} cols={4} rows={6} gap={9} ww={13} wh={9} litColor="#b8ffee" litChance={0.4} />
      <NeonSign x={592} y={455} text="Fun 4 Everyone" color="#00ffcc" size={14} filterId="pb-neon-green" className={styles.neonGame} />
      {/* GAME road spill — teal */}
      <rect x="582" y="536" width="148" height="8" rx="4"
        fill="rgba(0,255,204,0.15)" className={styles.spillGame} />

      {/* ── Building E (far right) ── */}
      <rect x="1160" y="280" width="180" height="320" fill="#0b1c14" />
      <rect x="1160" y="280" width="180" height="8"   fill="#0f2a1c" />
      <Windows x={1170} y={296} cols={4} rows={7} gap={10} ww={14} wh={9} litColor="#ffe890" litChance={0.45} />
      <NeonSign x={1178} y={436} text={isOpen ? "OPEN" : "CLOSED"} color="#ff4da6" size={15} filterId="pb-neon-pink" className={styles.neonOpen} />
      {/* OPEN road spill — pink */}
      <rect x="1162" y="536" width="176" height="8" rx="4"
        fill="rgba(255,77,166,0.16)" className={styles.spillOpen} />

      {/* ── Building F ── */}
      <rect x="1320" y="320" width="140" height="280" fill="#091912" />
      <Windows x={1330} y={334} cols={3} rows={5} gap={10} ww={14} wh={10} litColor="#c8f0ff" litChance={0.35} />

      {/* Ground + road */}
      <rect x="0" y="540" width="1440" height="60" fill="#050f0a" />
      {[100,260,420,580,740,900,1060,1220].map((x, i) => (
        <rect key={i} x={x} y={558} width={60} height={4} fill="#1a3028" rx="1" />
      ))}
    </g>
  );
}

/**
 * Rooftop layer — all details sit ON the parapet surface (y≥480).
 * Ferret is positioned so its paw bottoms land at y=480 (parapet top).
 */
function CloseRooftop() {
  return (
    <g>
      {/* Left parapet block */}
      <rect x="-40" y="480" width="540" height="120" fill="#020a07" />
      <rect x="-40" y="476" width="540" height="6"   fill="#112018" />

      {/* Right parapet block */}
      <rect x="940" y="480" width="540" height="120" fill="#020a07" />
      <rect x="940" y="476" width="540" height="6"   fill="#112018" />

      {/* HVAC unit — sits ON the parapet (top at y=480, extends upward) */}
      <rect x="60"  y="450" width="64" height="30" fill="#0d1e12" rx="2" />
      <rect x="60"  y="450" width="64" height="5"  fill="#162a1a" />
      {[65,75,85,95,105,115].map((x, i) => (
        <rect key={i} x={x} y={456} width={4} height={20} fill="#0a1610" />
      ))}

      {/* Exhaust stack */}
      <rect x="164" y="458" width="10" height="22" fill="#0d1e12" />
      <rect x="160" y="454" width="18" height="6"  fill="#162a1a" rx="1" />

      {/* Small vent box */}
      <rect x="204" y="462" width="44" height="18" fill="#0d1e12" rx="1" />
      <rect x="204" y="462" width="44" height="4"  fill="#162a1a" rx="1" />

      {/* ── Street lamp — x≈165, base at y=600 (ground level) ─────────────
          Pole, arm, housing, and bulb/glow all rendered here.
          The bulb + ground pool use styles.turtleFace so they flicker in
          exact lockstep with the turtle face reveal (same keyframe+duration). */}

      {/* Pole */}
      <rect x="163" y="380" width="4" height="120" fill="#0e1f14" />
      {/* Horizontal arm extending right toward the turtle */}
      <rect x="163" y="380" width="28" height="3"  fill="#0e1f14" />
      {/* Lamp housing (small box at end of arm) */}
      <rect x="186" y="374" width="10" height="9"  fill="#162a1a" rx="1" />
      <rect x="187" y="382" width="8"  height="3"  fill="#0a1610" rx="1" />

      {/* Bulb — off by default, flickers on with turtleFace */}
      <circle cx="191" cy="378" r="3"
        fill="#c8ffd0"
        className={styles.turtleFace}
      />
      {/* Soft green glow halo around the bulb */}
      <circle cx="191" cy="378" r="8"
        fill="rgba(80,255,140,0.18)"
        className={styles.turtleFace}
      />
      {/* Ground pool of light cast below the lamp */}
      <ellipse cx="220" cy="500" rx="22" ry="6"
        fill="rgba(80,255,140,0.10)"
        className={styles.turtleFace}
      />

      <Turtle x={250} y={520} />

      {/* Right HVAC */}
      <rect x="1060" y="452" width="58" height="28" fill="#0d1e12" rx="2" />
      <rect x="1060" y="452" width="58" height="5"  fill="#162a1a" />
      {[1065,1075,1085,1095,1105,1115].map((x, i) => (
        <rect key={i} x={x} y={458} width={4} height={18} fill="#0a1610" />
      ))}

      {/* Right vent */}
      <rect x="1204" y="464" width="38" height="16" fill="#0d1e12" rx="1" />
    </g>
  );
}

/**
 * Turtle — sitting on the parapet, silhouetted at night.
 *
 * Rendering layers (back to front):
 *   1. Ground contact shadow ellipse
 *   2. turtle-silhouette.svg — the body outline always visible as a dark shape
 *   3. turtle-clean.svg — full-colour art, clipped to just the face/head region,
 *      animated with turtleFace (opacity 0 at rest → 1 when HF neon flickers on)
 *
 * The clip rect maps the face area (x=60–205, y=78–143 in the 270×347 viewBox)
 * into the component's display coordinate space.
 *
 * x, y = bottom-centre of the sprite (feet on the parapet).
 */
function Turtle({ x, y }: { x: number; y: number }) {
  const W = 55;                          // display width in SVG units
  const H = Math.round(347 / 270 * W);  // ≈ 116 — preserves 270×347 aspect ratio
  const ix = x - W / 2;                 // image left edge (centred on x)
  const iy = y - H;                     // image top edge (bottom lands at y)

  // Face region in the 270×347 viewBox → scale to display size
  const scaleX = W / 270;
  const scaleY = H / 347;

  // Diagonal clip polygon — four points that form a parallelogram-style slash
  // across the face. Runs from upper-left of the head down to lower-right,
  // revealing roughly the left half of the face and part of the neck/body.
  // All coordinates in display (component) space.
  const toX = (vx: number) => ix + vx * scaleX;
  const toY = (vy: number) => iy + vy * scaleY;

  // Viewbox anchor points (270×347 space):
  //   top-left  of head: (55, 75)   top-right of head:  (210, 75)
  //   diagonal cuts from top-left corner diagonally to bottom-right,
  //   so the left side of the face + a wedge of the neck is revealed.
  //   The four polygon corners (in viewBox coords):
  //     A = (55,  75)  — top-left  of clip zone
  //     B = (210, 75)  — top-right (upper edge stays flat)
  //     C = (120, 200) — lower-right (diagonal slices across)
  //     D = (55,  200) — lower-left  (left edge stays vertical)
  const poly = [
    `${toX(55)},${toY(75)}`,
    `${toX(210)},${toY(75)}`,
    `${toX(120)},${toY(200)}`,
    `${toX(55)},${toY(200)}`,
  ].join(' ');

  // Unique clip-path ID — static since there's only ever one turtle
  const clipId = 'pb-turtle-face-clip';

  return (
    <g>
      {/* Inline defs: clipPath with diagonal polygon */}
      <defs>
        <clipPath id={clipId}>
          <polygon points={poly} />
        </clipPath>
      </defs>

      {/* 1. Ground contact shadow */}
      <ellipse cx={x} cy={y + 3} rx={W * 0.48} ry={5}
        fill="rgba(0,0,0,0.50)" />

      {/* 2. Silhouette — always visible, matches the dark night background */}
      <image
        href="/img/turtle-silhouette.svg"
        x={ix} y={iy}
        width={W} height={H}
        filter="url(#pb-turtle-shadow)"
      />

      {/* 3. Face reveal — full-colour image clipped to head region only,
              invisible at rest, briefly flickers visible with the HF sign */}
      <image
        href="/img/turtle-clean.svg"
        x={ix} y={iy}
        width={W} height={H}
        clipPath={`url(#${clipId})`}
        className={styles.turtleFace}
      />
    </g>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DAY / LIGHT MODE SCENE
// Hill colours from distant (pale) to close (saturated)
// ═══════════════════════════════════════════════════════════════════════════

function Sun() {
  return (
    <g>
      <circle cx="260" cy="100" r="130" fill="url(#pb-sun-glow)" />
      <circle cx="260" cy="100" r="54" fill="#fffbe0" filter="url(#pb-bloom)" />
      <circle cx="260" cy="100" r="50" fill="#fff7a0" />
      {/* Pixel sunrays */}
      {[0,45,90,135,180,225,270,315].map((deg, i) => {
        const rad = deg * Math.PI / 180;
        return (
          <rect key={i}
            x={260 + Math.cos(rad) * 62 - 2}
            y={100 + Math.sin(rad) * 62 - 2}
            width={6} height={6}
            fill="#fff0a0" rx="1"
          />
        );
      })}
    </g>
  );
}

/**
 * BunBrush — pixel-art character that floats gently in the sky.
 *
 * Animation is driven by a single requestAnimationFrame loop so it
 * composes with the parallax system without triggering React re-renders.
 *
 * Motion layers:
 *   • Vertical bob   — sin-wave, ±8 SVG units, period ≈ 4 s
 *   • Tilt           — slight rotation that leads the bob by ~90°
 *                      (leans forward on the way up, back on the way down)
 *   • Shadow         — ellipse below the character that squishes and fades
 *                      when the character is at the top of its arc
 *
 * x/y = top-left of the sprite at rest; size = sprite width/height (1:1).
 */
function BunBrush({ x, y, size }: { x: number; y: number; size: number }) {
  const groupRef  = useRef<SVGGElement | null>(null);
  const shadowRef = useRef<SVGEllipseElement | null>(null);
  const rafRef    = useRef<number>(0);

  // Bob parameters
  const BOB_AMP    = 8;          // px vertical travel (half-range)
  const BOB_PERIOD = 4000;       // ms for one full cycle
  const TILT_AMP   = 2.5;        // degrees of rotation
  const CX         = x + size / 2; // horizontal centre (for transform-origin)

  // Shadow sits just below the sprite's rest position
  const SHADOW_CY  = y + size + 6;
  const SHADOW_RX  = size * 0.30;
  const SHADOW_RY  = 5;

  useEffect(() => {
    const animate = (t: number) => {
      const phase = (t % BOB_PERIOD) / BOB_PERIOD; // 0 → 1
      const sin   = Math.sin(phase * Math.PI * 2);      // −1 → 1
      const cos   = Math.cos(phase * Math.PI * 2);      // leads sin by 90°

      const bobY  = -sin * BOB_AMP;         // negative = up
      const tilt  = cos * TILT_AMP;         // cos leads sin → leans forward on ascent

      // Snap bob to 1-px grid for pixel-art feel (keep tilt smooth)
      const snappedY = Math.round(bobY);

      if (groupRef.current) {
        groupRef.current.style.transform =
          `translate(0px, ${snappedY}px) rotate(${tilt.toFixed(2)}deg)`;
        // transform-origin must be set inline for SVG elements
        groupRef.current.style.transformOrigin = `${CX}px ${y + size * 0.55}px`;
      }

      if (shadowRef.current) {
        // Shadow shrinks and fades when character is high (bobY negative = up)
        const t01 = (sin + 1) / 2;                       // 0 when up, 1 when down
        const scaleX = 0.6 + t01 * 0.4;                  // 0.6 → 1.0
        const opacity = (0.18 + t01 * 0.22).toFixed(3);  // 0.18 → 0.40
        shadowRef.current.setAttribute('rx', String((SHADOW_RX * scaleX).toFixed(1)));
        shadowRef.current.setAttribute('opacity', opacity);
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [x, y, size, BOB_AMP, BOB_PERIOD, TILT_AMP, CX]);

  return (
    <>
      {/* Ground shadow — rendered behind the character */}
      <ellipse
        ref={shadowRef}
        cx={CX}
        cy={SHADOW_CY}
        rx={SHADOW_RX}
        ry={SHADOW_RY}
        fill="rgba(60,120,60,0.30)"
      />

      {/* Character — wrapped in a <g> so the RAF loop can drive transform */}
      <g ref={groupRef}>
        <image
          href="/img/bunbrush.svg"
          x={x}
          y={y}
          width={size}
          height={size}
        />
      </g>
    </>
  );
}

function Clouds() {
  const clouds = [
    { x: 80,  y: 60,  scale: 1.0 },
    { x: 380, y: 40,  scale: 0.7 },
    { x: 650, y: 80,  scale: 1.2 },
    { x: 950, y: 55,  scale: 0.85 },
    { x:1200, y: 70,  scale: 0.9 },
  ];
  return (
    <g>
      {clouds.map((c, i) => (
        <Cloud key={i} x={c.x} y={c.y} scale={c.scale}
          className={i % 2 === 0 ? styles.cloudDrift : styles.cloudDriftSlow} />
      ))}
    </g>
  );
}

function Cloud({ x, y, scale, className }: { x:number;y:number;scale:number;className?:string }) {
  const s = scale;
  return (
    <g transform={`translate(${x},${y}) scale(${s})`} className={className}>
      {/* Pixel cloud puffs */}
      <rect x="0"   y="24" width="40" height="24" fill="white" opacity="0.9" rx="4" />
      <rect x="16"  y="12" width="40" height="28" fill="white" opacity="0.95" rx="4" />
      <rect x="44"  y="20" width="32" height="24" fill="white" opacity="0.88" rx="4" />
      <rect x="8"   y="18" width="28" height="16" fill="white" opacity="0.9"  rx="3" />
      <rect x="60"  y="16" width="20" height="14" fill="white" opacity="0.85" rx="3" />
    </g>
  );
}

/** Distant pale hills */
function FarHills() {
  return (
    <g>
      {/* Continuous rolling hill silhouette as overlapping ellipses */}
      <ellipse cx="100"  cy="520" rx="250" ry="140" fill="#a8d88a" opacity="0.6" />
      <ellipse cx="380"  cy="540" rx="300" ry="120" fill="#b0dc90" opacity="0.6" />
      <ellipse cx="680"  cy="510" rx="280" ry="150" fill="#a4d488" opacity="0.6" />
      <ellipse cx="980"  cy="530" rx="310" ry="130" fill="#acd88c" opacity="0.6" />
      <ellipse cx="1260" cy="515" rx="270" ry="145" fill="#a8d48a" opacity="0.6" />
      <ellipse cx="1480" cy="535" rx="260" ry="125" fill="#b0dc90" opacity="0.6" />
      {/* Fill bottom */}
      <rect x="0" y="540" width="1440" height="60" fill="#9ccc80" opacity="0.6" />
    </g>
  );
}

/** Mid-ground hills with river and trees */
function MidHills() {
  return (
    <g>
      {/* Hill shapes */}
      <ellipse cx="0"    cy="560" rx="300" ry="160" fill="#5aaa3c" />
      <ellipse cx="360"  cy="580" rx="340" ry="150" fill="#4e9e34" />
      <ellipse cx="720"  cy="555" rx="320" ry="165" fill="#56a63a" />
      <ellipse cx="1080" cy="575" rx="350" ry="155" fill="#4e9e34" />
      <ellipse cx="1440" cy="560" rx="300" ry="160" fill="#5aaa3c" />
      <rect x="0" y="560" width="1440" height="40" fill="#4e9e34" />

      {/* River — flows across the valley floor, staying below the hilltops.
          Starts off the left edge, winds gently right, exits bottom-right.
          All y-values kept ≥ 490 so the river stays on the ground. */}
      <path
        d="M -40 560 Q 200 548 400 538 Q 560 530 680 520 Q 800 512 960 518 Q 1100 524 1300 534 Q 1380 538 1480 545"
        stroke="url(#pb-river)" strokeWidth="36" fill="none" strokeLinecap="round"
      />
      {/* River shimmer */}
      <path
        d="M -40 560 Q 200 548 400 538 Q 560 530 680 520 Q 800 512 960 518 Q 1100 524 1300 534 Q 1380 538 1480 545"
        stroke="url(#pb-river-shimmer)" strokeWidth="20" fill="none" strokeLinecap="round"
        className={styles.riverShimmer}
      />
      {/* River banks */}
      <path
        d="M -40 548 Q 200 536 400 526 Q 560 518 680 508 Q 800 500 960 506 Q 1100 512 1300 522 Q 1380 526 1480 533"
        stroke="#3d7a28" strokeWidth="5" fill="none"
      />
      <path
        d="M -40 572 Q 200 560 400 550 Q 560 542 680 532 Q 800 524 960 530 Q 1100 536 1300 546 Q 1380 550 1480 557"
        stroke="#3d7a28" strokeWidth="5" fill="none"
      />
      {/* Pebbles along bank */}
      {[
        [120,552],[280,544],[440,535],[600,526],[740,518],
        [880,516],[1020,521],[1160,528],[1300,535],
      ].map(([px,py],i) => (
        <ellipse key={i} cx={px} cy={py} rx={5} ry={3} fill="#c8b89a" opacity="0.7" />
      ))}

      {/* Apple trees (left cluster) */}
      <PixelTree x={100} y={380} type="apple" />
      <PixelTree x={200} y={400} type="apple" />
      <PixelTree x={160} y={460} type="apple" />

      {/* Cherry trees (right cluster) */}
      <PixelTree x={860} y={470} type="cherry" />
      <PixelTree x={960} y={490} type="cherry" />
      <PixelTree x={910} y={465} type="cherry" />

      {/* Scattered singles */}
      <PixelTree x={1100} y={500} type="apple" />
      <PixelTree x={300}  y={510} type="cherry" />
    </g>
  );
}

/** Close foreground meadow strip */
function ForegroundMeadow() {
  const rand = makeLCG(99);
  // Tall grass tufts
  const tufts = Array.from({ length: 60 }, () => ({
    x: Math.floor(rand() * 1440),
    h: 10 + Math.floor(rand() * 20),
    w: 4 + Math.floor(rand() * 4),
  }));

  return (
    <g>
      {/* Solid ground */}
      <rect x="0" y="550" width="1440" height="50" fill="#2e7a1a" />
      <rect x="0" y="546" width="1440" height="6"  fill="#38921e" />

      {/* Grass tufts */}
      {tufts.map((t, i) => (
        <rect key={i} x={t.x} y={550 - t.h} width={t.w} height={t.h}
          fill={i % 3 === 0 ? "#3da020" : i % 3 === 1 ? "#48b828" : "#56cc30"}
          rx="1"
        />
      ))}

      {/* Wildflowers */}
      {[80,200,340,490,620,780,920,1080,1220,1380].map((fx, i) => (
        <g key={i}>
          <rect x={fx}   y={542} width={2} height={10} fill="#3da020" />
          <rect x={fx-3} y={538} width={8} height={6}
            fill={i%3===0?"#ff6b6b":i%3===1?"#ffd93d":"#ff9ff3"} rx="2" />
        </g>
      ))}

      {/* Foreground single trees */}
      <PixelTree x={-10} y={490} type="apple"  scale={1.3} />
      <PixelTree x={1350} y={485} type="cherry" scale={1.3} />
    </g>
  );
}

/** Pixel-art tree — apple (green canopy, red fruits) or cherry (pink blossom) */
function PixelTree({ x, y, type, scale = 1 }: { x:number;y:number;type:"apple"|"cherry";scale?:number }) {
  const trunkColor  = "#5c3a1e";
  const leafColor   = type === "apple" ? "#2d8a20" : "#d44a7a";
  const leafColor2  = type === "apple" ? "#38a828" : "#e86090";
  const fruitColor  = type === "apple" ? "#e03030" : "#ff80b0";
  const s = scale;

  // All coordinates relative to (x,y), then scaled
  const T = (dx:number,dy:number,w:number,h:number,fill:string) => (
    <rect
      x={x + dx*s} y={y + dy*s}
      width={w*s}   height={h*s}
      fill={fill} rx={w*s > 10 ? 2 : 0}
    />
  );

  return (
    <g>
      {T(14, 30, 8, 40, trunkColor)}              {/* trunk */}
      {T(6,  30, 24, 8, trunkColor)}              {/* lower branch splay */}
      {/* Canopy — layered ellipse-ish using rects */}
      {T(0,  10, 36, 28, leafColor)}
      {T(-4,  4, 44, 20, leafColor2)}
      {T(4,  -2, 28, 18, leafColor)}
      {T(8,  -8, 20, 12, leafColor2)}
      {/* Fruits / blossoms */}
      {[[4,14],[20,8],[30,12],[12,20],[26,20]].map(([dx,dy],i) => (
        <rect key={i} x={x+(dx)*s} y={y+(dy)*s} width={4*s} height={4*s}
          fill={fruitColor} rx={2*s} />
      ))}
    </g>
  );
}