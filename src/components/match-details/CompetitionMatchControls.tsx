'use client';

import { useUser } from '@/firebase';
import { useState, useEffect } from 'react';
import { Match } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateMatchFinalScoreAction } from '@/lib/actions/server-actions';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Trophy, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface CompetitionMatchControlsProps {
    match: Match;
    onSuccess?: () => void;
}

export const CompetitionMatchControls = ({ match, onSuccess }: CompetitionMatchControlsProps) => {
    const { toast } = useToast();
    const { user } = useUser();
    const [team1Score, setTeam1Score] = useState<string>(match.finalScore?.team1?.toString() || '0');
    const [team2Score, setTeam2Score] = useState<string>(match.finalScore?.team2?.toString() || '0');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const team1 = match.teams?.[0];
    const team2 = match.teams?.[1];

    if (!team1 || !team2) return null;

    // ✅ Sync local state if match prop changes (e.g. goals added in visualizer)
    useEffect(() => {
        setTeam1Score(match.finalScore?.team1?.toString() || match.teams?.[0]?.finalScore?.toString() || '0');
        setTeam2Score(match.finalScore?.team2?.toString() || match.teams?.[1]?.finalScore?.toString() || '0');
    }, [match.finalScore, match.teams]);

    const handleSaveScore = async () => {
        if (!user) {
            toast({ variant: 'destructive', title: 'Error', description: 'Debes iniciar sesión.' });
            return;
        }

        setIsSubmitting(true);
        try {
            const score1 = parseInt(team1Score);
            const score2 = parseInt(team2Score);

            if (isNaN(score1) || isNaN(score2)) {
                toast({ variant: 'destructive', title: 'Error', description: 'Los goles deben ser números válidos.' });
                setIsSubmitting(false);
                return;
            }

            // In cups, we should prevent draw if possible, or warn at least.
            if (match.type === 'cup' && score1 === score2) {
                toast({
                    title: 'Empate en Copa',
                    description: 'En copas debe haber un ganador para avanzar en el bracket.',
                    variant: 'destructive'
                });
                setIsSubmitting(false);
                return;
            }

            // 1. Update match score & finalize (this now handles standings and cup advancement on the server)
            const updateResult = await updateMatchFinalScoreAction(match.id, score1, score2, user.uid);
            if (!updateResult.success) throw new Error(updateResult.error);

            toast({ title: 'Partido Finalizado', description: 'El resultado se ha guardado y las tablas se han actualizado.' });

            if (onSuccess) {
                onSuccess();
            }

            // Refresh the page to show updated bracket or standings
            setTimeout(() => {
                window.location.reload();
            }, 1000);

        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message || 'Ocurrió un error al guardar.' });
            setIsSubmitting(false);
        }
    };

    return (
        <Card className="border-border bg-card/70">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Trophy className="h-5 w-5 text-foreground" />
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
                        />
                    </div>
                    <div className="text-2xl font-bold text-muted-foreground">-</div>
                    <div className="flex-1 space-y-2 text-center">
                        <Label className="truncate block font-bold text-base">{team2.name}</Label>
                        <Input
                            type="number"
                            min="0"
                            value={team2Score}
                            onChange={(e) => setTeam2Score(e.target.value)}
                            className="text-center text-2xl font-bold h-16 w-full"
                        />
                    </div>
                </div>

                <Button
                    onClick={handleSaveScore}
                    disabled={isSubmitting}
                    className="w-full bg-secondary hover:bg-secondary/80 text-secondary-foreground"
                >
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {match.status === 'completed' ? 'Actualizar Resultado' : 'Finalizar Partido'}
                </Button>
            </CardContent>
        </Card>
    );
};
