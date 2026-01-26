"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { X, Trophy, Clock, Target, AlertTriangle, RotateCcw, Megaphone, Eye, Maximize2 } from 'lucide-react';
import type { Match, MatchEvent, MatchEventType } from '@/lib/types';
import { cn } from '@/lib/utils';
import { VisualizerTimeline } from './visualizer-timeline';
import { EventLogger } from './event-logger';
import { useMatchPresence } from '@/hooks/useMatchPresence';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useDoc, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';

export type MatchVisualizerProps = {
  match: Match;
  isOpen: boolean;
  onClose: () => void;
  isAdmin?: boolean;
  onEventLogged?: (event: MatchEvent) => void;
  currentMinute?: number;
  currentSecond?: number;
};

export function MatchVisualizer({ match, isOpen, onClose, isAdmin = false, onEventLogged, currentMinute = 0, currentSecond = 0 }: MatchVisualizerProps) {
  const [showEventLogger, setShowEventLogger] = useState(false);
  const [selectedEventType, setSelectedEventType] = useState<MatchEventType | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const firestore = useFirestore();
  const matchRef = firestore ? doc(firestore, 'matches', match.id) : null;
  const { data: liveMatch } = useDoc<Match>(matchRef);
  const dataMatch = liveMatch || match;
  const team1 = dataMatch.teams?.[0];
  const team2 = dataMatch.teams?.[1];
  const team1ScoreFinal = dataMatch.finalScore?.team1 ?? 0;
  const team2ScoreFinal = dataMatch.finalScore?.team2 ?? 0;
  const { viewers, count } = useMatchPresence({ matchId: match.id, track: true, staleMs: 5 * 60 * 1000, optimisticSelf: true });

  const broadcastMode = !!match.stream?.active;
  const team1Primary = team1?.jersey?.primaryColor || '#1f2937';
  const team2Primary = team2?.jersey?.primaryColor || '#374151';
  const team1Secondary = team1?.jersey?.secondaryColor || '#9CA3AF';
  const team2Secondary = team2?.jersey?.secondaryColor || '#9CA3AF';
  const abbr = (name?: string) => (name ? name.slice(0,3).toUpperCase() : 'EQ1');

  // Live timer derived from server values for viewers
  const [liveMinute, setLiveMinute] = useState<number>(currentMinute);
  const [liveSecond, setLiveSecond] = useState<number>(currentSecond);
  useEffect(() => {
    const baselineMinute = dataMatch.currentMinute ?? 0;
    const paused = !!dataMatch.timerPaused;
    const startMs = (() => {
      const ts: any = dataMatch.periodStartTs;
      if (!ts) return 0;
      if (typeof ts?.toMillis === 'function') return ts.toMillis();
      if (typeof ts === 'number') return ts;
      const parsed = Date.parse(ts as string);
      return isNaN(parsed) ? 0 : parsed;
    })();
    const tick = () => {
      if (!startMs || paused) {
        setLiveMinute(baselineMinute);
        setLiveSecond(0);
        return;
      }
      const elapsed = Date.now() - startMs;
      const m = baselineMinute + Math.floor(elapsed / 60000);
      const s = Math.floor((elapsed % 60000) / 1000);
      setLiveMinute(m);
      setLiveSecond(s);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [dataMatch.currentMinute, dataMatch.timerPaused, dataMatch.periodStartTs]);

  // Live score derived from events if available
  const goalEvents = (dataMatch.events || []).filter((e) => e.type === 'goal');
  const t1Id = team1?.id || '';
  const t2Id = team2?.id || '';
  const scoreFromEventsKnown = t1Id && t2Id && goalEvents.some(e => e.teamId === t1Id || e.teamId === t2Id);
  const team1GoalsLive = scoreFromEventsKnown ? goalEvents.filter(e => e.teamId === t1Id).length : undefined;
  const team2GoalsLive = scoreFromEventsKnown ? goalEvents.filter(e => e.teamId === t2Id).length : undefined;
  const team1ScoreDisplay = typeof team1GoalsLive === 'number' ? team1GoalsLive : team1ScoreFinal;
  const team2ScoreDisplay = typeof team2GoalsLive === 'number' ? team2GoalsLive : team2ScoreFinal;

  const enterFullscreenLandscape = async () => {
    try {
      const el = containerRef.current || document.documentElement;
      if (el && el.requestFullscreen) {
        await el.requestFullscreen();
      }
      // Orientation lock only works in real fullscreen and may throw
      // Use landscape-primary as preferred
      // @ts-ignore
      if (screen.orientation && screen.orientation.lock) {
        // @ts-ignore
        await screen.orientation.lock('landscape-primary');
      }
    } catch (_) {
      // Silently ignore; user can rotate manually
    }
  };

  const quickEventButtons = [
    { type: 'goal' as MatchEventType, label: 'Gol', icon: Target },
    { type: 'card' as MatchEventType, label: 'Tarjeta', icon: AlertTriangle },
    { type: 'substitution' as MatchEventType, label: 'Cambio', icon: RotateCcw },
    { type: 'foul' as MatchEventType, label: 'Falta', icon: Megaphone },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[100vw] max-h-[100vh] w-screen h-screen p-0 m-0 border-0 bg-black/95">
        <div ref={containerRef} className="relative w-full h-full text-white">
          {/* Header (hidden in broadcast mode) */}
          {!broadcastMode && (
            <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-2 py-1">
                {viewers.slice(0,3).map((v) => (
                  <Avatar key={v.id} className="h-6 w-6 border border-white/20">
                    <AvatarImage src={v.photoURL || undefined} alt={v.displayName || 'viewer'} />
                    <AvatarFallback className="text-xs">{(v.displayName || 'V').slice(0,1)}</AvatarFallback>
                  </Avatar>
                ))}
                <div className="flex items-center gap-1 text-white/90 text-xs">
                  <Eye className="h-3.5 w-3.5" /> {count}
                </div>
              </div>
            </div>
          )}

          <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
            <Button variant="ghost" onClick={onClose} className="text-white hover:bg-white/10">
              <X className="h-6 w-6" />
            </Button>
            <Button variant="ghost" onClick={enterFullscreenLandscape} className="text-white hover:bg-white/10">
              <Maximize2 className="h-6 w-6" />
            </Button>
          </div>

          {/* Optional Live Video */}
          {broadcastMode && (() => {
            const provider = match.stream?.provider;
            const id = match.stream?.id || '';
            const url = match.stream?.url || '';
            const parent = typeof window !== 'undefined' ? window.location.hostname : '';
            let src: string | null = null;
            if (provider === 'youtube' && id) {
              src = `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&playsinline=1`;
            } else if (provider === 'twitch' && id) {
              const params = new URLSearchParams({ channel: id, autoplay: 'true', muted: 'true' });
              const parents = new Set<string>();
              if (parent) {
                parents.add(parent);
                const parts = parent.split('.');
                if (parts.length > 2) {
                  parents.add(`${parts[parts.length-2]}.${parts[parts.length-1]}`);
                }
              }
              parents.add('localhost');
              parents.add('127.0.0.1');
              parents.forEach(p => params.append('parent', p));
              src = `https://player.twitch.tv/?${params.toString()}`;
            } else if (provider === 'kick' && id) {
              src = `https://player.kick.com/${id}?autoplay=true&muted=true`;
            } else if (url) {
              src = url;
            }
            return src ? (
              <div className="w-full aspect-video bg-black">
                <iframe className="w-full h-full" src={src} allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowFullScreen />
              </div>
            ) : null;
          })()}

          {/* Broadcast overlay: ESPN-style score bug (top-left) */}
          {broadcastMode && (
            <ScoreBug
              team1Name={team1?.name}
              team2Name={team2?.name}
              team1Color={team1Primary}
              team2Color={team2Primary}
              score1={team1ScoreDisplay}
              score2={team2ScoreDisplay}
              minute={liveMinute}
              second={liveSecond}
            />
          )}

          {/* Viewer counter bottom-right */}
          {broadcastMode && (
            <div className="absolute bottom-3 right-3 z-20">
              <div className="flex items-center gap-1 text-white/90 text-xs bg-black/60 backdrop-blur border border-white/20 rounded-full px-3 py-1">
                <Eye className="h-3.5 w-3.5" /> {count}
              </div>
            </div>
          )}

          {/* Scoreboard (hidden in broadcast mode) */}
          {!broadcastMode && (
            <div className="flex flex-col items-center justify-center h-[35%]">
              <div className="flex items-center gap-8">
                <div className="text-center">
                  <div className="text-sm opacity-80 mb-1">{team1?.name || 'Equipo 1'}</div>
                  <div className="text-7xl font-black tracking-tight">{team1ScoreDisplay}</div>
                </div>
                <div className="text-4xl opacity-70">-</div>
                <div className="text-center">
                  <div className="text-sm opacity-80 mb-1">{team2?.name || 'Equipo 2'}</div>
                  <div className="text-7xl font-black tracking-tight">{team2ScoreDisplay}</div>
                </div>
              </div>
              <div className="mt-6">
                <Badge className="text-2xl px-5 py-2 bg-white/10 border-white/20">{liveMinute}:{String(liveSecond).padStart(2, '0')}</Badge>
              </div>
            </div>
          )}

          {/* Timeline + Controls */}
          <div className="h-[65%] overflow-auto p-6">
            {isAdmin && !broadcastMode && (
              <div className="sticky top-0 -mx-6 px-6 py-3 z-40 bg-black/70 supports-[backdrop-filter]:bg-black/40 backdrop-blur border-b border-white/10">
                <div className="flex gap-2 overflow-x-auto">
                  {quickEventButtons.map(({ type, label, icon: Icon }) => (
                    <Button key={type} variant="secondary" className="bg-white/10 border-white/20 text-white"
                      onClick={() => {
                        setSelectedEventType(type);
                        setShowEventLogger(true);
                      }}>
                      <Icon className="h-4 w-4 mr-2" /> {label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Timeline (standard mode) */}
            {!broadcastMode && (
              <div className="mt-4">
                <VisualizerTimeline events={match.events || []} />
              </div>
            )}

            {/* Event Logger */}
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
                onEventLogged={(ev) => {
                  onEventLogged?.(ev);
                }}
              />
            )}
          </div>

          {/* Timeline toggle for broadcast mode */}
          {broadcastMode && (
            <BroadcastTimelineToggle events={match.events || []} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Minimal ESPN/FOX-style score bug component
function ScoreBug({
  team1Name,
  team2Name,
  team1Color,
  team2Color,
  score1,
  score2,
  minute,
  second,
}: {
  team1Name?: string;
  team2Name?: string;
  team1Color: string;
  team2Color: string;
  score1: number;
  score2: number;
  minute: number;
  second: number;
}) {
  const t1 = (team1Name && team1Name.length > 0) ? team1Name : 'Equipo 1';
  const t2 = (team2Name && team2Name.length > 0) ? team2Name : 'Equipo 2';
  return (
    <div className="absolute top-3 left-3 z-20">
      <div className="flex items-center h-11 rounded-md bg-black/75 shadow-md px-3 backdrop-blur supports-[backdrop-filter]:bg-black/60">
        <div className="flex items-center gap-2 pr-3 border-r border-white/10">
          <span className="inline-block w-5 h-5 rounded-full" style={{ backgroundColor: team1Color }} />
          <span className="text-sm font-semibold tracking-wide text-white max-w-[160px] truncate">{t1}</span>
        </div>
        <div className="flex items-center gap-1 mx-3">
          <span className="text-3xl leading-none font-black text-white">{score1}</span>
          <span className="text-xl leading-none text-white/70">-</span>
          <span className="text-3xl leading-none font-black text-white">{score2}</span>
        </div>
        <div className="flex items-center gap-2 pl-3 border-l border-white/10">
          <span className="inline-block w-5 h-5 rounded-full" style={{ backgroundColor: team2Color }} />
          <span className="text-sm font-semibold tracking-wide text-white max-w-[160px] truncate">{t2}</span>
        </div>
        <div className="ml-3 flex items-center gap-1 font-mono text-sm text-white bg-white/10 border border-white/10 rounded px-2 py-0.5">
          <Clock className="h-3.5 w-3.5" /> {minute}:{String(second).padStart(2, '0')}
        </div>
      </div>
    </div>
  );
}
// Inline helper component to toggle timeline in broadcast mode
function BroadcastTimelineToggle({ events }: { events: MatchEvent[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="absolute bottom-3 left-3 z-20">
        <Button variant="ghost" size="sm" className="text-white hover:bg-white/10" onClick={() => setOpen((v) => !v)}>
          <Megaphone className="h-4 w-4 mr-2" /> Eventos
        </Button>
      </div>
      {open && (
        <div className="absolute bottom-0 left-0 right-0 max-h-[40%] bg-black/80 backdrop-blur border-t border-white/10 p-4 overflow-auto">
          <VisualizerTimeline events={events} />
        </div>
      )}
    </>
  );
}
