'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { getAppHelpAction } from '@/lib/actions';
import type { AppHelpInput, AppHelpOutput } from '@/ai/flows/get-app-help';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Send, Bot, User as UserIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from './ui/scroll-area';

type Message = {
  role: 'user' | 'agent';
  content: string;
};

interface HelpChatDialogProps {
  children: React.ReactNode;
}

export function HelpChatDialog({ children }: HelpChatDialogProps) {
  const [open, setOpen] = useState(false);
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
    if (open && messages.length === 0) {
      setMessages([
        {
          role: 'agent',
          content: '¡Hola! Soy el asistente de Pateá. ¿En qué te puedo ayudar sobre cómo funciona la app?',
        },
      ]);
    }
  }, [open, messages.length]);

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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="h-[70vh] w-[90vw] max-w-lg flex flex-col">
        <DialogHeader>
          <DialogTitle>Asistente de Ayuda</DialogTitle>
          <DialogDescription>Preguntale a la IA cómo usar la aplicación.</DialogDescription>
        </DialogHeader>
        <div className="flex-grow overflow-y-auto -mx-6 px-4">
            <ScrollArea className="h-full" ref={scrollRef}>
                <div className="space-y-4 py-4 pr-4">
                {messages.map((message, index) => (
                    <div key={index} className={cn('flex items-start gap-2 text-sm', message.role === 'user' ? 'justify-end' : 'justify-start')}>
                    {message.role === 'agent' && (
                        <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-primary text-primary-foreground"><Bot className="h-5 w-5" /></AvatarFallback>
                        </Avatar>
                    )}
                    <div className={cn('rounded-lg px-3 py-2 max-w-[85%]', message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                        <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                    {message.role === 'user' && (
                        <Avatar className="h-8 w-8">
                            <AvatarFallback><UserIcon className="h-5 w-5" /></AvatarFallback>
                        </Avatar>
                    )}
                    </div>
                ))}
                {isLoading && (
                    <div className="flex items-start gap-2 justify-start">
                    <Avatar className="h-8 w-8"><AvatarFallback className="bg-primary text-primary-foreground"><Bot className="h-5 w-5" /></AvatarFallback></Avatar>
                    <div className="bg-muted rounded-lg px-3 py-2"><Loader2 className="h-5 w-5 animate-spin" /></div>
                    </div>
                )}
                </div>
            </ScrollArea>
        </div>
        <div className="border-t pt-4 -mx-6 px-6">
          <div className="flex w-full items-center space-x-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }}}
              placeholder="Ej: ¿Cómo se actualiza mi OVR?"
              disabled={isLoading}
            />
            <Button onClick={handleSend} disabled={isLoading || !input.trim()} size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
