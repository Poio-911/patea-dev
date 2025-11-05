"use client";

import React from 'react';
import { useTheme } from 'next-themes';
import { Rajdhani, Teko, Outfit } from 'next/font/google';
import { cn } from '@/lib/utils';

// Cargamos las fuentes aquí para asegurar que las variables existen cuando se requiere el modo juego
const outfit = Outfit({ subsets: ['latin'], weight: ['400','500','600','700'], variable: '--font-body' });
const rajdhani = Rajdhani({ subsets: ['latin'], weight: ['500','600','700'], variable: '--font-headline' });
const teko = Teko({ subsets: ['latin'], weight: ['400','500','600','700'], variable: '--font-numeric' });

interface GameFontScopeProps {
  children: React.ReactNode;
  fonts?: string[]; // opcional si quisieras pasar otras variables
}

export function GameFontScope({ children }: GameFontScopeProps) {
  const { theme } = useTheme();
  // Sólo añadimos las clases con las variables cuando theme === 'game'
  const fontVars = theme === 'game' ? cn(outfit.variable, rajdhani.variable, teko.variable) : undefined;
  return <div className={fontVars}>{children}</div>;
}
