'use client';

import { cn } from '@/lib/utils';
import { type LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatTileProps {
    label: string;
    value: string | number;
    trend?: 'up' | 'down' | 'neutral';
    icon?: LucideIcon;
    className?: string;
    valueClassName?: string;
}

export function StatTile({
    label,
    value,
    trend,
    icon: Icon,
    className,
    valueClassName,
}: StatTileProps) {
    const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
    const trendColor = trend === 'up' ? 'text-success' : trend === 'down' ? 'text-destructive' : 'text-muted-foreground';

    return (
        <div
            className={cn(
                'flex flex-col gap-1 p-4 rounded-lg',
                'bg-card border border-border',
                'transition-colors hover:bg-accent/50',
                className
            )}
        >
            <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{label}</span>
                {Icon && <Icon className="w-4 h-4 text-muted-foreground" />}
            </div>

            <div className="flex items-baseline gap-2">
                <span
                    className={cn(
                        'text-2xl font-bold',
                        valueClassName
                    )}
                >
                    {value}
                </span>

                {trend && (
                    <TrendIcon className={cn('w-4 h-4', trendColor)} />
                )}
            </div>
        </div>
    );
}
