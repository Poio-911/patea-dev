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
import { CompetitionMatchResultDialog } from '@/components/organizer/competition-match-result-dialog';
import { BracketMatchSettingsDialog } from '@/components/organizer/bracket-match-settings-dialog';
import { motion } from 'framer-motion';

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

import { JerseyPreview } from '@/components/team-builder/jersey-preview';

export function CupBracketTab({ cupId, isReadOnly }: CupBracketTabProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const isEditable = !isReadOnly;
  const [showRegenerateConfirm, setShowRegenerateConfirm] = React.useState(false);
  const [isGenerating, setIsGenerating] = React.useState(false);

  // Result dialog state
  const [selectedMatch, setSelectedMatch] = React.useState<BracketMatch | null>(null);
  const [isResultDialogOpen, setIsResultDialogOpen] = React.useState(false);
  const [isSubmittingResult, setIsSubmittingResult] = React.useState(false); // Mantengo para regenerar si es necesario

  // Settings dialog state
  const [selectedMatchForSettings, setSelectedMatchForSettings] = React.useState<BracketMatch | null>(null);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = React.useState(false);

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
    if (!isEditable) return;

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
    setIsResultDialogOpen(true);
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

            {isEditable && !hasBracket ? (
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
            ) : isEditable ? (
              <Button
                variant="outline"
                onClick={() => setShowRegenerateConfirm(true)}
                className="border-destructive/20 text-destructive hover:bg-destructive/10"
              >
                <AlertTriangle className="mr-2 h-4 w-4" />
                Regenerar Bracket
              </Button>
            ) : null}
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
              onMatchClick={isEditable ? handleMatchClick : undefined}
              onMatchSettingsClick={isEditable ? (match) => {
                setSelectedMatchForSettings(match);
                setIsSettingsDialogOpen(true);
              } : undefined}
              currentRound={cup.currentRound}
              canCreate={isEditable}
            />
          </CardContent>
        </Card>
      )}

      {/* Regenerate Confirmation Dialog */}
      {isEditable && (
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
      )}

      {isEditable && selectedMatch && (
        <CompetitionMatchResultDialog
          competitionId={cupId}
          competitionType="cups"
          match={{
            id: selectedMatch.id,
            homeTeamId: selectedMatch.team1Id,
            awayTeamId: selectedMatch.team2Id,
            homeTeamName: selectedMatch.team1Name || 'Libre',
            awayTeamName: selectedMatch.team2Name || 'Libre',
            homeTeamJersey: selectedMatch.team1Jersey,
            awayTeamJersey: selectedMatch.team2Jersey,
            homeScore: selectedMatch.team1Score,
            awayScore: selectedMatch.team2Score,
            status: selectedMatch.winnerId ? 'finished' : 'pending',
            round: selectedMatch.round,
            matchNumber: selectedMatch.matchNumber,
            nextMatchNumber: selectedMatch.nextMatchNumber,
            penaltyWinnerId: selectedMatch.penaltyWinnerId,
            streamingUrl: selectedMatch.streamingUrl,
            isLive: selectedMatch.isLive,
          } as any}
          homeTeam={cup?.teams?.find((t: any) => t.id === selectedMatch.team1Id) as any}
          awayTeam={cup?.teams?.find((t: any) => t.id === selectedMatch.team2Id) as any}
          open={isResultDialogOpen}
          onOpenChange={setIsResultDialogOpen}
          onSuccess={() => {
            // No need to do anything, the dialog handles advancement and Firebase update
            setSelectedMatch(null);
          }}
        />
      )}

      {/* Settings Dialog */}
      {isEditable && (
        <BracketMatchSettingsDialog
          cupId={cupId}
          match={selectedMatchForSettings}
          open={isSettingsDialogOpen}
          onOpenChange={setIsSettingsDialogOpen}
        />
      )}
    </div>
  );
}
