'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import { Send, Loader2 } from 'lucide-react';
import { ChatReplyPreview } from './chat-reply-preview';

interface ChatInputProps {
  onSend: (message: string) => void | Promise<void>;
  disabled?: boolean;
  isSending?: boolean;
  placeholder?: string;
  replyTo?: {
    messageId: string;
    text: string;
    senderName: string;
    senderId: string;
  } | null;
  onCancelReply?: () => void;
  className?: string;
}

export function ChatInput({
  onSend,
  disabled = false,
  isSending = false,
  placeholder = 'Escribe un mensaje...',
  replyTo,
  onCancelReply,
  className,
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [message]);

  // Focus input when reply is set
  useEffect(() => {
    if (replyTo && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [replyTo]);

  const handleSend = async () => {
    const trimmed = message.trim();
    if (!trimmed || disabled || isSending) return;

    await onSend(trimmed);
    setMessage('');

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isDisabled = disabled || isSending;
  const canSend = message.trim().length > 0 && !isDisabled;

  return (
    <div className={cn('chat-input-container flex-col', className)}>
      {replyTo && (
        <div className="px-1 pb-2">
          <ChatReplyPreview
            replyTo={replyTo}
            onCancel={onCancelReply}
          />
        </div>
      )}
      <div className="flex items-end gap-2 w-full">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isDisabled}
          rows={1}
          className="chat-input"
          aria-label="Message input"
        />
        <button
          onClick={handleSend}
          disabled={!canSend}
          className="chat-send-button"
          aria-label="Send message"
        >
          {isSending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </button>
      </div>
    </div>
  );
}
