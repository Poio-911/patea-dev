'use client';

import { useState, useRef, useEffect } from 'react';
import type { Match, ChatMessage } from '@/lib/types';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { useChatMessages } from '@/hooks/use-chat-messages';
import { useChatReactions } from '@/hooks/use-chat-reactions';
import { useChatReply } from '@/hooks/use-chat-reply';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Bot } from 'lucide-react';
import {
  ChatMessageBubble,
  ChatInput,
  ChatEmptyState,
  ChatLoadingState,
} from '@/components/chat';

interface MatchChatSheetProps {
  match: Match;
  children: React.ReactNode;
}

export function MatchChatSheet({ match, children }: MatchChatSheetProps) {
  const [open, setOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiWelcomeMessage, setAiWelcomeMessage] = useState<string | null>(null);

  const { user } = useUser();
  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const isPublicJoiner = user?.groups && match.groupId && !user.groups.includes(match.groupId) && match.isPublic;

  const collectionPath = `matches/${match.id}/messages`;

  const { messages, loading: messagesLoading, sendMessage } = useChatMessages({
    collectionPath,
    enabled: open,
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

  const handleOpenChange = async (newOpenState: boolean) => {
    setOpen(newOpenState);
    if (newOpenState && isPublicJoiner && !aiWelcomeMessage && user?.displayName) {
      setIsAiLoading(true);
      setTimeout(() => {
        setAiWelcomeMessage(
          `¡Bienvenido al partido ${match.title}, ${user.displayName}! Por favor, coordina con el organizador cualquier detalle sobre costos o reglas.`
        );
        setIsAiLoading(false);
      }, 1000);
    }
  };

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

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages, aiWelcomeMessage]);

  const renderContent = () => {
    const hasExistingMessages = messages && messages.length > 0;

    if (isPublicJoiner && !hasExistingMessages) {
      if (isAiLoading) {
        return (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <Bot className="h-10 w-10 text-[hsl(var(--whatsapp-green))]" />
            <p className="font-semibold">Generando bienvenida personalizada...</p>
            <p className="text-sm text-muted-foreground">
              Un asistente de IA está preparando información útil para ti.
            </p>
          </div>
        );
      }
      if (aiWelcomeMessage) {
        return (
          <div className="flex items-end gap-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-[hsl(var(--whatsapp-green))] text-[hsl(var(--whatsapp-foreground))]">
                <Bot size={20} />
              </AvatarFallback>
            </Avatar>
            <div className="max-w-xs rounded-lg p-3 text-sm lg:max-w-md rounded-bl-none bg-card border border-border/50">
              <p className="font-semibold mb-1 text-xs text-[hsl(var(--whatsapp-green))]">
                Asistente del Partido
              </p>
              <p className="break-words">{aiWelcomeMessage}</p>
            </div>
          </div>
        );
      }
    }

    if (messagesLoading) {
      return <ChatLoadingState />;
    }

    if (!hasExistingMessages && (!isPublicJoiner || !aiWelcomeMessage)) {
      return <ChatEmptyState description="¡Sé el primero en saludar!" />;
    }

    if (!messages) {
      return null;
    }

    return (
      <div className="space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            ref={(el) => registerMessageRef(msg.id, el)}
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
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent className="flex flex-col">
        <SheetHeader className="bg-[hsl(var(--whatsapp-green))] text-[hsl(var(--whatsapp-foreground))] -mx-6 -mt-6 px-6 py-4">
          <SheetTitle className="text-[hsl(var(--whatsapp-foreground))]">Chat del Partido</SheetTitle>
          <SheetDescription className="text-[hsl(var(--whatsapp-foreground))]/80">{match.title}</SheetDescription>
        </SheetHeader>
        <div ref={scrollAreaRef} className="flex-1 overflow-y-auto space-y-4 p-4 -mx-6 chat-container">
          {renderContent()}
        </div>
        <SheetFooter className="-mx-6 -mb-6">
          <ChatInput
            onSend={handleSendMessage}
            isSending={isSending}
            replyTo={replyTo}
            onCancelReply={cancelReply}
            placeholder="Escribe un mensaje..."
          />
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
