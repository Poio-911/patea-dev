
'use client';

import { CompetitionType } from '@/lib/types';
import { LucideIcon, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface CompetitionCardProps {
    type: CompetitionType | 'friendly';
    title: string;
    icon: LucideIcon;
    notificationCount?: number;
    stats?: { label: string; value: number | string }[];
    className?: string;
}

const config = {
    friendly: {
        label: 'Amistoso',
        border: 'border-l-emerald-500',
        badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
        iconBg: 'bg-emerald-500/10 text-emerald-500',
        shadow: 'hover:shadow-emerald-500/10',
        accent: 'text-emerald-500',
    },
    league: {
        label: 'Liga',
        border: 'border-l-blue-500',
        badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
        iconBg: 'bg-blue-500/10 text-blue-500',
        shadow: 'hover:shadow-blue-500/10',
        accent: 'text-blue-500',
    },
    cup: {
        label: 'Copa',
        border: 'border-l-amber-500',
        badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
        iconBg: 'bg-amber-500/10 text-amber-500',
        shadow: 'hover:shadow-amber-500/10',
        accent: 'text-amber-500',
    },
};

export function CompetitionCard({ type, title, icon: Icon, notificationCount, stats, className }: CompetitionCardProps) {
    const c = config[type === 'friendly' ? 'friendly' : type as keyof typeof config];

    return (
        <motion.div
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.99 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className={cn(
                "group relative flex flex-col p-5 md:p-6 min-h-[180px]",
                "bg-card border border-border border-l-4 rounded-2xl",
                "shadow-sm hover:shadow-lg transition-shadow duration-300",
                c.border,
                c.shadow,
                className
            )}
        >
            {/* Header row */}
            <div className="flex items-start justify-between gap-3 mb-auto">
                <div className="space-y-2">
                    {/* Type badge */}
                    <span className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold sport-text tracking-widest uppercase",
                        c.badge
                    )}>
                        {c.label}
                    </span>
                    {/* Title */}
                    <h3 className="text-2xl md:text-3xl font-black sport-text leading-none tracking-tight">
                        {title}
                    </h3>
                </div>
                {/* Icon circle */}
                <div className={cn("flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center", c.iconBg)}>
                    <Icon className="w-5 h-5" strokeWidth={2.5} />
                </div>
            </div>

            {/* Notification badge */}
            {!!notificationCount && (
                <div className="absolute -top-2 -right-2 z-20">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-[10px] font-black sport-text text-white shadow-lg shadow-red-500/30 animate-bounce">
                        {notificationCount}
                    </span>
                </div>
            )}

            {/* Stats */}
            {stats && stats.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-4">
                    {stats.map((stat, idx) => (
                        <div key={idx}>
                            <p className="text-[9px] font-bold uppercase tracking-widest sport-text text-muted-foreground leading-none mb-1">
                                {stat.label}
                            </p>
                            <p className={cn("text-2xl font-black tabular-nums leading-none sport-text", c.accent)}>
                                {stat.value}
                            </p>
                        </div>
                    ))}
                </div>
            )}

            {/* Chevron hint on hover */}
            <ChevronRight className={cn(
                "absolute bottom-4 right-4 w-4 h-4 opacity-0 group-hover:opacity-40 transition-opacity",
                c.accent
            )} />
        </motion.div>
    );
}
