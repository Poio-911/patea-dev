
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from './ui/separator';
import type { Player, PlayerPosition } from '@/lib/types';
import { cn } from '@/lib/utils';
import { playerSpecialties } from '@/lib/data';
import { useUser } from '@/firebase';
import { Button } from './ui/button';
import { Sparkles, Loader2, Scissors } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { generatePlayerCardImageAction } from '@/lib/actions/image-generation';
import { PlayerOvr, getPositionBadgeClasses, AttributesGrid, PlayerPhoto } from '@/components/player-styles';
import { ImageCropperDialog } from './image-cropper-dialog';
import { Dialog, DialogContent, DialogTrigger } from './ui/dialog';

type PlayerDetailCardProps = {
  player: Player;
};

const positionTextColors: Record<PlayerPosition, string> = {
  POR: 'text-orange-600',
  DEF: 'text-green-600',
  MED: 'text-blue-600',
  DEL: 'text-red-600',
};


const getStatColorClasses = (value: number): string => {
    if (value >= 85) return "text-yellow-400"; // Gold for elite stats
    if (value >= 75) return "text-green-400"; // Green for great stats
    if (value >= 60) return "text-slate-300"; // Light gray for good stats
    return "text-slate-500"; // Muted gray for average stats
};


const StatPill = ({ label, value, isPrimary, index }: { label: string; value: number; isPrimary: boolean; index: number }) => {
    const colorClass = getStatColorClasses(value);

    return (
        <div
            className={cn(
                "relative flex items-center justify-between rounded-lg p-2 text-xs font-bold border-2",
                "bg-white/5 game:bg-white/5",
                isPrimary ? "border-yellow-400/50 game:border-yellow-400/50" : "border-transparent"
            )}
        >
            <span className="text-gray-400">{label}</span>
            <span className={cn("font-black", colorClass)}>
                {value}
            </span>
        </div>
    );
};

export function PlayerDetailCard({ player: initialPlayer }: PlayerDetailCardProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const [player, setPlayer] = useState<Player>(initialPlayer);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  const isCurrentUserProfile = user?.uid === player.id;
  const playerName = player.name || 'Jugador';

  const handlePhotoUpdate = (newUrl: string) => {
    setPlayer(prev => ({...prev, photoUrl: newUrl}));
  }

  const stats = [
    { label: 'RIT', value: player.pac, key: 'PAC' },
    { label: 'TIR', value: player.sho, key: 'SHO' },
    { label: 'PAS', value: player.pas, key: 'PAS' },
    { label: 'REG', value: player.dri, key: 'DRI' },
    { label: 'DEF', value: player.def, key: 'DEF' },
    { label: 'FIS', value: player.phy, key: 'PHY' },
  ];

  const primaryStat = stats.reduce((max, stat) => (stat.value > max.value ? stat : max), stats[0]);
  const specialty = playerSpecialties[primaryStat.key as keyof typeof playerSpecialties];
  const showSpecialty = specialty && primaryStat.value >= specialty.threshold;

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
      if (result.newPhotoURL) {
        handlePhotoUpdate(result.newPhotoURL);
      }
    } catch (error: any) {
      logger.error('Error generating AI photo', error, { userId: user?.uid });
      toast({ variant: 'destructive', title: 'Error al generar imagen', description: error.message || 'No se pudo generar la imagen con IA. Asegúrate de tener una foto real subida.' });
    } finally {
      setIsGeneratingAI(false);
    }
  };

  return (
    <>
      <Card className={cn(
          "relative overflow-hidden border-2 shadow-lg h-full flex flex-col",
          "shimmer-bg", // Fondo estático para modo claro
          "game:bg-card game:border-border"
      )}>
        {/* Efecto de brillo solo en modo claro */}
        <div className="shimmer-effect absolute inset-0 pointer-events-none game:hidden"></div>
        <div className="hidden game:block absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.08)_10%,transparent_90%)] opacity-20 pointer-events-none"></div>

        <CardContent className="pt-6 z-10">
          <div className="flex flex-col items-center gap-4">
            <div className="text-center">
              <h2 className="text-3xl font-bold font-headline">{playerName}</h2>
              <div className="flex items-center justify-center gap-6 mt-2">
                <PlayerOvr value={player.ovr} />
                <Badge className={cn('px-3 py-1 font-bold uppercase', getPositionBadgeClasses(player.position))}>{player.position}</Badge>
              </div>
              {showSpecialty && (
                <div className="flex items-center justify-center gap-2 mt-2">
                  <specialty.icon className="h-5 w-5 text-primary" />
                  <span className="text-xs font-semibold text-primary">{specialty.nickname}</span>
                </div>
              )}
            </div>
            <div className="relative w-full flex flex-col items-center gap-4">
              <div className="group relative">
                <Dialog>
                  <DialogTrigger asChild>
                    <button aria-label="Ampliar imagen de perfil" className="cursor-pointer">
                      <div className="relative">
                        {isGeneratingAI && (
                          <div className="absolute inset-0 z-10 bg-black/60 flex flex-col items-center justify-center text-white rounded-full">
                            <Sparkles className="h-6 w-6 animate-pulse" />
                            <p className="text-[10px] font-semibold mt-1">Generando...</p>
                          </div>
                        )}
                        <PlayerPhoto player={player} size="profile" />
                      </div>
                    </button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl p-0 border-0 bg-transparent shadow-none">
                    <img src={player.photoUrl} alt={player.name} className="w-full h-auto max-h-[80vh] object-contain rounded-lg" />
                  </DialogContent>
                </Dialog>
              </div>
              {isCurrentUserProfile && (
                <div className="w-full flex flex-col items-center gap-2">
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
                  <ImageCropperDialog player={player} onSaveComplete={handlePhotoUpdate}>
                    <Button variant="outline" size="sm" disabled={isGeneratingAI}>
                      <Scissors className="mr-2 h-4 w-4" /> Cambiar Foto
                    </Button>
                  </ImageCropperDialog>
                </div>
              )}
            </div>
          </div>
          <Separator className="my-6 game:bg-white/10"/>
          <div className="w-full px-2 mt-2">
            <AttributesGrid player={player} />
          </div>
        </CardContent>
      </Card>
    </>
  );
}
