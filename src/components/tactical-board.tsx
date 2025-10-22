
'use client';

import type { GroupTeam, Player } from '@/lib/types';
import { JerseyIcon } from './icons/jersey-icon';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"


type FormationLayout = {
  [key: string]: { gridArea: string }[];
};

const formationLayouts: Record<string, FormationLayout> = {
  '4-4-2': {
    DEL: [{ gridArea: 'fwd1' }, { gridArea: 'fwd2' }],
    MED: [{ gridArea: 'mid1' }, { gridArea: 'mid2' }, { gridArea: 'mid3' }, { gridArea: 'mid4' }],
    DEF: [{ gridArea: 'def1' }, { gridArea: 'def2' }, { gridArea: 'def3' }, { gridArea: 'def4' }],
    POR: [{ gridArea: 'gk' }],
  },
  '4-3-3': {
    DEL: [{ gridArea: 'fwd1' }, { gridArea: 'fwd2' }, { gridArea: 'fwd3' }],
    MED: [{ gridArea: 'mid1' }, { gridArea: 'mid2' }, { gridArea: 'mid3' }],
    DEF: [{ gridArea: 'def1' }, { gridArea: 'def2' }, { gridArea: 'def3' }, { gridArea: 'def4' }],
    POR: [{ gridArea: 'gk' }],
  },
  '3-5-2': {
    DEL: [{ gridArea: 'fwd1' }, { gridArea: 'fwd2' }],
    MED: [{ gridArea: 'mid1' }, { gridArea: 'mid2' }, { gridArea: 'mid3' }, { gridArea: 'mid4' }, { gridArea: 'mid5' }],
    DEF: [{ gridArea: 'def1' }, { gridArea: 'def2' }, { gridArea: 'def3' }],
    POR: [{ gridArea: 'gk' }],
  },
   '5-3-2': {
    DEL: [{ gridArea: 'fwd1' }, { gridArea: 'fwd2' }],
    MED: [{ gridArea: 'mid1' }, { gridArea: 'mid2' }, { gridArea: 'mid3' }],
    DEF: [{ gridArea: 'def1' }, { gridArea: 'def2' }, { gridArea: 'def3' }, { gridArea: 'def4' }, { gridArea: 'def5' }],
    POR: [{ gridArea: 'gk' }],
  },
   '4-5-1': {
    DEL: [{ gridArea: 'fwd1' }],
    MED: [{ gridArea: 'mid1' }, { gridArea: 'mid2' }, { gridArea: 'mid3' }, { gridArea: 'mid4' }, { gridArea: 'mid5' }],
    DEF: [{ gridArea: 'def1' }, { gridArea: 'def2' }, { gridArea: 'def3' }, { gridArea: 'def4' }],
    POR: [{ gridArea: 'gk' }],
  },
};

const PlayerMarker = ({ player, team }: { player: Player & { number: number }, team: GroupTeam }) => (
    <TooltipProvider>
        <Tooltip>
            <TooltipTrigger>
                 <div className="flex flex-col items-center gap-1">
                    <div className="h-10 w-10">
                        <JerseyIcon {...team.jersey} number={player.number} />
                    </div>
                    <span className="text-[10px] font-bold text-white bg-black/50 px-1 rounded-sm truncate max-w-[60px]">
                        {player.name}
                    </span>
                </div>
            </TooltipTrigger>
            <TooltipContent>
                <p>{player.name} (#{player.number}) - OVR: {player.ovr}</p>
            </TooltipContent>
        </Tooltip>
    </TooltipProvider>
);

export function TacticalBoard({ team, players }: { team: GroupTeam, players: (Player & { number: number })[] }) {
  const layout = formationLayouts[team.formation] || formationLayouts['4-4-2'];

  const playerPositions: Record<string, (Player & { number: number; })[]> = {
    POR: [], DEF: [], MED: [], DEL: [],
  };

  players.forEach(p => {
    if (playerPositions[p.position]) {
      playerPositions[p.position].push(p);
    }
  });

  const assignedPlayers: JSX.Element[] = [];

  Object.keys(layout).forEach(position => {
    const spots = layout[position];
    const playersForPos = playerPositions[position as keyof typeof playerPositions];
    
    spots.forEach((spot, index) => {
      const player = playersForPos[index];
      if (player) {
        assignedPlayers.push(
          <div key={player.id} style={{ gridArea: spot.gridArea }}>
            <PlayerMarker player={player} team={team} />
          </div>
        );
      }
    });
  });

  return (
    <div className="relative aspect-[7/10] w-full bg-green-600 rounded-md overflow-hidden border-4 border-white/30">
        {/* Pitch markings */}
        <div className="absolute inset-0 border-4 border-white/30"></div>
        <div className="absolute top-1/2 left-0 right-0 h-1 -translate-y-1/2 bg-white/30"></div>
        <div className="absolute top-1/2 left-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white/30"></div>
        <div className="absolute top-[calc(50%-1px)] left-[calc(50%-1px)] h-2 w-2 rounded-full bg-white/30"></div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-24 w-1/2 border-4 border-white/30 border-t-0 rounded-b-xl"></div>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-24 w-1/2 border-4 border-white/30 border-b-0 rounded-t-xl"></div>
        
        {/* Grid for player positions */}
        <div
            className="absolute inset-0 grid h-full w-full p-4"
            style={{
                gridTemplateRows: 'repeat(12, 1fr)',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gridTemplateAreas: `
                ".   fwd3 fwd1 fwd2  ."
                ".   .    .    .     ."
                "mid5 mid3 mid1 mid2 mid4"
                ".   .    .    .     ."
                ".   .    .    .     ."
                ".   .    .    .     ."
                "def5 .    .    .  def4"
                "def3 .    .    .  def2"
                ".   .   def1  .     ."
                ".   .    .    .     ."
                ".   .    .    .     ."
                ".   .    gk   .     ."
                `,
            }}
        >
            {assignedPlayers}
        </div>
    </div>
  );
}
