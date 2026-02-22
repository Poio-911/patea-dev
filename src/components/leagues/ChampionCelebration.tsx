'use client';

import { Card } from '@/components/ui/card';
import { JerseyPreview } from '@/components/team-builder/jersey-preview';
import { Trophy, Medal, Star, Crown } from 'lucide-react';
import type { Jersey } from '@/lib/types';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import Confetti from 'react-confetti';
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
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    // Solo en cliente
    setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-indigo-950 via-background to-purple-950/30 shadow-xl">
      {windowSize.width > 0 && (
        <Confetti
          width={windowSize.width}
          height={windowSize.height}
          recycle={false}
          numberOfPieces={400}
          gravity={0.15}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}
        />
      )}
      {/* Decorative Background Elements */}
      <div className="absolute top-0 right-0 -mt-16 -mr-16 h-64 w-64 rounded-full bg-muted/10 blur-3xl" />
      <div className="absolute bottom-0 left-0 -mb-16 -ml-16 h-64 w-64 rounded-full bg-muted/10 blur-3xl" />

      <div className="relative pt-16 p-8 md:p-12 flex flex-col items-center text-center z-10">

        {/* Champion Section */}
        <motion.div
          className="mb-8 relative"
          initial={{ scale: 0.5, opacity: 0, y: 50 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
        >
          <motion.div
            className="absolute -top-12 left-1/2 -translate-x-1/2"
            animate={{ y: [0, -10, 0] }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          >
            <Crown className="h-12 w-12 text-yellow-400 fill-yellow-400/20 drop-shadow-md" />
          </motion.div>

          <div className="relative z-10 transform transition-transform hover:scale-105 duration-500">
            {championJersey ? (
              <div className="drop-shadow-[0_0_35px_rgba(250,204,21,0.4)]">
                <JerseyPreview jersey={championJersey} size="xl" />
              </div>
            ) : (
              <div className="h-48 w-48 rounded-full bg-card/90 flex items-center justify-center border-4 border-yellow-500/50 shadow-[0_0_30px_rgba(250,204,21,0.3)]">
                <Trophy className="h-24 w-24 text-yellow-500 drop-shadow-lg" />
              </div>
            )}

            {/* Winner Badge */}
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-yellow-600 to-yellow-400 text-white px-6 py-1.5 rounded-full font-bold text-sm shadow-xl border border-yellow-300/50 whitespace-nowrap flex items-center gap-2">
              <Star className="h-3.5 w-3.5 fill-white" />
              CAMPEÓN
              <Star className="h-3.5 w-3.5 fill-white" />
            </div>
          </div>
        </motion.div>

        <motion.h2
          className="text-4xl md:text-5xl font-black tracking-tight text-foreground mt-4 mb-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          {championName}
        </motion.h2>
        <motion.p
          className="text-muted-foreground text-lg mb-8 max-w-md mx-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.5 }}
        >
          ¡Felicitaciones por la victoria! El trofeo es suyo.
        </motion.p>

        {/* Runner Up Section */}
        <motion.div
          className="flex items-center justify-center gap-6 md:gap-12 w-full max-w-2xl border-t border-border/50 pt-8 mt-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.8 }}
        >
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Subcampeón</span>
            <div className="flex items-center gap-4 bg-card/50 p-3 pr-6 rounded-full border border-border/50 backdrop-blur-sm">
              <div className="relative">
                {runnerUpJersey ? (
                  <JerseyPreview jersey={runnerUpJersey} size="sm" />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                    <Medal className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 bg-muted-foreground text-foreground text-[10px] font-bold h-5 w-5 rounded-full flex items-center justify-center border-2 border-background">
                  2
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
