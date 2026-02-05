"use client";

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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
  const goalEvents = (dataMatch.events || []).filter((e: MatchEvent) => e.type === 'goal');
  const t1Id = team1?.id || 'team1';
  const t2Id = team2?.id || 'team2';
  const scoreFromEventsKnown = t1Id && t2Id && goalEvents.some((e: MatchEvent) => e.teamId === t1Id || e.teamId === t2Id);
  const team1GoalsLive = scoreFromEventsKnown ? goalEvents.filter((e: MatchEvent) => e.teamId === t1Id).length : undefined;
  const team2GoalsLive = scoreFromEventsKnown ? goalEvents.filter((e: MatchEvent) => e.teamId === t2Id).length : undefined;
  const team1ScoreDisplay = typeof team1GoalsLive === 'number' ? team1GoalsLive : team1ScoreFinal;
  const team2ScoreDisplay = typeof team2GoalsLive === 'number' ? team2GoalsLive : team2ScoreFinal;

  // Goal animation state
  const [showGoalAnim, setShowGoalAnim] = useState(false);
  const [goalAnimColor, setGoalAnimColor] = useState<string>('#ffffff');
  const [goalSide, setGoalSide] = useState<'team1' | 'team2' | null>(null);
  const lastGoalIdRef = useRef<string | null>(null);
  useEffect(() => {
    const latestGoal = goalEvents
      .slice()
      .sort((a: MatchEvent, b: MatchEvent) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .at(-1);
    if (!latestGoal) return;
    if (lastGoalIdRef.current === latestGoal.id) return;
    lastGoalIdRef.current = latestGoal.id;
    const isTeam1 = latestGoal.teamId === t1Id;
    const color = isTeam1 ? team1Primary : team2Primary;
    setGoalAnimColor(color || '#ffffff');
    setGoalSide(isTeam1 ? 'team1' : 'team2');
    setShowGoalAnim(true);
    const t = setTimeout(() => setShowGoalAnim(false), 1800);
    return () => clearTimeout(t);
  }, [goalEvents.length, t1Id, team1Primary, team2Primary]);

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
      <DialogContent className="max-w-[100vw] max-h-[100vh] w-screen h-screen p-0 m-0 border-0 bg-background">
        <div ref={containerRef} className="relative w-full h-full text-foreground">
          {/* Header (hidden in broadcast mode) */}
          {!broadcastMode && (
            <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 bg-foreground/10 border border-foreground/20 rounded-full px-2 py-1">
                {viewers.slice(0,3).map((v) => (
                  <Avatar key={v.id} className="h-6 w-6 border border-foreground/20">
                    <AvatarImage src={v.photoURL || undefined} alt={v.displayName || 'viewer'} />
                    <AvatarFallback className="text-xs">{(v.displayName || 'V').slice(0,1)}</AvatarFallback>
                  </Avatar>
                ))}
                <div className="flex items-center gap-1 text-foreground/90 text-xs">
                  <Eye className="h-3.5 w-3.5" /> {count}
                </div>
              </div>
            </div>
          )}

          <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
            <Button variant="ghost" onClick={onClose} className="text-foreground hover:bg-foreground/10">
              <X className="h-6 w-6" />
            </Button>
            <Button variant="ghost" onClick={enterFullscreenLandscape} className="text-foreground hover:bg-foreground/10">
              <Maximize2 className="h-6 w-6" />
            </Button>
            {broadcastMode && isAdmin && (
              <div className="flex items-center gap-2">
                <Button variant="secondary" className="bg-foreground/10 border-foreground/20 text-foreground"
                  onClick={() => { setSelectedEventType('goal'); setShowEventLogger(true); }}>
                  Gol
                </Button>
                <Button variant="secondary" className="bg-foreground/10 border-foreground/20 text-foreground"
                  onClick={() => { setSelectedEventType('card'); setShowEventLogger(true); }}>
                  Tarjeta
                </Button>
              </div>
            )}
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
              <div className="w-full aspect-video bg-background">
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
              redCards1={(dataMatch.events || []).filter((e: MatchEvent) => e.type === 'card' && e.cardType === 'red' && e.teamId === t1Id).length}
              redCards2={(dataMatch.events || []).filter((e: MatchEvent) => e.type === 'card' && e.cardType === 'red' && e.teamId === t2Id).length}
              showGoalAnim={showGoalAnim}
              goalSide={goalSide || undefined}
              goalColor={goalAnimColor}
            />
          )}

          {/* Viewer counter bottom-right */}
          {broadcastMode && (
            <div className="absolute bottom-3 right-3 z-20">
              <div className="flex items-center gap-1 text-foreground/90 text-xs bg-background/60 backdrop-blur border border-border rounded-full px-3 py-1">
                <Eye className="h-3.5 w-3.5" /> {count}
              </div>
            </div>
          )}

          {/* Goal animation handled inside ScoreBug, anchored under scoring team */}

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
                <Badge className="text-2xl px-5 py-2 bg-foreground/10 border-foreground/20">{liveMinute}:{String(liveSecond).padStart(2, '0')}</Badge>
              </div>
            </div>
          )}

          {/* Timeline + Controls */}
          <div className="h-[65%] overflow-auto p-6">
            {isAdmin && !broadcastMode && (
              <div className="sticky top-0 -mx-6 px-6 py-3 z-40 bg-background/70 supports-[backdrop-filter]:bg-background/40 backdrop-blur border-b border-border">
                <div className="flex gap-2 overflow-x-auto">
                  {quickEventButtons.map(({ type, label, icon: Icon }) => (
                    <Button key={type} variant="secondary" className="bg-foreground/10 border-foreground/20 text-foreground"
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
                match={dataMatch}
                currentMinute={liveMinute}
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
  redCards1,
  redCards2,
  showGoalAnim,
  goalSide,
  goalColor,
}: {
  team1Name?: string;
  team2Name?: string;
  team1Color: string;
  team2Color: string;
  score1: number;
  score2: number;
  minute: number;
  second: number;
  redCards1: number;
  redCards2: number;
  showGoalAnim?: boolean;
  goalSide?: 'team1' | 'team2';
  goalColor?: string;
}) {
  const t1 = (team1Name && team1Name.length > 0) ? team1Name : 'Equipo 1';
  const t2 = (team2Name && team2Name.length > 0) ? team2Name : 'Equipo 2';
  return (
      <div className="absolute top-3 left-3 z-20">
      <div className="relative flex items-center h-11 rounded-md bg-background/75 shadow-md px-3 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-2 pr-3 border-r border-border">
          <span className="inline-block w-5 h-5 rounded-full" style={{ backgroundColor: team1Color }} />
          <span className="text-sm font-semibold tracking-wide text-foreground max-w-[160px] truncate">{t1}</span>
          {redCards1 > 0 && (
            <div className="ml-2 flex items-center gap-1">
              {Array.from({ length: redCards1 }).map((_, i) => (
                <span key={i} className="inline-block w-2.5 h-2.5 bg-destructive" />
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 mx-3">
          <span className="text-3xl leading-none font-black text-foreground">{score1}</span>
          <span className="text-xl leading-none text-foreground/70">-</span>
          <span className="text-3xl leading-none font-black text-foreground">{score2}</span>
        </div>
        <div className="flex items-center gap-2 pl-3 border-l border-border">
          <span className="inline-block w-5 h-5 rounded-full" style={{ backgroundColor: team2Color }} />
          <span className="text-sm font-semibold tracking-wide text-foreground max-w-[160px] truncate">{t2}</span>
          {redCards2 > 0 && (
            <div className="ml-2 flex items-center gap-1">
              {Array.from({ length: redCards2 }).map((_, i) => (
                <span key={i} className="inline-block w-2.5 h-2.5 bg-destructive" />
              ))}
            </div>
          )}
        </div>
        <div className="ml-3 flex items-center gap-1 font-mono text-sm text-foreground bg-foreground/10 border border-foreground/10 rounded px-2 py-0.5">
          <Clock className="h-3.5 w-3.5" /> {minute}:{String(second).padStart(2, '0')}
        </div>

        {/* Goal animation under scoring team: small drop, hold, then rise */}
        <AnimatePresence>
          {showGoalAnim && goalSide && (
            <motion.div
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -10, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className={goalSide === 'team1' ? 'absolute -bottom-6 left-2' : 'absolute -bottom-6 right-2'}
            >
              <div className="px-2 py-0.5 rounded-md">
                <div className="text-foreground text-lg font-extrabold tracking-wide">
                  GOOOL
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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
        <Button variant="ghost" size="sm" className="text-foreground hover:bg-foreground/10" onClick={() => setOpen((v) => !v)}>
          <Megaphone className="h-4 w-4 mr-2" /> Eventos
        </Button>
      </div>
      {open && (
        <div className="absolute bottom-0 left-0 right-0 max-h-[40%] bg-background/80 backdrop-blur border-t border-border p-4 overflow-auto">
          <VisualizerTimeline events={events} />
        </div>
      )}
    </>
  );
}
