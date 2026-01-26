'use client';

import { cn } from '@/lib/utils';
import type { MessageReaction } from '@/lib/types';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ChatReactionsDisplayProps {
  reactions: MessageReaction[];
  className?: string;
}

type GroupedReaction = {
  emoji: string;
  count: number;
  users: string[];
};

export function ChatReactionsDisplay({ reactions, className }: ChatReactionsDisplayProps) {
  if (!reactions || reactions.length === 0) return null;

  // Group reactions by emoji
  const grouped = reactions.reduce<Record<string, GroupedReaction>>((acc, reaction) => {
    if (!acc[reaction.emoji]) {
      acc[reaction.emoji] = { emoji: reaction.emoji, count: 0, users: [] };
    }
    acc[reaction.emoji].count++;
    acc[reaction.emoji].users.push(reaction.userName);
    return acc;
  }, {});

  const groupedArray = Object.values(grouped);

  return (
    <TooltipProvider>
      <div className={cn('chat-reactions', className)}>
        {groupedArray.map((group) => (
          <Tooltip key={group.emoji}>
            <TooltipTrigger asChild>
              <button className="flex items-center gap-0.5 text-xs hover:scale-110 transition-transform">
                <span>{group.emoji}</span>
                {group.count > 1 && (
                  <span className="text-[10px] text-muted-foreground">{group.count}</span>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {group.users.join(', ')}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
