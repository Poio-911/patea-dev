'use client';

import * as React from 'react';
import { useFirestore } from '@/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from '@/hooks/use-toast';
import { Loader2, ShieldCheck, Trophy, Goal, X, AlertTriangle, Swords, ExternalLink, ShieldAlert, Users } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { advanceWinner, isRoundComplete, getNextRound, isTournamentComplete, getChampion } from '@/lib/utils/cup-bracket';

interface MatchScorer {
  playerId: string;
  playerName: string;
  teamId: string;
}

interface MatchCard {
  playerId: string;
  playerName: string;
  teamId: string;
  color: 'yellow' | 'red';
}

interface CompetitionMatch {
  id: string; // league: match sub-id, cup: bracket match id
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamJersey?: any;
  awayTeamJersey?: any;
  homeScore?: number;
  awayScore?: number;
  status: 'pending' | 'finished';
  scorers?: MatchScorer[];
  cards?: MatchCard[];
  mvp?: MatchScorer;
  isWalkover?: boolean;
  attendance?: number;
  notes?: string;
  // Cup specific
  round?: any;
  matchNumber?: number;
  nextMatchNumber?: number;
  penaltyWinnerId?: string | null;
  streamingUrl?: string;
  isLive?: boolean;
}

interface GhostPlayer {
  id: string;
  name: string;
  number: number | string;
}

interface GhostTeam {
  id: string;
  name: string;
  players?: GhostPlayer[];
}

interface CompetitionMatchResultDialogProps {
  competitionId: string;
  competitionType: 'leagues' | 'cups';
  fixtureDocId?: string; // Only for leagues
  match: CompetitionMatch | null;
  homeTeam?: GhostTeam;
  awayTeam?: GhostTeam;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CompetitionMatchResultDialog({ 
  competitionId, 
  competitionType, 
  fixtureDocId, 
  match, 
  homeTeam, 
  awayTeam, 
  open, 
  onOpenChange,
  onSuccess 
}: CompetitionMatchResultDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = React.useState(false);

  // Form state
  const [homeScore, setHomeScore] = React.useState<string>('');
  const [awayScore, setAwayScore] = React.useState<string>('');
  const [homeScorers, setHomeScorers] = React.useState<string[]>([]);
  const [awayScorers, setAwayScorers] = React.useState<string[]>([]);
  const [homeYellowCards, setHomeYellowCards] = React.useState<string[]>([]);
  const [awayYellowCards, setAwayYellowCards] = React.useState<string[]>([]);
  const [homeRedCards, setHomeRedCards] = React.useState<string[]>([]);
  const [awayRedCards, setAwayRedCards] = React.useState<string[]>([]);
  const [mvpPlayerId, setMvpPlayerId] = React.useState<string>('');
  const [isWalkover, setIsWalkover] = React.useState(false);
  const [attendance, setAttendance] = React.useState<string>('');
  const [matchNotes, setMatchNotes] = React.useState<string>('');
  
  // Cup specific state
  const [penaltyWinner, setPenaltyWinner] = React.useState<string | null>(null);
  const [streamingUrl, setStreamingUrl] = React.useState('');
  const [isLive, setIsLive] = React.useState(false);

  React.useEffect(() => {
    if (open && match) {
      setHomeScore(match.homeScore !== undefined ? String(match.homeScore) : '');
      setAwayScore(match.awayScore !== undefined ? String(match.awayScore) : '');

      const hs = (match.scorers || []).filter(s => s.teamId === match.homeTeamId).map(s => s.playerId);
      const as = (match.scorers || []).filter(s => s.teamId === match.awayTeamId).map(s => s.playerId);
      setHomeScorers(hs);
      setAwayScorers(as);

      const cards = match.cards || [];
      setHomeYellowCards(cards.filter(c => c.teamId === match.homeTeamId && c.color === 'yellow').map(c => c.playerId));
      setAwayYellowCards(cards.filter(c => c.teamId === match.awayTeamId && c.color === 'yellow').map(c => c.playerId));
      setHomeRedCards(cards.filter(c => c.teamId === match.homeTeamId && c.color === 'red').map(c => c.playerId));
      setAwayRedCards(cards.filter(c => c.teamId === match.awayTeamId && c.color === 'red').map(c => c.playerId));

      setMvpPlayerId(match.mvp?.playerId || '');
      setIsWalkover(match.isWalkover || false);
      setAttendance(match.attendance !== undefined ? String(match.attendance) : '');
      setMatchNotes(match.notes || '');
      
      // Cup specific
      setPenaltyWinner(match.penaltyWinnerId || null);
      setStreamingUrl(match.streamingUrl || '');
      setIsLive(match.isLive || false);
    }
  }, [open, match]);

  const handleSave = async () => {
    if (!match) return;
    if (homeScore === '' || awayScore === '') {
      toast({ variant: 'destructive', title: 'Faltan datos', description: 'Tenés que poner los goles de ambos equipos.' });
      return;
    }

    const homeVal = parseInt(homeScore, 10);
    const awayVal = parseInt(awayScore, 10);

    if (isNaN(homeVal) || isNaN(awayVal) || homeVal < 0 || awayVal < 0) {
      toast({ variant: 'destructive', title: 'Datos inválidos', description: 'Los goles deben ser números positivos.' });
      return;
    }

    // Cup tiebreaker check
    if (competitionType === 'cups' && homeVal === awayVal && !penaltyWinner && !isWalkover) {
      toast({ variant: 'destructive', title: 'Empate', description: 'Seleccioná el ganador por penales.' });
      return;
    }

    setIsSaving(true);
    try {
      // 1. Gather data
      const allScorers: MatchScorer[] = [];
      homeScorers.forEach(pid => {
        const p = homeTeam?.players?.find(pl => pl.id === pid);
        if (p && match.homeTeamId) allScorers.push({ playerId: p.id, playerName: p.name, teamId: match.homeTeamId });
      });
      awayScorers.forEach(pid => {
        const p = awayTeam?.players?.find(pl => pl.id === pid);
        if (p && match.awayTeamId) allScorers.push({ playerId: p.id, playerName: p.name, teamId: match.awayTeamId });
      });

      const allCards: MatchCard[] = [];
      homeYellowCards.forEach(pid => {
        const p = homeTeam?.players?.find(pl => pl.id === pid);
        if (p && match.homeTeamId) allCards.push({ playerId: p.id, playerName: p.name, teamId: match.homeTeamId, color: 'yellow' });
      });
      awayYellowCards.forEach(pid => {
        const p = awayTeam?.players?.find(pl => pl.id === pid);
        if (p && match.awayTeamId) allCards.push({ playerId: p.id, playerName: p.name, teamId: match.awayTeamId, color: 'yellow' });
      });
      homeRedCards.forEach(pid => {
        const p = homeTeam?.players?.find(pl => pl.id === pid);
        if (p && match.homeTeamId) allCards.push({ playerId: p.id, playerName: p.name, teamId: match.homeTeamId, color: 'red' });
      });
      awayRedCards.forEach(pid => {
        const p = awayTeam?.players?.find(pl => pl.id === pid);
        if (p && match.awayTeamId) allCards.push({ playerId: p.id, playerName: p.name, teamId: match.awayTeamId, color: 'red' });
      });

      let mvpData = undefined;
      if (mvpPlayerId) {
        const mvpPlayer = [...(homeTeam?.players || []), ...(awayTeam?.players || [])].find(p => p.id === mvpPlayerId);
        if (mvpPlayer) {
          const mvpTeamId = homeTeam?.players?.find(p => p.id === mvpPlayerId) ? match.homeTeamId : match.awayTeamId;
          if (mvpTeamId) mvpData = { playerId: mvpPlayer.id, playerName: mvpPlayer.name, teamId: mvpTeamId };
        }
      }

      const parsedAttendance = attendance.trim() !== '' ? parseInt(attendance, 10) : null;
      const safeAttendance = Number.isFinite(parsedAttendance) && parsedAttendance !== null ? parsedAttendance : null;
      const trimmedNotes = matchNotes.trim();

      const { saveMatchResultAction } = await import('@/lib/actions/server-actions');
      const res = await saveMatchResultAction(competitionType, competitionId, {
        matchId: match.id,
        fixtureDocId,
        homeScore: homeVal,
        awayScore: awayVal,
        scorers: allScorers,
        cards: allCards,
        mvp: mvpData,
        isWalkover,
        penaltyWinnerId: penaltyWinner || null,
        streamingUrl,
        isLive,
        attendance: safeAttendance,
        notes: trimmedNotes || undefined,
        isCup: competitionType === 'cups',
      });

      if (!res?.success) throw new Error(res?.error || 'Error al guardar');

      toast({ title: '¡Acta Cerrada!', description: `Resultado guardado: ${homeVal}-${awayVal}` });
      if (onSuccess) onSuccess();
      onOpenChange(false);
    } catch (e: any) {
      console.error('[CompetitionMatchResultDialog]', e);
      toast({ variant: 'destructive', title: 'Error', description: e.message || 'No se pudo guardar el resultado.' });
    } finally {
      setIsSaving(false);
    }
  };

  if (!match) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl w-full max-h-[95vh] flex flex-col gap-0 overflow-hidden shadow-2xl rounded-2xl border-none">
        <DialogHeader className="shrink-0 p-6 pb-2">
          <DialogTitle className="flex items-center gap-2 uppercase tracking-tight font-black text-xl">
            <Trophy className="h-6 w-6 text-primary" />
            Cargar Acta de Partido
          </DialogTitle>
          <DialogDescription>
            Registrá goles, tarjetas e incidencias del partido.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-2 pb-6 space-y-6 scrollbar-hide">
          {/* Score Board */}
          <div className="py-8 flex items-center justify-center gap-6 bg-muted/20 rounded-2xl border border-border/40 shadow-inner relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -ml-16 -mt-16 group-hover:bg-primary/10 transition-colors" />
            <div className="absolute bottom-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mb-16 group-hover:bg-primary/10 transition-colors" />
            
            <div className="flex flex-col items-center gap-3 z-10">
              <span className="font-bold text-center max-w-[120px] leading-tight truncate px-2 text-sm uppercase tracking-wide">{match.homeTeamName}</span>
              <Input 
                type="number" 
                min="0"
                value={homeScore}
                onChange={(e) => { setHomeScore(e.target.value); setPenaltyWinner(null); }}
                className="w-20 h-20 text-center text-4xl font-black bg-background border-2 shadow-sm rounded-xl focus:border-primary transition-all h-hide-arrows"
                placeholder="0"
              />
            </div>

            <div className="text-muted-foreground/30 font-black text-3xl">-</div>

            <div className="flex flex-col items-center gap-3 z-10">
              <span className="font-bold text-center max-w-[120px] leading-tight truncate px-2 text-sm uppercase tracking-wide">{match.awayTeamName}</span>
              <Input 
                type="number" 
                min="0"
                value={awayScore}
                onChange={(e) => { setAwayScore(e.target.value); setPenaltyWinner(null); }}
                className="w-20 h-20 text-center text-4xl font-black bg-background border-2 shadow-sm rounded-xl focus:border-primary transition-all h-hide-arrows"
                placeholder="0"
              />
            </div>
          </div>

          {/* Cup Penalty Desempate */}
          {competitionType === 'cups' && homeScore !== '' && awayScore !== '' && parseInt(homeScore) === parseInt(awayScore) && !isWalkover && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-amber-500/10 border border-amber-500/30 p-5 rounded-2xl space-y-3 shadow-md">
              <p className="text-xs font-black uppercase text-amber-600 dark:text-amber-400 text-center flex items-center justify-center gap-2">
                <Trophy className="h-3 w-3" /> Desempate por Penales
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Button 
                  variant={penaltyWinner === match.homeTeamId ? 'default' : 'outline'} 
                  onClick={() => setPenaltyWinner(match.homeTeamId!)}
                  className={cn("w-full font-bold", penaltyWinner === match.homeTeamId && "bg-amber-500 hover:bg-amber-600 text-black")}
                >
                  {match.homeTeamName}
                </Button>
                <Button 
                  variant={penaltyWinner === match.awayTeamId ? 'default' : 'outline'} 
                  onClick={() => setPenaltyWinner(match.awayTeamId!)}
                  className={cn("w-full font-bold", penaltyWinner === match.awayTeamId && "bg-amber-500 hover:bg-amber-600 text-black")}
                >
                  {match.awayTeamName}
                </Button>
              </div>
            </motion.div>
          )}

          {/* Goal Scorers Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-border shadow-sm pb-2">
              <Goal className="h-4 w-4 text-emerald-500" />
              <h3 className="text-xs font-black uppercase tracking-widest text-foreground">Goleadores</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {/* Home Team Scorers */}
              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase px-1">Local</Label>
                {homeTeam?.players?.length ? (
                  <>
                    {homeScorers.map((sid, idx) => (
                      <div key={idx} className="flex gap-1 group animate-in slide-in-from-left-2 duration-200">
                        <Select value={sid} onValueChange={(v) => {
                          const n = [...homeScorers]; n[idx] = v; setHomeScorers(n);
                        }}>
                          <SelectTrigger className="h-9 text-xs rounded-lg border-muted-foreground/20">
                            <SelectValue placeholder="Jugador" />
                          </SelectTrigger>
                          <SelectContent>
                            {homeTeam.players!.map(p => (
                              <SelectItem key={p.id} value={p.id}>{p.number ? `#${p.number} ` : ''}{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors shrink-0" onClick={() => setHomeScorers(s => s.filter((_, i) => i !== idx))}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => setHomeScorers(s => [...s, ''])} className="w-full h-8 text-xs border-dashed border-muted-foreground/30 hover:border-emerald-500/50 hover:bg-emerald-500/5 text-muted-foreground hover:text-emerald-500 transition-all font-bold">
                      + Agregar Gol
                    </Button>
                  </>
                ) : <div className="p-3 border border-dashed rounded-lg text-center text-[10px] text-muted-foreground">Sin plantel</div>}
              </div>

              {/* Away Team Scorers */}
              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase px-1">Visita</Label>
                {awayTeam?.players?.length ? (
                  <>
                    {awayScorers.map((sid, idx) => (
                      <div key={idx} className="flex gap-1 animate-in slide-in-from-right-2 duration-200">
                        <Select value={sid} onValueChange={(v) => {
                          const n = [...awayScorers]; n[idx] = v; setAwayScorers(n);
                        }}>
                          <SelectTrigger className="h-9 text-xs rounded-lg border-muted-foreground/20">
                            <SelectValue placeholder="Jugador" />
                          </SelectTrigger>
                          <SelectContent>
                            {awayTeam.players!.map(p => (
                              <SelectItem key={p.id} value={p.id}>{p.number ? `#${p.number} ` : ''}{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors shrink-0" onClick={() => setAwayScorers(s => s.filter((_, i) => i !== idx))}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => setAwayScorers(s => [...s, ''])} className="w-full h-8 text-xs border-dashed border-muted-foreground/30 hover:border-emerald-500/50 hover:bg-emerald-500/5 text-muted-foreground hover:text-emerald-500 transition-all font-bold">
                      + Agregar Gol
                    </Button>
                  </>
                ) : <div className="p-3 border border-dashed rounded-lg text-center text-[10px] text-muted-foreground">Sin plantel</div>}
              </div>
            </div>
          </div>

          {/* Cards Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-border shadow-sm pb-2">
              <ShieldAlert className="h-4 w-4 text-yellow-500" />
              <h3 className="text-xs font-black uppercase tracking-widest text-foreground">Tarjetas</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              {/* Home Team Cards */}
              <div className="space-y-3">
                {/* Yellows */}
                <div className="space-y-1.5">
                   <div className="flex items-center gap-1.5 px-1 text-[9px] font-black text-yellow-600 dark:text-yellow-500">
                    <div className="w-2 h-3 bg-yellow-400 rounded-sm shadow-sm" /> AMARILLAS LOCAL
                   </div>
                   {homeYellowCards.map((sid, idx) => (
                      <div key={idx} className="flex gap-1 animate-in slide-in-from-left-2">
                        <Select value={sid} onValueChange={(v) => {
                          const n = [...homeYellowCards]; n[idx] = v; setHomeYellowCards(n);
                        }}>
                          <SelectTrigger className="h-8 text-[11px] rounded-lg">
                            <SelectValue placeholder="Jugador" />
                          </SelectTrigger>
                          <SelectContent>
                            {homeTeam?.players?.map(p => (
                              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setHomeYellowCards(s => s.filter((_, i) => i !== idx))}><X className="h-3 w-3" /></Button>
                      </div>
                   ))}
                   <Button variant="link" size="sm" onClick={() => setHomeYellowCards(s => [...s, ''])} className="h-6 px-1 text-[10px] text-muted-foreground hover:text-yellow-600">+ Agregar</Button>
                </div>
                {/* Reds */}
                <div className="space-y-1.5">
                   <div className="flex items-center gap-1.5 px-1 text-[9px] font-black text-red-600 dark:text-red-500">
                    <div className="w-2 h-3 bg-red-600 rounded-sm shadow-sm" /> ROJAS LOCAL
                   </div>
                   {homeRedCards.map((sid, idx) => (
                      <div key={idx} className="flex gap-1 animate-in slide-in-from-left-2">
                        <Select value={sid} onValueChange={(v) => {
                          const n = [...homeRedCards]; n[idx] = v; setHomeRedCards(n);
                        }}>
                          <SelectTrigger className="h-8 text-[11px] rounded-lg border-red-500/20">
                            <SelectValue placeholder="Jugador" />
                          </SelectTrigger>
                          <SelectContent>
                            {homeTeam?.players?.map(p => (
                              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setHomeRedCards(s => s.filter((_, i) => i !== idx))}><X className="h-3 w-3" /></Button>
                      </div>
                   ))}
                   <Button variant="link" size="sm" onClick={() => setHomeRedCards(s => [...s, ''])} className="h-6 px-1 text-[10px] text-muted-foreground hover:text-red-600">+ Agregar</Button>
                </div>
              </div>

              {/* Away Team Cards */}
              <div className="space-y-3">
                 {/* Yellows */}
                 <div className="space-y-1.5">
                   <div className="flex items-center gap-1.5 px-1 text-[9px] font-black text-yellow-600 dark:text-yellow-500">
                    <div className="w-2 h-3 bg-yellow-400 rounded-sm shadow-sm" /> AMARILLAS VISITA
                   </div>
                   {awayYellowCards.map((sid, idx) => (
                      <div key={idx} className="flex gap-1 animate-in slide-in-from-right-2">
                        <Select value={sid} onValueChange={(v) => {
                          const n = [...awayYellowCards]; n[idx] = v; setAwayYellowCards(n);
                        }}>
                          <SelectTrigger className="h-8 text-[11px] rounded-lg">
                            <SelectValue placeholder="Jugador" />
                          </SelectTrigger>
                          <SelectContent>
                            {awayTeam?.players?.map(p => (
                              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setAwayYellowCards(s => s.filter((_, i) => i !== idx))}><X className="h-3 w-3" /></Button>
                      </div>
                   ))}
                   <Button variant="link" size="sm" onClick={() => setAwayYellowCards(s => [...s, ''])} className="h-6 px-1 text-[10px] text-muted-foreground hover:text-yellow-600">+ Agregar</Button>
                </div>
                {/* Reds */}
                <div className="space-y-1.5">
                   <div className="flex items-center gap-1.5 px-1 text-[9px] font-black text-red-600 dark:text-red-500">
                    <div className="w-2 h-3 bg-red-600 rounded-sm shadow-sm" /> ROJAS VISITA
                   </div>
                   {awayRedCards.map((sid, idx) => (
                      <div key={idx} className="flex gap-1 animate-in slide-in-from-right-2">
                        <Select value={sid} onValueChange={(v) => {
                          const n = [...awayRedCards]; n[idx] = v; setAwayRedCards(n);
                        }}>
                          <SelectTrigger className="h-8 text-[11px] rounded-lg border-red-500/20">
                            <SelectValue placeholder="Jugador" />
                          </SelectTrigger>
                          <SelectContent>
                            {awayTeam?.players?.map(p => (
                              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setAwayRedCards(s => s.filter((_, i) => i !== idx))}><X className="h-3 w-3" /></Button>
                      </div>
                   ))}
                   <Button variant="link" size="sm" onClick={() => setAwayRedCards(s => [...s, ''])} className="h-6 px-1 text-[10px] text-muted-foreground hover:text-red-600">+ Agregar</Button>
                </div>
              </div>
            </div>
          </div>

          {/* MVP Selection */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-border shadow-sm pb-2">
              <Trophy className="h-4 w-4 text-emerald-500" />
              <h3 className="text-xs font-black uppercase tracking-widest text-foreground">MVP del Partido</h3>
            </div>
            <div className="bg-muted/10 p-4 rounded-xl border border-border/40">
              <RadioGroup value={mvpPlayerId} onValueChange={setMvpPlayerId} className="grid grid-cols-2 gap-2">
                {[...(homeTeam?.players || []), ...(awayTeam?.players || [])].map(p => (
                  <div key={p.id} className={cn("flex items-center space-x-2 p-2.5 rounded-lg border transition-all cursor-pointer", mvpPlayerId === p.id ? "bg-primary/10 border-primary ring-1 ring-primary/20 shadow-sm" : "bg-card border-border/50 hover:border-muted-foreground/30")}>
                    <RadioGroupItem value={p.id} id={`mvp-${p.id}`} className="size-3.5" />
                    <Label htmlFor={`mvp-${p.id}`} className="flex-1 text-[11px] font-medium leading-tight cursor-pointer">
                      {p.name}
                      <span className="text-[9px] text-muted-foreground block font-normal opacity-70">
                        {homeTeam?.players?.find(hp => hp.id === p.id) ? match.homeTeamName : match.awayTeamName}
                      </span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
              {mvpPlayerId && (
                <Button variant="ghost" size="sm" onClick={() => setMvpPlayerId('')} className="w-full mt-3 h-7 text-[10px] font-bold text-muted-foreground hover:text-destructive">Limpiar MVP</Button>
              )}
            </div>
          </div>

          {/* Walkover Options */}
          <div className="bg-slate-900/5 dark:bg-slate-100/5 p-4 rounded-2xl border-2 border-dashed border-border/60">
            <div className="flex items-center gap-3">
               <Checkbox id="walkover" checked={isWalkover} onCheckedChange={(c) => { setIsWalkover(c === true); if (c) { setHomeScore('3'); setAwayScore('0'); } }} />
               <div>
                 <Label htmlFor="walkover" className="text-sm font-black uppercase tracking-tight cursor-pointer">Marcar como Walkover (W.O.)</Label>
                 <p className="text-[10px] text-muted-foreground">El resultado será 3-0 a favor del equipo con jugadores. No se requieren goleadores.</p>
               </div>
            </div>
          </div>

          {/* Streaming & Extra (Only show for Cups or if needed) */}
          <div className="space-y-4 pt-4">
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                    <Users className="size-3" /> Asistencia de público
                  </Label>
                  <Input type="number" value={attendance} onChange={e => setAttendance(e.target.value)} placeholder="Ej: 250" className="h-9 text-xs" />
                </div>
                {competitionType === 'cups' && (
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                      <ExternalLink className="size-3" /> Link de Transmisión
                    </Label>
                    <Input value={streamingUrl} onChange={e => setStreamingUrl(e.target.value)} placeholder="https://..." className="h-9 text-xs" />
                  </div>
                )}
             </div>
             
             {competitionType === 'cups' && (
                <div className="flex items-center justify-between bg-red-500/5 p-3 rounded-xl border border-red-500/20">
                  <div className="flex flex-col">
                    <Label className="text-[10px] font-black text-red-600 dark:text-red-400">EMISIÓN EN VIVO</Label>
                    <span className="text-[9px] text-muted-foreground">Destacar en la aplicación</span>
                  </div>
                  <Checkbox checked={isLive} onCheckedChange={c => setIsLive(c === true)} className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500 size-5" />
                </div>
             )}

             <div className="space-y-1.5">
               <Label className="text-[10px] font-bold text-muted-foreground uppercase">Notas e incidencias</Label>
               <Textarea value={matchNotes} onChange={e => setMatchNotes(e.target.value)} placeholder="Detallá cualquier evento importante..." rows={2} className="text-xs resize-none" />
             </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 p-6 bg-muted/30 border-t border-border/40 gap-3 sm:gap-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving} className="font-bold flex-1 sm:flex-none">Cancelar</Button>
          <Button onClick={handleSave} disabled={isSaving} className="font-black uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20 flex-1 sm:flex-none">
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
            {isSaving ? 'Guardando...' : 'Confirmar Acta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
