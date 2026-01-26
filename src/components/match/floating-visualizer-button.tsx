"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { MonitorPlay, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

type FloatingVisualizerButtonProps = {
  visible: boolean;
  onClick: () => void;
  watchers?: number;
};

export function FloatingVisualizerButton({ visible, onClick, watchers = 0 }: FloatingVisualizerButtonProps) {
  if (!visible) return null;
  return (
    <div
      className="fixed right-4 z-50"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
    >
      <Button
        onClick={onClick}
        className={cn(
          'rounded-full shadow-lg px-5 h-12 bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2'
        )}
      >
        <MonitorPlay className="h-5 w-5" />
        <span className="font-medium hidden xs:inline">Ver partido</span>
        <span className="sr-only">Abrir visualizador</span>
        {watchers > 0 && (
          <span className="ml-1 inline-flex items-center text-xs bg-black/20 rounded-full px-2 py-0.5">
            <Eye className="h-3.5 w-3.5 mr-1" />
            {watchers}
          </span>
        )}
      </Button>
    </div>
  );
}
