
'use client';

import React from 'react';
import { useUser } from '@/firebase';
import type { Player } from '@/lib/types';
import { PlayerCard } from '@/components/player-card';
import { PlayerDetailCard } from '@/components/player-detail-card'; // Solo usaremos sus botones, no reemplazaremos el layout base
import { Sparkles, Scissors } from 'lucide-react';
import { ImageCropperDialog } from '@/components/image-cropper-dialog';
import { generatePlayerCardImageAction } from '@/lib/actions/image-generation';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LineChart, BrainCircuit } from 'lucide-react';
import Link from 'next/link';
import { PlayerRecentActivity } from './player-recent-activity';

type PlayerProfileViewProps = {
  playerId: string;
  player: Player;
};

export default function PlayerProfileView({ playerId, player }: PlayerProfileViewProps) {
  const { user } = useUser();
  const isCurrentUserProfile = user?.uid === playerId;
  const { toast } = useToast();
  const [isGeneratingAI, setIsGeneratingAI] = React.useState(false);

  const handleGenerateAIPhoto = async () => {
    if (!user?.uid) return;
    setIsGeneratingAI(true);
    try {
      const result = await generatePlayerCardImageAction(user.uid);
      if ('error' in result) {
        toast({ variant: 'destructive', title: 'Error al generar imagen', description: result.error });
      } else {
        toast({ title: 'Foto generada con éxito', description: 'Tu foto profesional ha sido creada con IA.' });
        // Pequeño refresh local sin recargar toda la app (optimización simple)
        // Idealmente usaríamos un refetch; por ahora forzamos reload de la página de perfil.
        setTimeout(() => window.location.reload(), 800);
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message || 'Fallo inesperado.' });
    } finally {
      setIsGeneratingAI(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Mantener EXACTO layout visual de PlayerCard para consistencia con vista jugadores */}
      <PlayerCard player={player} />

      {/* Botones IA + recorte SOLO si es mi perfil, reutilizando lógica pero sin alterar la tarjeta base */}
      {isCurrentUserProfile && (
        <div className="flex flex-col items-center gap-3 -mt-2">
          <div className="flex flex-wrap justify-center gap-2 w-full px-2">
            <Button
              variant="default"
              size="sm"
              disabled={isGeneratingAI || (player.cardGenerationCredits !== undefined && player.cardGenerationCredits <= 0)}
              onClick={handleGenerateAIPhoto}
            >
              {isGeneratingAI ? (
                <>
                  <Sparkles className="mr-2 h-4 w-4 animate-pulse" /> Generando...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" /> Generar Foto IA
                </>
              )}
            </Button>
            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-muted inline-flex items-center justify-center">{player.cardGenerationCredits || 0} créditos</span>
            <ImageCropperDialog player={player} onSaveComplete={() => setTimeout(() => window.location.reload(), 500)}>
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

      {/* Componente para la actividad reciente */}
      <PlayerRecentActivity playerId={playerId} />

    </div>
  );
}
