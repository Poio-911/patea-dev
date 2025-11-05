"use client";
import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import dynamic from 'next/dynamic';

// Dynamically load the high-fidelity WebGL shader backdrop (client-only)
const ShaderBackdrop = dynamic(() => import('./game-backdrop/shader-backdrop'), { ssr: false, loading: () => null });

/**
 * Canvas fallback (kept from original prototype). Runs when WebGL2 not available.
 */
const CanvasFallback: React.FC<{ active: boolean }> = ({ active }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const DPR = Math.min(window.devicePixelRatio || 1, 2); // clamp for perf
    const resize = () => {
      canvas.width = Math.floor(window.innerWidth * 0.5 * DPR); // render at half res then scale
      canvas.height = Math.floor(window.innerHeight * 0.5 * DPR);
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
    };
    resize();
    window.addEventListener('resize', resize);

    // Precompute a noise buffer
    const noise = new Uint8Array(canvas.width * canvas.height);
    for (let i = 0; i < noise.length; i++) {
      noise[i] = Math.random() * 255;
    }

    let t = 0;
    const render = () => {
      t += 0.002; // slow time
      // Fading background
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#0d141d';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const idx = (y * canvas.width + x);
          const n = noise[idx];
          // Diagonal energy modulation
          const diag = (x + y) / (canvas.width + canvas.height);
          const pulse = 0.5 + 0.5 * Math.sin((diag * 8) + t * 4);
          const accent = 0.4 + 0.6 * Math.sin(t + diag * 10);
          const base = (n / 255) * 0.25 + pulse * 0.15;

          const r = base * 18 + accent * 10; // subtle yellow infusion
          const g = base * 42 + accent * 18; // teal-ish
          const b = base * 58 + pulse * 12; // blue/cyan shadow
          const a = 255;
          const di = idx * 4;
          data[di] = r;
          data[di + 1] = g;
          data[di + 2] = b;
          data[di + 3] = a;
        }
      }
      ctx.putImageData(imgData, 0, 0);

      // Add streak overlay
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(170,255,90,0.05)';
      ctx.lineWidth = 2 * DPR;
      const streakCount = 8;
      for (let i = 0; i < streakCount; i++) {
        const offset = ((t * 20) + i * 40) % (canvas.height + 200) - 200;
        ctx.beginPath();
        ctx.moveTo(-50, offset);
        ctx.lineTo(canvas.width + 50, offset + canvas.width * 0.3);
        ctx.stroke();
      }

      // Soft vignette
      const grad = ctx.createRadialGradient(
        canvas.width / 2,
        canvas.height / 2,
        canvas.width * 0.1,
        canvas.width / 2,
        canvas.height / 2,
        canvas.width * 0.7
      );
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.35)');
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      rafRef.current = requestAnimationFrame(render);
    };
    rafRef.current = requestAnimationFrame(render);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={
        (() => {
          // debug override: add ?forceBackdrop=1 to URL to force visible backdrop during development
          const forced = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('forceBackdrop') === '1';
          const visible = active || forced;
          return `fixed inset-0 z-[-4] w-full h-full select-none pointer-events-none [image-rendering:pixelated] ${visible ? 'opacity-100' : 'opacity-0'}`;
        })()
      }
    />
  );
};

/**
 * GameModeBackdrop
 * Chooses the WebGL shader backdrop when supported, otherwise falls back to CPU canvas.
 */
export const GameModeBackdrop: React.FC = () => {
  const { theme } = useTheme();
  const [webglAvailable, setWebglAvailable] = useState(false);
  const [active, setActive] = useState<boolean>(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Detect WebGL2 availability
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2');
      setWebglAvailable(!!gl);
    } catch (e) {
      setWebglAvailable(false);
    }
  }, []);

  // Sync active state with next-themes hook and with html.classList (console/manual toggles)
  useEffect(() => {
    // mark mounted so we don't render on server
    setMounted(true);
    if (theme === 'game') {
      setActive(true);
      return;
    }
    if (typeof document !== 'undefined') {
      setActive(document.documentElement.classList.contains('game'));
    } else {
      setActive(false);
    }
  }, [theme]);
  // Avoid rendering anything during SSR or before client mount to prevent hydration mismatches.
  if (!mounted) return null;

  return (
    <>
      {active && webglAvailable ? (
        // High-fidelity shader-backed backdrop
        <ShaderBackdrop />
      ) : (
        // Canvas2D fallback
        <CanvasFallback active={active} />
      )}
    </>
  );
};
