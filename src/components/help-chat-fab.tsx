'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { HelpCircle, Send, Loader2, Bot, User } from 'lucide-react';
import { getAppHelpAction } from '@/lib/actions/ai-actions';
import { cn } from '@/lib/utils';
import { useUser } from '@/firebase';

type Message = {
  id: string;
  role: 'user' | 'agent';
  content: string;
};

export function HelpChatFab() {
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when sheet opens
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Build conversation history for context
      const conversationHistory = messages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      const result = await getAppHelpAction({
        userMessage: userMessage.content,
        conversationHistory,
      });

      const agentMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'agent',
        content: result.response || result.error || 'No se pudo obtener respuesta.',
      };

      setMessages(prev => [...prev, agentMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'agent',
        content: 'Hubo un error al procesar tu pregunta. Intentá de nuevo.',
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Don't show FAB if user is not logged in
  if (!user) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          size="icon"
          className="fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-lg z-40 md:bottom-6"
          aria-label="Abrir ayuda"
        >
          <HelpCircle className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex flex-col p-0 w-full sm:max-w-md">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Asistente Pateá
          </SheetTitle>
        </SheetHeader>

        {/* Messages area */}
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-8">
              <Bot className="h-12 w-12 mb-4 opacity-50" />
              <p className="font-medium mb-2">¡Hola! Soy el asistente de Pateá</p>
              <p className="text-sm">
                Preguntame sobre cómo usar la app, crear partidos, evaluar jugadores, y más.
              </p>
              <div className="mt-4 space-y-2 text-sm">
                <p className="text-primary cursor-pointer hover:underline" onClick={() => setInput('¿Cómo creo un partido?')}>
                  ¿Cómo creo un partido?
                </p>
                <p className="text-primary cursor-pointer hover:underline" onClick={() => setInput('¿Cómo funcionan las evaluaciones?')}>
                  ¿Cómo funcionan las evaluaciones?
                </p>
                <p className="text-primary cursor-pointer hover:underline" onClick={() => setInput('¿Qué son los grupos?')}>
                  ¿Qué son los grupos?
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    'flex gap-3',
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  {message.role === 'agent' && (
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        <Bot className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={cn(
                      'max-w-[80%] rounded-lg px-3 py-2 text-sm',
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    )}
                  >
                    {message.content}
                  </div>
                  {message.role === 'user' && (
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback>
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      <Bot className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-muted rounded-lg px-3 py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Input area */}
        <div className="p-4 border-t">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              placeholder="Escribí tu pregunta..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
