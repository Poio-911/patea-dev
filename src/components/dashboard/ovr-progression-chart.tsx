'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { TrendingUp } from 'lucide-react';
import type { Player, OvrHistory } from '@/lib/types';
import { useMemo } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';

interface OVRProgressionChartProps {
  player: Player;
}

export function OVRProgressionChart({ player }: OVRProgressionChartProps) {
  const firestore = useFirestore();

  // Fetch OVR history
  const ovrHistoryQuery = useMemo(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, `players/${player.id}/ovrHistory`),
      orderBy('date', 'asc')
    );
  }, [firestore, player.id]);

  const { data: ovrHistory } = useCollection<OvrHistory>(ovrHistoryQuery);

  const chartData = useMemo(() => {
    if (!ovrHistory) return [];

    // Map ovrHistory to chart data
    const data = ovrHistory.map((entry, index) => {
      return {
        date: format(new Date(entry.date), 'dd/MM', { locale: es }),
        fullDate: format(new Date(entry.date), "dd 'de' MMMM", { locale: es }),
        ovr: entry.newOVR,
        matchId: entry.matchId,
      };
    });

    return data;
  }, [ovrHistory]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (chartData.length === 0) return { change: 0, highest: player.ovr, lowest: player.ovr };

    const ovrs = chartData.map((d) => d.ovr);
    const firstOVR = ovrs[0];
    const lastOVR = ovrs[ovrs.length - 1];

    return {
      change: lastOVR - firstOVR,
      highest: Math.max(...ovrs, player.ovr),
      lowest: Math.min(...ovrs, player.ovr),
    };
  }, [chartData, player.ovr]);

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Progresión de OVR
          </CardTitle>
          <CardDescription>Tu evolución a lo largo de los partidos evaluados.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Aún no tenés partidos evaluados. ¡Jugá y evaluá tus partidos para ver tu progresión!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Progresión de OVR
        </CardTitle>
        <CardDescription>Tu evolución a lo largo de los partidos evaluados.</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Statistics Summary */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <motion.div
            className="text-center"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.3 }}
          >
            <p className="text-xs text-muted-foreground">Cambio</p>
            <p className={`text-2xl font-bold ${stats.change > 0 ? 'text-green-600' : stats.change < 0 ? 'text-red-600' : 'text-gray-600'}`}>
              {stats.change > 0 ? '+' : ''}{stats.change}
            </p>
          </motion.div>
          <motion.div
            className="text-center"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.3 }}
          >
            <p className="text-xs text-muted-foreground">Máximo</p>
            <p className="text-2xl font-bold text-primary">{stats.highest}</p>
          </motion.div>
          <motion.div
            className="text-center"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.3 }}
          >
            <p className="text-xs text-muted-foreground">Mínimo</p>
            <p className="text-2xl font-bold text-muted-foreground">{stats.lowest}</p>
          </motion.div>
        </div>

        {/* Chart */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorOvr" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            />
            <YAxis
              domain={['dataMin - 2', 'dataMax + 2']}
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }}
              formatter={(value: any, name: string, props: any) => {
                return [
                  <span key="ovr" className="text-primary font-bold">{value} OVR</span>,
                ];
              }}
              labelFormatter={(label: string, payload: any) => {
                if (payload && payload[0]) {
                  return payload[0].payload.fullDate;
                }
                return label;
              }}
            />
            <Area
              type="monotone"
              dataKey="ovr"
              stroke="hsl(var(--primary))"
              strokeWidth={3}
              fill="url(#colorOvr)"
              activeDot={{ r: 6, fill: 'hsl(var(--primary))' }}
            />
          </AreaChart>
        </ResponsiveContainer>
        </motion.div>
      </CardContent>
    </Card>
  );
}
