
'use client';

import { useMemo } from 'react';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { OvrHistory } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

interface PlayerProgressionViewProps {
    playerId: string;
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border bg-background p-2 shadow-sm">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col">
              <span className="text-[0.70rem] uppercase text-muted-foreground">PARTIDO</span>
              <span className="font-bold text-muted-foreground">{label}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[0.70rem] uppercase text-muted-foreground">OVR</span>
              <span className="font-bold text-primary">{payload[0].value}</span>
            </div>
          </div>
        </div>
      );
    }
  
    return null;
  };

export function PlayerProgressionView({ playerId }: PlayerProgressionViewProps) {
    const firestore = useFirestore();

    const ovrHistoryQuery = useMemo(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, `players/${playerId}/ovrHistory`),
            orderBy('date', 'asc')
        );
    }, [firestore, playerId]);

    const { data: ovrHistory, loading } = useCollection<OvrHistory>(ovrHistoryQuery);
    
    const chartData = useMemo(() => {
        if (!ovrHistory) return [];
        return ovrHistory.map((entry, index) => ({
            name: `P. ${index + 1}`,
            OVR: entry.newOVR,
            Fecha: format(new Date(entry.date), 'dd/MM/yyyy'),
        }));
    }, [ovrHistory]);

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Evolución de OVR</CardTitle>
                </CardHeader>
                <CardContent className="h-72 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </CardContent>
            </Card>
        );
    }
    
    if (!ovrHistory || ovrHistory.length < 2) {
        return (
            <Card>
                 <CardHeader>
                    <CardTitle>Evolución de OVR</CardTitle>
                </CardHeader>
                 <CardContent>
                    <Alert>
                        <AlertTitle>No hay suficientes datos</AlertTitle>
                        <AlertDescription>
                            Jugá y completá algunas evaluaciones para empezar a ver tu progreso.
                        </AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Evolución de OVR</CardTitle>
                <CardDescription>Tu rendimiento a lo largo de los últimos partidos.</CardDescription>
            </CardHeader>
            <CardContent>
                 <ResponsiveContainer width="100%" height={300}>
                  <LineChart
                    data={chartData}
                    margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis domain={['dataMin - 2', 'dataMax + 2']} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="OVR"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 8 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}
