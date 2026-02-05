'use client';

import { type LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type CompetitionType = 'friendly' | 'league' | 'cup';

interface CompetitionCardProps {
    type: CompetitionType;
    title: string;
    icon: LucideIcon;
    stats?: { label: string; value: string | number }[];
    notificationCount?: number;
    onClick?: () => void;
    className?: string;
}

export function CompetitionCard({
    type,
    title,
    icon: Icon,
    stats = [],
    notificationCount,
    onClick,
    className,
}: CompetitionCardProps) {
    return (
        <Card
            className={cn(
                'relative overflow-hidden cursor-pointer',
                'rounded-2xl border',
                'p-5 flex flex-col gap-3 min-h-[200px]',
                'transition-all duration-300 ease-out',
                'hover:scale-[1.02] hover:-translate-y-1',
                // Glassmorphism - light for light theme, dark for dark theme
                'bg-white/50 dark:bg-black/50',
                'backdrop-blur-xl',
                'shadow-xl',
                // Border with accent color hint
                type === 'friendly' && 'border-emerald-200 dark:border-emerald-500/20 hover:border-emerald-400 dark:hover:border-emerald-500/50 hover:shadow-emerald-500/20',
                type === 'league' && 'border-blue-200 dark:border-blue-500/20 hover:border-blue-400 dark:hover:border-blue-500/50 hover:shadow-blue-500/20',
                type === 'cup' && 'border-amber-200 dark:border-amber-500/20 hover:border-amber-400 dark:hover:border-amber-500/50 hover:shadow-amber-500/20',
                className
            )}
            onClick={onClick}
        >
            {/* Subtle gradient overlay for depth */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/50 dark:from-white/5 via-transparent to-transparent dark:to-black/20 pointer-events-none" />

            {/* Notification Badge */}
            {(notificationCount ?? 0) > 0 && (
                <Badge
                    className={cn(
                        'absolute top-3 right-3 font-bold px-2.5 py-0.5 shadow-lg z-10',
                        type === 'friendly' && 'bg-emerald-500 text-white',
                        type === 'league' && 'bg-blue-500 text-white',
                        type === 'cup' && 'bg-amber-500 text-white',
                    )}
                    variant="default"
                >
                    {notificationCount}
                </Badge>
            )}

            {/* Icon with accent color */}
            <div className="flex items-center justify-center relative z-10">
                <Icon
                    className={cn(
                        'w-12 h-12 drop-shadow-lg',
                        type === 'friendly' && 'text-emerald-600 dark:text-emerald-400',
                        type === 'league' && 'text-blue-600 dark:text-blue-400',
                        type === 'cup' && 'text-amber-600 dark:text-amber-400',
                    )}
                    strokeWidth={2}
                />
            </div>

            {/* Title */}
            <h3 className="text-xl font-bold text-foreground text-center drop-shadow-sm dark:drop-shadow-md tracking-tight relative z-10">
                {title}
            </h3>

            {/* Quick Stats */}
            {stats.length > 0 && (
                <div className="flex flex-col gap-2 mt-auto relative z-10">
                    {stats.map((stat, index) => (
                        <div
                            key={index}
                            className={cn(
                                'flex items-center justify-between px-3 py-2 rounded-lg border',
                                'bg-black/5 dark:bg-black/30',
                                'border-black/10 dark:border-white/10'
                            )}
                        >
                            <span className="text-xs font-medium text-muted-foreground">{stat.label}</span>
                            <span className="text-sm font-bold text-foreground">{stat.value}</span>
                        </div>
                    ))}
                </div>
            )}
        </Card>
    );
}
