'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { TrendingUp } from 'lucide-react';
import type { Match } from '@/lib/types';
import { useMemo } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion } from 'framer-motion';

interface OVRProgressionChartProps {
  matches: Match[];
  playerId: string;
  currentOVR: number;
}

export function OVRProgressionChart({ matches, playerId, currentOVR }: OVRProgressionChartProps) {
  const chartData = useMemo(() => {
    // Filter matches where the player participated and were evaluated
    const playerMatches = matches.filter(
      (m) => m.status === 'evaluated' && m.players?.some((p) => p.id === playerId)
    );

    // Sort by date
    const sortedMatches = playerMatches.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Map to chart data
    const data = sortedMatches.map((match) => {
      const playerData = match.players?.find((p) => p.id === playerId);
      return {
        date: format(new Date(match.date), 'dd/MM', { locale: es }),
        fullDate: format(new Date(match.date), "dd 'de' MMMM", { locale: es }),
        ovr: playerData?.ovr || currentOVR,
        matchTitle: match.title,
      };
    });

    return data;
  }, [matches, playerId, currentOVR]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (chartData.length === 0) return { change: 0, highest: currentOVR, lowest: currentOVR };

    const ovrs = chartData.map((d) => d.ovr);
    const firstOVR = ovrs[0];
    const lastOVR = ovrs[ovrs.length - 1];

    return {
      change: lastOVR - firstOVR,
      highest: Math.max(...ovrs),
      lowest: Math.min(...ovrs),
    };
  }, [chartData, currentOVR]);

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
                  <span key="match" className="text-muted-foreground block text-xs mt-1">{props.payload.matchTitle}</span>,
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
