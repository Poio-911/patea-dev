'use client';

import { useState, useCallback, useRef } from 'react';
import type { ChatMessage } from '@/lib/types';

interface ReplyTo {
  messageId: string;
  text: string;
  senderName: string;
  senderId: string;
}

export function useChatReply() {
  const [replyTo, setReplyTo] = useState<ReplyTo | null>(null);
  const messageRefs = useRef<Map<string, HTMLElement>>(new Map());

  const startReply = useCallback((message: ChatMessage) => {
    setReplyTo({
      messageId: message.id,
      text: message.text,
      senderName: message.senderName,
      senderId: message.senderId,
    });
  }, []);

  const cancelReply = useCallback(() => {
    setReplyTo(null);
  }, []);

  const getReplyData = useCallback(() => {
    return replyTo;
  }, [replyTo]);

  const clearReply = useCallback(() => {
    setReplyTo(null);
  }, []);

  const registerMessageRef = useCallback((messageId: string, element: HTMLElement | null) => {
    if (element) {
      messageRefs.current.set(messageId, element);
    } else {
      messageRefs.current.delete(messageId);
    }
  }, []);

  const scrollToMessage = useCallback((messageId: string) => {
    const element = messageRefs.current.get(messageId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Add highlight effect
      element.classList.add('bg-primary/20');
      setTimeout(() => {
        element.classList.remove('bg-primary/20');
      }, 2000);
    }
  }, []);

  return {
    replyTo,
    startReply,
    cancelReply,
    getReplyData,
    clearReply,
    registerMessageRef,
    scrollToMessage,
  };
}
