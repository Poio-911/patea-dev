
'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Player, Jersey } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useUser } from '@/firebase';
import { Button } from './ui/button';
import { Sparkles, Loader2, Scissors, Share2, ShoppingCart } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { generatePlayerCardImageAction } from '@/lib/actions/image-generation';
import { PlayerOvr, AttributesGrid, PlayerPhoto, positionConfig, PlayerPositionBadge } from '@/components/player-styles';
import { ImageCropperDialog } from './image-cropper-dialog';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from './ui/dialog';
import { FollowButton } from './social/follow-button';
import { ShareButton } from './social/share-button';
import { CreditPackagesDialog } from './payments/credit-packages-dialog';
import { AnimatedCardWrapper } from '@/components/animated-card-wrapper';
import { JerseyWatermark, JerseySilhouette } from '@/components/jersey-watermark';
import { motion } from 'framer-motion';
import { getOvrLevel } from '@/lib/player-utils';

type PlayerDetailCardProps = {
  player: Player;
  onPhotoUpdate: (newUrl: string) => void;
  isCurrentUserProfile: boolean;
  jersey?: Jersey;
};

const auraClasses: Record<string, string> = {
  bronze: 'aura-bronze',
  silver: 'aura-silver',
  gold: 'aura-gold',
  elite: 'aura-elite',
};


export function PlayerDetailCard({ player, onPhotoUpdate, isCurrentUserProfile, jersey }: PlayerDetailCardProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [showCreditPackages, setShowCreditPackages] = useState(false);

  const playerName = player.name || 'Jugador';

  const PositionIcon = positionConfig[player.position].Icon;
  const ovrLevel = getOvrLevel(player.ovr);
  const selectedAuraClass = auraClasses[ovrLevel];

  const borderGlowClasses: Record<string, string> = {
    bronze: 'border-glow-bronze',
    silver: 'border-glow-silver',
    gold: 'border-glow-gold',
    elite: 'border-glow-elite',
  };

  const handleGenerateAIPhoto = async () => {
    if (!user?.uid) return;

    setIsGeneratingAI(true);
    try {
      const result = await generatePlayerCardImageAction(user.uid);

      if ('error' in result) {
        toast({ variant: 'destructive', title: 'Error al generar imagen', description: result.error });
        return;
      }

      // Notificar callback si existe (para compatibilidad)
      if (result.newPhotoURL && onPhotoUpdate) {
        onPhotoUpdate(result.newPhotoURL);
      }

      toast({ title: 'Foto generada con éxito', description: 'Tu foto profesional ha sido creada con IA.' });
      // La actualización también se propagará automáticamente vía Firestore listener (useDoc)
    } catch (error: any) {
      logger.error('Error generating AI photo', error, { userId: user?.uid });
      toast({ variant: 'destructive', title: 'Error al generar imagen', description: error.message || 'No se pudo generar la imagen con IA. Asegúrate de tener una foto real subida.' });
    } finally {
      setIsGeneratingAI(false);
    }
  };

  return (
    <AnimatedCardWrapper animation="flip">
      <Card className={cn(
        "player-card relative h-full w-full max-w-sm mx-auto flex flex-col overflow-hidden rounded-2xl shadow-lg",
        "game:bg-card game:border-border bg-card",
        // NEW: Holographic effect (only on dark theme)
        "game:holo-effect",
        ovrLevel === 'elite' && "game:holo-effect-elite",
        // NEW: Glowing border by tier (only on dark theme)
        "game:" + borderGlowClasses[ovrLevel],
      )}>
        <div className={cn("absolute inset-0 z-0", selectedAuraClass)} />

        {/* NEW: Jersey watermark - larger and more visible for profile (only on dark theme) */}
        <div className="hidden game:block">
          <JerseyWatermark jersey={jersey || player.jersey} position="center" opacity={0.1} />
          {!jersey && !player.jersey && <JerseySilhouette className="bottom-0 right-0 h-64 w-64" />}
        </div>

        <div className="shimmer-effect absolute inset-0 pointer-events-none game:hidden"></div>

      <CardContent className="relative z-10 flex h-full flex-col justify-between p-3 text-center">
        <div className="absolute -bottom-2 -right-2 h-2/5 w-2/5 text-muted-foreground/5 game:text-primary/5">
          {PositionIcon && <PositionIcon className="w-full h-full" />}
        </div>
        <div className="relative z-10 flex flex-col h-full justify-between">
          <div className="flex items-start justify-between mb-2">
            <PlayerPositionBadge position={player.position} />
            <PlayerOvr value={player.ovr} />
          </div>

          <div className="flex flex-col items-center gap-2 mb-2">
            {/* NEW: 3D hover effect on photo */}
            <motion.div
              whileHover={{
                scale: 1.08,
                rotateY: 5,
                rotateZ: 2,
                transition: { type: 'spring', stiffness: 300 },
              }}
              style={{ transformStyle: 'preserve-3d' }}
            >
              <Dialog>
                <DialogTrigger asChild>
                  <button
                    aria-label="Ampliar imagen de perfil"
                    className={cn(
                      "cursor-pointer",
                      // NEW: Ring effects for Elite/Gold
                      ovrLevel === 'elite' && "ring-4 ring-purple-500/50 rounded-full",
                      ovrLevel === 'gold' && "ring-4 ring-yellow-500/50 rounded-full",
                    )}
                  >
                    <div className="relative">
                      <PlayerPhoto player={player as any} size="profile" />
                      {isGeneratingAI && (
                        <div className="absolute inset-0 bg-black/70 rounded-full flex flex-col items-center justify-center text-white">
                          <Loader2 className="h-8 w-8 animate-spin" />
                          <span className="text-xs mt-2">Generando...</span>
                        </div>
                      )}
                    </div>
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-md p-0 border-0 bg-transparent shadow-none">
                  <DialogTitle className="sr-only">Imagen de perfil de {playerName}</DialogTitle>
                  <img src={player.photoUrl} alt={player.name} className="w-full h-auto rounded-lg" />
                </DialogContent>
              </Dialog>
            </motion.div>
            <h3 className="w-full truncate text-center text-xl font-semibold">{playerName}</h3>
          </div>

          {/* Social actions for other users' profiles */}
          {!isCurrentUserProfile && (
            <div className="flex items-center justify-center gap-2 my-3">
              <FollowButton targetUserId={player.id} variant="default" size="sm" />
              <ShareButton
                title={`${player.name} - OVR ${player.ovr}`}
                text={`Mirá el perfil de ${player.name} en Pateá!`}
                url={typeof window !== 'undefined' ? window.location.href : ''}
                imageUrl={player.photoUrl}
                variant="outline"
                size="sm"
                showLabel={false}
              />
            </div>
          )}

          {isCurrentUserProfile && (
            <div className="flex flex-col gap-2 w-full my-4">
              <div className="grid grid-cols-2 gap-2 w-full">
                {player.cardGenerationCredits && player.cardGenerationCredits > 0 ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="default" size="sm" disabled={isGeneratingAI}>
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4" />
                          <span>Generar IA</span>
                          <Badge className="bg-primary-foreground/20 text-primary-foreground">{player.cardGenerationCredits || 0}</Badge>
                        </div>
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
                          {isGeneratingAI ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          Confirmar y Usar Crédito
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setShowCreditPackages(true)}
                    className="bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-white"
                  >
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    Comprar Créditos
                  </Button>
                )}
                <ImageCropperDialog player={player} onSaveComplete={onPhotoUpdate}>
                  <Button variant="secondary" size="sm" disabled={isGeneratingAI}>
                    <Scissors className="mr-2 h-4 w-4" />
                    Cambiar Foto
                  </Button>
                </ImageCropperDialog>
              </div>

              {/* Mensaje cuando no hay créditos */}
              {player.cardGenerationCredits !== undefined && player.cardGenerationCredits <= 0 && (
                <p className="text-xs text-center text-muted-foreground">
                  Sin créditos. Compra un paquete para generar fotos con IA.
                </p>
              )}
            </div>
          )}

          {/* Dialog de paquetes de créditos */}
          <CreditPackagesDialog
            open={showCreditPackages}
            onOpenChange={setShowCreditPackages}
          />

          <AttributesGrid player={player} />
        </div>
      </CardContent>
    </Card>
    </AnimatedCardWrapper>
  );
}
