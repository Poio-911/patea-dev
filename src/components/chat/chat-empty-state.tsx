'use client';

import { cn } from '@/lib/utils';
import { MessageCircle } from 'lucide-react';

interface ChatEmptyStateProps {
  title?: string;
  description?: string;
  className?: string;
}

export function ChatEmptyState({
  title = 'No hay mensajes',
  description = '¡Sé el primero en saludar!',
  className
}: ChatEmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center h-full gap-3 text-center p-6', className)}>
      <div className="rounded-full bg-muted p-4">
        <MessageCircle className="h-8 w-8 text-muted-foreground" />
      </div>
      <div>
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
