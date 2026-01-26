'use client';

import { useState, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Reply } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { ChatMessage, MessageStatus } from '@/lib/types';
import { ChatMessageTail } from './chat-message-tail';
import { ChatMessageStatus } from './chat-message-status';
import { ChatReactionsDisplay } from './chat-reactions-display';
import { ChatReactionsPicker } from './chat-reactions-picker';
import { ChatReplyPreview } from './chat-reply-preview';

interface ChatMessageBubbleProps {
  message: ChatMessage;
  isCurrentUser: boolean;
  showAvatar?: boolean;
  showSenderName?: boolean;
  onReply?: (message: ChatMessage) => void;
  onReact?: (messageId: string, emoji: string) => void;
  onScrollToMessage?: (messageId: string) => void;
  className?: string;
}

export function ChatMessageBubble({
  message,
  isCurrentUser,
  showAvatar = true,
  showSenderName = true,
  onReply,
  onReact,
  onScrollToMessage,
  className,
}: ChatMessageBubbleProps) {
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  const createdAtDate = useMemo(() => {
    if (!message.createdAt) return new Date();
    if (typeof message.createdAt.toDate === 'function') {
      return message.createdAt.toDate();
    }
    return new Date(message.createdAt);
  }, [message.createdAt]);

  const formattedTime = format(createdAtDate, 'HH:mm', { locale: es });

  const handleLongPressStart = () => {
    if (!onReact) return;
    longPressTimer.current = setTimeout(() => {
      setShowReactionPicker(true);
    }, 500);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!onReact) return;
    e.preventDefault();
    setShowReactionPicker(true);
  };

  const handleReact = (emoji: string) => {
    onReact?.(message.id, emoji);
    setShowReactionPicker(false);
  };

  const handleReply = () => {
    onReply?.(message);
  };

  const handleScrollToReply = () => {
    if (message.replyTo?.messageId && onScrollToMessage) {
      onScrollToMessage(message.replyTo.messageId);
    }
  };

  const hasReactions = message.reactions && message.reactions.length > 0;

  return (
    <div
      className={cn(
        'flex items-end gap-2 group',
        isCurrentUser ? 'justify-end' : 'justify-start',
        hasReactions && 'mb-4',
        className
      )}
    >
      {/* Avatar for incoming messages */}
      {!isCurrentUser && showAvatar && (
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarImage src={message.senderPhotoUrl} alt={message.senderName} />
          <AvatarFallback>{message.senderName.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
      )}

      {/* Reply button (left side for outgoing) */}
      {isCurrentUser && onReply && (
        <button
          onClick={handleReply}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-foreground"
          aria-label="Reply to message"
        >
          <Reply className="h-4 w-4" />
        </button>
      )}

      {/* Message bubble */}
      <div
        className={cn(
          'relative px-3 py-2',
          isCurrentUser ? 'chat-bubble-outgoing' : 'chat-bubble-incoming'
        )}
        onMouseDown={handleLongPressStart}
        onMouseUp={handleLongPressEnd}
        onMouseLeave={handleLongPressEnd}
        onTouchStart={handleLongPressStart}
        onTouchEnd={handleLongPressEnd}
        onContextMenu={handleContextMenu}
      >
        {/* Reaction picker */}
        {showReactionPicker && (
          <ChatReactionsPicker
            onSelect={handleReact}
            onClose={() => setShowReactionPicker(false)}
          />
        )}

        {/* Reply preview inside bubble */}
        {message.replyTo && (
          <ChatReplyPreview
            replyTo={message.replyTo}
            onClick={handleScrollToReply}
            isInBubble
            className={cn(
              'mb-2 -mx-1',
              isCurrentUser && 'border-white/50 bg-white/10'
            )}
          />
        )}

        {/* Sender name for incoming messages */}
        {!isCurrentUser && showSenderName && (
          <p className="text-xs font-semibold text-[hsl(var(--whatsapp-green))] mb-1">
            {message.senderName}
          </p>
        )}

        {/* Message text */}
        <p className="break-words whitespace-pre-wrap text-sm">{message.text}</p>

        {/* Timestamp and status */}
        <div className={cn(
          'flex items-center gap-1 justify-end chat-timestamp',
          isCurrentUser && 'text-white/70'
        )}>
          <span>{formattedTime}</span>
          {isCurrentUser && message.status && (
            <ChatMessageStatus status={message.status} />
          )}
        </div>

        {/* Message tail */}
        <ChatMessageTail direction={isCurrentUser ? 'right' : 'left'} />

        {/* Reactions display */}
        {hasReactions && (
          <ChatReactionsDisplay reactions={message.reactions!} />
        )}
      </div>

      {/* Reply button (right side for incoming) */}
      {!isCurrentUser && onReply && (
        <button
          onClick={handleReply}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-foreground"
          aria-label="Reply to message"
        >
          <Reply className="h-4 w-4" />
        </button>
      )}

      {/* Avatar for outgoing messages */}
      {isCurrentUser && showAvatar && (
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarImage src={message.senderPhotoUrl} alt={message.senderName} />
          <AvatarFallback>{message.senderName.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
