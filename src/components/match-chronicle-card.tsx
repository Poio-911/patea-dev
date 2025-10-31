
'use client';

import { useState } from 'react';
import type { Match } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from './ui/button';
import { Loader2, Sparkles, Newspaper } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

interface MatchChronicleCardProps {
    match: Match;
}

export function MatchChronicleCard({ match }: MatchChronicleCardProps) {
    const [chronicle, setChronicle] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const handleGenerateChronicle = () => {
        setIsLoading(true);
        // Placeholder for AI call
        setTimeout(() => {
            setChronicle(`En un partidazo, ${match.teams[0]?.name || 'Equipo 1'} se llevó la victoria. La figura fue un jugador que corrió mucho.`);
            setIsLoading(false);
            toast({ title: 'Crónica generada', description: 'La crónica del partido está lista.' });
        }, 1500);
    };

    if (match.status !== 'evaluated' || !match.teams || match.teams.length < 2) {
        return null; // Only show this card for evaluated matches with teams
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Newspaper className="h-5 w-5"/>
                    Crónica del Partido
                </CardTitle>
                 <CardDescription>Un resumen del partido generado por IA.</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex items-center justify-center p-4">
                        <Loader2 className="h-6 w-6 animate-spin"/>
                        <p className="ml-2">Generando crónica...</p>
                    </div>
                ) : chronicle ? (
                    <p className="text-sm italic text-muted-foreground">&ldquo;{chronicle}&rdquo;</p>
                ) : (
                     <Alert>
                        <Sparkles className="h-4 w-4" />
                        <AlertTitle>¡Generá la crónica!</AlertTitle>
                        <AlertDescription>
                          Pulsá el botón para que la IA escriba un resumen de lo que pasó en el partido.
                        </AlertDescription>
                        <Button onClick={handleGenerateChronicle} size="sm" className="mt-4">
                            <Sparkles className="mr-2 h-4 w-4"/>
                            Generar Crónica
                        </Button>
                    </Alert>
                )}
            </CardContent>
        </Card>
    )
}
