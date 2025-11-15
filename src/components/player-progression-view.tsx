
'use client';

import { useMemo, useState, useTransition } from 'react';
import { useCollection, useFirestore, useUser, useDoc } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import type { OvrHistory, AttributeKey, Player } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, BrainCircuit, TrendingUp, TrendingDown, Info, Medal, ChevronsUp, ChevronsDown, Goal } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Button } from './ui/button';
import { analyzePlayerProgressionAction } from '@/lib/actions/server-actions';
import type { AnalyzePlayerProgressionOutput } from '@/ai/flows/analyze-player-progression';
import { Separator } from './ui/separator';
import { attributeDescriptions } from '@/lib/data';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Label } from '@/components/ui/label';

interface PlayerProgressionViewProps {
    playerId: string;
}

const attributeColors: Record<AttributeKey, string> = {
    PAC: "hsl(var(--chart-1))",
    SHO: "hsl(var(--chart-2))",
    PAS: "hsl(var(--chart-3))",
    DRI: "hsl(var(--chart-4))",
    DEF: "hsl(var(--chart-5))",
    PHY: "hsl(var(--primary))",
};


const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const changes = data.attributeChanges || {};
      const changeEntries = Object.entries(changes).filter(([, value]) => value !== 0);

      return (
        <div className="rounded-lg border bg-background/95 backdrop-blur-sm p-3 shadow-lg">
          <p className="font-bold text-sm">Partido {label.replace('P. ', '')}</p>
          <p className="text-xs text-muted-foreground mb-2">{data.Fecha}</p>
          <Separator />
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
            {payload.map((pld: any) => (
              <div key={pld.dataKey} className="flex justify-between items-center gap-2">
                <span className="text-xs font-semibold" style={{ color: pld.color }}>
                  {pld.name}
                </span>
                <span className="font-bold tabular-nums">{pld.value}</span>
              </div>
            ))}
          </div>

          {changeEntries.length > 0 && (
            <>
              <Separator className="my-2" />
              <div className="space-y-1">
                {changeEntries.map(([key, value]) => (
                  <div key={key} className={`flex justify-between items-center text-xs ${(value as number) > 0 ? 'text-green-500' : 'text-red-500'}`}>
                    <span>{attributeDescriptions[key as AttributeKey]?.name || key}</span>
                    <span className="font-semibold">{(value as number) > 0 ? '+' : ''}{value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      );
    }
  
    return null;
};

const getPlayerMilestones = (history: OvrHistory[], player: Player) => {
    if (history.length < 1) return null;
    const maxOvr = Math.max(...history.map(h => h.newOVR), player.ovr);
    const biggestJump = history.reduce((max, h) => h.change > max.change ? h : max, { change: -Infinity, newOVR: 0, oldOVR: 0, date: '' });
    const biggestDrop = history.reduce((min, h) => h.change < min.change ? h : min, { change: Infinity, newOVR: 0, oldOVR: 0, date: '' });

    const streaks = history.reduce((acc, h) => {
        if (h.change > 0) {
            acc.currentPositive++;
            acc.currentNegative = 0;
            acc.maxPositive = Math.max(acc.maxPositive, acc.currentPositive);
        } else if (h.change < 0) {
            acc.currentNegative++;
            acc.currentPositive = 0;
            acc.maxNegative = Math.max(acc.maxNegative, acc.currentNegative);
        } else {
            acc.currentPositive = 0;
            acc.currentNegative = 0;
        }
        return acc;
    }, { currentPositive: 0, currentNegative: 0, maxPositive: 0, maxNegative: 0 });

    return {
        maxOvr,
        totalGoals: player.stats?.goals || 0,
        biggestJump: biggestJump.change > 0 ? biggestJump : null,
        biggestDrop: biggestDrop.change < 0 ? biggestDrop : null,
        longestPositiveStreak: streaks.maxPositive,
    };
};

export function PlayerProgressionView({ playerId }: PlayerProgressionViewProps) {
    const firestore = useFirestore();
    const { user } = useUser();
    const [isAnalyzing, startTransition] = useTransition();
    const [analysis, setAnalysis] = useState<AnalyzePlayerProgressionOutput | null>(null);
    const [analysisError, setAnalysisError] = useState<string | null>(null);
    const [visibleAttributes, setVisibleAttributes] = useState<AttributeKey[]>([]);

    const playerRef = useMemo(() => firestore ? doc(firestore, 'players', playerId) : null, [firestore, playerId]);
    const { data: player, loading: playerLoading } = useDoc<Player>(playerRef);

    const ovrHistoryQuery = useMemo(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, `players/${playerId}/ovrHistory`),
            orderBy('date', 'asc')
        );
    }, [firestore, playerId]);

    const { data: ovrHistory, loading: historyLoading } = useCollection<OvrHistory>(ovrHistoryQuery);
    
    const chartData = useMemo(() => {
        if (!ovrHistory) return [];
        let currentAttrs: Record<AttributeKey, number> = { PAC: 0, SHO: 0, PAS: 0, DRI: 0, DEF: 0, PHY: 0 };
        const firstWithAttrs = ovrHistory.find(h => h.attributeChanges);
        if (firstWithAttrs) {
            const baseOvr = firstWithAttrs.oldOVR;
            Object.keys(currentAttrs).forEach(key => {
                currentAttrs[key as AttributeKey] = baseOvr;
            });
        }
        
        return ovrHistory.map((entry, index) => {
            const newAttrs = { ...currentAttrs };
            if (entry.attributeChanges) {
                for (const [key, change] of Object.entries(entry.attributeChanges)) {
                    if (change !== undefined) {
                      newAttrs[key as AttributeKey] = (newAttrs[key as AttributeKey] || 0) + change;
                    }
                }
            }
            currentAttrs = newAttrs;

            return {
                name: `P. ${index + 1}`,
                OVR: entry.newOVR,
                Fecha: format(new Date(entry.date), 'dd/MM/yyyy'),
                attributeChanges: entry.attributeChanges,
                ...currentAttrs
            };
        });
    }, [ovrHistory]);

    const milestones = useMemo(() => ovrHistory && player ? getPlayerMilestones(ovrHistory, player) : null, [ovrHistory, player]);

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
                setAnalysis(result as AnalyzePlayerProgressionOutput);
            }
        });
    }
    
    const loading = playerLoading || historyLoading;

    if (loading) {
        return (
            <Card>
                <CardHeader><CardTitle>Evolución de OVR</CardTitle></CardHeader>
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
                            Jugá algunos partidos para empezar a ver tu progreso.
                        </AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {milestones && (
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">OVR Máximo</CardTitle></CardHeader><CardContent><div className="flex items-baseline gap-2"><Medal className="h-6 w-6 text-yellow-500"/><span className="text-3xl font-bold">{milestones.maxOvr}</span></div></CardContent></Card>
                    <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Goles Totales</CardTitle></CardHeader><CardContent><div className="flex items-baseline gap-2"><Goal className="h-6 w-6 text-blue-500"/><span className="text-3xl font-bold">{milestones.totalGoals}</span></div></CardContent></Card>
                    <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Mayor Subida</CardTitle></CardHeader><CardContent><div className="flex items-baseline gap-2"><ChevronsUp className="h-6 w-6 text-green-500"/><span className="text-3xl font-bold">+{milestones.biggestJump?.change || 0}</span></div></CardContent></Card>
                    <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Mayor Bajada</CardTitle></CardHeader><CardContent><div className="flex items-baseline gap-2"><ChevronsDown className="h-6 w-6 text-red-500"/><span className="text-3xl font-bold">{milestones.biggestDrop?.change || 0}</span></div></CardContent></Card>
                    <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Mejor Racha</CardTitle></CardHeader><CardContent><div className="flex items-baseline gap-2"><TrendingUp className="h-6 w-6 text-indigo-500"/><span className="text-3xl font-bold">{milestones.longestPositiveStreak}</span><span className="text-sm text-muted-foreground">partidos</span></div></CardContent></Card>
                </div>
            )}
            <Card>
                <CardHeader>
                    <CardTitle>Evolución de OVR y Atributos</CardTitle>
                    <CardDescription>Tu rendimiento a lo largo de los últimos partidos.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="mb-4">
                        <Label className="text-xs font-semibold">Ver Atributos:</Label>
                        <ToggleGroup type="multiple" value={visibleAttributes} onValueChange={(value) => setVisibleAttributes(value as AttributeKey[])} className="flex-wrap justify-start mt-2">
                           {Object.keys(attributeDescriptions).map(key => (
                                <ToggleGroupItem key={key} value={key} className="text-xs h-7 px-2">
                                    <div className="h-2 w-2 rounded-full mr-1.5" style={{ backgroundColor: attributeColors[key as AttributeKey]}} />
                                    {attributeDescriptions[key as AttributeKey].name.split(' ')[0]}
                                </ToggleGroupItem>
                           ))}
                        </ToggleGroup>
                    </div>
                    <ResponsiveContainer width="100%" height={350}>
                        <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis domain={['dataMin - 5', 'dataMax + 5']} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend />
                            <Line type="monotone" dataKey="OVR" name="OVR" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 5 }} activeDot={{ r: 8 }} />
                            <AnimatePresence>
                                {visibleAttributes.map(attr => (
                                    <motion.foreignObject key={attr} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                        <Line
                                            type="monotone"
                                            dataKey={attr}
                                            name={attributeDescriptions[attr].name.split(' ')[0]}
                                            stroke={attributeColors[attr]}
                                            strokeWidth={1.5}
                                            dot={false}
                                            activeDot={{ r: 6 }}
                                            strokeOpacity={0.8}
                                        />
                                    </motion.foreignObject>
                                ))}
                            </AnimatePresence>
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
                        <div className="space-y-6">
                            <div>
                                <h3 className="font-semibold text-lg">Resumen del Analista</h3>
                                <p className="text-sm text-muted-foreground italic mt-1">&ldquo;{analysis.summary}&rdquo;</p>
                            </div>
                            <Separator />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <h4 className="font-semibold flex items-center gap-2 text-green-600"><TrendingUp className="h-5 w-5"/>Tendencias Positivas</h4>
                                    <ul className="list-disc list-inside space-y-2 text-sm text-foreground/90">
                                        {analysis.positiveTrends.map((trend, i) => <li key={i}>{trend}</li>)}
                                    </ul>
                                </div>
                                <div className="space-y-3">
                                     <h4 className="font-semibold flex items-center gap-2 text-red-600"><TrendingDown className="h-5 w-5"/>Áreas a Mejorar</h4>
                                    <ul className="list-disc list-inside space-y-2 text-sm text-foreground/90">
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

    