'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { ReactionType, Reactions } from '@/lib/types';

interface ReactionPickerProps {
  reactions: Reactions;
  userId?: string;
  onReact: (type: ReactionType) => void;
  onUnreact: (type: ReactionType) => void;
  disabled?: boolean;
}

const reactionOptions: { type: ReactionType; emoji: string; label: string; color: string }[] = [
  { type: 'fire', emoji: '\uD83D\uDD25', label: 'Fuego', color: 'hover:bg-amber-500/20' },
  { type: 'clap', emoji: '\uD83D\uDC4F', label: 'Aplauso', color: 'hover:bg-blue-500/20' },
  { type: 'goal', emoji: '\u26BD', label: 'Golazo', color: 'hover:bg-green-500/20' },
];

export function ReactionPicker({
  reactions,
  userId,
  onReact,
  onUnreact,
  disabled = false,
}: ReactionPickerProps) {
  const [open, setOpen] = useState(false);

  const getUserReactions = (): ReactionType[] => {
    if (!userId) return [];
    const userReactions: ReactionType[] = [];
    if (reactions.fire?.includes(userId)) userReactions.push('fire');
    if (reactions.clap?.includes(userId)) userReactions.push('clap');
    if (reactions.goal?.includes(userId)) userReactions.push('goal');
    return userReactions;
  };

  const userReactions = getUserReactions();
  const totalReactions =
    (reactions.fire?.length || 0) +
    (reactions.clap?.length || 0) +
    (reactions.goal?.length || 0);

  const handleReaction = (type: ReactionType) => {
    if (userReactions.includes(type)) {
      onUnreact(type);
    } else {
      onReact(type);
    }
    setOpen(false);
  };

  // Show the most used reaction or fire as default
  const dominantReaction = (): { emoji: string; type: ReactionType } => {
    const counts = {
      fire: reactions.fire?.length || 0,
      clap: reactions.clap?.length || 0,
      goal: reactions.goal?.length || 0,
    };
    const max = Math.max(counts.fire, counts.clap, counts.goal);
    if (max === 0 || counts.fire >= max) return { emoji: '\uD83D\uDD25', type: 'fire' };
    if (counts.clap >= max) return { emoji: '\uD83D\uDC4F', type: 'clap' };
    return { emoji: '\u26BD', type: 'goal' };
  };

  const dominant = dominantReaction();
  const hasUserReacted = userReactions.length > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-8 px-2 gap-1.5 text-muted-foreground hover:text-foreground',
            hasUserReacted && 'text-foreground'
          )}
          disabled={disabled}
          aria-label="Reaccionar"
        >
          <span className="text-base">{dominant.emoji}</span>
          {totalReactions > 0 && (
            <span className="text-xs tabular-nums">{totalReactions}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-1"
        align="start"
        side="top"
        sideOffset={4}
      >
        <div className="flex gap-1">
          {reactionOptions.map((option) => {
            const isActive = userReactions.includes(option.type);
            const count = reactions[option.type]?.length || 0;

            return (
              <button
                key={option.type}
                onClick={() => handleReaction(option.type)}
                className={cn(
                  'flex flex-col items-center gap-0.5 p-2 rounded-lg transition-all',
                  option.color,
                  isActive && 'bg-muted ring-2 ring-primary/50'
                )}
                aria-label={option.label}
                aria-pressed={isActive}
              >
                <span className="text-2xl">{option.emoji}</span>
                {count > 0 && (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default ReactionPicker;
