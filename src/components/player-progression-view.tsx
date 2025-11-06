
'use client';

import { useMemo, useState, useTransition } from 'react';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { OvrHistory } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, BrainCircuit, TrendingUp, TrendingDown, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Button } from './ui/button';
import { analyzePlayerProgressionAction } from '@/lib/actions/server-actions';
import { AnalyzePlayerProgressionOutput } from '@/ai/flows/analyze-player-progression';
import { Separator } from './ui/separator';

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
    const { user } = useUser();
    const [isAnalyzing, startTransition] = useTransition();
    const [analysis, setAnalysis] = useState<AnalyzePlayerProgressionOutput | null>(null);
    const [analysisError, setAnalysisError] = useState<string | null>(null);

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

    const handleAnalyze = () => {
        startTransition(async () => {
            if (!user?.activeGroupId) {
                setAnalysisError("Necesitás un grupo activo para realizar el análisis.");
                return;
            }
            setAnalysisError(null);
            const result = await analyzePlayerProgressionAction(playerId, user.activeGroupId);
            if ('error' in result) {
                setAnalysisError(result.error);
            } else {
                setAnalysis(result);
            }
        });
    }

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
        <div className="space-y-6">
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
                        <YAxis domain={['dataMin - 5', 'dataMax + 5']} />
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

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <BrainCircuit className="h-6 w-6 text-primary"/>
                        Análisis de Progresión por IA
                    </CardTitle>
                    <CardDescription>Un informe detallado sobre tu evolución como jugador.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isAnalyzing ? (
                        <div className="flex items-center justify-center p-8">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="ml-4 text-muted-foreground">Analizando datos...</p>
                        </div>
                    ) : analysis ? (
                        <div className="space-y-4">
                            <div>
                                <h3 className="font-semibold text-lg">Resumen del Analista</h3>
                                <p className="text-sm text-muted-foreground italic mt-1">&ldquo;{analysis.summary}&rdquo;</p>
                            </div>
                            <Separator />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <h4 className="font-semibold flex items-center gap-2 text-green-600"><TrendingUp className="h-5 w-5"/>Tendencias Positivas</h4>
                                    <ul className="list-disc list-inside space-y-1 text-sm">
                                        {analysis.positiveTrends.map((trend, i) => <li key={i}>{trend}</li>)}
                                    </ul>
                                </div>
                                <div className="space-y-2">
                                     <h4 className="font-semibold flex items-center gap-2 text-red-600"><TrendingDown className="h-5 w-5"/>Áreas a Mejorar</h4>
                                    <ul className="list-disc list-inside space-y-1 text-sm">
                                        {analysis.areasForImprovement.map((area, i) => <li key={i}>{area}</li>)}
                                    </ul>
                                </div>
                            </div>
                             <Button variant="link" onClick={handleAnalyze} className="p-0 h-auto text-xs mt-4">Volver a analizar</Button>
                        </div>
                    ) : (
                        <Alert>
                            <Info className="h-4 w-4" />
                            <AlertTitle>¿Querés saber qué dicen los números?</AlertTitle>
                            <AlertDescription className="flex flex-col items-start gap-4 mt-2">
                                <span>Pulsá el botón para que la IA analice tu historial de OVR y las etiquetas de tus evaluaciones para darte un informe detallado.</span>
                                {analysisError && <p className="text-destructive text-xs">{analysisError}</p>}
                                <Button onClick={handleAnalyze}>
                                    <BrainCircuit className="mr-2 h-4 w-4" />
                                    Analizar Evolución
                                </Button>
                            </AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
