
'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { Player } from '@/lib/types';
import { cn } from '@/lib/utils';
import { playerSpecialties } from '@/lib/data';
import { useUser } from '@/firebase';
import { Button } from './ui/button';
import { Sparkles, Upload, Loader2, Image, Scissors } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { generatePlayerCardImageAction } from '@/lib/actions/image-generation';
import { ImageCropperDialog } from './image-cropper-dialog';
import { Dialog, DialogContent } from './ui/dialog';

type PlayerDetailCardProps = {
  player: Player;
};

const positionColors: Record<Player['position'], string> = {
  POR: 'text-yellow-600',
  DEF: 'text-green-600',
  MED: 'text-blue-600',
  DEL: 'text-red-600',
};

const getStatColorClasses = (value: number): string => {
    if (value >= 85) return 'text-green-500 border-green-500';
    if (value >= 70) return 'text-blue-500 border-blue-500';
    if (value >= 50) return 'text-yellow-600 border-yellow-600';
    return 'text-muted-foreground border-muted';
};

const StatPill = ({ label, value, isPrimary }: { label: string; value: number; isPrimary: boolean; }) => {
    const colorClass = getStatColorClasses(value);
    return (
        <div className={cn(
            "flex items-center justify-between rounded-lg p-2 text-xs font-bold border-2",
            isPrimary ? 'border-primary shadow-lg animated-glowing-border' : colorClass
        )}>
            <span className="text-muted-foreground">{label}</span>
            <span className={cn(isPrimary ? 'text-primary' : colorClass.split(' ')[0])}>{value}</span>
        </div>
    );
};

const toDataURL = (url: string): Promise<string> =>
  fetch(url)
    .then(response => {
        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
        }
        return response.blob();
    })
    .then(blob => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    }));

export function PlayerDetailCard({ player }: PlayerDetailCardProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [showImageDialog, setShowImageDialog] = useState(false);

  const isCurrentUserProfile = user?.uid === player.id;
  const playerName = player.name || 'Jugador';

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
    if (!user?.uid || !player?.photoUrl) return;

    setIsGeneratingAI(true);
    try {
      const photoDataUri = await toDataURL(player.photoUrl);
      const result = await generatePlayerCardImageAction(user.uid, photoDataUri);

      if ('error' in result) {
        toast({ variant: 'destructive', title: 'Error al generar imagen', description: result.error });
        return;
      }
      toast({ title: 'Foto generada con éxito', description: 'Tu foto profesional ha sido creada con IA.' });
    } catch (error: any) {
      logger.error('Error generating AI photo', error, { userId: user?.uid });
      toast({ variant: 'destructive', title: 'Error al generar imagen', description: error.message || 'No se pudo generar la imagen con IA. Asegúrate de tener una foto real subida.' });
    } finally {
      setIsGeneratingAI(false);
    }
  };

  return (
    <>
      <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
        <DialogContent className="max-w-2xl p-0 border-0 bg-transparent shadow-none">
            <img
                src={player.photoUrl}
                alt={player.name}
                className="w-full h-auto max-h-[80vh] object-contain"
            />
        </DialogContent>
      </Dialog>
      <Card className="overflow-hidden border-2 shadow-lg border-border h-full flex flex-col bg-card">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-4">
            <div className="text-center">
              <h2 className="text-3xl font-bold font-headline">{playerName}</h2>
              <div className="flex items-center justify-center gap-4 mt-2">
                <span className={cn("text-5xl font-bold", positionColors[player.position])}>{player.ovr}</span>
                <Badge variant="secondary" className="text-lg">{player.position}</Badge>
              </div>
              {showSpecialty && (
                <div className="flex items-center justify-center gap-1.5 mt-2 text-sm font-semibold text-primary">
                  <specialty.icon className="h-4 w-4" />
                  <span>{specialty.nickname}</span>
                </div>
              )}
            </div>
            <div className="relative w-full flex flex-col items-center gap-4">
              <div className="group relative">
                <button onClick={() => setShowImageDialog(true)} aria-label="Ampliar imagen de perfil">
                  <Avatar className="h-40 w-40 border-4 border-primary/50 group-hover:scale-105 group-hover:ring-4 group-hover:ring-primary/50 transition-all duration-300 overflow-hidden">
                    {isGeneratingAI && (
                      <div className="absolute inset-0 z-10 bg-black/70 flex flex-col items-center justify-center text-white">
                        <Sparkles className="h-8 w-8 color-cycle-animation" />
                        <p className="text-xs font-semibold mt-2">Creando magia...</p>
                      </div>
                    )}
                    <AvatarImage
                      src={player.photoUrl} alt={player.name} data-ai-hint="player portrait"
                      className={cn(isGeneratingAI && "opacity-30 blur-sm")}
                      style={{ objectFit: 'cover', objectPosition: `${player.cropPosition?.x || 50}% ${player.cropPosition?.y || 50}%`, transform: `scale(${player.cropZoom || 1})`, transformOrigin: 'center center' }}
                    />
                    <AvatarFallback>{playerName.charAt(0)}</AvatarFallback>
                  </Avatar>
                </button>
              </div>
              {isCurrentUserProfile && (
                <div className="w-full flex flex-col items-center gap-2">
                  <div className="flex items-center justify-center gap-2">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="default" size="sm" disabled={isGeneratingAI || (player.cardGenerationCredits !== undefined && player.cardGenerationCredits <= 0)}>
                          <Sparkles className="mr-2 h-4 w-4" /> Generar Foto IA
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Confirmar generación de imagen?</AlertDialogTitle>
                          <AlertDialogDescription>Esto usará 1 de tus {player.cardGenerationCredits} créditos. Esta acción no se puede deshacer.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={handleGenerateAIPhoto}>Confirmar y Usar Crédito</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <Badge variant="secondary" className="rounded-full h-6 w-6 flex items-center justify-center p-0 text-xs">
                      {player.cardGenerationCredits || 0}
                    </Badge>
                  </div>
                  <ImageCropperDialog player={player} onSaveComplete={() => window.location.reload()}>
                    <Button variant="outline" size="sm" disabled={isGeneratingAI}>
                      <Scissors className="mr-2 h-4 w-4" /> Cambiar Foto
                    </Button>
                  </ImageCropperDialog>
                </div>
              )}
            </div>
          </div>
          <Separator className="my-6"/>
          <div className="w-full px-4">
            <div className="grid grid-cols-2 gap-2 my-2">
              {stats.map((stat, index) => (
                <StatPill key={stat.label} label={stat.label} value={stat.value} isPrimary={stat.key === primaryStat.key} />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
