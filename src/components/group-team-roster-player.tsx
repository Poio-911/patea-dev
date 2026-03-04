
'use client';

import type { GroupTeam, DetailedTeamPlayer } from '@/lib/types';
import { cn } from '@/lib/utils';
import { MoreVertical } from 'lucide-react';
import { PlayerPhoto, positionConfig } from '@/components/player-styles';
import { Button } from '@/components/ui/button';
import { SetPlayerStatusDialog } from '@/components/set-player-status-dialog';
import { AnimatedCardWrapper } from '@/components/animated-card-wrapper';
import { getOvrLevel } from '@/lib/player-utils';
import type { PlayerPosition } from '@/lib/types';

interface GroupTeamRosterPlayerProps {
    player: DetailedTeamPlayer;
    team: GroupTeam;
    onPlayerUpdate?: () => void;
    index?: number;
    canEdit?: boolean;
}

const positionColors: Record<PlayerPosition, string> = {
    DEL: 'text-pos-del',
    MED: 'text-pos-med',
    DEF: 'text-pos-def',
    POR: 'text-pos-por',
};

export const GroupTeamRosterPlayer = ({ player, team, onPlayerUpdate, index = 0, canEdit = false }: GroupTeamRosterPlayerProps) => {
    const staggerDelay = index * 0.03;
    const posConfig = positionConfig[player.position as PlayerPosition];
    const positionName = posConfig?.name ?? player.position;
    const positionColor = positionColors[player.position as PlayerPosition] ?? 'text-muted-foreground';

    return (
        <AnimatedCardWrapper animation="slide" delay={staggerDelay}>
            <div className="relative flex items-center gap-4 px-3 py-2.5 rounded-xl border bg-card hover:bg-accent/30 transition-colors group">

                {/* Actions menu */}
                {canEdit && (
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <SetPlayerStatusDialog player={player} team={team} onPlayerUpdate={onPlayerUpdate}>
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                                <MoreVertical className="h-3.5 w-3.5" />
                            </Button>
                        </SetPlayerStatusDialog>
                    </div>
                )}

                {/* Number — dorsal deportivo */}
                <div className="flex flex-col items-center justify-center shrink-0 w-10">
                    <span
                        className={cn(
                            'font-black tabular-nums leading-none text-3xl',
                            positionColor
                        )}
                        style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em' }}
                    >
                        {player.number}
                    </span>
                    <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground/50 mt-0.5">Nº</span>
                </div>

                {/* Photo */}
                <div className="shrink-0">
                    <PlayerPhoto player={player as any} size="compact" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <p
                        className="font-black text-sm uppercase tracking-widest leading-tight truncate"
                        style={{ letterSpacing: '0.08em' }}
                    >
                        {player.name}
                    </p>
                    <p className={cn('text-xs font-semibold mt-0.5', positionColor)}>
                        {positionName}
                    </p>
                </div>
            </div>
        </AnimatedCardWrapper>
    );
};
