
'use client';

import { useState } from 'react';
import { Match } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trophy, Loader2, ArrowLeft } from 'lucide-react';
import { JerseyPreview } from '@/components/team-builder/jersey-preview';
import { updateMatchFinalScoreAction, advanceCupWinnerAction } from '@/lib/actions/server-actions';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface CupMatchViewProps {
    match: Match;
    cupId: string;
    userId: string;
}

export function CupMatchView({ match, cupId, userId }: CupMatchViewProps) {
    const { toast } = useToast();
    const router = useRouter();
    const [team1Score, setTeam1Score] = useState(match.finalScore?.team1?.toString() || '0');
    const [team2Score, setTeam2Score] = useState(match.finalScore?.team2?.toString() || '0');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const team1 = match.teams[0];
    const team2 = match.teams[1];
    const isCompleted = match.status === 'completed';

    const handleFinalize = async () => {
        const score1 = parseInt(team1Score);
        const score2 = parseInt(team2Score);

        if (isNaN(score1) || isNaN(score2) || score1 < 0 || score2 < 0) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Por favor ingresá resultados válidos.',
            });
            return;
        }

        if (score1 === score2) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'En copas no puede haber empate. Debe haber un ganador.',
            });
            return;
        }

        setIsSubmitting(true);

        try {
            // Update match score
            const scoreResult = await updateMatchFinalScoreAction(match.id, score1, score2, userId);

            if (!scoreResult.success) {
                throw new Error(scoreResult.error || 'Error al actualizar el resultado');
            }

            // Determine winner - use participantTeamIds if available, fallback to team.id
            const winnerId = score1 > score2
                ? (match.participantTeamIds?.[0] || team1.id)
                : (match.participantTeamIds?.[1] || team2.id);

            // ✅ FIX: Ensure winnerId is a valid string before proceeding
            if (!winnerId) {
                throw new Error('No se pudo determinar el ID del equipo ganador.');
            }

            // Advance winner in bracket
            const advanceResult = await advanceCupWinnerAction(cupId, match.id, winnerId);

            if (!advanceResult.success) {
                throw new Error(advanceResult.error || 'Error al avanzar el ganador');
            }

            toast({
                title: '¡Partido finalizado!',
                description: 'El ganador avanzó en la copa.',
            });

            // Redirect to cup page
            router.push(`/competitions/cups/${cupId}`);
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.message || 'Ocurrió un error inesperado.',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="container max-w-4xl mx-auto p-4 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <Button asChild variant="outline">
                    <Link href={`/competitions/cups/${cupId}`}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Volver a la Copa
                    </Link>
                </Button>
            </div>

            {/* Match Title */}
            <div className="text-center">
                <h1 className="text-2xl font-bold">{match.title}</h1>
                <p className="text-sm text-muted-foreground mt-1">Partido de Copa</p>
            </div>

            {/* Score Card */}
            {userId === match.ownerUid && (
                <Card className="border-amber-500/20 bg-amber-500/5">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Trophy className="h-5 w-5 text-amber-500" />
                            Resultado del Partido
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex-1 space-y-2 text-center">
                                <Label className="truncate block font-bold text-base">{team1.name}</Label>
                                <Input
                                    type="number"
                                    min="0"
                                    value={team1Score}
                                    onChange={(e) => setTeam1Score(e.target.value)}
                                    className="text-center text-2xl font-bold h-16 w-full"
                                    disabled={isCompleted}
                                />
                            </div>
                            <div className="text-2xl font-bold text-muted-foreground">VS</div>
                            <div className="flex-1 space-y-2 text-center">
                                <Label className="truncate block font-bold text-base">{team2.name}</Label>
                                <Input
                                    type="number"
                                    min="0"
                                    value={team2Score}
                                    onChange={(e) => setTeam2Score(e.target.value)}
                                    className="text-center text-2xl font-bold h-16 w-full"
                                    disabled={isCompleted}
                                />
                            </div>
                        </div>

                        {!isCompleted && (
                            <Button
                                onClick={handleFinalize}
                                disabled={isSubmitting}
                                className="w-full bg-amber-600 hover:bg-amber-700 text-white h-12"
                                size="lg"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Finalizando...
                                    </>
                                ) : (
                                    <>
                                        <Trophy className="mr-2 h-4 w-4" />
                                        Finalizar Partido
                                    </>
                                )}
                            </Button>
                        )}

                        {isCompleted && (
                            <div className="text-center py-2">
                                <p className="text-sm text-muted-foreground">✓ Partido finalizado</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Teams Display */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Team 1 */}
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center gap-3">
                            <JerseyPreview jersey={team1.jersey} size="md" />
                            <div>
                                <CardTitle className="text-lg">{team1.name}</CardTitle>
                                <p className="text-sm text-muted-foreground">{team1.players.length} jugadores</p>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-1">
                            {team1.players.map((player) => (
                                <li key={player.uid} className="text-sm py-1 border-b last:border-0">
                                    {player.displayName}
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>

                {/* Team 2 */}
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center gap-3">
                            <JerseyPreview jersey={team2.jersey} size="md" />
                            <div>
                                <CardTitle className="text-lg">{team2.name}</CardTitle>
                                <p className="text-sm text-muted-foreground">{team2.players.length} jugadores</p>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-1">
                            {team2.players.map((player) => (
                                <li key={player.uid} className="text-sm py-1 border-b last:border-0">
                                    {player.displayName}
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
