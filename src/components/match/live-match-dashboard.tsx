"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Clock, Play, Pause, Square, Target, AlertTriangle, RotateCcw, Megaphone, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Match, MatchEvent, LiveMatchStatus, MatchEventType } from '@/lib/types';
import { EventLogger } from './event-logger';
import { MatchTimeline } from './match-timeline';
import { LiveStats } from './live-stats';
import { MatchVisualizer } from './match-visualizer';
import { MatchStreamDialog } from './match-stream-dialog';

type LiveMatchDashboardProps = {
  match: Match;
  isAdmin?: boolean; // Only admins can log events
  onEventLogged?: (event: MatchEvent) => void;
  onMatchStatusChange?: (status: LiveMatchStatus, currentMinute: number) => void;
};

export function LiveMatchDashboard({ 
  match, 
  isAdmin = false, 
  onEventLogged,
  onMatchStatusChange 
}: LiveMatchDashboardProps) {
  const [baseMinute, setBaseMinute] = useState(match.currentMinute || 0);
  const [periodStartMs, setPeriodStartMs] = useState<number | null>(match.periodStartTs ? new Date((match as any).periodStartTs?.toDate?.() || match.periodStartTs).getTime() : null);
  const [currentMinute, setCurrentMinute] = useState(match.currentMinute || 0);
  const [currentSecond, setCurrentSecond] = useState(0);
  const [liveStatus, setLiveStatus] = useState<LiveMatchStatus>(match.liveStatus || 'not_started');
  const [isTimerRunning, setIsTimerRunning] = useState(match.liveStatus === 'first_half' || match.liveStatus === 'second_half');
  const [showEventLogger, setShowEventLogger] = useState(false);
  const [selectedEventType, setSelectedEventType] = useState<MatchEventType | null>(null);
  const [showVisualizer, setShowVisualizer] = useState(false);
  const [showStreamDialog, setShowStreamDialog] = useState(false);

  // Derive clock from base + elapsed since periodStartMs; keeps running even if admin leaves
  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    const running = (liveStatus === 'first_half' || liveStatus === 'second_half') && isTimerRunning && !!periodStartMs;
    if (running) {
      interval = setInterval(() => {
        const elapsedMs = Date.now() - (periodStartMs as number);
        const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
        const minute = baseMinute + Math.floor(totalSeconds / 60);
        const second = totalSeconds % 60;
        setCurrentMinute(minute);
        setCurrentSecond(second);
      }, 1000);
    } else {
      setCurrentMinute(baseMinute);
      setCurrentSecond(0);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isTimerRunning, liveStatus, periodStartMs, baseMinute]);

  const handleStatusChange = (newStatus: LiveMatchStatus) => {
    setLiveStatus(newStatus);
    // compute baseline + start time
    if (newStatus === 'first_half') {
      setBaseMinute(0);
      setPeriodStartMs(Date.now());
      setIsTimerRunning(true);
      onMatchStatusChange?.('first_half', 0);
      return;
    }
    if (newStatus === 'second_half') {
      const baseline = Math.max(45, currentMinute >= 45 ? currentMinute : 45);
      setBaseMinute(baseline);
      setPeriodStartMs(Date.now());
      setIsTimerRunning(true);
      onMatchStatusChange?.('second_half', baseline);
      return;
    }
    
    if (newStatus === 'half_time' || newStatus === 'finished') {
      setIsTimerRunning(false);
      onMatchStatusChange?.(newStatus, currentMinute);
    }
  };

  const handleEventLog = (event: MatchEvent) => {
    onEventLogged?.(event);
    setShowEventLogger(false);
    setSelectedEventType(null);
  };

  const getStatusColor = (status: LiveMatchStatus) => {
    switch (status) {
      case 'not_started': return 'bg-muted';
      case 'first_half': case 'second_half': return 'bg-primary';
      case 'half_time': return 'bg-card';
      case 'finished': return 'bg-muted';
      default: return 'bg-secondary';
    }
  };

  const getStatusLabel = (status: LiveMatchStatus) => {
    switch (status) {
      case 'not_started': return 'No Iniciado';
      case 'first_half': return 'Primer Tiempo';
      case 'half_time': return 'Entretiempo';
      case 'second_half': return 'Segundo Tiempo';
      case 'finished': return 'Finalizado';
      default: return status;
    }
  };

  const quickEventButtons = [
    { type: 'goal' as MatchEventType, label: 'Gol', icon: Target },
    { type: 'card' as MatchEventType, label: 'Tarjeta', icon: AlertTriangle },
    { type: 'substitution' as MatchEventType, label: 'Cambio', icon: RotateCcw },
    { type: 'foul' as MatchEventType, label: 'Falta', icon: Megaphone },
  ];

  return (
    <div className="space-y-6">
      {/* Match Status Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="flex items-center gap-3">
              <div className={cn(
                "w-3 h-3 rounded-full animate-pulse",
                getStatusColor(liveStatus)
              )} />
              <span>{getStatusLabel(liveStatus)}</span>
            </CardTitle>
            <div className="flex items-center gap-2 shrink-0">
              <Clock className="h-4 w-4" />
              <Badge variant="outline" className="text-lg font-mono">
                {currentMinute}:{String(currentSecond).padStart(2, '0')}
              </Badge>
              <Button variant="outline" size="sm" onClick={() => setShowVisualizer(true)} className="ml-2">
                <Maximize2 className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Visualizador</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        
        {isAdmin && (
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {liveStatus === 'not_started' && (
                <Button 
                  onClick={() => handleStatusChange('first_half')}
                  className="bg-primary hover:bg-primary/90"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Iniciar Partido
                </Button>
              )}
              
              {liveStatus === 'first_half' && (
                <>
                  <Button 
                    onClick={() => setIsTimerRunning(!isTimerRunning)}
                    variant={isTimerRunning ? "destructive" : "default"}
                  >
                    {isTimerRunning ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                    {isTimerRunning ? 'Pausar' : 'Reanudar'}
                  </Button>
                  <Button onClick={() => handleStatusChange('half_time')}>
                    Entretiempo
                  </Button>
                </>
              )}
              
              {liveStatus === 'half_time' && (
                <Button 
                  onClick={() => handleStatusChange('second_half')}
                  className="bg-primary hover:bg-primary/90"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Segundo Tiempo
                </Button>
              )}
              
              {liveStatus === 'second_half' && (
                <>
                  <Button 
                    onClick={() => setIsTimerRunning(!isTimerRunning)}
                    variant={isTimerRunning ? "destructive" : "default"}
                  >
                    {isTimerRunning ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                    {isTimerRunning ? 'Pausar' : 'Reanudar'}
                  </Button>
                  <Button 
                    onClick={() => handleStatusChange('finished')}
                    variant="destructive"
                  >
                    <Square className="h-4 w-4 mr-2" />
                    Finalizar
                  </Button>
                </>
              )}
              <Button variant="outline" onClick={() => setShowStreamDialog(true)}>
                Transmisión
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Score Display */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center text-4xl font-bold">
            <div className="text-center">
              <div className="text-sm font-normal text-muted-foreground mb-1">
                {match.teams[0]?.name || 'Equipo 1'}
              </div>
              <div>{match.finalScore?.team1 || 0}</div>
            </div>
            <Separator orientation="vertical" className="mx-8 h-16" />
            <div className="text-center">
              <div className="text-sm font-normal text-muted-foreground mb-1">
                {match.teams[1]?.name || 'Equipo 2'}
              </div>
              <div>{match.finalScore?.team2 || 0}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Event Buttons */}
      {isAdmin && (liveStatus === 'first_half' || liveStatus === 'second_half') && (
        <Card>
          <CardHeader>
            <CardTitle>Registrar Evento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {quickEventButtons.map(({ type, label, icon: Icon }) => (
                <Button
                  key={type}
                  onClick={() => {
                    setSelectedEventType(type);
                    setShowEventLogger(true);
                  }}
                  className={cn("h-20 flex-col gap-2 bg-card text-foreground border border-border hover:bg-muted")}
                  variant="default"
                >
                  <Icon className="h-6 w-6" />
                  <span className="text-sm">{label}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Match Timeline and Stats */}
      <div className="grid md:grid-cols-2 gap-6">
        <MatchTimeline events={match.events || []} currentMinute={currentMinute} />
        <LiveStats match={match} />
      </div>

      {/* Event Logger Modal */}
      {showEventLogger && selectedEventType && (
        <EventLogger
          isOpen={showEventLogger}
          onClose={() => {
            setShowEventLogger(false);
            setSelectedEventType(null);
          }}
          eventType={selectedEventType}
          match={match}
          currentMinute={currentMinute}
          onEventLogged={handleEventLog}
        />
      )}

      {/* Fullscreen Visualizer */}
      <MatchVisualizer 
        match={match} 
        isOpen={showVisualizer} 
        onClose={() => setShowVisualizer(false)} 
        isAdmin={isAdmin}
        onEventLogged={onEventLogged}
        currentMinute={currentMinute}
        currentSecond={currentSecond}
      />

      <MatchStreamDialog match={match} open={showStreamDialog} onOpenChange={setShowStreamDialog} />

      {/* Floating CTA removed: moved to dashboard widget */}
    </div>
  );
}