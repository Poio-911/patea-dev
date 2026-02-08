'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Check, Loader2, ArrowUp, ArrowDown, Sparkles } from 'lucide-react';

interface AttributeChange {
    attribute: string;
    change: number;
    reason?: string;
}

interface AiScanOverlayProps {
    isScanning: boolean;
    result: {
        attributeChanges: AttributeChange[];
        confidence: number;
        summary: string;
    } | null;
    onClose?: () => void;
}

export function AiScanOverlay({ isScanning, result }: AiScanOverlayProps) {
    if (!isScanning && !result) return null;

    return (
        <div className="rounded-xl border border-zinc-200 dark:border-emerald-500/30 bg-white dark:bg-black/40 backdrop-blur-md overflow-hidden relative min-h-[160px] transition-all shadow-sm dark:shadow-none">

            {/* Scanning State */}
            <AnimatePresence>
                {isScanning && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-emerald-700 dark:text-emerald-400 bg-white/95 dark:bg-black/80"
                    >
                        <motion.div
                            className="w-full h-1 bg-emerald-500 absolute top-0 shadow-[0_0_15px_rgba(16,185,129,0.8)]"
                            animate={{ top: ['0%', '100%', '0%'] }}
                            transition={{ duration: 2, ease: "linear", repeat: Infinity }}
                        />
                        <Loader2 className="h-8 w-8 animate-spin mb-2" />
                        <span className="font-mono text-sm tracking-widest uppercase animate-pulse">Analizando Táctica...</span>

                        {/* Binary Rain Effect (Simplified - Adjusted opacity for light mode) */}
                        <div className="absolute inset-0 opacity-5 dark:opacity-10 pointer-events-none font-mono text-[10px] overflow-hidden whitespace-pre-wrap select-none p-2 text-black dark:text-emerald-500">
                            {Array.from({ length: 200 }).map((_, i) => Math.random() > 0.5 ? '1' : '0').join(' ')}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Results State */}
            {result && !isScanning && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-5 space-y-4"
                >
                    {/* Header */}
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 border-b border-emerald-500/20 pb-3">
                        <Sparkles className="h-5 w-5" />
                        <span className="font-bold tracking-wide uppercase text-sm">Análisis Táctico Completado</span>
                        <span className="ml-auto text-xs font-mono opacity-70">CONF: {Math.round(result.confidence * 100)}%</span>
                    </div>

                    {/* Attribute Grid */}
                    <div className="grid grid-cols-2 gap-3">
                        {result.attributeChanges.map((change, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ x: -20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: idx * 0.1 }}
                                className={cn(
                                    "flex items-center justify-between p-2.5 rounded border backdrop-blur-sm",
                                    change.change > 0
                                        ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                                        : "bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400"
                                )}
                            >
                                <span className="font-black text-sm uppercase font-mono">{change.attribute}</span>
                                <div className="flex items-center gap-1 font-bold">
                                    {change.change > 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                                    <span>{change.change > 0 ? '+' : ''}{change.change}</span>
                                </div>
                            </motion.div>
                        ))}
                        {result.attributeChanges.length === 0 && (
                            <div className="col-span-2 text-center text-xs text-muted-foreground py-2 italic">
                                No se detectaron cambios significativos de atributos.
                            </div>
                        )}
                    </div>

                    {/* Summary Text */}
                    <div className="bg-zinc-50 dark:bg-white/5 rounded-lg p-3 border border-zinc-200 dark:border-white/5">
                        <p className="text-sm text-zinc-600 dark:text-zinc-300 italic leading-relaxed">"{result.summary}"</p>
                    </div>
                </motion.div>
            )}
        </div>
    );
}
