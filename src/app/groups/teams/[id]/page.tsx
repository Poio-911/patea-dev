
'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useDoc, useCollection, useFirestore } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import type { GroupTeam, Player } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Loader2, Users } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShirtIcon } from '@/components/icons/shirt-icon';

const TeamRosterPlayer = ({ player, number }: { player: Player; number: number; }) => {
  return (
    <Card className="flex items-center gap-4 p-3">
        <Avatar className="h-12 w-12 border">
          <AvatarImage src={player.photoUrl} alt={player.name} />
          <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
            <p className="font-bold truncate">{player.name}</p>
            <p className="text-sm text-muted-foreground">{player.position}</p>
        </div>
        <div className="flex flex-col items-center">
             <ShirtIcon className="h-5 w-5 text-muted-foreground"/>
             <p className="text-2xl font-bold">#{number}</p>
        </div>
    </Card>
  );
};

export default function TeamDetailPage() {
  const { id: teamId } = useParams();
  const firestore = useFirestore();

  const teamRef = useMemo(() => {
    if (!firestore || !teamId) return null;
    return doc(firestore, 'teams', teamId as string);
  }, [firestore, teamId]);

  const { data: team, loading: teamLoading } = useDoc<GroupTeam>(teamRef);

  const groupPlayersQuery = useMemo(() => {
    if (!firestore || !team?.groupId) return null;
    return query(collection(firestore, 'players'), where('groupId', '==', team.groupId));
  }, [firestore, team?.groupId]);

  const { data: groupPlayers, loading: playersLoading } = useCollection<Player>(groupPlayersQuery);
  
  const loading = teamLoading || playersLoading;

  const teamPlayersWithDetails = useMemo(() => {
    if (loading || !team || !groupPlayers) return [];

    const playerIds = team.members ? team.members.map(m => m.playerId) : (team as any).playerIds || [];

    return playerIds.map((playerId: string, index: number) => {
        const playerDetails = groupPlayers.find(p => p.id === playerId);
        const memberInfo = team.members?.find(m => m.playerId === playerId);
        if (!playerDetails) return null;
        return { ...playerDetails, number: memberInfo?.number || index + 1 };
    }).filter((p): p is Player & { number: number } => p !== null).sort((a,b) => a.number - b.number);

  }, [team, groupPlayers, loading]);
  
  if (loading) {
    return <div className="flex justify-center items-center h-full"><Loader2 className="h-12 w-12 animate-spin" /></div>;
  }

  if (!team) {
    return <div className="text-center">No se encontró el equipo.</div>;
  }

  const memberCount = team.members ? team.members.length : ((team as any).playerIds || []).length;

  return (
    <div className="flex flex-col gap-8">
        <div className="flex flex-row items-center gap-4">
            <div className="h-16 w-16 flex-shrink-0">
                 <ShirtIcon className="h-16 w-16 text-primary" />
            </div>
            <div className="flex-grow">
                <PageHeader title={team.name} />
                <Badge variant="outline" className="mt-2 text-sm">
                    <Users className="mr-2 h-4 w-4"/>
                    {memberCount} Jugadores
                </Badge>
            </div>
        </div>
        
        <div className="space-y-4">
             <h2 className="text-xl font-bold">Plantel</h2>
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {teamPlayersWithDetails.map(player => (
                    <TeamRosterPlayer key={player.id} player={player} number={player.number} />
                ))}
             </div>
        </div>
    </div>
  );
}
