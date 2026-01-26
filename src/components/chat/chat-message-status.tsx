'use client';

import { cn } from '@/lib/utils';
import { Check, Clock } from 'lucide-react';
import type { MessageStatus } from '@/lib/types';

interface ChatMessageStatusProps {
  status: MessageStatus;
  className?: string;
}

export function ChatMessageStatus({ status, className }: ChatMessageStatusProps) {
  if (status === 'sending') {
    return (
      <Clock className={cn('h-3 w-3 chat-status-sending', className)} />
    );
  }

  if (status === 'sent') {
    return (
      <Check className={cn('h-3 w-3 chat-status-sent', className)} />
    );
  }

  if (status === 'delivered') {
    return (
      <div className={cn('flex -space-x-1.5', className)}>
        <Check className="h-3 w-3 chat-status-delivered" />
        <Check className="h-3 w-3 chat-status-delivered" />
      </div>
    );
  }

  // status === 'read'
  return (
    <div className={cn('flex -space-x-1.5', className)}>
      <Check className="h-3 w-3 chat-status-read" />
      <Check className="h-3 w-3 chat-status-read" />
    </div>
  );
}
