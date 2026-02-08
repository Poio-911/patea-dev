'use client';

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Calendar, MapPin, Clock, Trophy, Crown, Swords } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Match } from '@/lib/types';

interface MatchEventCardProps {
    match: Match;
    children?: React.ReactNode;
    className?: string;
    onClick?: () => void;
}

export function MatchEventCard({ match, children, className, onClick }: MatchEventCardProps) {
    // Determine gradient based on match type (heuristic based on title or properties)
    // Ideally, Match type should have a 'type' field. Assuming title contains keywords or defaulting.
    // For now, let's use a robust default and try to sniff type.
    const isCup = match.title?.toLowerCase().includes('copa') || match.title?.toLowerCase().includes('cup');
    const isLeague = match.title?.toLowerCase().includes('liga') || match.title?.toLowerCase().includes('league') || match.title?.toLowerCase().includes('fecha');
    const isFriendly = !isCup && !isLeague;

    const typeConfig = {
        cup: {
            gradient: 'from-amber-900/40 via-yellow-900/20 to-zinc-950',
            border: 'border-amber-700/30 hover:border-amber-500/50',
            icon: <Trophy className="h-4 w-4 text-amber-500" />,
            label: 'COPA',
            accent: 'text-amber-500',
        },
        league: {
            gradient: 'from-blue-900/40 via-cyan-900/20 to-zinc-950',
            border: 'border-cyan-700/30 hover:border-cyan-500/50',
            icon: <Crown className="h-4 w-4 text-cyan-500" />,
            label: 'LIGA',
            accent: 'text-cyan-500',
        },
        friendly: {
            gradient: 'from-emerald-900/40 via-green-900/20 to-zinc-950',
            border: 'border-emerald-700/30 hover:border-emerald-500/50',
            icon: <Swords className="h-4 w-4 text-emerald-500" />,
            label: 'AMISTOSO',
            accent: 'text-emerald-500',
        },
    };

    const config = isCup ? typeConfig.cup : isLeague ? typeConfig.league : typeConfig.friendly;

    return (
        <Card
            onClick={onClick}
            className={cn(
                'relative overflow-hidden group transition-all duration-300',
                'bg-white dark:bg-zinc-950/80 backdrop-blur-md',
                'border-l-4', // Left border accent
                config.border,
                onClick && 'cursor-pointer hover:shadow-lg hover:shadow-black/40 hover:-translate-y-0.5',
                // Specific left border color override
                isCup ? 'border-l-amber-500' : isLeague ? 'border-l-cyan-500' : 'border-l-emerald-500',
                className
            )}
        >
            {/* Background Gradient */}
            <div className={cn('absolute inset-0 bg-gradient-to-br opacity-50', config.gradient)} />

            {/* Texture overlay (dots) */}
            <div
                className="absolute inset-0 opacity-[0.03] pointer-events-none"
                style={{
                    backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
                    backgroundSize: '16px 16px'
                }}
            />

            <CardContent className="relative p-5 space-y-4">
                {/* Header: Type & Date */}
                <div className="flex justify-between items-start">
                    <Badge
                        variant="outline"
                        className={cn(
                            'bg-zinc-100 dark:bg-black/40 border border-zinc-200 dark:border-0 backdrop-blur-sm flex items-center gap-1.5 px-2.5 py-0.5 text-[10px] tracking-widest font-bold',
                            config.accent
                        )}
                    >
                        {config.icon}
                        {config.label}
                    </Badge>
                    <div className="text-xs font-mono text-zinc-500 dark:text-zinc-400 flex items-center gap-1 bg-zinc-100 dark:bg-black/20 px-2 py-1 rounded">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(match.date), 'dd MMM', { locale: es }).toUpperCase()}
                    </div>
                </div>

                {/* Match Title & Location */}
                <div>
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white group-hover:text-primary dark:group-hover:text-white transition-colors line-clamp-1 leading-tight">
                        {match.title}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate max-w-[200px]">{match.location.name}</span>
                    </div>
                </div>

                {/* Content Slot (Progress, buttons, etc) */}
                <div className="pt-2">
                    {children}
                </div>

            </CardContent>
        </Card >
    );
}
