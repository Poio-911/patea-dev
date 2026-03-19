'use client';

import * as React from 'react';
import { useDoc, useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { CupBracket } from '@/components/competitions/cup-bracket';
import { generateBracket, advanceWinner, isRoundComplete, isTournamentComplete, getChampion, getNextRound } from '@/lib/utils/cup-bracket';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Trophy, AlertTriangle, Sparkles, Loader2, Swords, PlayCircle, ExternalLink } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import type { Cup, BracketMatch as OriginalBracketMatch } from '@/lib/types';

interface BracketMatch extends OriginalBracketMatch {
  streamingUrl?: string;
  isLive?: boolean;
  team1Score?: number;
  team2Score?: number;
  penaltyWinnerId?: string | null;
}

interface CupBracketTabProps {
  cupId: string;
  isReadOnly?: boolean;
}

export function CupBracketTab({ cupId, isReadOnly }: CupBracketTabProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [showRegenerateConfirm, setShowRegenerateConfirm] = React.useState(false);
  const [isGenerating, setIsGenerating] = React.useState(false);

  // Result dialog state
  const [selectedMatch, setSelectedMatch] = React.useState<BracketMatch | null>(null);
  const [isResultDialogOpen, setIsResultDialogOpen] = React.useState(false);
  const [team1Score, setTeam1Score] = React.useState('');
  const [team2Score, setTeam2Score] = React.useState('');
  const [penaltyWinner, setPenaltyWinner] = React.useState<string | null>(null);
  const [streamingUrl, setStreamingUrl] = React.useState('');
  const [isLive, setIsLive] = React.useState(false);
  const [isSubmittingResult, setIsSubmittingResult] = React.useState(false);

  const cupRef = React.useMemo(() => {
    if (!firestore || !cupId) return null;
    return doc(firestore, 'cups', cupId);
  }, [firestore, cupId]);

  const { data: cup } = useDoc<Cup>(cupRef);

  const handleGenerateBracket = async () => {
    if (!cup?.teams || !cupRef) return;

    setIsGenerating(true);
    try {
      // Validar número de equipos (2, 4, 8, 16, 32)
      const validSizes = [2, 4, 8, 16, 32];
      if (!validSizes.includes(cup.teams.length)) {
        toast({
          variant: 'destructive',
          title: 'Cantidad Inválida',
          description: `Necesitás 2, 4, 8, 16 o 32 equipos para generar el bracket. Actualmente hay ${cup.teams.length}.`
        });
        return;
      }

      // Generar bracket
      const bracket = generateBracket(cup.teams, cup.seedingType || 'random');

      // Guardar en Firestore
      await updateDoc(cupRef, {
        bracket,
        status: 'in_progress',
        currentRound: bracket[0].round, // Primera ronda
      });

      toast({
        title: '✨ Bracket Generado',
        description: 'Las llaves de eliminación han sido sorteadas exitosamente.',
      });

      setShowRegenerateConfirm(false);
    } catch (error: any) {
      console.error('[CupBracketTab] Error generating bracket:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo generar el bracket.',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleMatchClick = (match: BracketMatch) => {
    // Si no tiene equipos, no hacer nada
    if (!match.team1Id || !match.team2Id) {
      toast({
        title: 'Partido No Disponible',
        description: 'Los equipos aún no están definidos para este partido.',
      });
      return;
    }

    // Si ya está completo, mostrar resultado
    if (match.winnerId) {
      toast({
        title: 'Partido Finalizado',
        description: `Ganador: ${match.winnerId === match.team1Id ? match.team1Name : match.team2Name}`,
      });
      return;
    }

    // Si tiene matchId, mostrar mensaje
    if (match.matchId) {
      toast({
        title: 'Partido Creado',
        description: 'Este partido ya tiene un documento asociado. Ve a la pestaña Partidos para gestionarlo.',
      });
      return;
    }

    // Open result dialog
    setSelectedMatch(match);
    setTeam1Score(match.team1Score !== undefined ? String(match.team1Score) : '');
    setTeam2Score(match.team2Score !== undefined ? String(match.team2Score) : '');
    setPenaltyWinner(match.penaltyWinnerId || null);
    setStreamingUrl(match.streamingUrl || '');
    setIsLive(match.isLive || false);
    setIsResultDialogOpen(true);
  };

  const handleResultSubmit = async () => {
    if (!cupRef || !cup?.bracket || !selectedMatch) return;

    const s1 = parseInt(team1Score, 10);
    const s2 = parseInt(team2Score, 10);

    if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0) {
      toast({ variant: 'destructive', title: 'Puntaje inválido', description: 'Ingresá puntajes válidos (números enteros ≥ 0).' });
      return;
    }

    const isTied = s1 === s2;
    if (isTied && !penaltyWinner) {
      toast({ variant: 'destructive', title: 'Empate', description: 'Seleccioná el ganador por penales.' });
      return;
    }

    const winnerId = s1 > s2
      ? selectedMatch.team1Id!
      : s2 > s1
        ? selectedMatch.team2Id!
        : penaltyWinner!;
    const winnerName = winnerId === selectedMatch.team1Id ? selectedMatch.team1Name! : selectedMatch.team2Name!;
    const winnerJersey = winnerId === selectedMatch.team1Id ? selectedMatch.team1Jersey! : selectedMatch.team2Jersey!;

    setIsSubmittingResult(true);
    try {
      const updatedBracket = advanceWinner(
        cup.bracket,
        selectedMatch.id,
        winnerId,
        winnerName,
        winnerJersey,
        { team1: s1, team2: s2 }
      );

      const updates: Record<string, any> = { 
        bracket: updatedBracket.map(m => {
          if (m.id === selectedMatch.id) {
            return { ...m, streamingUrl, isLive };
          }
          return m;
        })
      };

      // Advance currentRound if all matches in this round are done
      if (isRoundComplete(updatedBracket, selectedMatch.round)) {
        const nextRound = getNextRound(selectedMatch.round);
        if (nextRound) updates.currentRound = nextRound;
      }

      // Close out tournament if final is complete
      if (isTournamentComplete(updatedBracket)) {
        const champion = getChampion(updatedBracket);
        if (champion) {
          updates.status = 'completed';
          updates.championTeamId = champion.teamId;
          updates.championTeamName = champion.teamName;
          updates.completedAt = new Date().toISOString();
        }
      }

      await updateDoc(cupRef, updates);

      toast({
        title: isTournamentComplete(updatedBracket) ? '🏆 Torneo Finalizado' : '✅ Resultado Registrado',
        description: isTournamentComplete(updatedBracket)
          ? `¡${winnerName} es el campeón!`
          : `${winnerName} avanza a la siguiente ronda.`,
      });

      setIsResultDialogOpen(false);
      setSelectedMatch(null);
    } catch (error: any) {
      console.error('[CupBracketTab] Error saving result:', error);
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'No se pudo guardar el resultado.' });
    } finally {
      setIsSubmittingResult(false);
    }
  };
  const totalMatches = cup?.bracket?.length || 0;
  const completedMatches = cup?.bracket?.filter(m => m.winnerId).length || 0;
  const hasBracket = cup?.bracket && cup.bracket.length > 0;

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <Card className="border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
                <Trophy className="h-6 w-6 text-amber-500" />
                Bracket de Eliminación Directa
              </CardTitle>
              {hasBracket && (
                <p className="text-sm text-muted-foreground font-medium">
                  {completedMatches} de {totalMatches} partidos completados
                  {cup.status === 'completed' && cup.championTeamName && (
                    <span className="ml-2 text-amber-400 font-bold">
                      🏆 Campeón: {cup.championTeamName}
                    </span>
                  )}
                </p>
              )}
            </div>

            {!hasBracket ? (
              <Button
                onClick={handleGenerateBracket}
                disabled={isGenerating || !cup?.teams || cup.teams.length === 0}
                size="lg"
                className="bg-amber-500 hover:bg-amber-600 text-black font-bold shadow-lg shadow-amber-500/20"
              >
                {isGenerating ? (
                  <>
                    <Sparkles className="mr-2 h-5 w-5 animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" />
                    Generar Bracket
                  </>
                )}
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => setShowRegenerateConfirm(true)}
                className="border-destructive/20 text-destructive hover:bg-destructive/10"
              >
                <AlertTriangle className="mr-2 h-4 w-4" />
                Regenerar Bracket
              </Button>
            )}
          </div>
        </CardHeader>

        {!hasBracket && (
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <Trophy className="h-8 w-8 text-amber-500/60" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground mb-1">No hay bracket generado</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  Asegurate de tener {[2, 4, 8, 16, 32].includes(cup?.teams?.length || 0) ? '' : 'exactamente 2, 4, 8, 16 o 32 '}equipos inscriptos antes de generar el bracket.
                  {cup?.teams && <span className="block mt-1 font-medium">Actualmente hay {cup.teams.length} equipos.</span>}
                </p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Bracket Visualization */}
      {hasBracket && cup.bracket && (
        <Card>
          <CardContent className="p-6">
            <CupBracket
              bracket={cup.bracket}
              onMatchClick={handleMatchClick}
              currentRound={cup.currentRound}
              canCreate={true}
            />
          </CardContent>
        </Card>
      )}

      {/* Regenerate Confirmation Dialog */}
      <AlertDialog open={showRegenerateConfirm} onOpenChange={setShowRegenerateConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              ⚠️ Regenerar Bracket
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Esta acción eliminará el bracket actual y generará uno nuevo con sorteo aleatorio.</p>
              {completedMatches > 0 && (
                <p className="font-bold text-destructive mt-2 bg-destructive/10 p-3 rounded-lg border border-destructive/20">
                  ⚠️ Se perderán {completedMatches} partido{completedMatches !== 1 ? 's' : ''} ya jugado{completedMatches !== 1 ? 's' : ''}.
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-3">
                Esta acción no se puede deshacer. Los partidos deberán jugarse nuevamente.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleGenerateBracket}
              disabled={isGenerating}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isGenerating ? 'Regenerando...' : 'Regenerar de todos modos'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Match Result Dialog */}
      <Dialog open={isResultDialogOpen} onOpenChange={(open) => { if (!isSubmittingResult) setIsResultDialogOpen(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-black uppercase tracking-tight">
              <Swords className="h-5 w-5 text-amber-500" />
              Registrar Resultado
            </DialogTitle>
          </DialogHeader>

          {selectedMatch && (
            <div className="space-y-6 py-2">
              {/* Teams face-off */}
              <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center">
                {/* Team 1 */}
                <div className="text-center space-y-2">
                  <p className="font-bold text-sm leading-tight truncate">{selectedMatch.team1Name}</p>
                  <div>
                    <Label htmlFor="score-team1" className="sr-only">Goles {selectedMatch.team1Name}</Label>
                    <Input
                      id="score-team1"
                      type="number"
                      min="0"
                      value={team1Score}
                      onChange={e => { setTeam1Score(e.target.value); setPenaltyWinner(null); }}
                      placeholder="0"
                      className="text-center text-2xl font-black h-16 w-full"
                    />
                  </div>
                </div>

                <span className="text-xl font-black text-muted-foreground pb-6">VS</span>

                {/* Team 2 */}
                <div className="text-center space-y-2">
                  <p className="font-bold text-sm leading-tight truncate">{selectedMatch.team2Name}</p>
                  <div>
                    <Label htmlFor="score-team2" className="sr-only">Goles {selectedMatch.team2Name}</Label>
                    <Input
                      id="score-team2"
                      type="number"
                      min="0"
                      value={team2Score}
                      onChange={e => { setTeam2Score(e.target.value); setPenaltyWinner(null); }}
                      placeholder="0"
                      className="text-center text-2xl font-black h-16 w-full"
                    />
                  </div>
                </div>
              </div>

              {/* Penalty tiebreaker — shown only when tied */}
              {team1Score !== '' && team2Score !== '' &&
               !isNaN(parseInt(team1Score, 10)) && !isNaN(parseInt(team2Score, 10)) &&
               parseInt(team1Score, 10) === parseInt(team2Score, 10) && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
                  <p className="text-sm font-bold text-amber-600 dark:text-amber-400 flex items-center gap-2">
                    <Trophy className="h-4 w-4" />
                    Empate — Ganador por penales
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={penaltyWinner === selectedMatch.team1Id ? 'default' : 'outline'}
                      size="sm"
                      className="w-full font-bold"
                      onClick={() => setPenaltyWinner(selectedMatch.team1Id!)}
                    >
                      {selectedMatch.team1Name}
                    </Button>
                    <Button
                      type="button"
                      variant={penaltyWinner === selectedMatch.team2Id ? 'default' : 'outline'}
                      size="sm"
                      className="w-full font-bold"
                      onClick={() => setPenaltyWinner(selectedMatch.team2Id!)}
                    >
                      {selectedMatch.team2Name}
                    </Button>
                  </div>
                </div>
              )}

              {/* Streaming Section */}
              <div className="space-y-4 pt-4 border-t border-border/40">
                <div className="grid gap-2">
                  <Label htmlFor="streamingUrl" className="flex items-center gap-2 text-amber-500 font-bold">
                    <Sparkles className="w-4 h-4" /> Link de Transmisión
                  </Label>
                  <Input 
                    id="streamingUrl" 
                    value={streamingUrl} 
                    onChange={(e) => setStreamingUrl(e.target.value)} 
                    placeholder="https://youtube.com/live/..." 
                  />
                </div>
                <div className="flex items-center space-x-2 bg-amber-500/5 p-3 rounded-xl border border-amber-500/20">
                   <Checkbox 
                     id="isLive" 
                     checked={isLive} 
                     onCheckedChange={(checked) => setIsLive(checked === true)} 
                   />
                   <label
                     htmlFor="isLive"
                     className="text-sm font-bold leading-none cursor-pointer text-amber-600 dark:text-amber-400"
                   >
                     EN VIVO AHORA
                   </label>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setIsResultDialogOpen(false)}
              disabled={isSubmittingResult}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleResultSubmit}
              disabled={isSubmittingResult || team1Score === '' || team2Score === ''}
              className="bg-amber-500 hover:bg-amber-600 text-black font-bold"
            >
              {isSubmittingResult ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</>
              ) : (
                'Confirmar Resultado'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
