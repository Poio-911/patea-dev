'use client';

import { useState, useMemo } from 'react';
import { detectPlayerPatternsAction } from '@/lib/actions';
import type { DetectPlayerPatternsOutput } from '@/ai/flows/detect-player-patterns';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, Brain, Target, AlertCircle, Activity, TrendingUp, TrendingDown, MoveHorizontal, Shuffle, Zap, Lightbulb, Trophy, Star } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface PlayerInsightsPanelProps {
  playerId: string;
  playerName: string;
  groupId: string;
}

const trajectoryInfoMap = {
  improving: { label: 'En Ascenso', icon: TrendingUp, color: 'text-green-500' },
  declining: { label: 'En Baja', icon: TrendingDown, color: 'text-red-500' },
  stable: { label: 'Estable', icon: MoveHorizontal, color: 'text-yellow-500' },
  volatile: { label: 'Volátil', icon: Shuffle, color: 'text-purple-500' },
};

const consistencyInfoMap = {
  very_high: { label: 'Muy Alta', value: 95 },
  high: { label: 'Alta', value: 80 },
  medium: { label: 'Media', value: 60 },
  low: { label: 'Baja', value: 40 },
  very_low: { label: 'Muy Baja', value: 20 },
};

const impactColors: Record<string, string> = {
  positive: 'border-green-500',
  negative: 'border-red-500',
  neutral: 'border-yellow-500',
};

const patternIcons: Record<string, React.ElementType> = {
  trend: TrendingUp,
  consistency: Activity,
  volatility: Shuffle,
  improvement: TrendingUp,
  decline: TrendingDown,
  specialty: Star,
};

export function PlayerInsightsPanel({ playerId, playerName, groupId }: PlayerInsightsPanelProps) {
  const [insights, setInsights] = useState<DetectPlayerPatternsOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await detectPlayerPatternsAction(playerId, groupId);

      if ('error' in result) {
        setError(result.error);
      } else {
        setInsights(result);
      }
    } catch (err: any) {
      setError(err.message || 'Error al analizar el rendimiento');
    } finally {
      setIsLoading(false);
    }
  };
  
  const trajectoryInfo = insights ? trajectoryInfoMap[insights.insights.trajectory] : null;
  const consistencyInfo = insights ? consistencyInfoMap[insights.insights.consistency] : null;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Insights de Rendimiento
        </CardTitle>
        <CardDescription>Análisis automático de tu evolución basado en evaluaciones</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!insights ? (
          <div className="text-center py-8">
            {error ? (
                 <div className="flex flex-col items-center gap-4 text-destructive">
                    <AlertCircle className="h-10 w-10" />
                    <p className="font-semibold">Error al Analizar</p>
                    <p className="text-sm">{error}</p>
                    <Button onClick={handleAnalyze} disabled={isLoading}>Reintentar</Button>
                </div>
            ) : (
                <Button onClick={handleAnalyze} disabled={isLoading}>
                {isLoading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analizando...</>
                ) : (
                    <><Brain className="mr-2 h-4 w-4" /> Analizar Mi Rendimiento</>
                )}
                </Button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Target className="h-8 w-8 text-green-600" /><div><h4 className="text-sm font-semibold text-muted-foreground">Atributo Más Fuerte</h4><p className="text-lg font-bold">{insights.insights.strongestAttribute}</p></div></div></CardContent></Card>
                <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><AlertCircle className="h-8 w-8 text-orange-600" /><div><h4 className="text-sm font-semibold text-muted-foreground">Área a Mejorar</h4><p className="text-lg font-bold">{insights.insights.weakestAttribute}</p></div></div></CardContent></Card>
                {trajectoryInfo && <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><trajectoryInfo.icon className={cn("h-8 w-8", trajectoryInfo.color)} /><div><h4 className="text-sm font-semibold text-muted-foreground">Trayectoria</h4><p className="text-lg font-bold">{trajectoryInfo.label}</p></div></div></CardContent></Card>}
                {consistencyInfo && <Card><CardContent className="pt-6"><div className="space-y-2"><div className="flex items-center gap-3"><Activity className="h-8 w-8 text-blue-600" /><div><h4 className="text-sm font-semibold text-muted-foreground">Consistencia</h4><p className="text-lg font-bold">{consistencyInfo.label}</p></div></div><Progress value={consistencyInfo.value} /></div></CardContent></Card>}
            </div>

            <Card><CardContent className="pt-6"><div className="flex items-start gap-3"><Zap className="h-6 w-6 text-yellow-600 flex-shrink-0 mt-1" /><div><h4 className="font-semibold mb-1">Estilo de Juego</h4><p className="text-sm text-muted-foreground">{insights.insights.playingStyle}</p></div></div></CardContent></Card>
            
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2"><TrendingUp className="h-5 w-5" />Patrones Detectados ({insights.patterns.length})</h4>
              {insights.patterns.map((pattern, index) => {
                const PatternIcon = patternIcons[pattern.type] || Star;
                return (
                    <Card key={index} className={`border-l-4 ${impactColors[pattern.impact]}`}><CardContent className="pt-4"><div className="flex items-start gap-3"><PatternIcon className="h-5 w-5 flex-shrink-0 mt-0.5" />
                        <div className="flex-1"><div className="flex items-start justify-between gap-2"><h5 className="font-semibold text-sm">{pattern.title}</h5><Badge variant="outline" className="text-xs">{pattern.confidence}% confianza</Badge></div>
                        <p className="text-sm text-muted-foreground mt-1">{pattern.description}</p></div></div></CardContent></Card>
                );
              })}
            </div>
            
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2"><Lightbulb className="h-5 w-5" />Recomendaciones</h4>
              <div className="space-y-2">{insights.recommendations.map((rec, index) => (<div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"><span className="font-bold text-primary">{index + 1}.</span><p className="text-sm flex-1">{rec}</p></div>))}</div>
            </div>
            
            {insights.standoutMoments && insights.standoutMoments.length > 0 && (
                <div className="space-y-3"><h4 className="font-semibold flex items-center gap-2"><Trophy className="h-5 w-5 text-yellow-600" />Momentos Destacados</h4><div className="space-y-2">{insights.standoutMoments.map((moment, index) => (<Card key={index}><CardContent className="pt-4"><p className="text-xs text-muted-foreground mb-1">{moment.matchDate}</p><p className="text-sm">{moment.description}</p></CardContent></Card>))}</div></div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
