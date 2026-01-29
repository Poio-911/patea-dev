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
      color: 'text-foreground',
      bgColor: 'bg-card/80 border border-border',
      valueColor: 'text-foreground',
    },
    {
      title: 'Goles',
      value: stats.totalGoals,
      icon: Target,
      color: 'text-foreground',
      bgColor: 'bg-card/80 border border-border',
      valueColor: 'text-foreground',
    },
    {
      title: 'Goles por Partido',
      value: stats.avgGoalsPerMatch,
      icon: Trophy,
      color: 'text-foreground',
      bgColor: 'bg-card/80 border border-border',
      valueColor: 'text-foreground',
    },
    {
      title: 'Tendencia OVR',
      value: stats.ovrTrend > 0 ? `+${stats.ovrTrend}` : stats.ovrTrend || '0',
      icon: TrendingUp,
      color: 'text-foreground',
      bgColor: 'bg-card/80 border border-border',
      valueColor: 'text-foreground',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mis Estadísticas</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {statCards.map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.3 }}
              className={`flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-lg ${stat.bgColor}`}
            >
              <div className={`p-1.5 sm:p-2 rounded-full bg-background/40 ${stat.color} shrink-0`}>
                <stat.icon className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <p className={`text-xl sm:text-2xl font-bold ${stat.valueColor} truncate`}>{stat.value}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{stat.title}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
