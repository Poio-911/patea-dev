'use client';

import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface ChatReplyPreviewProps {
  replyTo: {
    messageId: string;
    text: string;
    senderName: string;
    senderId: string;
  };
  onCancel?: () => void;
  onClick?: () => void;
  isInBubble?: boolean;
  className?: string;
}

export function ChatReplyPreview({
  replyTo,
  onCancel,
  onClick,
  isInBubble = false,
  className
}: ChatReplyPreviewProps) {
  const truncatedText = replyTo.text.length > 100
    ? replyTo.text.slice(0, 100) + '...'
    : replyTo.text;

  return (
    <div
      className={cn(
        'chat-reply-preview flex items-start gap-2 cursor-pointer',
        isInBubble && 'cursor-pointer hover:bg-muted/70 transition-colors',
        className
      )}
      onClick={onClick}
    >
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-[hsl(var(--whatsapp-green))] truncate">
          {replyTo.senderName}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {truncatedText}
        </p>
      </div>
      {onCancel && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCancel();
          }}
          className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
          aria-label="Cancel reply"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
