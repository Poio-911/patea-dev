'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { coachConversationAction } from '@/lib/actions';
import type { CoachConversationInput, CoachConversationOutput } from '@/ai/flows/coach-conversation';
import { useUser } from '@/firebase';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, ArrowDown } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { CoachIcon } from './icons/coach-icon';

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

export function CoachChatView({ playerId, groupId }: Props) {
  const { user } = useUser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
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
        const isScrolledToBottom = scrollRef.current.scrollHeight - scrollRef.current.clientHeight <= scrollRef.current.scrollTop + 1;
        if (isScrolledToBottom) {
             scrollToBottom();
        }
    }
  }, [messages, isLoading, scrollToBottom]);

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      // Show button if user has scrolled up more than 300px from the bottom
      setShowScrollButton(scrollHeight - clientHeight - scrollTop > 300);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !playerId || !groupId) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const conversationHistory: CoachConversationInput['conversationHistory'] = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
      }));

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
      setMessages(prev => [...prev, coachMessage]);
    } catch (error: any) {
      const errorMessage: Message = {
        role: 'coach',
        content: `Disculpá, tuve un problema procesando tu mensaje. ${error.message}`,
        timestamp: new Date().toISOString(),
        mood: 'supportive',
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="h-[70vh] flex flex-col">
        <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <CoachIcon className="h-6 w-6 text-primary" />
                Charla con el DT
            </CardTitle>
        </CardHeader>
        <div className="flex-1 overflow-y-auto px-4 relative" ref={scrollRef} onScroll={handleScroll}>
            <div className="space-y-4 py-4">
            {messages.map((message, index) => (
                <div key={index} className={cn('flex items-end gap-2 text-sm', message.role === 'user' ? 'justify-end' : 'justify-start')}>
                {message.role === 'coach' && (
                    <Avatar className="h-6 w-6">
                        <AvatarFallback className="bg-primary text-primary-foreground text-xs">DT</AvatarFallback>
                    </Avatar>
                )}
                <div className={cn('rounded-2xl px-3 py-2 max-w-[80%]', message.role === 'user' ? 'bg-primary text-primary-foreground rounded-br-none' : 'bg-muted rounded-bl-none')}>
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    {message.mood && <Badge variant="outline" className="mt-2 text-xs bg-background/50">{moodLabels[message.mood]}</Badge>}
                    {message.suggestedActions && message.suggestedActions.length > 0 && (
                        <div className="mt-3 space-y-2 border-t border-white/20 pt-2">
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
                </div>
                </div>
            ))}
            {isLoading && (
                <div className="flex items-end gap-2 justify-start">
                    <Avatar className="h-6 w-6"><AvatarFallback className="bg-primary text-primary-foreground text-xs">DT</AvatarFallback></Avatar>
                    <div className="bg-muted rounded-2xl rounded-bl-none px-3 py-2"><Loader2 className="h-4 w-4 animate-spin" /></div>
                </div>
            )}
            </div>
            {showScrollButton && (
                <Button size="icon" className="absolute bottom-4 right-4 rounded-full h-10 w-10 shadow-lg" onClick={scrollToBottom}>
                    <ArrowDown className="h-5 w-5" />
                </Button>
            )}
        </div>
        <div className="border-t p-4 flex gap-2">
          <Input value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }}} placeholder="Escribí tu mensaje..." disabled={isLoading} className="flex-1" />
          <Button onClick={handleSend} disabled={isLoading || !input.trim()} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
    </Card>
  );
}
