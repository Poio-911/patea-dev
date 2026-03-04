'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ChevronUp, ChevronDown, Plus, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CounterDialProps {
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
    label?: string;
    className?: string;
    icon?: React.ReactNode;
}

export function CounterDial({
    value,
    onChange,
    min = 0,
    max = 99,
    label,
    className,
    icon
}: CounterDialProps) {
    const handleIncrement = () => {
        if (value < max) onChange(value + 1);
    };

    const handleDecrement = () => {
        if (value > min) onChange(value - 1);
    };

    return (
        <div className={cn('flex flex-col items-center gap-2', className)}>
            {label && <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">{label}</span>}

            <div className="relative flex items-center gap-3 bg-slate-100 dark:bg-zinc-900/80 p-1.5 rounded-full border border-slate-200 dark:border-white/5 shadow-inner game:bg-black/40 game:border-primary/20">
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-full bg-white dark:bg-white/5 hover:bg-red-500/20 hover:text-red-600 dark:hover:text-red-400 border border-transparent hover:border-red-500/50 transition-all active:scale-95 shadow-sm dark:shadow-none game:bg-zinc-900/50 game:text-white game:hover:bg-red-500/30 game:border-white/5"
                    onClick={handleDecrement}
                    disabled={value <= min}
                >
                    <Minus className="h-5 w-5" />
                </Button>

                <div className="relative w-16 h-16 flex items-center justify-center">
                    {/* Glowing Ring */}
                    <div className={cn(
                        "absolute inset-0 rounded-full border-2 opacity-50 transition-colors duration-300",
                        value > 0 ? "border-blue-500 dark:border-cyan-500 game:border-primary game:opacity-100" : "border-slate-300 dark:border-zinc-700 game:border-white/10"
                    )} />

                    {value > 0 && (
                        <div className="absolute inset-0 rounded-full bg-primary/20 blur-md hidden game:block animate-pulse" />
                    )}

                    {/* Value Display */}
                    <AnimatePresence mode="popLayout">
                        <motion.span
                            key={value}
                            initial={{ y: 20, opacity: 0, scale: 0.5 }}
                            animate={{ y: 0, opacity: 1, scale: 1 }}
                            exit={{ y: -20, opacity: 0, scale: 0.5 }}
                            className={cn(
                                "text-3xl font-bold font-mono nums-tabular z-10",
                                value > 0 ? "text-blue-600 dark:text-cyan-400 game:text-primary" : "text-slate-400 dark:text-zinc-500 game:text-white/20"
                            )}
                        >
                            {value}
                        </motion.span>
                    </AnimatePresence>

                    {/* Icon Overlay */}
                    {icon && (
                        <div className="absolute inset-0 flex items-center justify-center text-zinc-900/10 dark:text-white/10 pointer-events-none game:text-primary/10 transition-opacity duration-300" style={{ opacity: value > 0 ? 0.3 : 1 }}>
                            {React.cloneElement(icon as React.ReactElement, { className: 'h-8 w-8' })}
                        </div>
                    )}
                </div>

                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-full bg-white dark:bg-white/5 hover:bg-green-500/20 hover:text-green-600 dark:hover:text-green-400 border border-transparent hover:border-green-500/50 transition-all active:scale-95 shadow-sm dark:shadow-none game:bg-zinc-900/50 game:text-white game:hover:bg-primary/30 game:border-white/5"
                    onClick={handleIncrement}
                    disabled={value >= max}
                >
                    <Plus className="h-5 w-5" />
                </Button>
            </div>
        </div>
    );
}
