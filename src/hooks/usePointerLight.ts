"use client";
import { useEffect, useRef } from 'react';

/**
 * usePointerLight
 * Attaches pointer move listener to a ref element and updates CSS custom properties
 * --px / --py (percentage) for a radial highlight layer.
 */
export function usePointerLight<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handle = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      el.style.setProperty('--px', x.toFixed(2) + '%');
      el.style.setProperty('--py', y.toFixed(2) + '%');
    };
    el.addEventListener('pointermove', handle);
    el.addEventListener('pointerleave', () => {
      el.style.setProperty('--px', '50%');
      el.style.setProperty('--py', '50%');
    });
    return () => {
      el.removeEventListener('pointermove', handle);
    };
  }, []);
  return ref;
}
