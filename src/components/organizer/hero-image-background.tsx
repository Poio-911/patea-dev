"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';

export function HeroImageBackground({ opacity = "opacity-[0.15] dark:opacity-20", blendMode = "mix-blend-overlay dark:mix-blend-screen" }) {
  const [bgIndex, setBgIndex] = useState<number | null>(null);

  useEffect(() => {
    setBgIndex(Math.floor(Math.random() * 9) + 1);
  }, []);

  if (!bgIndex) return null;

  return (
    <div className={`absolute inset-0 z-0 pointer-events-none transition-opacity duration-1000 ${opacity} ${blendMode}`}>
      <Image
        src={`/images/backgrounds/fondo_${bgIndex}.jpg`}
        alt="Background"
        fill
        className="object-cover object-center"
        priority
      />
      {/* Adding a gradient overlay specifically for images to ensure text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background/40 to-background/90" />
    </div>
  );
}
