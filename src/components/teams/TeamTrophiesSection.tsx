'use client';

import { motion } from 'framer-motion';
import { Trophy } from 'lucide-react';
import { Cup, League } from '@/lib/types';

type Championship = {
    id: string;
    name: string;
    type: 'cup' | 'league';
    completedAt?: string;
};

type TeamTrophiesSectionProps = {
    cups: Cup[];
    leagues: League[];
};

export function TeamTrophiesSection({ cups, leagues }: TeamTrophiesSectionProps) {
    const championships: Championship[] = [
        ...cups.map(c => ({
            id: c.id,
            name: c.name,
            type: 'cup' as const,
            completedAt: c.completedAt,
        })),
        ...leagues.map(l => ({
            id: l.id,
            name: l.name,
            type: 'league' as const,
            completedAt: l.completedAt,
        })),
    ].sort((a, b) => {
        // Sort by completion date descending (most recent first)
        if (!a.completedAt) return 1;
        if (!b.completedAt) return -1;
        return new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime();
    });

    if (championships.length === 0) return null;

    return (
        <motion.div
            className="flex flex-col items-center gap-3"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
        >
            <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
                Palmarés
            </span>
            <div className="flex flex-wrap justify-center gap-2">
                {championships.map((c, i) => {
                    const year = c.completedAt
                        ? new Date(c.completedAt).getFullYear()
                        : null;

                    return (
                        <motion.div
                            key={c.id}
                            initial={{ opacity: 0, scale: 0.7 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.15 * i, type: 'spring', stiffness: 280, damping: 20 }}
                            className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold
                ${c.type === 'cup'
                                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
                                    : 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400'
                                }
              `}
                        >
                            <Trophy className="h-3.5 w-3.5 fill-current opacity-80" />
                            <span>{c.name}</span>
                            {year && (
                                <span className="opacity-60 text-[10px]">{year}</span>
                            )}
                        </motion.div>
                    );
                })}
            </div>
        </motion.div>
    );
}
