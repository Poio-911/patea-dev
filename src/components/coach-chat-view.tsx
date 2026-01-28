'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { coachConversationAction } from '@/lib/actions/server-actions';
import type { CoachConversationInput, CoachConversationOutput } from '@/ai/flows/coach-conversation';
import { useUser } from '@/firebase';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChatInput } from '@/components/chat';

type Message = {
  role: 'user' | 'coach';
  content: string;
  timestamp: string;
  mood?: CoachConversationOutput['mood'];
  suggestedActions?: string[];
};

const moodLabels: Record<NonNullable<Message['mood']>, string> = {
  motivational: 'Motivacional',
  analytical: 'Analítico',
  supportive: 'De Apoyo',
  critical: 'Crítico',
};

interface Props {
  playerId: string;
  groupId: string;
}

function CoachMessageBubble({ message }: { message: Message }) {
  const formattedTime = format(new Date(message.timestamp), 'HH:mm', { locale: es });
  const isCoach = message.role === 'coach';

  return (
    <div className={cn('flex items-end gap-2 group', isCoach ? 'justify-start' : 'justify-end')}>
      {isCoach && (
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarFallback className="bg-[hsl(var(--whatsapp-green))] text-[hsl(var(--whatsapp-foreground))] text-xs font-bold">
            DT
          </AvatarFallback>
        </Avatar>
      )}

      <div
        className={cn(
          'relative px-3 py-2 max-w-[80%] rounded-lg',
          isCoach
            ? 'chat-bubble-incoming rounded-bl-none'
            : 'chat-bubble-outgoing rounded-br-none'
        )}
      >
        <p className="whitespace-pre-wrap text-sm">{message.content}</p>

        {message.mood && (
          <Badge
            variant="outline"
            className={cn(
              'mt-2 text-xs',
              isCoach ? 'bg-background/50' : 'bg-foreground/20 text-foreground border-foreground/30'
            )}
          >
            {moodLabels[message.mood]}
          </Badge>
        )}

        {message.suggestedActions && message.suggestedActions.length > 0 && (
          <div
            className={cn(
              'mt-3 space-y-2 border-t pt-2',
              isCoach ? 'border-border/50' : 'border-foreground/20'
            )}
          >
            <p className="text-xs font-semibold">Acciones sugeridas:</p>
            <ul className="space-y-1">
              {message.suggestedActions.map((action, i) => (
                <li key={i} className="text-xs flex items-start gap-1">
                  <span className="opacity-80">•</span>
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div
          className={cn(
            'flex items-center justify-end chat-timestamp mt-1',
            !isCoach && 'text-foreground/70'
          )}
        >
          <span>{formattedTime}</span>
        </div>
      </div>
    </div>
  );
}

export function CoachChatView({ playerId, groupId }: Props) {
  const { user } = useUser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    if (messages.length === 0 && user) {
      const welcomeMessage: Message = {
        role: 'coach',
        content: `¡Hola, ${user.displayName?.split(' ')[0]}! Soy tu DT virtual. ¿En qué te puedo ayudar hoy?`,
        timestamp: new Date().toISOString(),
        mood: 'supportive',
      };
      setMessages([welcomeMessage]);
    }
  }, [messages.length, user]);

  useEffect(() => {
    if (scrollRef.current) {
      const isScrolledToBottom =
        scrollRef.current.scrollHeight - scrollRef.current.clientHeight <=
        scrollRef.current.scrollTop + 1;
      if (isScrolledToBottom) {
        scrollToBottom();
      }
    }
  }, [messages, isLoading, scrollToBottom]);

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      setShowScrollButton(scrollHeight - clientHeight - scrollTop > 300);
    }
  };

  const handleSend = async (input: string) => {
    if (!input.trim() || !playerId || !groupId) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const conversationHistory: CoachConversationInput['conversationHistory'] = messages.map(
        (msg) => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
        })
      );

      const result = await coachConversationAction(playerId, groupId, input, conversationHistory);

      if ('error' in result) {
        throw new Error(result.error);
      }

      const coachMessage: Message = {
        role: 'coach',
        content: result.response,
        timestamp: new Date().toISOString(),
        mood: result.mood,
        suggestedActions: result.suggestedActions,
      };
      setMessages((prev) => [...prev, coachMessage]);
    } catch (error: any) {
      const errorMessage: Message = {
        role: 'coach',
        content: `Disculpá, tuve un problema procesando tu mensaje. ${error.message}`,
        timestamp: new Date().toISOString(),
        mood: 'supportive',
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="flex flex-col @container overflow-hidden">
      <CardHeader className="bg-[hsl(var(--whatsapp-green))] text-[hsl(var(--whatsapp-foreground))]">
        <CardTitle className="text-[hsl(var(--whatsapp-foreground))]">Charla con el DT</CardTitle>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col gap-0 overflow-hidden p-0">
        <div
          className="flex-grow overflow-y-auto pr-2 relative min-h-[200px] max-h-[50vh] chat-container"
          ref={scrollRef}
          onScroll={handleScroll}
        >
          <div className="space-y-3 p-4">
            {messages.map((message, index) => (
              <CoachMessageBubble key={index} message={message} />
            ))}
            {isLoading && (
              <div className="flex items-end gap-2 justify-start">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-[hsl(var(--whatsapp-green))] text-[hsl(var(--whatsapp-foreground))] text-xs font-bold">
                    DT
                  </AvatarFallback>
                </Avatar>
                <div className="chat-bubble-incoming rounded-bl-none px-3 py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
          </div>
          {showScrollButton && (
            <Button
              size="icon"
              className="absolute bottom-4 right-4 rounded-full h-10 w-10 shadow-lg bg-[hsl(var(--whatsapp-green))] hover:bg-[hsl(var(--whatsapp-green))]/90"
              onClick={scrollToBottom}
            >
              <ArrowDown className="h-5 w-5" />
            </Button>
          )}
        </div>
        <ChatInput onSend={handleSend} disabled={isLoading} placeholder="Escribí tu mensaje..." />
      </CardContent>
    </Card>
  );
}
