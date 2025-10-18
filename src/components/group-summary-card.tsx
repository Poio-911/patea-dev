'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Bot, Loader2 } from 'lucide-react';
import { generateGroupSummary, GroupSummaryInput, GroupSummaryOutput } from '@/ai/flows/generate-group-summary';
import type { Player, Match } from '@/lib/types';

interface GroupSummaryCardProps {
  players: Player[];
  matches: Match[];
}

export function GroupSummaryCard({ players, matches }: GroupSummaryCardProps) {
  const [summaryData, setSummaryData] = useState<GroupSummaryOutput | null>(null);
  const [loading, setLoading] = useState(true);

  const analysisInput = useMemo((): GroupSummaryInput | null => {
    if (!players || players.length === 0) {
      return {
        playerCount: 0,
        upcomingMatchesCount: 0,
      };
    }
    
    const upcomingMatchesCount = matches.filter(m => m.status === 'upcoming').length;
    const topPlayer = players.sort((a, b) => b.ovr - a.ovr)[0];

    return {
      playerCount: players.length,
      upcomingMatchesCount,
      topPlayer: topPlayer ? { name: topPlayer.name, ovr: topPlayer.ovr } : undefined,
    };
  }, [players, matches]);


  useEffect(() => {
    const getSummary = async () => {
      if (!analysisInput) return;
      setLoading(true);
      try {
        const result = await generateGroupSummary(analysisInput);
        setSummaryData(result);
      } catch (error) {
        console.error("Failed to fetch group summary:", error);
        setSummaryData({ summary: 'No se pudo cargar el análisis del grupo. Inténtalo de nuevo más tarde.', author: 'Error del Sistema' });
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
