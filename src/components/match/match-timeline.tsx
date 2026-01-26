"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Target, AlertTriangle, RotateCcw, Siren, Flag, Clock, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MatchEvent, MatchEventType } from '@/lib/types';

type MatchTimelineProps = {
  events: MatchEvent[];
  currentMinute?: number;
  className?: string;
};

export function MatchTimeline({ events, currentMinute = 0, className }: MatchTimelineProps) {
  const getEventIcon = (type: MatchEventType) => {
    switch (type) {
      case 'goal': return Target;
      case 'card': return AlertTriangle;
      case 'substitution': return RotateCcw;
      case 'foul': return Siren;
      case 'corner': return Flag;
      case 'kick_off': return Play;
      case 'half_time': case 'full_time': return Clock;
      default: return Clock;
    }
  };

  const getEventColor = (type: MatchEventType) => {
    // Grayscale neutral style for all events
    return 'text-foreground bg-card/70 border border-border';
  };

  const getEventDescription = (event: MatchEvent) => {
    switch (event.type) {
      case 'goal':
        const goalDesc = `Gol de ${event.playerName}`;
        if (event.assistName) {
          return `${goalDesc} (Asistencia: ${event.assistName})`;
        }
        if (event.goalType && event.goalType !== 'regular') {
          return `${goalDesc} (${event.goalType === 'penalty' ? 'Penal' : 
                   event.goalType === 'free_kick' ? 'Tiro libre' :
                   event.goalType === 'header' ? 'Cabezazo' :
                   event.goalType === 'own_goal' ? 'Autogol' : event.goalType})`;
        }
        return goalDesc;
      
      case 'card':
        const cardColor = event.cardType === 'yellow' ? 'Amarilla' : 'Roja';
        const reason = event.cardReason ? ` (${event.cardReason})` : '';
        return `Tarjeta ${cardColor} para ${event.playerName}${reason}`;
      
      case 'substitution':
        return `Cambio: Sale ${event.playerOutName}, entra ${event.playerInName}`;
      
      case 'foul':
        return `Falta de ${event.playerName}`;
      
      case 'corner':
        return `Córner para el equipo`;
      
      case 'kick_off':
        return 'Inicio del partido';
      
      case 'half_time':
        return 'Fin del primer tiempo';
      
      case 'full_time':
        return 'Fin del partido';
      
      default:
        return event.description || 'Evento';
    }
  };

  // Sort events by minute (most recent first for timeline view)
  const sortedEvents = [...events].sort((a, b) => b.minute - a.minute);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Línea de Tiempo
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-80">
          {sortedEvents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No hay eventos registrados</p>
              {currentMinute > 0 && (
                <p className="text-sm">Minuto actual: {currentMinute}'</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Current minute indicator */}
              {currentMinute > 0 && (
                <div className="flex items-center gap-3 p-3 rounded-lg border-2 border-primary bg-primary/5">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                    {currentMinute}'
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-primary">
                      En curso - Minuto {currentMinute}
                    </div>
                  </div>
                </div>
              )}
              
              {sortedEvents.map((event) => {
                const Icon = getEventIcon(event.type);
                const colorClasses = getEventColor(event.type);
                
                return (
                  <div key={event.id} className="flex items-start gap-3 p-3 rounded-lg border border-border">
                    <div className={cn(
                      "flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold",
                      colorClasses
                    )}>
                      <Icon className="h-4 w-4" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          {event.minute}'
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(event.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      
                      <div className="font-medium text-sm">
                        {getEventDescription(event)}
                      </div>
                      
                      {event.description && event.description !== getEventDescription(event) && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {event.description}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}