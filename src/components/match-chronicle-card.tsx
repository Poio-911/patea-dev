'use client';

import { useState, useEffect } from 'react';
import type { Match, GenerateMatchChronicleOutput } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from './ui/button';
import { Loader2, Sparkles, Newspaper } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateMatchChronicleAction } from '@/lib/actions/server-actions';
import { Separator } from './ui/separator';

interface MatchChronicleCardProps {
  match: Match;
}

export function MatchChronicleCard({ match }: MatchChronicleCardProps) {
  const [chronicle, setChronicle] = useState<GenerateMatchChronicleOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // ✅ Load saved chronicle from match document
  useEffect(() => {
    if (match.chronicle) {
      setChronicle(match.chronicle);
    }
  }, [match.chronicle]);

  const handleGenerateChronicle = async () => {
    // ✅ Prevent regeneration if chronicle already exists
    if (match.chronicle) {
      toast({
        title: 'Crónica ya generada',
        description: 'Este partido ya tiene una crónica guardada.',
        variant: 'default'
      });
      return;
    }

    setIsLoading(true);
    try {
      const result = await generateMatchChronicleAction(match.id);

      if ('error' in result) {
        throw new Error(String(result.error));
      }

      if ('data' in result && result.data) {
        setChronicle(result.data);
        toast({ title: 'Relato generado', description: 'El relato del partido está listo.' });
      } else {
        throw new Error('No se recibieron datos del relato');
      }

    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'No se pudo generar el relato.' });
    } finally {
      setIsLoading(false);
    }
  };

  if (match.status !== 'evaluated' || !match.teams || match.teams.length < 2) {
    return null;
  }

  return (
    <Card className="surface hover:shadow-md transition-shadow duration-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-lg font-semibold">
          <Newspaper className="h-5 w-5 text-primary" />
          Relato del Partido
        </CardTitle>
        <CardDescription>
          Un relato literario del partido generado por IA
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-8 space-y-4">
            <div className="relative">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <div className="absolute inset-0 h-12 w-12 rounded-full bg-gradient-to-r from-primary/20 to-transparent animate-ping"></div>
            </div>
            <div className="text-center space-y-2">
              <p className="font-semibold text-lg">Generando crónica épica...</p>
              <p className="text-sm text-muted-foreground">La IA está analizando cada jugada</p>
            </div>
          </div>
        ) : chronicle ? (
          <div className="space-y-6">
            {/* Título Evocativo */}
            <div className="text-center space-y-2">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground leading-tight">
                {chronicle.headline}
              </h2>
              <div className="w-24 h-1 bg-gradient-to-r from-transparent via-primary to-transparent mx-auto"></div>
            </div>

            {/* Relato Fluido */}
            <div className="prose prose-lg dark:prose-invert max-w-none">
              <div className="text-foreground/90 leading-relaxed whitespace-pre-line text-base md:text-lg">
                {chronicle.story}
              </div>
            </div>

            {/* Voces de los Jugadores */}
            {chronicle.playerVoices && chronicle.playerVoices.length > 0 && (
              <>
                <Separator className="my-8" />
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-primary text-center">
                    Voces del Vestuario
                  </h3>
                  <div className="space-y-4">
                    {chronicle.playerVoices.map((voice, index) => (
                      <div key={index} className="relative pl-6 py-3">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary/50 to-primary/10 rounded-full"></div>
                        <p className="text-base italic text-muted-foreground leading-relaxed mb-2">
                          &ldquo;{voice.quote}&rdquo;
                        </p>
                        <p className="text-sm font-medium text-primary">
                          — {voice.playerName}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="p-6 text-center space-y-4">
            <div className="flex flex-col items-center gap-4">
              <div className="p-3 rounded-full bg-muted border">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-foreground">
                  Generar Relato
                </h3>
                <p className="text-muted-foreground text-sm max-w-md">
                  Creá un relato literario del partido con los momentos más destacados
                </p>
              </div>
              <Button
                onClick={handleGenerateChronicle}
                className="font-medium"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Generar Relato
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
