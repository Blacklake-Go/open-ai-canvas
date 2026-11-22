'use client';

import React, { useRef, useEffect, useCallback, useState } from 'react';

// Authentic mathematical parameters reverse-engineered from Google Stitch
const GRID_STEP = 16;
const DOT_RADIUS = 1.0;
const INFLUENCE_RADIUS = 725;
const MAX_DISPLACEMENT = 28;
const SPRING_FACTOR = 0.035;
const NOISE_AMP = 6.0;
const NOISE_SCALE = 0.04;
const TIME_SPEED = 0.0008;

const BASE_COLOR = [68, 68, 68];
const AURORA_PURPLE = [96, 86, 240];
const AURORA_TEAL = [64, 217, 198];

// Perlin noise permutation table
const PERMUTATION = new Uint8Array(512);
{
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const n = (i * 2654435761 >>> 0) % (i + 1);
    const temp = p[i];
    p[i] = p[n];
    p[n] = temp;
  }
  for (let i = 0; i < 512; i++) PERMUTATION[i] = p[i & 255];
}

const GRADIENTS = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [0, 1], [0, -1]
];

function hermiteFade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a, b, t) {
  return a + t * (b - a);
}

function gradDot(hash, x, y) {
  const g = GRADIENTS[hash & 7];
  return g[0] * x + g[1] * y;
}

function perlin2D(x, y) {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);
  const u = hermiteFade(xf);
  const v = hermiteFade(yf);

  const aa = PERMUTATION[PERMUTATION[X] + Y];
  const ab = PERMUTATION[PERMUTATION[X] + Y + 1];
  const ba = PERMUTATION[PERMUTATION[X + 1] + Y];
  const bb = PERMUTATION[PERMUTATION[X + 1] + Y + 1];

  const x1 = lerp(gradDot(aa, xf, yf), gradDot(ba, xf - 1, yf), u);
  const x2 = lerp(gradDot(ab, xf, yf - 1), gradDot(bb, xf - 1, yf - 1), u);
  return lerp(x1, x2, v);
}

export default function StitchCanvasGrid({ className = '', opacity = 1, dotScale = 1.0 }) {
  const canvasRef = useRef(null);
  const pointsRef = useRef([]);
  const mouseRef = useRef(null);
  const animFrameRef = useRef(null);
  const sizeRef = useRef({ w: 0, h: 0 });
  const [mounted, setMounted] = useState(false);

  // Initialize point grid
  const initGrid = useCallback((width, height) => {
    const points = [];
    const cols = Math.ceil(width / GRID_STEP) + 1;
    const rows = Math.ceil(height / GRID_STEP) + 1;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const gx = c * GRID_STEP;
        const gy = r * GRID_STEP;
        points.push({ gx, gy, x: gx, y: gy });
      }
    }
    pointsRef.current = points;
    sizeRef.current = { w: width, h: height };
  }, []);

  // Main render loop
  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { w, h } = sizeRef.current;
    if (w === 0 || h === 0) return;

    ctx.clearRect(0, 0, w, h);

    const mouse = mouseRef.current;
    const points = pointsRef.current;
    const inflSq = INFLUENCE_RADIUS * INFLUENCE_RADIUS;
    const time = performance.now() * TIME_SPEED;
    const radius = DOT_RADIUS * dotScale;

    for (let i = 0; i < points.length; i++) {
      const pt = points[i];
      let targetX = pt.gx;
      let targetY = pt.gy;
      let influence = 0;

      if (mouse) {
        const dx = pt.gx - mouse.x;
        const dy = pt.gy - mouse.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < inflSq && distSq > 0) {
          const dist = Math.sqrt(distSq);
          influence = 1 - dist / INFLUENCE_RADIUS;
          const cubic = influence * influence * influence * MAX_DISPLACEMENT;

          targetX = pt.gx + (dx / dist) * cubic;
          targetY = pt.gy + (dy / dist) * cubic;

          const n1 = perlin2D(pt.gx * NOISE_SCALE, pt.gy * NOISE_SCALE + time);
          const n2 = perlin2D(pt.gx * NOISE_SCALE + 100, pt.gy * NOISE_SCALE + time);
          const pAmp = influence * influence * NOISE_AMP;

          targetX += n1 * pAmp;
          targetY += n2 * pAmp;
        }
      }

      // Spring inertia back to target
      pt.x += (targetX - pt.x) * SPRING_FACTOR;
      pt.y += (targetY - pt.y) * SPRING_FACTOR;

      let rColor = BASE_COLOR[0];
      let gColor = BASE_COLOR[1];
      let bColor = BASE_COLOR[2];
      let alpha = 1.0;

      // Bottom fade-out (lower 25% smooth drop)
      const fadeStart = h * 0.75;
      if (pt.gy > fadeStart) {
        alpha *= 1 - (pt.gy - fadeStart) / (h - fadeStart);
      }

      // Dynamic cursor aurora tinting
      if (mouse && influence > 0) {
        alpha *= 1 - influence * influence * 0.85;
        const angle = Math.atan2(pt.gy - mouse.y, pt.gx - mouse.x);
        const wave = (Math.sin(angle * 2 + time * 3) + 1) * 0.5;

        const tintR = lerp(AURORA_PURPLE[0], AURORA_TEAL[0], wave);
        const tintG = lerp(AURORA_PURPLE[1], AURORA_TEAL[1], wave);
        const tintB = lerp(AURORA_PURPLE[2], AURORA_TEAL[2], wave);

        const tintFactor = influence * influence;
        rColor = Math.round(lerp(BASE_COLOR[0], tintR, tintFactor));
        gColor = Math.round(lerp(BASE_COLOR[1], tintG, tintFactor));
        bColor = Math.round(lerp(BASE_COLOR[2], tintB, tintFactor));
      }

      if (alpha <= 0.001) continue;

      ctx.fillStyle = `rgba(${rColor},${gColor},${bColor},${(alpha * opacity).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [opacity, dotScale]);

  // Animation frame loop
  const loop = useCallback(() => {
    renderFrame();
    animFrameRef.current = requestAnimationFrame(loop);
  }, [renderFrame]);

  // Handle Resize and Retina DPR
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const handleResize = () => {
      const rect = parent.getBoundingClientRect();
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);

      if (w === 0 || h === 0) return;

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
      }
      initGrid(w, h);
    };

    const ro = new ResizeObserver(handleResize);
    ro.observe(parent);
    handleResize();

    return () => ro.disconnect();
  }, [initGrid]);

  // Mouse event listeners on window
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const handleMouseMove = (e) => {
      const rect = parent.getBoundingClientRect();
      if (
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom
      ) {
        mouseRef.current = null;
        return;
      }
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    const handleMouseLeave = () => {
      mouseRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseleave', handleMouseLeave, { passive: true });

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  // Animation lifecycle
  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(loop);
    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [loop]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 z-[1] ${className}`}
      style={{
        opacity: mounted ? 1 : 0,
        transition: 'opacity 1.2s ease-in',
      }}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
        }}
      />
    </div>
  );
}
