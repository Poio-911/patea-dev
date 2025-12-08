
'use client';

import type { GroupTeam, DetailedTeamPlayer } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { MoreVertical } from 'lucide-react';
import { PlayerOvr, PlayerPhoto, positionConfig, PlayerPositionBadge } from '@/components/player-styles';
import { Button } from '@/components/ui/button';
import { SetPlayerStatusDialog } from '@/components/set-player-status-dialog';
import { AnimatedCardWrapper } from '@/components/animated-card-wrapper';
import { JerseyPreview } from '@/components/team-builder/jersey-preview';
import { getOvrLevel } from '@/lib/player-utils';

interface GroupTeamRosterPlayerProps {
    player: DetailedTeamPlayer;
    team: GroupTeam;
    onPlayerUpdate?: () => void;
    index?: number;
}

export const GroupTeamRosterPlayer = ({ player, team, onPlayerUpdate, index = 0 }: GroupTeamRosterPlayerProps) => {
    const { Icon, textColor } = positionConfig[player.position];
    const ovrLevel = getOvrLevel(player.ovr);
    const staggerDelay = index * 0.03;

    return (
        <AnimatedCardWrapper animation="slide" delay={staggerDelay}>
            <Card className={cn(
                "flex flex-col items-center text-center p-3 gap-2 transition-shadow relative",
                // NEW: Subtle holographic effect (only on dark theme)
                "game:holo-effect",
                // NEW: Hover effects with shadows by tier (lighter version, only on dark theme)
                "hover:shadow-md",
                ovrLevel === 'elite' && "game:hover:border-purple-500/50 game:hover:shadow-lg game:hover:shadow-purple-500/30",
                ovrLevel === 'gold' && "game:hover:border-yellow-500/50 game:hover:shadow-lg game:hover:shadow-yellow-500/30",
                ovrLevel === 'silver' && "game:hover:border-gray-400/50 game:hover:shadow-lg game:hover:shadow-gray-400/30",
                ovrLevel === 'bronze' && "game:hover:border-amber-700/50 game:hover:shadow-lg game:hover:shadow-amber-700/30",
            )}>
            <div className="absolute top-1 right-1">
                <SetPlayerStatusDialog player={player} team={team} onPlayerUpdate={onPlayerUpdate}>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                        <MoreVertical className="h-4 w-4" />
                    </Button>
                </SetPlayerStatusDialog>
            </div>

            {/* NEW: Tiny jersey indicator (only on dark theme) */}
            {team.jersey && (
                <div className="hidden game:block absolute top-1 left-1 opacity-30 z-0">
                    <JerseyPreview jersey={team.jersey} size="xs" />
                </div>
            )}

            <div className="relative mt-4">
                <PlayerPhoto player={player as any} size="compact" />
                <Badge className="absolute -bottom-2 -right-2 text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center border-2 border-background">
                    {player.number}
                </Badge>
            </div>
            <div className="flex flex-col items-center">
                <div className="flex items-center gap-2">
                    <Icon className={cn("h-5 w-5 rounded-full border-2 p-0.5", textColor)} />
                    <p className="font-bold truncate w-24 text-base">{player.name}</p>
                </div>
                <div className="flex items-center justify-center gap-2 mt-1">
                    <PlayerOvr value={player.ovr} size="compact" />
                    <PlayerPositionBadge position={player.position} size="sm" />
                </div>
            </div>
        </Card>
        </AnimatedCardWrapper>
    );
};
