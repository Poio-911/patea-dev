
'use client';

import React, { useState, useEffect } from 'react';
import { useUser } from '@/firebase';
import type { Player } from '@/lib/types';
import { PlayerCard } from '@/components/player-card';
import { Sparkles, Scissors, Loader2, LineChart, BrainCircuit } from 'lucide-react';
import { ImageCropperDialog } from '@/components/image-cropper-dialog';
import { generatePlayerCardImageAction } from '@/lib/actions/image-generation';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PlayerRecentActivity } from './player-recent-activity';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

type PlayerProfileViewProps = {
  playerId: string;
  player: Player;
};

export default function PlayerProfileView({ playerId, player: initialPlayer }: PlayerProfileViewProps) {
  const { user } = useUser();
  const [player, setPlayer] = useState<Player>(initialPlayer);
  const isCurrentUserProfile = user?.uid === playerId;
  const { toast } = useToast();
  const [isGeneratingAI, setIsGeneratingAI] = React.useState(false);

  useEffect(() => {
    setPlayer(initialPlayer);
  }, [initialPlayer]);

  const handlePhotoUpdate = (newUrl: string) => {
    setPlayer(prevPlayer => ({ ...prevPlayer, photoUrl: newUrl }));
    // No need to reload the page, state update will trigger re-render
  };

  const handleGenerateAIPhoto = async () => {
    if (!user?.uid) return;
    setIsGeneratingAI(true);
    try {
      const result = await generatePlayerCardImageAction(user.uid);

      if ('error' in result) {
        toast({ variant: 'destructive', title: 'Error al generar imagen', description: result.error });
      } else {
        toast({ title: 'Foto generada con éxito', description: 'Tu foto profesional ha sido creada con IA.' });
        if (result.newPhotoURL) {
          // The useUser hook will pick up the change from Auth and update the context,
          // which will re-render components that use it.
          // For local component state, we still update it manually.
          handlePhotoUpdate(result.newPhotoURL);
        }
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message || 'Fallo inesperado.' });
    } finally {
      setIsGeneratingAI(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <PlayerCard player={player} />

      {isCurrentUserProfile && (
        <div className="flex flex-col items-center gap-3 -mt-2">
          <div className="flex flex-wrap justify-center gap-2 w-full px-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="default" size="sm" disabled={isGeneratingAI || (player.cardGenerationCredits !== undefined && player.cardGenerationCredits <= 0)}>
                  <Sparkles className="mr-2 h-4 w-4" /> 
                  {isGeneratingAI ? 'Generando...' : 'Generar Foto IA'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Confirmar generación de imagen?</AlertDialogTitle>
                  <AlertDialogDescription>Esto usará 1 de tus {player.cardGenerationCredits} créditos. Esta acción no se puede deshacer.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleGenerateAIPhoto} disabled={isGeneratingAI}>
                    {isGeneratingAI ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                    Confirmar y Usar Crédito
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-muted inline-flex items-center justify-center">{player.cardGenerationCredits || 0} créditos</span>
            <ImageCropperDialog player={player} onSaveComplete={handlePhotoUpdate}>
              <Button variant="outline" size="sm" disabled={isGeneratingAI}>
                <Scissors className="mr-2 h-4 w-4" /> Cambiar Foto
              </Button>
            </ImageCropperDialog>
          </div>
        </div>
      )}
      
      {isCurrentUserProfile && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link href={`/players/${playerId}/analysis`}>
            <Card className="h-full hover:bg-muted/50 transition-colors cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Análisis con IA
                </CardTitle>
                <BrainCircuit className="h-5 w-5 text-primary" />
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Descubrí patrones y recibí consejos del DT virtual.
                </p>
              </CardContent>
            </Card>
          </Link>
          <Link href={`/players/${playerId}/progression`}>
             <Card className="h-full hover:bg-muted/50 transition-colors cursor-pointer">
               <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Progresión de OVR
                </CardTitle>
                <LineChart className="h-5 w-5 text-primary" />
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Mirá el gráfico de cómo evolucionaron tus estadísticas.
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>
      )}

      <PlayerRecentActivity playerId={playerId} />

    </div>
  );
}
