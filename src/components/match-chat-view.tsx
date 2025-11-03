'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Match, ChatMessage } from '@/lib/types';
import { useFirestore, useUser, useCollection } from '@/firebase';
import { collection, query, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Send, MessageCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from './ui/scroll-area';


interface MatchChatViewProps {
  match: Match;
}

const chatSchema = z.object({
  message: z.string().min(1, 'El mensaje no puede estar vacío.'),
});
type ChatFormData = z.infer<typeof chatSchema>;

function ChatMessageItem({ message, isCurrentUser }: { message: ChatMessage; isCurrentUser: boolean }) {
  const createdAtDate = useMemo(() => {
    if (!message.createdAt) {
      return new Date();
    }
    if (typeof message.createdAt.toDate === 'function') {
      return message.createdAt.toDate();
    }
    return new Date(message.createdAt);
  }, [message.createdAt]);

  return (
    <div className={cn('flex items-end gap-2 text-sm', isCurrentUser && 'justify-end')}>
      {!isCurrentUser && (
        <Avatar className="h-8 w-8">
          <AvatarImage src={message.senderPhotoUrl} alt={message.senderName} />
          <AvatarFallback>{message.senderName.charAt(0)}</AvatarFallback>
        </Avatar>
      )}
      <div
        className={cn(
          'max-w-xs rounded-lg p-3 lg:max-w-md',
          isCurrentUser
            ? 'rounded-br-none bg-primary text-primary-foreground'
            : 'rounded-bl-none bg-muted'
        )}
      >
        {!isCurrentUser && <p className="font-semibold mb-1 text-xs">{message.senderName}</p>}
        <p className="break-words">{message.text}</p>
        <p className="mt-1 text-xs opacity-70">
          {formatDistanceToNow(createdAtDate, { addSuffix: true, locale: es })}
        </p>
      </div>
       {isCurrentUser && (
        <Avatar className="h-8 w-8">
          <AvatarImage src={message.senderPhotoUrl} alt={message.senderName} />
          <AvatarFallback>{message.senderName.charAt(0)}</AvatarFallback>
        </Avatar>
      )}
    </div>
  );
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

  const messagesQuery = useMemo(() => {
    if (!firestore || !match.id) return null;
    return query(collection(firestore, `matches/${match.id}/messages`), orderBy('createdAt', 'asc'));
  }, [firestore, match.id]);

  const { data: messages, loading: messagesLoading } = useCollection<ChatMessage>(messagesQuery);
  
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
        const newMessages = messages.filter(msg => {
            const msgTimestamp = msg.createdAt?.toDate ? msg.createdAt.toDate().getTime() : 0;
            return msgTimestamp > lastSeenTimestamp;
        });
        setUnreadCount(newMessages.length);
      }
  }, [messages, lastSeenKey, scrollToBottom]);

  const handleFocus = () => {
    if (messages && messages.length > 0) {
        const lastMessageTimestamp = messages[messages.length - 1].createdAt?.toDate ? messages[messages.length - 1].createdAt.toDate().getTime() : Date.now();
        localStorage.setItem(lastSeenKey, lastMessageTimestamp.toString());
        setUnreadCount(0);
    }
  }

  // Marcar como leído cuando se abre el chat
  useEffect(() => {
    if (isOpen) {
      handleFocus();
    }
  }, [isOpen]);


  const form = useForm<ChatFormData>({
    resolver: zodResolver(chatSchema),
    defaultValues: { message: '' },
  });

  const onSubmit = async (data: ChatFormData) => {
    if (!firestore || !user) return;
    setIsSending(true);
    try {
      await addDoc(collection(firestore, `matches/${match.id}/messages`), {
        text: data.message,
        senderId: user.uid,
        senderName: user.displayName,
        senderPhotoUrl: user.photoURL,
        createdAt: serverTimestamp(),
      });
      form.reset();
      scrollToBottom();
    } catch (error) {
      console.error('Error sending message:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo enviar el mensaje.' });
    } finally {
      setIsSending(false);
    }
  };

  const renderContent = () => {
    if (messagesLoading) {
      return (
        <div className="flex justify-center items-center h-full">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      );
    }
    if (!messages || messages.length === 0) {
        return (
            <div className="flex justify-center items-center h-full text-center">
              <p className="text-sm text-muted-foreground">Aún no hay mensajes. <br/> ¡Sé el primero en saludar!</p>
            </div>
        );
    }
    return messages.map((msg) => (
      <ChatMessageItem key={msg.id} message={msg} isCurrentUser={msg.senderId === user?.uid} />
    ));
  };

  return (
    <>
      {/* Botón flotante circular */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-20 right-6 w-14 h-14 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg flex items-center justify-center z-[100] transition-transform hover:scale-110"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Abrir chat del partido"
      >
        <MessageCircle className="h-6 w-6" />
        {unreadCount > 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-destructive text-white text-xs font-bold flex items-center justify-center"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.div>
        )}
      </motion.button>

      {/* Panel del chat */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-20 right-6 w-96 max-w-[calc(100vw-3rem)] z-[100] mb-4"
          >
            <Card className="bg-card/95 backdrop-blur-md border-2 shadow-2xl">
              <CardHeader className="flex flex-row items-center justify-between p-4 border-b">
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5" />
                  <CardTitle className="text-lg font-semibold">Chat del Partido</CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsOpen(false)}
                  className="h-8 w-8"
                >
                  ×
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="flex-1 flex flex-col overflow-hidden" onFocus={handleFocus} tabIndex={0}>
                  <ScrollArea className="p-4 h-[400px]" ref={scrollAreaRef}>
                    <div className="space-y-4">
                      {renderContent()}
                    </div>
                  </ScrollArea>
                </div>
                <CardFooter className="p-4 border-t">
                  <form onSubmit={form.handleSubmit(onSubmit)} className="flex w-full items-center space-x-2">
                    <Input
                      {...form.register('message')}
                      placeholder="Escribe un mensaje..."
                      autoComplete="off"
                      disabled={isSending}
                      onFocus={handleFocus}
                    />
                    <Button type="submit" size="icon" disabled={isSending}>
                      {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </form>
                </CardFooter>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
