'use client';

import { useState } from 'react';
import type { Match } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from './ui/button';
import { Loader2, Sparkles, Newspaper } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { generateMatchChronicleAction } from '@/lib/actions/server-actions';
import { type GenerateMatchChronicleOutput } from '@/ai/flows/generate-match-chronicle';
import { Separator } from './ui/separator';

interface MatchChronicleCardProps {
  match: Match;
}

export function MatchChronicleCard({ match }: MatchChronicleCardProps) {
  const [chronicle, setChronicle] = useState<GenerateMatchChronicleOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleGenerateChronicle = async () => {
    setIsLoading(true);
    try {
      const result = await generateMatchChronicleAction(match.id);
      if (result.error) {
        throw new Error(result.error);
      }
      setChronicle(result.data);
      toast({ title: 'Crónica generada', description: 'La crónica del partido está lista.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'No se pudo generar la crónica.' });
    } finally {
      setIsLoading(false);
    }
  };

  if (match.status !== 'evaluated' || !match.teams || match.teams.length < 2) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Newspaper className="h-5 w-5" />
          Crónica del Partido
        </CardTitle>
        <CardDescription>Un resumen del partido generado por IA.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center p-4">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="ml-2">Generando crónica...</p>
          </div>
        ) : chronicle ? (
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-primary font-headline">{chronicle.headline}</h3>
            <p className="text-sm text-muted-foreground">{chronicle.introduction}</p>
            <div className="space-y-3 border-l-2 border-primary/50 pl-4">
              {chronicle.keyMoments.map((moment, index) => (
                <div key={index}>
                  <p className="font-bold text-sm">{moment.minute}</p>
                  <p className="text-sm">{moment.event}</p>
                </div>
              ))}
            </div>
            <p className="text-sm font-semibold border-t pt-3">{chronicle.conclusion}</p>
          </div>
        ) : (
          <Alert>
            <Sparkles className="h-4 w-4" />
            <AlertTitle>¡Generá la crónica!</AlertTitle>
            <AlertDescription>
              Pulsá el botón para que la IA escriba un resumen de lo que pasó en el partido.
            </AlertDescription>
            <Button onClick={handleGenerateChronicle} size="sm" className="mt-4">
              <Sparkles className="mr-2 h-4 w-4" />
              Generar Crónica
            </Button>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
