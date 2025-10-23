
'use client';

import { useState, useRef, useEffect } from 'react';
import { coachConversationAction } from '@/lib/actions';
import type { CoachConversationInput, CoachConversationOutput } from '@/ai/flows/coach-conversation';
import { useUser } from '@/firebase';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Loader2, MessageCircle, Send, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

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

export function CoachChatDialog({ playerId, groupId }: Props) {
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && messages.length === 0) {
      const welcomeMessage: Message = {
        role: 'coach',
        content: '¡Hola! Soy tu DT virtual. ¿En qué puedo ayudarte hoy? Podés preguntarme sobre tu rendimiento, pedir consejos tácticos, o charlar sobre cómo mejorar tu juego.',
        timestamp: new Date().toISOString(),
        mood: 'supportive',
      };
      setMessages([welcomeMessage]);
    }
  }, [open, messages.length]);

  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-full shadow-lg hover:shadow-xl transition-shadow" size="lg">
          <MessageCircle className="mr-2 h-5 w-5" />
          Hablar con el DT
        </Button>
      </DialogTrigger>
      <DialogContent className="h-[600px] max-w-2xl flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Tu Entrenador Virtual
          </DialogTitle>
          <DialogDescription>Chateá con tu DT personal para recibir consejos personalizados</DialogDescription>
        </DialogHeader>

        <div ref={scrollRef} className="flex-1 overflow-y-auto pr-4 -mx-6 px-6">
            <div className="space-y-4">
            {messages.map((message, index) => (
                <div key={index} className={cn('flex gap-3', message.role === 'user' ? 'justify-end' : 'justify-start')}>
                {message.role === 'coach' && (
                    <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-primary-foreground">DT</AvatarFallback>
                    </Avatar>
                )}
                <div className={cn('rounded-lg px-4 py-2 max-w-[80%]', message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    {message.mood && <Badge variant="outline" className="mt-2 text-xs">{moodLabels[message.mood]}</Badge>}
                    {message.suggestedActions && message.suggestedActions.length > 0 && (
                    <div className="mt-3 space-y-2">
                        <p className="text-xs font-semibold">Acciones sugeridas:</p>
                        <ul className="space-y-1">
                        {message.suggestedActions.map((action, i) => (
                            <li key={i} className="text-xs flex items-start gap-1">
                            <span className="text-primary">•</span>
                            <span>{action}</span>
                            </li>
                        ))}
                        </ul>
                    </div>
                    )}
                    <p className="text-xs opacity-70 mt-1 text-right">{format(new Date(message.timestamp), 'HH:mm')}</p>
                </div>
                {message.role === 'user' && user && (
                    <Avatar className="h-8 w-8">
                    <AvatarFallback>{user.displayName?.charAt(0) || 'U'}</AvatarFallback>
                    </Avatar>
                )}
                </div>
            ))}
            {isLoading && (
                <div className="flex gap-3 justify-start">
                <Avatar className="h-8 w-8"><AvatarFallback className="bg-primary text-primary-foreground">DT</AvatarFallback></Avatar>
                <div className="bg-muted rounded-lg px-4 py-2"><Loader2 className="h-4 w-4 animate-spin" /></div>
                </div>
            )}
            </div>
        </div>

        <div className="border-t pt-4 flex gap-2">
          <Input value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }}} placeholder="Escribí tu mensaje..." disabled={isLoading} className="flex-1" />
          <Button onClick={handleSend} disabled={isLoading || !input.trim()} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
