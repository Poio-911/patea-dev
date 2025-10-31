'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';


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
    <Card className="dark:bg-background/20 border-foreground/10 backdrop-blur-sm">
        <Accordion type="single" collapsible defaultValue="chat" className="w-full">
            <AccordionItem value="chat" className="border-b-0">
                <AccordionTrigger className="p-4">
                    <div className="flex items-center gap-2 w-full">
                        <MessageCircle className="h-5 w-5" />
                        <h3 className="font-semibold text-lg">Chat del Partido</h3>
                        {unreadCount > 0 && (
                            <Badge className="animate-pulse">{unreadCount}</Badge>
                        )}
                    </div>
                </AccordionTrigger>
                <AccordionContent>
                    <div className="flex-1 flex flex-col p-4 pt-0 overflow-hidden min-h-[300px]" onFocus={handleFocus} tabIndex={0}>
                        <ScrollArea className="flex-1 pr-2 max-h-[400px]" ref={scrollAreaRef}>
                            <div className="space-y-4">
                            {renderContent()}
                            </div>
                        </ScrollArea>
                    </div>
                    <div className="p-4 border-t">
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
                    </div>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    </Card>
  );
}
