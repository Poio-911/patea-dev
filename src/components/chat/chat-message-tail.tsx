'use client';

import { cn } from '@/lib/utils';

interface ChatMessageTailProps {
  direction: 'left' | 'right';
  className?: string;
}

export function ChatMessageTail({ direction, className }: ChatMessageTailProps) {
  if (direction === 'right') {
    return (
      <svg
        viewBox="0 0 8 13"
        width="8"
        height="13"
        className={cn('chat-tail-outgoing', className)}
      >
        <path
          fill="currentColor"
          d="M1.533 3.568 8 12.193V1H2.812C1.042 1 .474 2.156 1.533 3.568z"
        />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 8 13"
      width="8"
      height="13"
      className={cn('chat-tail-incoming', className)}
    >
      <path
        fill="currentColor"
        d="M6.467 3.568 0 12.193V1h5.188c1.77 0 2.338 1.156 1.279 2.568z"
      />
    </svg>
  );
}
