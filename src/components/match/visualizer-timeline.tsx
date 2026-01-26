"use client";

import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Target, AlertTriangle, RotateCcw, Megaphone, Flag, Play, Clock } from 'lucide-react';
import type { MatchEvent, MatchEventType } from '@/lib/types';
import { cn } from '@/lib/utils';

export type VisualizerTimelineProps = {
  events: MatchEvent[];
};

function getEventIcon(type: MatchEventType) {
  switch (type) {
    case 'goal': return Target;
    case 'card': return AlertTriangle;
    case 'substitution': return RotateCcw;
    case 'foul': return Megaphone;
    case 'corner': return Flag;
    case 'kick_off': return Play;
    case 'half_time':
    case 'full_time': return Clock;
    default: return Clock;
  }
}

export function VisualizerTimeline({ events }: VisualizerTimelineProps) {
  const sortedEvents = [...events].sort((a, b) => b.minute - a.minute);

  if (sortedEvents.length === 0) {
    return (
      <div className="text-center py-12 text-white/70">
        <Clock className="h-10 w-10 mx-auto mb-3 opacity-60" />
        <p>No hay eventos registrados</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {sortedEvents.map((event) => {
        const Icon = getEventIcon(event.type);
        return (
          <Card key={event.id} className="bg-white/8 border-white/15 text-white p-4 md:p-5 rounded-xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-white/15 border-white/20 text-white">{event.minute}'</Badge>
                <span className="text-xs opacity-70">{new Date(event.timestamp).toLocaleTimeString()}</span>
              </div>
            </div>
            <div className="text-base md:text-lg font-semibold">
              {event.type === 'goal' && (
                <>
                  Gol de {event.playerName}
                  {event.assistName ? ` (Asistencia: ${event.assistName})` : ''}
                </>
              )}
              {event.type === 'card' && (
                <>Tarjeta {event.cardType === 'yellow' ? 'Amarilla' : 'Roja'} para {event.playerName}</>
              )}
              {event.type === 'substitution' && (
                <>Cambio: Sale {event.playerOutName}, entra {event.playerInName}</>
              )}
              {event.type === 'foul' && (
                <>Falta de {event.playerName}</>
              )}
              {event.type === 'corner' && (
                <>Córner para el equipo</>
              )}
              {event.type === 'kick_off' && <>Inicio del partido</>}
              {event.type === 'half_time' && <>Fin del primer tiempo</>}
              {event.type === 'full_time' && <>Fin del partido</>}
              {!['goal','card','substitution','foul','corner','kick_off','half_time','full_time'].includes(event.type) && (
                <>{event.description || 'Evento'}</>
              )}
            </div>
            {event.description && (
              <div className="text-sm opacity-80 mt-2">{event.description}</div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
