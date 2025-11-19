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
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-900/20',
    },
    {
      title: 'Goles',
      value: stats.totalGoals,
      icon: Target,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-100 dark:bg-green-900/20',
    },
    {
      title: 'Goles por Partido',
      value: stats.avgGoalsPerMatch,
      icon: Trophy,
      color: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-100 dark:bg-orange-900/20',
    },
    {
      title: 'Tendencia OVR',
      value: stats.ovrTrend > 0 ? `+${stats.ovrTrend}` : stats.ovrTrend || '0',
      icon: TrendingUp,
      color:
        stats.ovrTrend > 0
          ? 'text-emerald-600 dark:text-emerald-400'
          : stats.ovrTrend < 0
          ? 'text-red-600 dark:text-red-400'
          : 'text-gray-600 dark:text-gray-400',
      bgColor:
        stats.ovrTrend > 0
          ? 'bg-emerald-100 dark:bg-emerald-900/20'
          : stats.ovrTrend < 0
          ? 'bg-red-100 dark:bg-red-900/20'
          : 'bg-gray-100 dark:bg-gray-900/20',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mis Estadísticas</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {statCards.map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.3 }}
              className={`flex items-center gap-3 p-4 rounded-lg ${stat.bgColor}`}
            >
              <div className={`p-2 rounded-full bg-background/50 ${stat.color}`}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.title}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
