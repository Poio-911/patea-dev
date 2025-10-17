
'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import type { Match, ChatMessage } from '@/lib/types';
import { useFirestore, useUser, useCollection } from '@/firebase';
import { collection, query, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Send, Bot } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { generateWelcomeMessage, WelcomeMessageInput } from '@/ai/flows/generate-welcome-message';

interface MatchChatSheetProps {
  match: Match;
  children: React.ReactNode;
}

const chatSchema = z.object({
  message: z.string().min(1, 'El mensaje no puede estar vacío.'),
});
type ChatFormData = z.infer<typeof chatSchema>;

function ChatMessageItem({ message, isCurrentUser }: { message: ChatMessage; isCurrentUser: boolean }) {
  const createdAtDate = message.createdAt ? new Date(message.createdAt) : new Date();

  return (
    <div className={cn('flex items-end gap-2', isCurrentUser && 'justify-end')}>
      {!isCurrentUser && (
        <Avatar className="h-8 w-8">
          <AvatarImage src={message.senderPhotoUrl} alt={message.senderName} />
          <AvatarFallback>{message.senderName.charAt(0)}</AvatarFallback>
        </Avatar>
      )}
      <div
        className={cn(
          'max-w-xs rounded-lg p-3 text-sm lg:max-w-md',
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

export function MatchChatSheet({ match, children }: MatchChatSheetProps) {
  const [open, setOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiWelcomeMessage, setAiWelcomeMessage] = useState<string | null>(null);

  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const isPublicJoiner = user?.groups && !user.groups.includes(match.groupId) && match.isPublic;

  const messagesQuery = useMemo(() => {
    if (!firestore || !match.id || !open) return null;
    return query(collection(firestore, `matches/${match.id}/messages`), orderBy('createdAt', 'asc'));
  }, [firestore, match.id, open]);

  const { data: messages, loading: messagesLoading } = useCollection<ChatMessage>(messagesQuery);

  const form = useForm<ChatFormData>({
    resolver: zodResolver(chatSchema),
    defaultValues: { message: '' },
  });

  const handleOpenChange = async (newOpenState: boolean) => {
    setOpen(newOpenState);
    if (newOpenState && isPublicJoiner && !aiWelcomeMessage && user?.displayName) {
        setIsAiLoading(true);
        try {
            const input: WelcomeMessageInput = {
                playerName: user.displayName,
                matchTitle: match.title,
                matchLocation: match.location.address
            };
            const result = await generateWelcomeMessage(input);
            setAiWelcomeMessage(result.welcomeMessage);
        } catch (error) {
            console.error("Error generating AI welcome message:", error);
            setAiWelcomeMessage("¡Bienvenido al partido! Por favor, coordina con el organizador cualquier detalle sobre costos o reglas.");
        } finally {
            setIsAiLoading(false);
        }
    }
  }

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
    } catch (error) {
      console.error('Error sending message:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo enviar el mensaje.' });
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages, aiWelcomeMessage]);

  const renderContent = () => {
    const hasExistingMessages = messages && messages.length > 0;
    
    if (isPublicJoiner && !hasExistingMessages) {
        if(isAiLoading) {
            return (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                    <Bot className="h-10 w-10 text-primary" />
                    <p className="font-semibold">Generando bienvenida personalizada...</p>
                    <p className="text-sm text-muted-foreground">Un asistente de IA está preparando información útil para ti.</p>
                </div>
            )
        }
        if (aiWelcomeMessage) {
             return (
                <div className="flex items-end gap-2">
                    <Avatar className="h-8 w-8">
                        <AvatarFallback><Bot size={20}/></AvatarFallback>
                    </Avatar>
                    <div className="max-w-xs rounded-lg p-3 text-sm lg:max-w-md rounded-bl-none bg-blue-100 dark:bg-blue-900/50">
                        <p className="font-semibold mb-1 text-xs text-blue-800 dark:text-blue-300">Asistente del Partido</p>
                        <p className="break-words">{aiWelcomeMessage}</p>
                    </div>
                </div>
            )
        }
    }

    if (messagesLoading) {
      return (
        <div className="flex justify-center items-center h-full">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      );
    }

    if (!hasExistingMessages && (!isPublicJoiner || !aiWelcomeMessage)) {
      return (
        <div className="flex justify-center items-center h-full text-center">
          <p className="text-sm text-muted-foreground">Aún no hay mensajes. <br/> ¡Sé el primero en saludar!</p>
        </div>
      );
    }

    if (!messages) {
        return null;
    }

    return messages.map((msg) => (
      <ChatMessageItem key={msg.id} message={msg} isCurrentUser={msg.senderId === user?.uid} />
    ));
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent className="flex flex-col">
        <SheetHeader>
          <SheetTitle>Chat del Partido</SheetTitle>
          <SheetDescription>{match.title}</SheetDescription>
        </SheetHeader>
        <div ref={scrollAreaRef} className="flex-1 overflow-y-auto space-y-4 p-4 -mx-6">
          {renderContent()}
        </div>
        <SheetFooter>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex w-full items-center space-x-2">
            <Input
              {...form.register('message')}
              placeholder="Escribe un mensaje..."
              autoComplete="off"
              disabled={isSending}
            />
            <Button type="submit" size="icon" disabled={isSending}>
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
