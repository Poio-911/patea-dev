'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Bot, Loader2 } from 'lucide-react';
import type { Player, Match } from '@/lib/types';

interface GroupSummaryInput {
  playerCount: number;
  upcomingMatchesCount: number;
  topPlayer?: { name: string; ovr: number };
}

interface GroupSummaryOutput {
  summary: string;
  author: string;
}

// Generates the summary on the client-side to avoid server action loops.
function generateSummary(input: GroupSummaryInput): GroupSummaryOutput {
  const { playerCount, upcomingMatchesCount, topPlayer } = input;

  if (playerCount === 0) {
    return {
      summary: 'El grupo está listo para nuevos talentos. ¡Añade jugadores para empezar la acción!',
      author: 'El Director Deportivo',
    };
  }
  
  if (upcomingMatchesCount === 0) {
    return {
      summary: `Con ${playerCount} cracks en la plantilla, el mercado de pases está que arde, pero la hinchada pide fútbol. ¿Cuándo vuelve a rodar la pelota?`,
      author: 'Crónicas de Vestuario',
    };
  }

  if (upcomingMatchesCount > 2) {
      return {
          summary: `La agenda está cargada. Con ${upcomingMatchesCount} partidos en el horizonte, el DT deberá rotar la plantilla para mantener la frescura.`,
          author: 'Pizarra Táctica',
      }
  }

  if (topPlayer) {
    return {
      summary: `Todos los ojos están puestos en ${topPlayer.name}, la figura del equipo con ${topPlayer.ovr} de OVR. ¿Podrá mantener el nivel y llevar al equipo a la gloria?`,
      author: 'El Analista de AFM',
    };
  }

  return {
    summary: 'El equipo se prepara para los próximos desafíos, la estrategia es clave para la victoria.',
    author: 'El Entrenador',
  };
}


interface GroupSummaryCardProps {
  players: Player[];
  matches: Match[];
}

export function GroupSummaryCard({ players, matches }: GroupSummaryCardProps) {
  const [summaryData, setSummaryData] = useState<GroupSummaryOutput | null>(null);
  const [loading, setLoading] = useState(true);

  const analysisInput = useMemo((): GroupSummaryInput => {
    if (!players || players.length === 0) {
      return {
        playerCount: 0,
        upcomingMatchesCount: 0,
      };
    }
    
    const upcomingMatchesCount = matches.filter(m => m.status === 'upcoming').length;
    const topPlayer = [...players].sort((a, b) => b.ovr - a.ovr)[0];

    return {
      playerCount: players.length,
      upcomingMatchesCount,
      topPlayer: topPlayer ? { name: topPlayer.name, ovr: topPlayer.ovr } : undefined,
    };
  }, [players, matches]);


  useEffect(() => {
    const getSummary = () => {
      setLoading(true);
      try {
        const result = generateSummary(analysisInput);
        setSummaryData(result);
      } catch (error) {
        console.error("Failed to generate group summary:", error);
        setSummaryData({ summary: 'No se pudo cargar el análisis del grupo.', author: 'Error del Sistema' });
      } finally {
        setLoading(false);
      }
    };
    
    getSummary();
  }, [analysisInput]);

  return (
    <Card className="bg-gradient-to-br from-primary/80 via-primary to-accent/80 text-primary-foreground shadow-lg">
      <CardContent className="p-6">
          {loading ? (
            <div className="flex items-center gap-3 min-h-[80px] justify-center">
              <Loader2 className="h-5 w-5 animate-spin" />
              <p>Analizando la actualidad del grupo...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center gap-4">
                <Bot className="h-8 w-8 opacity-80" />
                <blockquote className="text-xl font-semibold italic text-center">
                &ldquo;{summaryData?.summary}&rdquo;
                </blockquote>
                <p className="font-bold opacity-90">— {summaryData?.author}</p>
            </div>
          )}
      </CardContent>
    </Card>
  );
}
