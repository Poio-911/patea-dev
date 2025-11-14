
'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Player, PlayerPosition } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useUser } from '@/firebase';
import { Button } from './ui/button';
import { Sparkles, Loader2, Scissors } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { generatePlayerCardImageAction } from '@/lib/actions/image-generation';
import { PlayerOvr, getPositionBadgeClasses, AttributesGrid, PlayerPhoto, positionConfig } from '@/components/player-styles';
import { ImageCropperDialog } from './image-cropper-dialog';
import { Dialog, DialogContent, DialogTrigger } from './ui/dialog';

type PlayerDetailCardProps = {
  player: Player;
  onPhotoUpdate: (newUrl: string) => void;
  isCurrentUserProfile: boolean;
};

const getOvrLevel = (ovr: number) => {
    if (ovr >= 86) return 'elite';
    if (ovr >= 76) return 'gold';
    if (ovr >= 65) return 'silver';
    return 'bronze';
};

const auraClasses: Record<string, string> = {
    bronze: 'aura-bronze',
    silver: 'aura-silver',
    gold: 'aura-gold',
    elite: 'aura-elite',
};


export function PlayerDetailCard({ player, onPhotoUpdate, isCurrentUserProfile }: PlayerDetailCardProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  const playerName = player.name || 'Jugador';
  
  const PositionIcon = positionConfig[player.position].Icon;
  const ovrLevel = getOvrLevel(player.ovr);
  const selectedAuraClass = auraClasses[ovrLevel]; 

  const handleGenerateAIPhoto = async () => {
    if (!user?.uid) return;

    setIsGeneratingAI(true);
    try {
      const result = await generatePlayerCardImageAction(user.uid);

      if ('error' in result) {
        toast({ variant: 'destructive', title: 'Error al generar imagen', description: result.error });
        return;
      }
      toast({ title: 'Foto generada con éxito', description: 'Tu foto profesional ha sido creada con IA.' });
      // La actualización se propagará automáticamente vía Firestore
    } catch (error: any) {
      logger.error('Error generating AI photo', error, { userId: user?.uid });
      toast({ variant: 'destructive', title: 'Error al generar imagen', description: error.message || 'No se pudo generar la imagen con IA. Asegúrate de tener una foto real subida.' });
    } finally {
      setIsGeneratingAI(false);
    }
  };

  return (
    <Card className={cn(
        "player-card relative h-full w-full max-w-sm mx-auto flex flex-col overflow-hidden rounded-2xl shadow-lg",
        "game:bg-card game:border-border",
        "bg-card"
    )}>
      <div className={cn("absolute inset-0 z-0", selectedAuraClass)} />
      <div className="shimmer-effect absolute inset-0 pointer-events-none game:hidden"></div>
      
      <CardContent className="relative z-10 flex h-full flex-col justify-between p-3 text-center">
        <div className="absolute -bottom-2 -right-2 h-2/5 w-2/5 text-muted-foreground/5 game:text-primary/5">
          {PositionIcon && <PositionIcon className="w-full h-full" />}
        </div>
        <div className="relative z-10 flex flex-col h-full justify-between">
          <div className="flex items-start justify-between mb-2">
            <Badge className={cn('font-headline uppercase font-bold', getPositionBadgeClasses(player.position))}>
              {player.position}
            </Badge>
            <PlayerOvr value={player.ovr} />
          </div>
          
          <div className="flex flex-col items-center gap-2 mb-2">
            <Dialog>
              <DialogTrigger asChild>
                <button aria-label="Ampliar imagen de perfil" className="cursor-pointer">
                  <PlayerPhoto player={player} size="profile" />
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-md p-0 border-0 bg-transparent shadow-none">
                <img src={player.photoUrl} alt={player.name} className="w-full h-auto rounded-lg" />
              </DialogContent>
            </Dialog>
            <h3 className="w-full truncate text-center text-xl font-semibold">{playerName}</h3>
          </div>

          {isCurrentUserProfile && (
            <div className="flex flex-col items-center gap-2 my-4">
              <div className="flex items-center justify-center gap-2">
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
                <Badge variant="secondary" className="rounded-full h-6 w-6 flex items-center justify-center p-0 text-xs">
                  {player.cardGenerationCredits || 0}
                </Badge>
              </div>
              <ImageCropperDialog player={player} onSaveComplete={onPhotoUpdate}>
                <Button variant="outline" size="sm" disabled={isGeneratingAI}>
                  <Scissors className="mr-2 h-4 w-4" /> Cambiar Foto
                </Button>
              </ImageCropperDialog>
            </div>
          )}

          <AttributesGrid player={player} />
        </div>
      </CardContent>
    </Card>
  );
}
