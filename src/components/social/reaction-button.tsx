'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ReactionType } from '@/lib/types';

interface ReactionButtonProps {
  type: ReactionType;
  count: number;
  isActive: boolean;
  onClick: () => void;
  disabled?: boolean;
  size?: 'sm' | 'default';
}

const reactionConfig: Record<ReactionType, { emoji: string; label: string; activeClass: string }> = {
  fire: {
    emoji: '\uD83D\uDD25',
    label: 'Fuego',
    activeClass: 'bg-amber-500/20 text-amber-500 border-amber-500/50',
  },
  clap: {
    emoji: '\uD83D\uDC4F',
    label: 'Aplauso',
    activeClass: 'bg-blue-500/20 text-blue-500 border-blue-500/50',
  },
  goal: {
    emoji: '\u26BD',
    label: 'Gol',
    activeClass: 'bg-green-500/20 text-green-500 border-green-500/50',
  },
};

export function ReactionButton({
  type,
  count,
  isActive,
  onClick,
  disabled = false,
  size = 'sm',
}: ReactionButtonProps) {
  const config = reactionConfig[type];

  return (
    <Button
      variant="outline"
      size={size}
      className={cn(
        'h-8 px-2 gap-1 font-normal transition-all',
        isActive && config.activeClass,
        !isActive && 'hover:bg-muted'
      )}
      onClick={onClick}
      disabled={disabled}
      aria-label={`${isActive ? 'Quitar' : 'Agregar'} ${config.label}`}
      aria-pressed={isActive}
    >
      <span className="text-base">{config.emoji}</span>
      {count > 0 && <span className="text-xs tabular-nums">{count}</span>}
    </Button>
  );
}

export default ReactionButton;
