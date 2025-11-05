"use client";
import React, { useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';

/**
 * GameModeBackdrop
 * Canvas procedural background: low-res noise + diagonal energy streak + soft color ramps.
 * Phase 1 prototype (no OffscreenCanvas yet). Designed to be visually distinct vs pure CSS.
 */
export const GameModeBackdrop: React.FC = () => {
  const { theme } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
  if (theme !== 'game') return; // Only run animation logic in game theme
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
  }, []);

  // Hide canvas when not in game theme
  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={"fixed inset-0 z-[-4] w-full h-full select-none pointer-events-none [image-rendering:pixelated] " + (theme === 'game' ? 'opacity-100' : 'opacity-0')}
    />
  );
};
