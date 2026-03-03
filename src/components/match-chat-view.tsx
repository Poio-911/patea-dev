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
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageCircle } from 'lucide-react';
import { WhatsAppIcon } from '@/components/icons/whatsapp-icon';
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
    scrollToBottom();

    if (messages && messages.length > 0) {
      const lastSeenTimestamp = parseInt(localStorage.getItem(lastSeenKey) || '0', 10);
      const newMessages = messages.filter((msg) => {
        const msgTimestamp = msg.createdAt?.toDate ? msg.createdAt.toDate().getTime() : 0;
        return msgTimestamp > lastSeenTimestamp;
      });
      setUnreadCount(newMessages.length);
    }
  }, [messages, lastSeenKey, scrollToBottom]);

  const handleFocus = () => {
    if (messages && messages.length > 0) {
      const lastMessageTimestamp = messages[messages.length - 1].createdAt?.toDate
        ? messages[messages.length - 1].createdAt.toDate().getTime()
        : Date.now();
      localStorage.setItem(lastSeenKey, lastMessageTimestamp.toString());
      setUnreadCount(0);
    }
  };

  useEffect(() => {
    if (isOpen) {
      handleFocus();
    }
  }, [isOpen]);

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
    <>
      {/* Bottom Floating Bar / Circular Button for Chat */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed z-[100] transition-all overflow-hidden flex items-center justify-center shadow-2xl",
          "bg-gradient-to-br from-[#25D366] to-[#128C7E] text-white border border-white/20 active:scale-95",
          // Mobile: Barra horizontal (rectángulo redondeado con texto)
          "bottom-[calc(5rem+env(safe-area-inset-bottom))] left-4 right-4 h-12 rounded-2xl md:right-6 md:left-auto md:w-14 md:h-14 md:rounded-full"
        )}
        whileHover={{
          scale: 1.05,
          boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)"
        }}
        whileTap={{ scale: 0.95 }}
        aria-label="Abrir chat del partido"
      >
        <div className="flex items-center justify-center gap-2">
          <WhatsAppIcon className="h-6 w-6 md:h-8 md:w-8 md:ml-[1px]" />
          <span className="font-bold tracking-wide md:hidden">CHAT DEL PARTIDO</span>
        </div>
        {unreadCount > 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 md:top-0 md:right-0 min-w-[22px] h-[22px] px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center border-2 border-background shadow-lg"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.div>
        )}
      </motion.button>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-20 right-6 w-96 max-w-[calc(100vw-3rem)] z-[100] mb-4 pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)]"
          >
            <Card className="bg-card/95 backdrop-blur-md border-2 shadow-2xl overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between p-4 border-b bg-[hsl(var(--whatsapp-green))] text-[hsl(var(--whatsapp-foreground))]">
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5" />
                  <CardTitle className="text-lg font-semibold text-[hsl(var(--whatsapp-foreground))]">Chat del Partido</CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsOpen(false)}
                  className="h-8 w-8 text-[hsl(var(--whatsapp-foreground))] hover:bg-[hsl(var(--whatsapp-foreground))]/20 hover:text-[hsl(var(--whatsapp-foreground))]"
                >
                  ×
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div
                  className="flex-1 flex flex-col overflow-hidden chat-container"
                  onFocus={handleFocus}
                  tabIndex={0}
                >
                  <div
                    className="p-4 h-[400px] overflow-y-auto"
                    ref={scrollAreaRef}
                  >
                    {renderContent()}
                  </div>
                </div>
              </CardContent>
              <CardFooter className="p-0">
                <ChatInput
                  onSend={handleSendMessage}
                  isSending={isSending}
                  replyTo={replyTo}
                  onCancelReply={cancelReply}
                  placeholder="Escribe un mensaje..."
                />
              </CardFooter>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
