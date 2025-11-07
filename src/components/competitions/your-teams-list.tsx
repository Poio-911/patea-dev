
'use client';

import { GroupTeam, Player } from '@/lib/types';
import { motion } from 'framer-motion';
import { TeamCard } from './team-card'; // We'll create this new card component

interface YourTeamsListProps {
    teams: GroupTeam[];
    players: Player[];
}

const listVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export function YourTeamsList({ teams, players }: YourTeamsListProps) {
    
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <div>
                    <h2 className="text-2xl font-bold">Mis Equipos</h2>
                    <p className="text-sm text-muted-foreground">
                        Seleccioná uno de tus equipos para buscarle un rival.
                    </p>
                </div>
            </div>
            <motion.div 
                className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
                variants={listVariants}
                initial="hidden"
                animate="visible"
            >
                {teams.map(team => {
                    const teamPlayers = players.filter(p => team.members.some(m => m.playerId === p.id));
                    return (
                        <motion.div key={team.id} variants={itemVariants}>
                            <TeamCard team={team} players={teamPlayers} />
                        </motion.div>
                    )
                })}
            </motion.div>
        </div>
    )
}
