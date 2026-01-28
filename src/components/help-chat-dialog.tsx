'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Bot, HelpCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChatInput } from '@/components/chat';

type Message = {
  role: 'user' | 'agent';
  content: string;
  timestamp: string;
};

function HelpMessageBubble({ message }: { message: Message }) {
  const formattedTime = format(new Date(message.timestamp), 'HH:mm', { locale: es });
  const isAgent = message.role === 'agent';

  return (
    <div className={cn('flex items-end gap-2 group', isAgent ? 'justify-start' : 'justify-end')}>
      {isAgent && (
        <Avatar className="h-7 w-7 flex-shrink-0">
          <AvatarFallback className="bg-[hsl(var(--whatsapp-green))] text-[hsl(var(--whatsapp-foreground))]">
            <Bot className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      )}

      <div
        className={cn(
          'relative px-3 py-2 max-w-[85%] rounded-lg text-sm',
          isAgent
            ? 'chat-bubble-incoming rounded-bl-none'
            : 'chat-bubble-outgoing rounded-br-none'
        )}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        <div
          className={cn('flex items-center justify-end chat-timestamp mt-1', !isAgent && 'text-[hsl(var(--whatsapp-foreground))]/70')}
        >
          <span>{formattedTime}</span>
        </div>
      </div>
    </div>
  );
}

export function HelpChatDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          role: 'agent',
          content: '¡Hola! Soy el asistente de Pateá. ¿En qué te puedo ayudar sobre cómo funciona la app?',
          timestamp: new Date().toISOString(),
        },
      ]);
    }
  }, [isOpen, messages.length]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  const handleSend = async (input: string) => {
    if (!input.trim()) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      setTimeout(() => {
        const agentMessage: Message = {
          role: 'agent',
          content: `No puedo procesar tu pregunta sobre "${input}" en este momento. La función de ayuda está en mantenimiento.`,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, agentMessage]);
        setIsLoading(false);
      }, 1000);
    } catch (error: any) {
      const errorMessage: Message = {
        role: 'agent',
        content: `Lo siento, tuve un problema. ${error.message}`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setIsLoading(false);
    }
  };

  return (
    <div className="relative">
      {/* Floating help button */}
      <div
        className={cn(
          'fixed bottom-4 right-4 z-40 transition-all pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)]',
          isOpen ? 'opacity-0 scale-90 pointer-events-none' : 'opacity-100 scale-100'
        )}
      >
        <Button
          className="rounded-full w-auto h-14 bg-[hsl(var(--whatsapp-green))] hover:bg-[hsl(var(--whatsapp-green))]/90 text-[hsl(var(--whatsapp-foreground))] shadow-lg transition-all px-4"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Open help chat"
        >
          <div className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            <span className="font-semibold">Ayuda</span>
          </div>
        </Button>
      </div>

      {/* Chat dialog */}
      <div
        className={cn(
          'fixed bottom-4 right-4 z-50 w-80 h-[28rem] flex flex-col bg-card/95 backdrop-blur-lg rounded-xl shadow-2xl border border-border overflow-hidden transition-all pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)]',
          isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none'
        )}
      >
        {/* Header */}
        <header className="p-3 flex justify-between items-center flex-shrink-0 bg-[hsl(var(--whatsapp-green))] text-[hsl(var(--whatsapp-foreground))]">
          <div className="flex items-center gap-2">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-[hsl(var(--whatsapp-foreground))]/20 text-[hsl(var(--whatsapp-foreground))]">
                <Bot className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            <h3 className="font-semibold text-sm">Asistente Pateá</h3>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-[hsl(var(--whatsapp-foreground))] hover:bg-[hsl(var(--whatsapp-foreground))]/20 hover:text-[hsl(var(--whatsapp-foreground))]"
            onClick={() => setIsOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </header>

        {/* Messages area */}
        <div className="flex-grow overflow-y-auto chat-container" ref={scrollRef}>
          <div className="p-4 space-y-3">
            {messages.map((message, index) => (
              <HelpMessageBubble key={index} message={message} />
            ))}
            {isLoading && (
              <div className="flex items-end gap-2 justify-start">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="bg-[hsl(var(--whatsapp-green))] text-[hsl(var(--whatsapp-foreground))]">
                    <Bot className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="chat-bubble-incoming rounded-bl-none px-3 py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Input area */}
        <div className="flex-shrink-0">
          <ChatInput onSend={handleSend} disabled={isLoading} placeholder="Escribe tu duda..." />
        </div>
      </div>
    </div>
  );
}
