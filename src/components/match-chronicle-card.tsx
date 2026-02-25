'use client';

import { useState, useEffect } from 'react';
import type { Match, GenerateMatchChronicleOutput } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from './ui/button';
import { Loader2, Sparkles, Newspaper, RefreshCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateMatchChronicleAction } from '@/lib/actions/server-actions';
import { Separator } from './ui/separator';
import { motion } from 'framer-motion';
import { useUser } from '@/firebase';

interface MatchChronicleCardProps {
  match: Match;
}

export function MatchChronicleCard({ match }: MatchChronicleCardProps) {
  const [chronicle, setChronicle] = useState<GenerateMatchChronicleOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useUser();
  const isOrganizer = user?.uid === match.ownerUid;

  // ✅ Load saved chronicle from match document
  useEffect(() => {
    if (match.chronicle) {
      setChronicle(match.chronicle);
    }
  }, [match.chronicle]);

  const handleGenerateChronicle = async (isRegenerating = false) => {
    // Prevent regeneration if not regenerating and chronicle already exists
    if (!isRegenerating && match.chronicle) {
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
          <div className="space-y-12 pb-6">
            {/* Título Evocativo */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="text-center space-y-4 pt-4"
            >
              <h2 className="text-4xl md:text-5xl font-black text-foreground leading-tight font-serif tracking-tight px-4" style={{ fontFamily: "Georgia, serif" }}>
                "{chronicle.headline}"
              </h2>
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground font-medium uppercase tracking-widest">
                <Sparkles size={14} className="text-primary animate-pulse" />
                <span>Escrito por Genkit IA</span>
                <Sparkles size={14} className="text-primary animate-pulse" />
              </div>
              <div className="w-32 h-1 bg-gradient-to-r from-transparent via-primary to-transparent mx-auto mt-4 opacity-50"></div>
            </motion.div>

            {/* Relato Fluido */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1, delay: 0.3 }}
              className="relative px-2 md:px-8"
            >
              <div className="absolute -left-2 top-0 text-9xl text-primary/10 font-serif leading-none select-none pointer-events-none">"</div>

              <div className="prose prose-lg dark:prose-invert max-w-none">
                <p className="text-foreground/90 leading-loose whitespace-pre-line text-lg font-serif first-letter:float-left first-letter:text-6xl first-letter:font-black first-letter:text-primary first-letter:mr-3 first-letter:mt-[-0.1em] first-letter:font-serif shadow-sm p-6 rounded-2xl bg-card border border-border/50">
                  {chronicle.story}
                </p>
              </div>
            </motion.div>

            {/* Voces de los Jugadores */}
            {chronicle.playerVoices && chronicle.playerVoices.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.6 }}
              >
                <Separator className="my-8 w-1/2 mx-auto bg-primary/20" />
                <div className="space-y-6">
                  <h3 className="text-2xl font-bold font-serif text-center uppercase tracking-widest text-primary/80">
                    Voces del Vestuario
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-4">
                    {chronicle.playerVoices.map((voice, index) => (
                      <div key={index} className="relative p-6 rounded-xl bg-muted/30 border border-muted-foreground/10 hover:bg-muted/50 transition-colors">
                        <p className="text-lg italic text-foreground/80 leading-relaxed font-serif">
                          &ldquo;{voice.quote}&rdquo;
                        </p>
                        <p className="text-sm font-bold text-primary mt-4 uppercase tracking-wider">
                          — {voice.playerName}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Regenerate Button for Organizers */}
            {isOrganizer && (
              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                className="flex justify-center pt-8"
              >
                <Button variant="outline" size="sm" onClick={() => handleGenerateChronicle(true)} disabled={isLoading} className="text-muted-foreground hover:text-primary transition-colors">
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Regenerar Crónica (Solo Organizador)
                </Button>
              </motion.div>
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
                onClick={() => handleGenerateChronicle(false)}
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
