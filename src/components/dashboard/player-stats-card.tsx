'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Target, TrendingUp, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Player, OvrHistory } from '@/lib/types';
import { useMemo } from 'react';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';

interface PlayerStatsCardProps {
  player: Player;
}

export function PlayerStatsCard({ player }: PlayerStatsCardProps) {
  const firestore = useFirestore();

  // Fetch OVR history for trend calculation
  const ovrHistoryQuery = useMemo(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, `players/${player.id}/ovrHistory`),
      orderBy('date', 'asc')
    );
  }, [firestore, player.id]);

  const { data: ovrHistory } = useCollection<OvrHistory>(ovrHistoryQuery);

  const stats = useMemo(() => {
    // Use player.stats which already contains the calculated values
    const totalMatches = player.stats?.matchesPlayed || 0;
    const totalGoals = player.stats?.goals || 0;

    // Calculate OVR trend from ovrHistory
    let ovrTrend = 0;
    if (ovrHistory && ovrHistory.length > 0) {
      const firstEntry = ovrHistory[0];
      const lastEntry = ovrHistory[ovrHistory.length - 1];
      if (firstEntry && lastEntry) {
        ovrTrend = lastEntry.newOVR - firstEntry.oldOVR;
      }
    }

    return {
      totalMatches,
      totalGoals,
      ovrTrend,
      avgGoalsPerMatch: totalMatches > 0 ? (totalGoals / totalMatches).toFixed(1) : '0.0',
    };
  }, [player.stats, ovrHistory]);

  const statCards = [
    {
      title: 'Partidos Jugados',
      value: stats.totalMatches,
      icon: Calendar,
      color: 'text-blue-500 text-blue-400',
      bgColor: 'bg-blue-500/10',
      valueColor: 'text-blue-600 dark:text-blue-400',
    },
    {
      title: 'Goles',
      value: stats.totalGoals,
      icon: Target,
      color: 'text-amber-500 dark:text-amber-400',
      bgColor: 'bg-amber-500/10',
      valueColor: 'text-amber-600 dark:text-amber-400',
    },
    {
      title: 'Promedio Goles',
      value: stats.avgGoalsPerMatch,
      icon: Trophy,
      color: 'text-emerald-500 dark:text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      valueColor: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      title: 'Tendencia OVR',
      value: stats.ovrTrend > 0 ? `+${stats.ovrTrend}` : stats.ovrTrend || '0',
      icon: TrendingUp,
      color: stats.ovrTrend >= 0 ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400',
      bgColor: stats.ovrTrend >= 0 ? 'bg-green-500/10' : 'bg-red-500/10',
      valueColor: stats.ovrTrend >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 relative group w-full">
      {/* Glow Effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity duration-500 -z-10"></div>

      {statCards.map((stat, index) => (
        <motion.div
          key={stat.title}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1, duration: 0.4, type: "sping", stiffness: 100 }}
          className="flex flex-col items-center justify-center p-4 sm:p-5 rounded-2xl bg-card/40 backdrop-blur-xl border border-border/40 shadow-xl relative overflow-hidden"
        >
          <div className={`absolute top-0 right-0 w-16 h-16 ${stat.bgColor.replace('bg-', 'bg-').replace('/10', '/20')} rounded-full blur-2xl -mr-8 -mt-8 opacity-50`}></div>
          <div className={`absolute bottom-0 left-0 w-16 h-16 ${stat.color.replace('text-', 'bg-')}/10 rounded-full blur-2xl -ml-8 -mb-8 opacity-50`}></div>

          <div className="flex items-center gap-2 mb-1 z-10">
            <stat.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${stat.color} opacity-80`} />
            <p className={`text-2xl sm:text-3xl font-black ${stat.valueColor} drop-shadow-sm tracking-tighter`}>{stat.value}</p>
          </div>

          <p className="text-[10px] sm:text-[11px] text-muted-foreground uppercase tracking-[0.1em] sm:tracking-[0.2em] font-bold z-10 text-center">{stat.title}</p>
        </motion.div>
      ))}
    </div>
  );
}
