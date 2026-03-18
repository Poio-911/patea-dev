'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Match, ChatMessage } from '@/lib/types';
import { useFirestore, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { useChatMessages } from '@/hooks/use-chat-messages';
import { useChatReactions } from '@/hooks/use-chat-reactions';
import { useChatReply } from '@/hooks/use-chat-reply';
import { useChatReadReceipts } from '@/hooks/use-chat-read-receipts';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import {
  ChatMessageBubble,
  ChatInput,
  ChatEmptyState,
  ChatLoadingState,
} from '@/components/chat';

interface MatchChatViewProps {
  match: Match;
}

export function MatchChatView({ match }: MatchChatViewProps) {
  const [isSending, setIsSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const lastSeenKey = `lastSeenMsg_${match.id}`;

  const collectionPath = `matches/${match.id}/messages`;

  const { messages, loading: messagesLoading, sendMessage } = useChatMessages({
    collectionPath,
    enabled: isOpen,
  });

  const { toggleReaction } = useChatReactions({ collectionPath });

  const {
    replyTo,
    startReply,
    cancelReply,
    clearReply,
    registerMessageRef,
    scrollToMessage,
  } = useChatReply();

  const { observeMessage } = useChatReadReceipts({
    collectionPath,
    userId: user?.uid || '',
    messages,
    enabled: isOpen && !!user,
  });

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      if (scrollAreaRef.current) {
        scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
      }
    }, 100);
  }, []);

  useEffect(() => {
    if (messages && messages.length > 0) {
      if (isOpen) {
        scrollToBottom();
      }
      const lastSeenTimestamp = parseInt(localStorage.getItem(lastSeenKey) || '0', 10);
      const newMessages = messages.filter((msg) => {
        const msgTimestamp = msg.createdAt?.toDate ? msg.createdAt.toDate().getTime() : 0;
        return msgTimestamp > lastSeenTimestamp;
      });
      setUnreadCount(newMessages.length);
    }
  }, [messages, lastSeenKey, scrollToBottom, isOpen]);

  const handleFocus = useCallback(() => {
    if (messages && messages.length > 0) {
      const lastMessageTimestamp = messages[messages.length - 1].createdAt?.toDate
        ? messages[messages.length - 1].createdAt.toDate().getTime()
        : Date.now();
      localStorage.setItem(lastSeenKey, lastMessageTimestamp.toString());
      setUnreadCount(0);
    }
  }, [lastSeenKey, messages]);

  useEffect(() => {
    if (isOpen) {
      handleFocus();
    }
  }, [handleFocus, isOpen]);

  const handleSendMessage = async (text: string) => {
    if (!user) return;
    setIsSending(true);
    try {
      await sendMessage({
        text,
        senderId: user.uid,
        senderName: user.displayName || 'Usuario',
        senderPhotoUrl: user.photoURL || '',
        replyTo: replyTo,
      });
      clearReply();
      scrollToBottom();
    } catch (error) {
      console.error('Error sending message:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo enviar el mensaje.' });
    } finally {
      setIsSending(false);
    }
  };

  const handleReact = async (messageId: string, emoji: string) => {
    if (!user) return;
    try {
      await toggleReaction({
        messageId,
        emoji,
        userId: user.uid,
        userName: user.displayName || 'Usuario',
      });
    } catch (error) {
      console.error('Error toggling reaction:', error);
    }
  };

  const handleReply = (message: ChatMessage) => {
    startReply(message);
  };

  const renderContent = () => {
    if (messagesLoading) {
      return <ChatLoadingState />;
    }
    if (!messages || messages.length === 0) {
      return <ChatEmptyState description="¡Sé el primero en saludar!" />;
    }
    return (
      <div className="space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            ref={(el) => {
              registerMessageRef(msg.id, el);
              if (el && msg.senderId !== user?.uid) {
                observeMessage(el, msg.id, msg.senderId);
              }
            }}
            className="transition-colors duration-500"
          >
            <ChatMessageBubble
              message={msg}
              isCurrentUser={msg.senderId === user?.uid}
              onReply={handleReply}
              onReact={handleReact}
              onScrollToMessage={scrollToMessage}
            />
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card className="bg-card w-full rounded-3xl overflow-hidden border-2 shadow-sm transition-all duration-300">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-4 sm:p-6 cursor-pointer hover:bg-muted/30 transition-colors select-none">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 sm:p-3 rounded-2xl">
                <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              </div>
              <div className="text-left">
                <h3 className="text-base sm:text-lg font-bold">Chat del Partido</h3>
                <p className="text-xs sm:text-sm text-muted-foreground font-medium hidden sm:block">Organizá, bardeá y motivá al equipo.</p>
              </div>
            </div>

            <div className="flex items-center gap-3 md:gap-4 shrink-0">
              {unreadCount > 0 && (
                <Badge variant="destructive" className="font-bold px-2 py-0.5 rounded-full shadow-md animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount} {unreadCount === 1 ? 'nuevo' : 'nuevos'}
                </Badge>
              )}
              <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }} className="text-muted-foreground bg-muted p-1.5 rounded-full">
                <ChevronDown className="h-5 w-5" />
              </motion.div>
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-col border-t bg-card/50"
          >
            <div
              className="flex-1 overflow-y-auto p-4 sm:p-6 chat-container scroll-smooth h-[350px] sm:h-[450px]"
              ref={scrollAreaRef}
              onFocus={handleFocus}
              tabIndex={0}
            >
              {renderContent()}
            </div>
            <div className="p-0 border-t bg-card">
              <ChatInput
                onSend={handleSendMessage}
                isSending={isSending}
                replyTo={replyTo}
                onCancelReply={cancelReply}
                placeholder="Escribe un mensaje al grupo..."
              />
            </div>
          </motion.div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

