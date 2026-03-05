'use client';

import { JerseyPreview } from '@/components/team-builder/jersey-preview';
import { Star, Crown } from 'lucide-react';
import type { Jersey } from '@/lib/types';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

type ChampionCelebrationProps = {
  championName: string;
  championJersey?: Jersey;
  runnerUpName: string;
  runnerUpJersey?: Jersey;
};

export function ChampionCelebration({
  championName,
  championJersey,
  runnerUpName,
  runnerUpJersey,
}: ChampionCelebrationProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  return (
    <div className="relative overflow-hidden rounded-2xl shadow-2xl">
      {/* Layered background for premium feel */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-zinc-900 to-slate-900" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(250,204,21,0.12),transparent_70%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(234,179,8,0.06),transparent_60%)]" />

      {/* Sparkle dots for texture */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
        {mounted && [
          { top: '12%', left: '8%', size: 2, delay: 0 },
          { top: '28%', left: '85%', size: 3, delay: 0.4 },
          { top: '65%', left: '6%', size: 2, delay: 0.8 },
          { top: '72%', left: '90%', size: 3, delay: 0.2 },
          { top: '45%', left: '92%', size: 2, delay: 1.1 },
          { top: '18%', left: '45%', size: 2, delay: 0.6 },
          { top: '80%', left: '55%', size: 2, delay: 0.9 },
        ].map((dot, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-yellow-300"
            style={{ top: dot.top, left: dot.left, width: dot.size, height: dot.size }}
            animate={{ opacity: [0.2, 0.9, 0.2], scale: [1, 1.5, 1] }}
            transition={{ repeat: Infinity, duration: 2.5, delay: dot.delay, ease: 'easeInOut' }}
          />
        ))}
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 pt-14 pb-10">

        {/* Crown + Champion Jersey */}
        <motion.div
          className="flex flex-col items-center mb-2"
          initial={{ scale: 0.6, opacity: 0, y: 40 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 180, damping: 14, delay: 0.15 }}
        >
          {/* Floating crown — in flow, overlaps jersey slightly */}
          <motion.div
            className="flex justify-center mb-[-8px] relative z-20"
            animate={{ y: [0, -6, 0] }}
            transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
          >
            <Crown className="h-10 w-10 text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.8)] fill-yellow-400/30" />
          </motion.div>

          {/* Jersey with explicit size container */}
          <div className="relative w-36 h-36 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-yellow-400/20 blur-2xl scale-110 pointer-events-none" />
            <div className="drop-shadow-[0_0_40px_rgba(250,204,21,0.45)] relative z-10">
              <JerseyPreview jersey={championJersey} size="lg" />
            </div>
          </div>

          {/* CAMPEÓN badge — in normal flow, always centered */}
          <motion.div
            className="mt-4"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.7, type: 'spring', stiffness: 300, damping: 20 }}
          >
            <div className="inline-flex items-center gap-1.5 bg-gradient-to-r from-yellow-500 to-amber-400 text-black text-[11px] font-black tracking-widest uppercase px-5 py-1.5 rounded-full shadow-[0_4px_20px_rgba(250,204,21,0.5)] border border-yellow-300/60">
              <Star className="h-3 w-3 fill-black/60" />
              CAMPEÓN
              <Star className="h-3 w-3 fill-black/60" />
            </div>
          </motion.div>
        </motion.div>

        {/* Champion name */}
        <motion.h2
          className="text-4xl md:text-5xl font-black tracking-tight mt-5 mb-1"
          style={{
            background: 'linear-gradient(135deg, #fef08a, #facc15, #d97706)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            textShadow: 'none',
            filter: 'drop-shadow(0 0 20px rgba(250,204,21,0.3))'
          }}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.55 }}
        >
          {championName}
        </motion.h2>

        <motion.p
          className="text-zinc-400 text-sm mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.75, duration: 0.45 }}
        >
          ¡Felicitaciones por la victoria! El trofeo es suyo.
        </motion.p>

        {/* Divider */}
        <motion.div
          className="w-full max-w-xs h-px bg-gradient-to-r from-transparent via-zinc-600 to-transparent mb-7"
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ delay: 0.95, duration: 0.6 }}
        />

        {/* Runner up */}
        <motion.div
          className="flex flex-col items-center gap-3"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.05, duration: 0.5 }}
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-500">Subcampeón</span>
          <div className="flex items-center gap-3 bg-white/5 border border-white/10 backdrop-blur-sm px-5 py-3 rounded-2xl">
            <div className="relative">
              <JerseyPreview jersey={runnerUpJersey} size="sm" />
              <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-zinc-600 border-2 border-zinc-800 flex items-center justify-center text-[9px] font-black text-zinc-200">
                2
              </div>
            </div>
            <span className="font-semibold text-zinc-300 text-sm">{runnerUpName}</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
