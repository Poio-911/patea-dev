'use client';

import Link from 'next/link';
import { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ArrowRight } from 'lucide-react';

interface CompetitionCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  variant: 'challenges' | 'teams' | 'search' | 'history';
  count?: number;
  stats?: {
    label: string;
    value: string | number;
  }[];
  disabled?: boolean;
}

const variantStyles = {
  challenges: {
    gradient: 'champions-gradient-challenges',
    border: 'champions-border-challenges',
    icon: 'champions-icon-challenges',
  },
  teams: {
    gradient: 'champions-gradient-teams',
    border: 'champions-border-teams',
    icon: 'champions-icon-teams',
  },
  search: {
    gradient: 'champions-gradient-search',
    border: 'champions-border-search',
    icon: 'champions-icon-search',
  },
  history: {
    gradient: 'champions-gradient-history',
    border: 'champions-border-history',
    icon: 'champions-icon-history',
  },
};

export function CompetitionCard({
  title,
  description,
  icon: Icon,
  href,
  variant,
  count,
  stats,
  disabled = false,
}: CompetitionCardProps) {
  const styles = variantStyles[variant];

  const content = (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl p-6 h-full min-h-[200px] flex flex-col',
        'champions-glass champions-hover',
        styles.gradient,
        styles.border,
        disabled && 'opacity-50 pointer-events-none'
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={cn('p-3 rounded-lg bg-background/50', styles.icon)}>
          <Icon className="h-8 w-8" />
        </div>
        {count !== undefined && count > 0 && (
          <Badge variant="secondary" className="text-sm font-bold">
            {count}
          </Badge>
        )}
      </div>

      <div className="space-y-2 flex-grow">
        <h3 className="text-xl font-bold tracking-tight">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>

      {stats && stats.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mt-4">
          {stats.map((stat, index) => (
            <div
              key={index}
              className="rounded-lg bg-background/30 p-3 border border-border/50"
            >
              <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
              <p className="text-lg font-bold">{stat.value}</p>
            </div>
          ))}
        </div>
      )}
      
      {!disabled && (
          <div className="absolute bottom-4 right-4 text-muted-foreground opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-transform">
            <ArrowRight className="h-5 w-5" />
          </div>
      )}
    </div>
  );
  
  return disabled ? <div>{content}</div> : <Link href={href} className="block">{content}</Link>;
}