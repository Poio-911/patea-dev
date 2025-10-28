'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Send, Bot, HelpCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from './ui/scroll-area';

type Message = {
  role: 'user' | 'agent';
  content: string;
};

export function HelpChatDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
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
        },
      ]);
    }
  }, [isOpen, messages.length]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);

    try {
      // Simulación de respuesta de IA ya que la función real fue eliminada
      setTimeout(() => {
        const agentMessage: Message = { role: 'agent', content: `No puedo procesar tu pregunta sobre "${currentInput}" en este momento. La función de ayuda está en mantenimiento.` };
        setMessages(prev => [...prev, agentMessage]);
        setIsLoading(false);
      }, 1000);

    } catch (error: any) {
      const errorMessage: Message = { role: 'agent', content: `Lo siento, tuve un problema. ${error.message}` };
      setMessages(prev => [...prev, errorMessage]);
      setIsLoading(false);
    }
  };

  return (
    <div className="relative">
        <div className={cn("fixed bottom-4 right-4 z-40 transition-all", isOpen ? "opacity-0 scale-90 pointer-events-none" : "opacity-100 scale-100")}>
            <Button
                className="rounded-full w-auto h-14 bg-background/70 backdrop-blur-lg border-2 border-primary/50 text-primary shadow-lg hover:bg-background/90 hover:scale-105 active:scale-95 transition-all px-4"
                onClick={() => setIsOpen(!isOpen)}
                aria-label="Open help chat"
            >
                <div className="flex items-center gap-2">
                    <HelpCircle className="h-5 w-5" />
                    <span className="font-semibold">Ayuda</span>
                </div>
            </Button>
        </div>

        <div className={cn("fixed bottom-4 right-4 z-50 w-80 h-[28rem] flex flex-col bg-background/70 backdrop-blur-lg rounded-xl shadow-2xl border border-primary/20 overflow-hidden transition-all", isOpen ? "opacity-100 scale-100" : "opacity-0 scale-90 pointer-events-none")}>
            <header className="p-2 border-b flex justify-between items-center flex-shrink-0">
                <div className="flex items-center gap-2">
                     <Avatar className="h-6 w-6"><AvatarFallback className="bg-primary text-primary-foreground"><Bot className="h-4 w-4" /></AvatarFallback></Avatar>
                     <h3 className="font-semibold text-sm">Asistente Pateá</h3>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsOpen(false)}>
                    <X className="h-4 w-4" />
                </Button>
            </header>
            <div className="flex-grow overflow-y-auto">
                <ScrollArea className="h-full" ref={scrollRef}>
                     <div className="p-4 space-y-4">
                        {messages.map((message, index) => (
                            <div key={index} className={cn('flex items-start gap-2 text-sm', message.role === 'user' ? 'justify-end' : 'justify-start')}>
                                {message.role === 'agent' && <Avatar className="h-6 w-6"><AvatarFallback className="bg-primary text-primary-foreground"><Bot className="h-4 w-4" /></AvatarFallback></Avatar>}
                                <div className={cn('rounded-lg px-3 py-2 max-w-[85%]', message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-background/80')}>
                                    <p className="whitespace-pre-wrap">{message.content}</p>
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex items-start gap-2 justify-start">
                                <Avatar className="h-6 w-6"><AvatarFallback className="bg-primary text-primary-foreground"><Bot className="h-4 w-4" /></AvatarFallback></Avatar>
                                <div className="bg-background/80 rounded-lg px-3 py-2"><Loader2 className="h-5 w-5 animate-spin" /></div>
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </div>
             <div className="border-t p-2 flex-shrink-0">
                <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex w-full items-center space-x-2">
                    <Input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Escribe tu duda..."
                        disabled={isLoading}
                        className="bg-background/80 border-primary/20"
                    />
                    <Button type="submit" disabled={isLoading || !input.trim()} size="icon">
                        <Send className="h-4 w-4" />
                    </Button>
                </form>
            </div>
        </div>
    </div>
  );
}
