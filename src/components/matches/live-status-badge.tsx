'use client';

import { cn } from '@/lib/utils';

export type StatusType = 'live' | 'upcoming' | 'today' | 'finished';

interface LiveStatusBadgeProps {
  status: StatusType;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const statusConfig: Record<StatusType, { label: string; bgClass: string; textClass: string; showDot: boolean }> = {
  live: {
    label: 'EN VIVO',
    bgClass: 'bg-primary/15 border border-primary/30',
    textClass: 'text-foreground',
    showDot: true,
  },
  upcoming: {
    label: 'PRÓXIMO',
    bgClass: 'bg-primary/10 border border-primary/30',
    textClass: 'text-foreground',
    showDot: false,
  },
  today: {
    label: 'HOY',
    bgClass: 'bg-muted/30 border border-muted/50',
    textClass: 'text-foreground',
    showDot: false,
  },
  finished: {
    label: 'FINALIZADO',
    bgClass: 'bg-muted/40 border border-muted/60',
    textClass: 'text-muted-foreground',
    showDot: false,
  },
};

const sizeConfig = {
  sm: 'px-2 py-0.5 text-[10px]',
  md: 'px-3 py-1 text-xs',
  lg: 'px-4 py-1.5 text-sm',
};

export function LiveStatusBadge({ status, className, size = 'md' }: LiveStatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-bold uppercase tracking-wide rounded-full backdrop-blur-sm',
        config.bgClass,
        config.textClass,
        sizeConfig[size],
        status === 'live' && 'badge-glow',
        className
      )}
    >
      {config.showDot && (
        <span className="live-dot" />
      )}
      {config.label}
    </span>
  );
}
