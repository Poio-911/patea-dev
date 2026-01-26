'use client';

import { cn } from '@/lib/utils';

const AVAILABLE_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

interface ChatReactionsPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  className?: string;
}

export function ChatReactionsPicker({ onSelect, onClose, className }: ChatReactionsPickerProps) {
  const handleSelect = (emoji: string) => {
    onSelect(emoji);
    onClose();
  };

  return (
    <div className={cn('chat-reaction-picker', className)}>
      {AVAILABLE_REACTIONS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => handleSelect(emoji)}
          className="hover:scale-125 transition-transform p-1"
          aria-label={`React with ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

export { AVAILABLE_REACTIONS };
