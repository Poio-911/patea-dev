'use client';

import { useTheme } from 'next-themes';
import { GameModeBackground } from '@/components/game-mode-background';
import { NikeBackground } from '@/components/nike-background';
import { useEffect, useState } from 'react';

export function ThemeBackground() {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  if (theme === 'game') return <GameModeBackground />;
  if (theme === 'nike') return <NikeBackground />;
  return null;
}
