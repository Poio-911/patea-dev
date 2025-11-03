
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
import { motion } from 'framer-motion';

type PlayerDetailCardProps = {
  player: Player;
};

const positionColors: Record<Player['position'], string> = {
  POR: 'text-yellow-600 dark:text-yellow-400',
  DEF: 'text-green-600 dark:text-green-400',
  MED: 'text-blue-600 dark:text-blue-400',
  DEL: 'text-red-600 dark:text-red-400',
};

const getStatColorClasses = (value: number): { text: string; border: string; bg: string } => {
    if (value >= 75) {
        return {
            text: 'text-yellow-600 dark:text-yellow-400',
            border: 'border-yellow-600 dark:border-yellow-400',
            bg: 'bg-yellow-600/10'
        };
    }
    if (value >= 65) {
        return {
            text: 'text-slate-400 dark:text-slate-300',
            border: 'border-slate-400 dark:border-slate-300',
            bg: 'bg-slate-400/10'
        };
    }
    return {
        text: 'text-amber-700 dark:text-amber-600',
        border: 'border-amber-700 dark:border-amber-600',
        bg: 'bg-amber-700/10'
    };
};

const StatPill = ({ label, value, isPrimary, index }: { label: string; value: number; isPrimary: boolean; index: number }) => {
    const { text, border, bg } = getStatColorClasses(value);

    return (
        <motion.div
            className={cn(
                "relative flex items-center justify-between rounded-lg p-2 text-xs font-bold border-2",
                "transition-all duration-200",
                border,
                bg,
                isPrimary && 'stat-border-glow stat-sparkle',
                !isPrimary && "hover:scale-105 hover:shadow-lg hover:z-10"
            )}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05, type: 'spring', stiffness: 300, damping: 20 }}
            whileHover={!isPrimary ? { scale: 1.05, transition: { duration: 0.2 } } : undefined}
        >
            <span className="text-muted-foreground">{label}</span>
            <span className={cn("font-black", text)}>
                {value}
            </span>
        </motion.div>
    );
};

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
    if (!user?.uid) return;

    setIsGeneratingAI(true);
    try {
      const result = await generatePlayerCardImageAction(user.uid);

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
                <motion.span
                  key={player.ovr}
                  initial={{ scale: 1.2 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.3, type: 'spring' }}
                  className={cn(
                    "text-5xl sm:text-6xl font-black drop-shadow-2xl",
                    player.ovr >= 85 ? "text-glow" : positionColors[player.position]
                  )}
                >
                  {player.ovr}
                </motion.span>
                <Badge
                  variant="secondary"
                  className="text-lg font-bold px-3 py-1.5 bg-background/90 backdrop-blur-sm border-2 shadow-md"
                >
                  {player.position}
                </Badge>
              </div>
              {showSpecialty && (
                <motion.div
                  className="flex items-center justify-center gap-2 mt-3 px-4 py-2 mx-auto max-w-fit bg-primary/10 rounded-full border border-primary/30"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, type: 'spring' }}
                >
                  <specialty.icon className="h-5 w-5 text-primary animate-pulse" />
                  <span className="text-base font-bold text-primary text-glow">{specialty.nickname}</span>
                </motion.div>
              )}
            </div>
            <div className="relative w-full flex flex-col items-center gap-4">
              <div className="group relative">
                <button onClick={() => setShowImageDialog(true)} aria-label="Ampliar imagen de perfil">
                  <Avatar className={cn(
                    "h-40 w-40 overflow-hidden",
                    "border-4 border-primary/50 shadow-2xl",
                    "transition-all duration-300",
                    "group-hover:scale-110 group-hover:shadow-primary/50",
                    "group-hover:ring-4 group-hover:ring-primary/50",
                    showSpecialty && "ring-4 ring-primary/30 ring-offset-2 ring-offset-background",
                    player.ovr >= 85 && "shadow-primary/40"
                  )}>
                    {isGeneratingAI && (
                      <div className="absolute inset-0 z-10 bg-black/70 flex flex-col items-center justify-center text-white">
                        <Sparkles className="h-8 w-8 color-cycle-animation" />
                        <p className="text-xs font-semibold mt-2">Creando magia...</p>
                      </div>
                    )}
                    <AvatarImage
                      src={player.photoUrl} alt={player.name} data-ai-hint="player portrait"
                      className={cn(
                        "group-hover:brightness-110 transition-all duration-300",
                        isGeneratingAI && "opacity-30 blur-sm"
                      )}
                      style={{ objectFit: 'cover', objectPosition: `${player.cropPosition?.x || 50}% ${player.cropPosition?.y || 50}%`, transform: `scale(${player.cropZoom || 1})`, transformOrigin: 'center center' }}
                    />
                    <AvatarFallback className="font-black text-5xl">{playerName.charAt(0)}</AvatarFallback>
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
            <div className="grid grid-cols-2 gap-2 sm:gap-3 my-3 sm:my-4">
              {stats.map((stat, index) => (
                <StatPill key={stat.label} label={stat.label} value={stat.value} isPrimary={stat.key === primaryStat.key} index={index} />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
