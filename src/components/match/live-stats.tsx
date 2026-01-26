"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { BarChart3, Target, Users, Zap } from 'lucide-react';
import type { Match, MatchStatistics } from '@/lib/types';

type LiveStatsProps = {
  match: Match;
  className?: string;
};

export function LiveStats({ match, className }: LiveStatsProps) {
  // Calculate basic stats from events
  const events = match.events || [];
  const team1 = match.teams[0];
  const team2 = match.teams[1];
  
  const calculateBasicStats = () => {
    const stats = {
      goals: { team1: 0, team2: 0 },
      cards: { team1: { yellow: 0, red: 0 }, team2: { yellow: 0, red: 0 } },
      substitutions: { team1: 0, team2: 0 },
      fouls: { team1: 0, team2: 0 },
      corners: { team1: 0, team2: 0 },
    };

    events.forEach(event => {
      const isTeam1 = event.teamId === team1?.id;
      const teamKey = isTeam1 ? 'team1' : 'team2';

      switch (event.type) {
        case 'goal':
          if (event.goalType !== 'own_goal') {
            stats.goals[teamKey]++;
          } else {
            // Own goals count for the other team
            stats.goals[isTeam1 ? 'team2' : 'team1']++;
          }
          break;
        case 'card':
          if (event.cardType === 'yellow') {
            stats.cards[teamKey].yellow++;
          } else if (event.cardType === 'red') {
            stats.cards[teamKey].red++;
          }
          break;
        case 'substitution':
          stats.substitutions[teamKey]++;
          break;
        case 'foul':
          stats.fouls[teamKey]++;
          break;
        case 'corner':
          stats.corners[teamKey]++;
          break;
      }
    });

    return stats;
  };

  const basicStats = calculateBasicStats();
  
  // Use advanced statistics if available, otherwise fall back to basic stats
  const stats: MatchStatistics = match.statistics || {
    possession: { team1: 50, team2: 50 },
    shots: {
      team1: { total: 0, onTarget: 0, offTarget: 0, blocked: 0 },
      team2: { total: 0, onTarget: 0, offTarget: 0, blocked: 0 }
    },
    passes: {
      team1: { total: 0, completed: 0, accuracy: 0 },
      team2: { total: 0, completed: 0, accuracy: 0 }
    },
    fouls: basicStats.fouls,
    corners: basicStats.corners,
    offsides: { team1: 0, team2: 0 },
    yellowCards: {
      team1: basicStats.cards.team1.yellow,
      team2: basicStats.cards.team2.yellow
    },
    redCards: {
      team1: basicStats.cards.team1.red,
      team2: basicStats.cards.team2.red
    },
    saves: { team1: 0, team2: 0 }
  };

  const StatRow = ({ 
    label, 
    team1Value, 
    team2Value, 
    type = 'number'
  }: { 
    label: string; 
    team1Value: number; 
    team2Value: number; 
    type?: 'number' | 'percentage';
  }) => (
    <div className="flex items-center justify-between py-2">
      <div className="text-center w-16">
        <div className="font-semibold text-lg">{team1Value}{type === 'percentage' ? '%' : ''}</div>
      </div>
      <div className="flex-1 text-center px-4">
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <div className="text-center w-16">
        <div className="font-semibold text-lg">{team2Value}{type === 'percentage' ? '%' : ''}</div>
      </div>
    </div>
  );

  const PossessionBar = () => {
    const team1Possession = stats.possession.team1;
    const team2Possession = stats.possession.team2;
    
    return (
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">{team1?.name || 'Equipo 1'}</span>
          <span className="text-xs text-muted-foreground">Posesión</span>
          <span className="text-sm font-medium">{team2?.name || 'Equipo 2'}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium w-8">{team1Possession}%</span>
          <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-300" 
              style={{ width: `${team1Possession}%` }}
            />
          </div>
          <span className="text-xs font-medium w-8">{team2Possession}%</span>
        </div>
      </div>
    );
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Estadísticas del Partido
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Possession */}
        <PossessionBar />
        
        {/* Basic Stats */}
        <div className="space-y-1 border-t pt-4">
          <StatRow 
            label="Goles" 
            team1Value={basicStats.goals.team1} 
            team2Value={basicStats.goals.team2} 
          />
          
          <StatRow 
            label="Tiros" 
            team1Value={stats.shots.team1.total} 
            team2Value={stats.shots.team2.total} 
          />
          
          <StatRow 
            label="Tiros al Arco" 
            team1Value={stats.shots.team1.onTarget} 
            team2Value={stats.shots.team2.onTarget} 
          />
          
          <StatRow 
            label="Córners" 
            team1Value={stats.corners.team1} 
            team2Value={stats.corners.team2} 
          />
          
          <StatRow 
            label="Faltas" 
            team1Value={stats.fouls.team1} 
            team2Value={stats.fouls.team2} 
          />
          
          <StatRow 
            label="Tarjetas Amarillas" 
            team1Value={stats.yellowCards.team1} 
            team2Value={stats.yellowCards.team2} 
          />
          
          {(stats.redCards.team1 > 0 || stats.redCards.team2 > 0) && (
            <StatRow 
              label="Tarjetas Rojas" 
              team1Value={stats.redCards.team1} 
              team2Value={stats.redCards.team2} 
            />
          )}
          
          {(stats.passes.team1.total > 0 || stats.passes.team2.total > 0) && (
            <StatRow 
              label="Precisión de Pases" 
              team1Value={stats.passes.team1.accuracy} 
              team2Value={stats.passes.team2.accuracy} 
              type="percentage"
            />
          )}
        </div>

        {/* Key Events Summary */}
        {events.length > 0 && (
          <div className="border-t pt-4">
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Resumen de Eventos
            </h4>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="space-y-1">
                <div className="text-2xl font-bold text-foreground">
                  {events.filter(e => e.type === 'goal').length}
                </div>
                <div className="text-xs text-muted-foreground">Goles</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-foreground">
                  {events.filter(e => e.type === 'card').length}
                </div>
                <div className="text-xs text-muted-foreground">Tarjetas</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-foreground">
                  {events.filter(e => e.type === 'substitution').length}
                </div>
                <div className="text-xs text-muted-foreground">Cambios</div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}