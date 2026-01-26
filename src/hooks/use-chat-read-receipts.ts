'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import type { ChatMessage, MessageStatus } from '@/lib/types';

interface UseChatReadReceiptsOptions {
  collectionPath: string;
  userId: string;
  messages: ChatMessage[];
  enabled?: boolean;
}

export function useChatReadReceipts({
  collectionPath,
  userId,
  messages,
  enabled = true,
}: UseChatReadReceiptsOptions) {
  const firestore = useFirestore();
  const observerRef = useRef<IntersectionObserver | null>(null);
  const markedAsReadRef = useRef<Set<string>>(new Set());

  const markAsDelivered = useCallback(async (messageId: string): Promise<void> => {
    if (!firestore || !collectionPath || !userId) return;

    const messageRef = doc(firestore, collectionPath, messageId);

    try {
      await updateDoc(messageRef, {
        deliveredTo: arrayUnion(userId),
        status: 'delivered' as MessageStatus,
      });
    } catch (err) {
      console.error('Error marking as delivered:', err);
    }
  }, [firestore, collectionPath, userId]);

  const markAsRead = useCallback(async (messageId: string): Promise<void> => {
    if (!firestore || !collectionPath || !userId) return;
    if (markedAsReadRef.current.has(messageId)) return;

    const messageRef = doc(firestore, collectionPath, messageId);

    try {
      await updateDoc(messageRef, {
        readBy: arrayUnion(userId),
        status: 'read' as MessageStatus,
      });
      markedAsReadRef.current.add(messageId);
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  }, [firestore, collectionPath, userId]);

  // Mark all unread messages from others as delivered when they're received
  useEffect(() => {
    if (!enabled || !messages.length) return;

    messages.forEach((message) => {
      if (
        message.senderId !== userId &&
        (!message.deliveredTo || !message.deliveredTo.includes(userId))
      ) {
        markAsDelivered(message.id);
      }
    });
  }, [messages, userId, enabled, markAsDelivered]);

  // Set up Intersection Observer to mark messages as read when visible
  const observeMessage = useCallback((element: HTMLElement | null, messageId: string, senderId: string) => {
    if (!element || !enabled || senderId === userId) return;

    if (!observerRef.current) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const msgId = entry.target.getAttribute('data-message-id');
              if (msgId) {
                markAsRead(msgId);
              }
            }
          });
        },
        { threshold: 0.5 }
      );
    }

    element.setAttribute('data-message-id', messageId);
    observerRef.current.observe(element);

    return () => {
      if (observerRef.current && element) {
        observerRef.current.unobserve(element);
      }
    };
  }, [enabled, userId, markAsRead]);

  // Cleanup observer on unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, []);

  return {
    markAsRead,
    markAsDelivered,
    observeMessage,
  };
}
