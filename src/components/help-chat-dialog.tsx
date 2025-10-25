
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { getAppHelpAction } from '@/lib/actions';
import type { AppHelpInput } from '@/ai/flows/get-app-help';
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
    setInput('');
    setIsLoading(true);

    try {
      const conversationHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      const result = await getAppHelpAction(input, conversationHistory);

      if ('error' in result) throw new Error(result.error);
      
      const agentMessage: Message = { role: 'agent', content: result.response };
      setMessages(prev => [...prev, agentMessage]);

    } catch (error: any) {
      const errorMessage: Message = { role: 'agent', content: `Lo siento, tuve un problema. ${error.message}` };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
        <AnimatePresence>
            {isOpen && (
                 <motion.div
                    initial={{ opacity: 0, y: 50, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 50, scale: 0.9 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    className="w-80 h-[28rem] flex flex-col bg-background/70 backdrop-blur-lg rounded-xl shadow-2xl border border-primary/20 overflow-hidden"
                >
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
                     <div className="border-t p-2">
                        <div className="flex w-full items-center space-x-2">
                            <Input
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyPress={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }}}
                                placeholder="Escribe tu duda..."
                                disabled={isLoading}
                                className="bg-background/80 border-primary/20"
                            />
                            <Button onClick={handleSend} disabled={isLoading || !input.trim()} size="icon">
                                <Send className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
        
        <Button
            className="rounded-full w-auto h-14 bg-background/70 backdrop-blur-lg border-2 border-primary/50 text-primary shadow-lg hover:bg-background/90 hover:scale-105 active:scale-95 transition-all px-4 mt-4"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle help chat"
        >
             <AnimatePresence initial={false} mode="wait">
                <motion.div
                    key={isOpen ? 'x' : 'help'}
                    initial={{ rotate: -45, opacity: 0, scale: 0.5 }}
                    animate={{ rotate: 0, opacity: 1, scale: 1 }}
                    exit={{ rotate: 45, opacity: 0, scale: 0.5 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center gap-2"
                >
                    {isOpen ? <X className="h-6 w-6" /> : <><HelpCircle className="h-5 w-5" /> <span className="font-semibold">Ayuda</span></>}
                </motion.div>
            </AnimatePresence>
        </Button>
    </div>
  );
}

