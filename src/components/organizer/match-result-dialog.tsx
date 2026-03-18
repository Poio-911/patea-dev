'use client';

import * as React from 'react';
import { useFirestore } from '@/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from '@/hooks/use-toast';
import { Loader2, ShieldCheck, Trophy, Goal, X, AlertTriangle } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface MatchObj {
  id: string; // The match sub-id
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeTeamName: string;
  awayTeamName: string;
  homeScore?: number;
  awayScore?: number;
  status: 'pending' | 'finished';
  scorers?: { playerId: string, playerName: string, teamId: string }[];
  cards?: { playerId: string, playerName: string, teamId: string, color: 'yellow' | 'red' }[];
  mvp?: { playerId: string, playerName: string, teamId: string };
  isWalkover?: boolean;
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

interface MatchResultDialogProps {
  leagueId: string;
  fixtureDocId: string; 
  match: MatchObj | null;
  homeTeam?: GhostTeam;
  awayTeam?: GhostTeam;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MatchResultDialog({ leagueId, fixtureDocId, match, homeTeam, awayTeam, open, onOpenChange }: MatchResultDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = React.useState(false);

  const [homeScore, setHomeScore] = React.useState<string>('');
  const [awayScore, setAwayScore] = React.useState<string>('');

  // Arrays of player IDs
  const [homeScorers, setHomeScorers] = React.useState<string[]>([]);
  const [awayScorers, setAwayScorers] = React.useState<string[]>([]);

  // Cards (yellow and red)
  const [homeYellowCards, setHomeYellowCards] = React.useState<string[]>([]);
  const [awayYellowCards, setAwayYellowCards] = React.useState<string[]>([]);
  const [homeRedCards, setHomeRedCards] = React.useState<string[]>([]);
  const [awayRedCards, setAwayRedCards] = React.useState<string[]>([]);

  // MVP
  const [mvpPlayerId, setMvpPlayerId] = React.useState<string>('');

  // Walkover
  const [isWalkover, setIsWalkover] = React.useState(false);

  React.useEffect(() => {
    if (open && match) {
      setHomeScore(match.homeScore !== undefined ? String(match.homeScore) : '');
      setAwayScore(match.awayScore !== undefined ? String(match.awayScore) : '');

      const hs = (match.scorers || []).filter(s => s.teamId === match.homeTeamId).map(s => s.playerId);
      const as = (match.scorers || []).filter(s => s.teamId === match.awayTeamId).map(s => s.playerId);
      setHomeScorers(hs);
      setAwayScorers(as);

      // Load cards
      const cards = match.cards || [];
      const homeYellows = cards.filter(c => c.teamId === match.homeTeamId && c.color === 'yellow').map(c => c.playerId);
      const awayYellows = cards.filter(c => c.teamId === match.awayTeamId && c.color === 'yellow').map(c => c.playerId);
      const homeReds = cards.filter(c => c.teamId === match.homeTeamId && c.color === 'red').map(c => c.playerId);
      const awayReds = cards.filter(c => c.teamId === match.awayTeamId && c.color === 'red').map(c => c.playerId);
      setHomeYellowCards(homeYellows);
      setAwayYellowCards(awayYellows);
      setHomeRedCards(homeReds);
      setAwayRedCards(awayReds);

      // Load MVP
      setMvpPlayerId(match.mvp?.playerId || '');

      // Load walkover
      setIsWalkover(match.isWalkover || false);
    }
  }, [open, match]);

  const handleSave = async () => {
    if (!firestore || !match) return;
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

    setIsSaving(true);
    try {
      const fixtureRef = doc(firestore, 'leagues', leagueId, 'fixtures', fixtureDocId);
      const fixtureSnap = await getDoc(fixtureRef);
      
      if (!fixtureSnap.exists()) {
        throw new Error('No se encontró la fecha en la base de datos.');
      }

      const fixtureData = fixtureSnap.data();

      // Bundle scorers
      const allScorers: { playerId: string, playerName: string, teamId: string }[] = [];

      homeScorers.forEach(pid => {
        const p = homeTeam?.players?.find(pl => pl.id === pid);
        if (p && match.homeTeamId) {
          allScorers.push({ playerId: p.id, playerName: p.name, teamId: match.homeTeamId });
        }
      });

      awayScorers.forEach(pid => {
        const p = awayTeam?.players?.find(pl => pl.id === pid);
        if (p && match.awayTeamId) {
          allScorers.push({ playerId: p.id, playerName: p.name, teamId: match.awayTeamId });
        }
      });

      // Bundle cards
      const allCards: { playerId: string, playerName: string, teamId: string, color: 'yellow' | 'red' }[] = [];

      homeYellowCards.forEach(pid => {
        const p = homeTeam?.players?.find(pl => pl.id === pid);
        if (p && match.homeTeamId) {
          allCards.push({ playerId: p.id, playerName: p.name, teamId: match.homeTeamId, color: 'yellow' });
        }
      });

      awayYellowCards.forEach(pid => {
        const p = awayTeam?.players?.find(pl => pl.id === pid);
        if (p && match.awayTeamId) {
          allCards.push({ playerId: p.id, playerName: p.name, teamId: match.awayTeamId, color: 'yellow' });
        }
      });

      homeRedCards.forEach(pid => {
        const p = homeTeam?.players?.find(pl => pl.id === pid);
        if (p && match.homeTeamId) {
          allCards.push({ playerId: p.id, playerName: p.name, teamId: match.homeTeamId, color: 'red' });
        }
      });

      awayRedCards.forEach(pid => {
        const p = awayTeam?.players?.find(pl => pl.id === pid);
        if (p && match.awayTeamId) {
          allCards.push({ playerId: p.id, playerName: p.name, teamId: match.awayTeamId, color: 'red' });
        }
      });

      // MVP
      let mvpData = undefined;
      if (mvpPlayerId) {
        const mvpPlayer = [...(homeTeam?.players || []), ...(awayTeam?.players || [])].find(p => p.id === mvpPlayerId);
        if (mvpPlayer) {
          const mvpTeamId = homeTeam?.players?.find(p => p.id === mvpPlayerId) ? match.homeTeamId : match.awayTeamId;
          if (mvpTeamId) {
            mvpData = { playerId: mvpPlayer.id, playerName: mvpPlayer.name, teamId: mvpTeamId };
          }
        }
      }

      const updatedMatches = (fixtureData.matches || []).map((m: MatchObj) => {
        if (m.id === match.id) {
          return {
            ...m,
            homeScore: homeVal,
            awayScore: awayVal,
            scorers: allScorers,
            cards: allCards,
            mvp: mvpData,
            isWalkover: isWalkover,
            status: 'finished',
          };
        }
        return m;
      });

      await updateDoc(fixtureRef, {
        matches: updatedMatches
      });

      toast({
        title: '¡Acta Cerrada!',
        description: `El partido terminó ${homeVal} a ${awayVal}.`,
      });

      onOpenChange(false);
    } catch (e: any) {
      console.error('[MatchResultDialog]', e);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar el resultado.' });
    } finally {
      setIsSaving(false);
    }
  };

  if (!match) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl w-full max-h-[90vh] flex flex-col gap-0">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2 uppercase tracking-tight font-black">
            <Trophy className="h-5 w-5 text-primary" />
            Cargar Resultado
          </DialogTitle>
          <DialogDescription>
            Registrá la cantidad de goles de cada equipo para este partido.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 min-h-0">
        <div className="py-8 flex items-center justify-center gap-6 bg-muted/20 rounded-xl my-4 border border-border/40">
          <div className="flex flex-col items-center gap-3">
            <span className="font-bold text-center max-w-[100px] leading-tight truncate px-2">{match.homeTeamName}</span>
            <Input 
              type="number" 
              min="0"
              value={homeScore}
              onChange={(e) => setHomeScore(e.target.value)}
              className="w-20 h-20 text-center text-4xl font-black bg-background shadow-inner placeholder:text-muted-foreground/30 focus-visible:ring-primary h-hide-arrows"
              placeholder="0"
            />
          </div>

          <div className="text-muted-foreground font-black text-2xl">-</div>

          <div className="flex flex-col items-center gap-3 w-32">
            <span className="font-bold text-center leading-tight truncate px-2">{match.awayTeamName}</span>
            <Input 
              type="number" 
              min="0"
              value={awayScore}
              onChange={(e) => setAwayScore(e.target.value)}
              className="w-20 h-20 text-center text-4xl font-black bg-background shadow-inner placeholder:text-muted-foreground/30 focus-visible:ring-primary h-hide-arrows"
              placeholder="0"
            />
          </div>
        </div>

        {/* Goal Scorers Section */}
        <div className="grid grid-cols-2 gap-4 my-2">
          {/* Home Scorers */}
          <div className="flex flex-col gap-2">
            {(homeTeam?.players && homeTeam.players.length > 0) ? (
              <>
                <div className="flex justify-between items-center text-xs font-bold uppercase tracking-widest text-muted-foreground px-1">
                  <span>Goles Local</span>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-muted" onClick={() => setHomeScorers(s => [...s, ''])}>
                    +
                  </Button>
                </div>
                {homeScorers.map((scorerId, idx) => (
                  <div key={idx} className="flex items-center gap-1">
                    <Select value={scorerId} onValueChange={(v) => {
                      const newScorers = [...homeScorers];
                      newScorers[idx] = v;
                      setHomeScorers(newScorers);
                    }}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {homeTeam.players!.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.number ? `${p.number} - ` : ''}{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0" onClick={() => setHomeScorers(s => s.filter((_, i) => i !== idx))}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </>
            ) : (
              <div className="text-[10px] text-muted-foreground text-center px-4 py-2 border rounded-md border-dashed border-border/50">
                Sin jugadores en el plantel
              </div>
            )}
          </div>

          {/* Away Scorers */}
          <div className="flex flex-col gap-2">
            {(awayTeam?.players && awayTeam.players.length > 0) ? (
              <>
                <div className="flex justify-between items-center text-xs font-bold uppercase tracking-widest text-muted-foreground px-1">
                  <span>Goles Visita</span>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-muted" onClick={() => setAwayScorers(s => [...s, ''])}>
                    +
                  </Button>
                </div>
                {awayScorers.map((scorerId, idx) => (
                  <div key={idx} className="flex items-center gap-1">
                    <Select value={scorerId} onValueChange={(v) => {
                      const newScorers = [...awayScorers];
                      newScorers[idx] = v;
                      setAwayScorers(newScorers);
                    }}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {awayTeam.players!.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.number ? `${p.number} - ` : ''}{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0" onClick={() => setAwayScorers(s => s.filter((_, i) => i !== idx))}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </>
            ) : (
              <div className="text-[10px] text-muted-foreground text-center px-4 py-2 border rounded-md border-dashed border-border/50">
                Sin jugadores en el plantel
              </div>
            )}
          </div>
        </div>

        {/* Cards Section */}
        <div className="mt-6 space-y-4">
          <div className="flex items-center gap-2 border-t border-border/40 pt-4">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            <h3 className="text-sm font-black uppercase tracking-widest">Tarjetas Disciplinarias</h3>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Home Yellow Cards */}
            <div className="flex flex-col gap-2">
              {(homeTeam?.players && homeTeam.players.length > 0) ? (
                <>
                  <div className="flex justify-between items-center text-xs font-bold uppercase tracking-widest text-yellow-600 dark:text-yellow-500 px-1">
                    <span className="flex items-center gap-1">
                      <div className="w-3 h-4 bg-yellow-400 rounded-sm shadow-sm ring-1 ring-yellow-500"></div>
                      Amarillas Local
                    </span>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-yellow-500/10" onClick={() => setHomeYellowCards(s => [...s, ''])}>
                      +
                    </Button>
                  </div>
                  {homeYellowCards.map((cardId, idx) => (
                    <div key={idx} className="flex items-center gap-1">
                      <Select value={cardId} onValueChange={(v) => {
                        const newCards = [...homeYellowCards];
                        newCards[idx] = v;
                        setHomeYellowCards(newCards);
                      }}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                        <SelectContent>
                          {homeTeam.players!.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.number ? `${p.number} - ` : ''}{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0" onClick={() => setHomeYellowCards(s => s.filter((_, i) => i !== idx))}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </>
              ) : (
                <div className="text-[10px] text-muted-foreground text-center px-4 py-2 border rounded-md border-dashed border-border/50">
                  Sin jugadores
                </div>
              )}
            </div>

            {/* Away Yellow Cards */}
            <div className="flex flex-col gap-2">
              {(awayTeam?.players && awayTeam.players.length > 0) ? (
                <>
                  <div className="flex justify-between items-center text-xs font-bold uppercase tracking-widest text-yellow-600 dark:text-yellow-500 px-1">
                    <span className="flex items-center gap-1">
                      <div className="w-3 h-4 bg-yellow-400 rounded-sm shadow-sm ring-1 ring-yellow-500"></div>
                      Amarillas Visita
                    </span>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-yellow-500/10" onClick={() => setAwayYellowCards(s => [...s, ''])}>
                      +
                    </Button>
                  </div>
                  {awayYellowCards.map((cardId, idx) => (
                    <div key={idx} className="flex items-center gap-1">
                      <Select value={cardId} onValueChange={(v) => {
                        const newCards = [...awayYellowCards];
                        newCards[idx] = v;
                        setAwayYellowCards(newCards);
                      }}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                        <SelectContent>
                          {awayTeam.players!.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.number ? `${p.number} - ` : ''}{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0" onClick={() => setAwayYellowCards(s => s.filter((_, i) => i !== idx))}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </>
              ) : (
                <div className="text-[10px] text-muted-foreground text-center px-4 py-2 border rounded-md border-dashed border-border/50">
                  Sin jugadores
                </div>
              )}
            </div>
          </div>

          {/* Red Cards */}
          <div className="grid grid-cols-2 gap-4">
            {/* Home Red Cards */}
            <div className="flex flex-col gap-2">
              {(homeTeam?.players && homeTeam.players.length > 0) ? (
                <>
                  <div className="flex justify-between items-center text-xs font-bold uppercase tracking-widest text-red-600 dark:text-red-500 px-1">
                    <span className="flex items-center gap-1">
                      <div className="w-3 h-4 bg-red-600 rounded-sm shadow-sm ring-1 ring-red-700"></div>
                      Rojas Local
                    </span>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-red-500/10" onClick={() => setHomeRedCards(s => [...s, ''])}>
                      +
                    </Button>
                  </div>
                  {homeRedCards.map((cardId, idx) => (
                    <div key={idx} className="flex items-center gap-1">
                      <Select value={cardId} onValueChange={(v) => {
                        const newCards = [...homeRedCards];
                        newCards[idx] = v;
                        setHomeRedCards(newCards);
                      }}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                        <SelectContent>
                          {homeTeam.players!.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.number ? `${p.number} - ` : ''}{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0" onClick={() => setHomeRedCards(s => s.filter((_, i) => i !== idx))}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </>
              ) : (
                <div className="text-[10px] text-muted-foreground text-center px-4 py-2 border rounded-md border-dashed border-border/50">
                  Sin jugadores
                </div>
              )}
            </div>

            {/* Away Red Cards */}
            <div className="flex flex-col gap-2">
              {(awayTeam?.players && awayTeam.players.length > 0) ? (
                <>
                  <div className="flex justify-between items-center text-xs font-bold uppercase tracking-widest text-red-600 dark:text-red-500 px-1">
                    <span className="flex items-center gap-1">
                      <div className="w-3 h-4 bg-red-600 rounded-sm shadow-sm ring-1 ring-red-700"></div>
                      Rojas Visita
                    </span>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-red-500/10" onClick={() => setAwayRedCards(s => [...s, ''])}>
                      +
                    </Button>
                  </div>
                  {awayRedCards.map((cardId, idx) => (
                    <div key={idx} className="flex items-center gap-1">
                      <Select value={cardId} onValueChange={(v) => {
                        const newCards = [...awayRedCards];
                        newCards[idx] = v;
                        setAwayRedCards(newCards);
                      }}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                        <SelectContent>
                          {awayTeam.players!.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.number ? `${p.number} - ` : ''}{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0" onClick={() => setAwayRedCards(s => s.filter((_, i) => i !== idx))}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </>
              ) : (
                <div className="text-[10px] text-muted-foreground text-center px-4 py-2 border rounded-md border-dashed border-border/50">
                  Sin jugadores
                </div>
              )}
            </div>
          </div>
        </div>

        {/* MVP Section */}
        <div className="mt-6 space-y-3">
          <div className="flex items-center gap-2 border-t border-border/40 pt-4">
            <Trophy className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-black uppercase tracking-widest">MVP del Partido</h3>
            <span className="text-[10px] text-muted-foreground">(Opcional)</span>
          </div>

          <RadioGroup value={mvpPlayerId} onValueChange={setMvpPlayerId}>
            <div className="grid grid-cols-2 gap-2">
              {/* Home Players */}
              {(homeTeam?.players && homeTeam.players.length > 0) && homeTeam.players.map(player => (
                <div key={player.id} className="flex items-center space-x-2 border border-border/40 rounded-md p-2 hover:bg-muted/30 transition-colors">
                  <RadioGroupItem value={player.id} id={`mvp-${player.id}`} />
                  <Label htmlFor={`mvp-${player.id}`} className="flex-1 cursor-pointer text-sm">
                    {player.number ? `${player.number} - ` : ''}{player.name}
                    <span className="text-[10px] text-muted-foreground ml-1">({match.homeTeamName})</span>
                  </Label>
                </div>
              ))}

              {/* Away Players */}
              {(awayTeam?.players && awayTeam.players.length > 0) && awayTeam.players.map(player => (
                <div key={player.id} className="flex items-center space-x-2 border border-border/40 rounded-md p-2 hover:bg-muted/30 transition-colors">
                  <RadioGroupItem value={player.id} id={`mvp-${player.id}`} />
                  <Label htmlFor={`mvp-${player.id}`} className="flex-1 cursor-pointer text-sm">
                    {player.number ? `${player.number} - ` : ''}{player.name}
                    <span className="text-[10px] text-muted-foreground ml-1">({match.awayTeamName})</span>
                  </Label>
                </div>
              ))}
            </div>
          </RadioGroup>

          {mvpPlayerId && (
            <Button variant="outline" size="sm" onClick={() => setMvpPlayerId('')} className="w-full">
              Limpiar MVP
            </Button>
          )}
        </div>

        {/* Walkover Section */}
        <div className="mt-6 border-t border-border/40 pt-4">
          <div className="flex items-center space-x-2 bg-muted/20 p-3 rounded-lg">
            <Checkbox
              id="walkover"
              checked={isWalkover}
              onCheckedChange={(checked) => {
                setIsWalkover(checked === true);
                if (checked) {
                  // Auto-set score 3-0 for home team
                  setHomeScore('3');
                  setAwayScore('0');
                }
              }}
            />
            <Label
              htmlFor="walkover"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              Marcar como W.O. (Walkover - Incomparecencia)
            </Label>
          </div>
          {isWalkover && (
            <p className="text-xs text-muted-foreground mt-2 px-3">
              El resultado se ha fijado automáticamente en 3-0. Los goleadores no son necesarios para partidos W.O.
            </p>
          )}
        </div>

        </div>

        <DialogFooter className="mt-4 shrink-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={isSaving} className="bg-primary text-primary-foreground font-bold hover:bg-primary/90">
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
            {isSaving ? 'Guardando...' : 'Confirmar Acta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
