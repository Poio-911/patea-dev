'use client';

import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface ChatLoadingStateProps {
  className?: string;
}

export function ChatLoadingState({ className }: ChatLoadingStateProps) {
  return (
    <div className={cn('flex items-center justify-center h-full', className)}>
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}
