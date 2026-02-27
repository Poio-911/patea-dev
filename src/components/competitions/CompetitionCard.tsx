'use client';

import { type LucideIcon } from 'lucide-react';
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
    isActive?: boolean;
}

const typeConfig = {
    friendly: {
        gradient: 'from-emerald-600 via-emerald-500 to-teal-400',
        darkGradient: 'dark:from-emerald-900 dark:via-emerald-800 dark:to-teal-800',
        gameGradient: 'game:from-emerald-700 game:via-emerald-600 game:to-teal-500',
        gameShadow: 'game:shadow-emerald-500/40 game:ring-1 game:ring-emerald-400/30',
        activeRing: 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-background',
        activeBar: 'bg-emerald-400',
        shadow: 'shadow-emerald-500/40',
    },
    league: {
        gradient: 'from-blue-600 via-blue-500 to-indigo-500',
        darkGradient: 'dark:from-blue-900 dark:via-blue-800 dark:to-indigo-900',
        gameGradient: 'game:from-blue-700 game:via-blue-600 game:to-indigo-600',
        gameShadow: 'game:shadow-blue-500/40 game:ring-1 game:ring-blue-400/30',
        activeRing: 'ring-2 ring-blue-400 ring-offset-2 ring-offset-background',
        activeBar: 'bg-blue-400',
        shadow: 'shadow-blue-500/40',
    },
    cup: {
        gradient: 'from-amber-600 via-amber-500 to-yellow-400',
        darkGradient: 'dark:from-amber-900 dark:via-amber-800 dark:to-yellow-800',
        gameGradient: 'game:from-amber-700 game:via-amber-600 game:to-yellow-500',
        gameShadow: 'game:shadow-amber-500/40 game:ring-1 game:ring-amber-400/30',
        activeRing: 'ring-2 ring-amber-400 ring-offset-2 ring-offset-background',
        activeBar: 'bg-amber-400',
        shadow: 'shadow-amber-500/40',
    },
} as const;

export function CompetitionCard({
    type,
    title,
    icon: Icon,
    stats = [],
    notificationCount,
    onClick,
    className,
    isActive = false,
}: CompetitionCardProps) {
    const config = typeConfig[type];

    return (
        <div
            className={cn(
                'relative overflow-hidden cursor-pointer rounded-2xl',
                'transition-all duration-300 ease-out',
                // Active vs inactive state
                isActive
                    ? [config.activeRing, 'scale-[1.03] -translate-y-2', `shadow-2xl ${config.shadow}`, config.gameShadow]
                    : ['shadow-lg opacity-80 hover:opacity-100 hover:scale-[1.02] hover:-translate-y-1', config.gameShadow],
                className
            )}
            onClick={onClick}
        >
            {/* Active bottom accent bar */}
            {isActive && (
                <div className={cn('absolute bottom-0 left-0 right-0 h-1 z-20', config.activeBar)} />
            )}

            {/* Gradient background */}
            <div className={cn('absolute inset-0 bg-gradient-to-br', config.gradient, config.darkGradient, config.gameGradient)} />

            {/* Dot pattern overlay */}
            <div
                className="absolute inset-0 opacity-[0.08]"
                style={{
                    backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
                    backgroundSize: '20px 20px',
                }}
            />

            {/* Top shine */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/25 to-transparent pointer-events-none" />

            {/* Notification Badge */}
            {(notificationCount ?? 0) > 0 && (
                <Badge className="absolute top-3 right-3 font-bold px-2.5 py-0.5 shadow-lg z-10 bg-white/90 text-foreground border-0 backdrop-blur-sm">
                    {notificationCount}
                </Badge>
            )}

            {/* Content */}
            <div className="relative z-10 p-5 flex flex-col gap-3 min-h-[200px]">
                {/* Icon */}
                <div className="flex items-center justify-center">
                    <Icon
                        className="w-12 h-12 text-white drop-shadow-lg"
                        strokeWidth={1.5}
                    />
                </div>

                {/* Title */}
                <h3 className="text-xl font-bold text-white text-center drop-shadow-md tracking-tight">
                    {title}
                </h3>

                {/* Active pill */}
                {isActive && (
                    <div className="flex items-center justify-center">
                        <span className="text-[11px] font-semibold text-white/90 bg-white/25 px-2.5 py-0.5 rounded-full uppercase tracking-widest">
                            Activo
                        </span>
                    </div>
                )}

                {/* Quick Stats */}
                {stats.length > 0 && (
                    <div className="flex flex-col gap-2 mt-auto">
                        {stats.map((stat, index) => (
                            <div
                                key={index}
                                className="flex items-center justify-between px-3 py-2 rounded-xl bg-black/20 backdrop-blur-sm"
                            >
                                <span className="text-xs font-medium text-white/70">{stat.label}</span>
                                <span className="text-sm font-bold text-white">{stat.value}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
