'use client';

import { LayoutGrid, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { MatchesViewMode } from '@/lib/types';

interface ViewModeToggleProps {
  viewMode: MatchesViewMode;
  onViewModeChange: (mode: MatchesViewMode) => void;
  className?: string;
}

export function ViewModeToggle({ viewMode, onViewModeChange, className }: ViewModeToggleProps) {
  return (
    <div className={cn('flex items-center gap-1 rounded-lg border bg-muted p-1', className)}>
      <Button
        variant={viewMode === 'grid' ? 'default' : 'ghost'}
        size="sm"
        className="h-7 w-7 p-0"
        onClick={() => onViewModeChange('grid')}
        title="Vista en grilla"
      >
        <LayoutGrid className="h-4 w-4" />
      </Button>
      <Button
        variant={viewMode === 'compact' ? 'default' : 'ghost'}
        size="sm"
        className="h-7 w-7 p-0"
        onClick={() => onViewModeChange('compact')}
        title="Vista compacta"
      >
        <List className="h-4 w-4" />
      </Button>
    </div>
  );
}
