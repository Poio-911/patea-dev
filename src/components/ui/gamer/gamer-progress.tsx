'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface GamerProgressProps {
    value: number;
    max?: number;
    className?: string;
    variant?: 'default' | 'success' | 'warning' | 'danger';
    showLabel?: boolean;
}

export function GamerProgress({
    value,
    max = 100,
    className,
    variant = 'default',
    showLabel = false,
}: GamerProgressProps) {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

    const variants = {
        default: 'from-cyan-500 to-blue-600 shadow-[0_0_10px_rgba(6,182,212,0.5)]',
        success: 'from-green-400 to-emerald-600 shadow-[0_0_10px_rgba(74,222,128,0.5)]',
        warning: 'from-yellow-400 to-orange-600 shadow-[0_0_10px_rgba(250,204,21,0.5)]',
        danger: 'from-red-500 to-rose-700 shadow-[0_0_10px_rgba(244,63,94,0.5)]',
    };

    // Determine variant automatically if default is used based on percentage
    const effectiveVariant =
        variant === 'default'
            ? percentage >= 100
                ? 'success'
                : percentage > 30
                    ? 'default'
                    : 'warning'
            : variant;

    return (
        <div className={cn('w-full space-y-1', className)}>
            <div className="h-4 w-full overflow-hidden rounded-full bg-black/40 border border-white/5 p-0.5 backdrop-blur-sm relative">
                {/* Background Grid Pattern */}
                <div
                    className="absolute inset-0 opacity-20 pointer-events-none"
                    style={{
                        backgroundImage: 'linear-gradient(90deg, transparent 50%, rgba(255,255,255,0.1) 50%)',
                        backgroundSize: '10px 100%'
                    }}
                />

                <motion.div
                    className={cn(
                        'h-full rounded-full bg-gradient-to-r transition-all duration-500 relative',
                        variants[effectiveVariant]
                    )}
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                >
                    {/* Scanline effect */}
                    <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                        animate={{ x: ['-100%', '100%'] }}
                        transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                    />
                </motion.div>
            </div>

            {showLabel && (
                <div className="flex justify-between text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <span>Progreso</span>
                    <span className={cn(
                        effectiveVariant === 'success' ? 'text-green-400' : 'text-cyan-400'
                    )}>
                        {Math.round(percentage)}%
                    </span>
                </div>
            )}
        </div>
    );
}
