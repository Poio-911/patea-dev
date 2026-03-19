'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

export function GameModeBackground() {
  const [bgIndex, setBgIndex] = useState<number | null>(null);

  useEffect(() => {
    // Pick a random image from fondo_1 to fondo_9
    setBgIndex(Math.floor(Math.random() * 9) + 1);
  }, []);

  if (!bgIndex) return <div className="fixed inset-0 bg-[#020617] -z-10" />;

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none bg-[#020617]">
      <div className="absolute inset-0 opacity-40">
        <Image
          src={`/images/backgrounds/fondo_${bgIndex}.jpg`}
          alt="Game Background"
          fill
          className="object-cover"
          priority
          style={{
            filter: 'brightness(0.7) contrast(1.1) saturate(1.2)',
          }}
        />
      </div>
      {/* Overlay gradient for better contrast and depth */}
      <div className="absolute inset-0 bg-gradient-to-b from-blue-950/40 via-transparent to-blue-950/60" />
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-background/80" />
    </div>
  );
}
