'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Check, Star } from 'lucide-react';

interface PlayerOption {
    id: string;
    name: string;
    photoURL?: string;
    position?: string;
}

interface PlayerCarouselProps {
    players: PlayerOption[];
    selectedId?: string;
    onSelect: (id: string) => void;
    className?: string;
}

export function PlayerCarousel({
    players,
    selectedId,
    onSelect,
    className
}: PlayerCarouselProps) {
    return (
        <div className={cn('w-full', className)}>
            <ScrollArea className="w-full whitespace-nowrap pb-4">
                <div className="flex w-max space-x-4 p-1">
                    {players.map((player) => {
                        const isSelected = selectedId === player.id;

                        return (
                            <motion.button
                                key={player.id}
                                type="button"
                                onClick={() => onSelect(player.id)}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className={cn(
                                    'relative flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all duration-300 w-[120px]',
                                    isSelected
                                        ? 'border-blue-500 bg-blue-50 dark:border-yellow-500 dark:bg-yellow-500/10 shadow-md dark:shadow-[0_0_20px_rgba(234,179,8,0.2)] game:border-primary game:bg-primary/10 game:shadow-[0_0_20px_rgba(170,254,72,0.2)]'
                                        : 'border-slate-200 dark:border-white/5 bg-white dark:bg-white/5 hover:border-blue-300 dark:hover:border-white/20 hover:bg-slate-50 dark:hover:bg-white/10 game:bg-zinc-950/40 game:border-white/5 game:hover:border-primary/30'
                                )}
                            >
                                {/* Selection Indicator */}
                                <AnimatePresence>
                                    {isSelected && (
                                        <motion.div
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            exit={{ scale: 0 }}
                                            className="absolute top-2 right-2 h-6 w-6 rounded-full bg-yellow-500 flex items-center justify-center text-black shadow-lg z-10"
                                        >
                                            <Check className="h-4 w-4 stroke-[3px]" />
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Avatar with Ring */}
                                <div className={cn(
                                    "relative p-1 rounded-full border-2 transition-colors duration-300",
                                    isSelected ? "border-yellow-500" : "border-transparent"
                                )}>
                                    <Avatar className="h-16 w-16">
                                        <AvatarImage src={player.photoURL} alt={player.name} className="object-cover" />
                                        <AvatarFallback className="bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 font-bold text-lg">
                                            {player.name.charAt(0)}
                                        </AvatarFallback>
                                    </Avatar>

                                    {isSelected && (
                                        <motion.div
                                            className="absolute -bottom-2 inset-x-0 flex justify-center"
                                            initial={{ y: 5, opacity: 0 }}
                                            animate={{ y: 0, opacity: 1 }}
                                        >
                                            <Star className="h-5 w-5 fill-yellow-500 text-yellow-500" />
                                        </motion.div>
                                    )}
                                </div>

                                {/* Name & Position */}
                                <div className="flex flex-col items-center text-center w-full">
                                    <span className={cn(
                                        "text-sm font-bold truncate w-full",
                                        isSelected ? "text-blue-700 dark:text-yellow-400" : "text-slate-700 dark:text-zinc-300"
                                    )}>
                                        {player.name}
                                    </span>
                                    {player.position && (
                                        <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                            {player.position}
                                        </span>
                                    )}
                                </div>
                            </motion.button>
                        );
                    })}
                </div>
                <ScrollBar orientation="horizontal" className="bg-white/5" />
            </ScrollArea>
        </div>
    );
}
