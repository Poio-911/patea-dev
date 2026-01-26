'use client';

import { useCallback } from 'react';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';
import type { MessageReaction } from '@/lib/types';

interface UseChatReactionsOptions {
  collectionPath: string;
}

interface AddReactionData {
  messageId: string;
  emoji: string;
  userId: string;
  userName: string;
}

export function useChatReactions({ collectionPath }: UseChatReactionsOptions) {
  const firestore = useFirestore();

  const addReaction = useCallback(async (data: AddReactionData): Promise<void> => {
    if (!firestore || !collectionPath) return;

    const messageRef = doc(firestore, collectionPath, data.messageId);

    const newReaction: MessageReaction = {
      emoji: data.emoji,
      userId: data.userId,
      userName: data.userName,
      createdAt: new Date().toISOString(),
    };

    try {
      await updateDoc(messageRef, {
        reactions: arrayUnion(newReaction),
      });
    } catch (err) {
      console.error('Error adding reaction:', err);
      throw err;
    }
  }, [firestore, collectionPath]);

  const removeReaction = useCallback(async (data: AddReactionData): Promise<void> => {
    if (!firestore || !collectionPath) return;

    const messageRef = doc(firestore, collectionPath, data.messageId);

    try {
      // Get current reactions to find the one to remove
      const docSnap = await getDoc(messageRef);
      if (!docSnap.exists()) return;

      const currentReactions: MessageReaction[] = docSnap.data().reactions || [];
      const reactionToRemove = currentReactions.find(
        (r) => r.emoji === data.emoji && r.userId === data.userId
      );

      if (reactionToRemove) {
        await updateDoc(messageRef, {
          reactions: arrayRemove(reactionToRemove),
        });
      }
    } catch (err) {
      console.error('Error removing reaction:', err);
      throw err;
    }
  }, [firestore, collectionPath]);

  const toggleReaction = useCallback(async (data: AddReactionData): Promise<void> => {
    if (!firestore || !collectionPath) return;

    const messageRef = doc(firestore, collectionPath, data.messageId);

    try {
      const docSnap = await getDoc(messageRef);
      if (!docSnap.exists()) return;

      const currentReactions: MessageReaction[] = docSnap.data().reactions || [];
      const existingReaction = currentReactions.find(
        (r) => r.emoji === data.emoji && r.userId === data.userId
      );

      if (existingReaction) {
        await removeReaction(data);
      } else {
        await addReaction(data);
      }
    } catch (err) {
      console.error('Error toggling reaction:', err);
      throw err;
    }
  }, [firestore, collectionPath, addReaction, removeReaction]);

  return {
    addReaction,
    removeReaction,
    toggleReaction,
  };
}
