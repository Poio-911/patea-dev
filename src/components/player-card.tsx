
'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Player, AttributeKey, PlayerPosition } from '@/lib/types';
import { cn } from '@/lib/utils';
import { DelIcon, MedIcon, DefIcon, PorIcon } from '@/components/icons/positions';
import { PlayerOvr, getPositionBadgeClasses, AttributesGrid, PlayerPhoto } from '@/components/player-styles';
import { Skeleton } from './ui/skeleton';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

type PlayerCardProps = {
  player: Player & { displayName?: string };
};

const attributeDetails: Record<AttributeKey, { name: string }> = {
    PAC: { name: 'RIT' },
    SHO: { name: 'TIR' },
    PAS: { name: 'PAS' },
    DRI: { name: 'REG' },
    DEF: { name: 'DEF' },
    PHY: { name: 'FIS' },
};

const positionTextColors: Record<PlayerPosition, string> = {
    POR: 'text-orange-600',
    DEF: 'text-green-600',
    MED: 'text-blue-600',
    DEL: 'text-red-600',
};

const positionIcons: Record<PlayerPosition, React.ElementType> = {
  DEL: DelIcon,
  MED: MedIcon,
  DEF: DefIcon,
  POR: PorIcon,
};

// --- Lógica de Niveles y Colores para el Resplandor ---
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


export const PlayerCard = React.memo(function PlayerCard({ player }: PlayerCardProps) {
    // ✅ ARREGLO DEFINITIVO: Si player es nulo o indefinido, mostramos un esqueleto de carga.
    if (!player) {
      return (
        <Card className="h-full w-full rounded-2xl">
          <CardContent className="p-3">
            <Skeleton className="h-full w-full aspect-[2/3]" />
          </CardContent>
        </Card>
      );
    }
    
    const playerName = player.name || player.displayName || 'Jugador';
    
    const stats = React.useMemo(() => [
        { key: 'PAC', value: player.pac },
        { key: 'SHO', value: player.sho },
        { key: 'PAS', value: player.pas },
        { key: 'DRI', value: player.dri },
        { key: 'DEF', value: player.def },
        { key: 'PHY', value: player.phy },
    ] as const, [player]);

    const PositionIcon = positionIcons[player.position];
    const ovrLevel = getOvrLevel(player.ovr);
    const selectedAuraClass = auraClasses[ovrLevel]; 

    return (
        <div className="h-full w-full">
            <Card
                className={cn(
                    "player-card relative h-full flex flex-col overflow-hidden rounded-2xl shadow-lg",
                    "game:bg-card game:border-border",
                    "bg-card"
                )}
            >
                {/* Capa de resplandor */}
                <div className={cn("absolute inset-0 z-0", selectedAuraClass)} />
                
                <CardContent className="relative z-10 flex h-full flex-col justify-between p-3 text-center">
                    <div className="absolute -bottom-2 -right-2 h-2/5 w-2/5 text-muted-foreground/5 game:text-primary/5">
                        {PositionIcon && <PositionIcon className="w-full h-full" />}
                    </div>
                    {/* Contenido principal de la tarjeta */}
                    <div className="relative z-10 flex flex-col h-full justify-between">
                                                <div className="flex items-start justify-between mb-2">
                                                    <Badge className={cn('uppercase font-bold', getPositionBadgeClasses(player.position))}>{player.position}</Badge>
                                                    <PlayerOvr value={player.ovr} />
                                                </div>
                                                <div className="flex flex-col items-center gap-2 mb-2">
                                                    <Dialog>
                                                        <DialogTrigger asChild>
                                                            <button aria-label="Ver foto jugador" className="cursor-pointer">
                                                                <PlayerPhoto player={player} />
                                                            </button>
                                                        </DialogTrigger>
                                                        <DialogContent className="max-w-md p-0 border-0 bg-transparent shadow-none">
                                                            <img src={player.photoUrl} alt={player.name} className="w-full h-auto rounded-lg" />
                                                        </DialogContent>
                                                    </Dialog>
                                                    <Link href={`/players/${player.id}`} className="w-full">
                                                        <h3 className="w-full truncate text-center text-sm font-semibold hover:text-primary transition-colors">{playerName}</h3>
                                                    </Link>
                                                </div>
                                                <AttributesGrid player={player} />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
});
