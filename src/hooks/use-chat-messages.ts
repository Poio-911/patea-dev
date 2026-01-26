'use client';

import { useMemo, useCallback } from 'react';
import { useFirestore, useCollection } from '@/firebase';
import {
  collection,
  query,
  orderBy,
  addDoc,
  serverTimestamp,
  DocumentReference,
} from 'firebase/firestore';
import type { ChatMessage } from '@/lib/types';

interface UseChatMessagesOptions {
  collectionPath: string;
  enabled?: boolean;
}

interface SendMessageData {
  text: string;
  senderId: string;
  senderName: string;
  senderPhotoUrl: string;
  replyTo?: {
    messageId: string;
    text: string;
    senderName: string;
    senderId: string;
  } | null;
}

export function useChatMessages({ collectionPath, enabled = true }: UseChatMessagesOptions) {
  const firestore = useFirestore();

  const messagesQuery = useMemo(() => {
    if (!firestore || !enabled || !collectionPath) return null;
    return query(
      collection(firestore, collectionPath),
      orderBy('createdAt', 'asc')
    );
  }, [firestore, collectionPath, enabled]);

  const { data: messages, loading, error } = useCollection<ChatMessage>(messagesQuery);

  const sendMessage = useCallback(async (data: SendMessageData): Promise<DocumentReference | null> => {
    if (!firestore || !collectionPath) return null;

    try {
      const messageData: Omit<ChatMessage, 'id'> = {
        text: data.text,
        senderId: data.senderId,
        senderName: data.senderName,
        senderPhotoUrl: data.senderPhotoUrl,
        createdAt: serverTimestamp(),
        status: 'sending',
        ...(data.replyTo && { replyTo: data.replyTo }),
      };

      const docRef = await addDoc(collection(firestore, collectionPath), messageData);
      return docRef;
    } catch (err) {
      console.error('Error sending message:', err);
      throw err;
    }
  }, [firestore, collectionPath]);

  return {
    messages: messages ?? [],
    loading,
    error,
    sendMessage,
  };
}
