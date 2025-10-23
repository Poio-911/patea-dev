
'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useDoc, useCollection, useFirestore } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import type { GroupTeam, Player, GroupTeamMember } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Loader2, Users, ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { TeamRosterPlayer } from '@/components/team-roster-player';
import { JerseyPreview } from '@/components/team-builder/jersey-preview';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

type DetailedTeamPlayer = Player & { number: number };

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
    if (loading || !team || !groupPlayers || !team.members) return [];

    return team.members
      .map((member: GroupTeamMember) => {
        const playerDetails = groupPlayers.find((p: Player) => p.id === member.playerId);
        if (!playerDetails) return null;
        return { 
          ...playerDetails, 
          number: member.number !== undefined ? member.number : 0 
        };
      })
      .filter((p: DetailedTeamPlayer | null): p is DetailedTeamPlayer => p !== null)
      .sort((a: DetailedTeamPlayer, b: DetailedTeamPlayer) => a.number - b.number);
      
  }, [team, groupPlayers, loading]);

  if (loading) {
    return <div className="flex justify-center items-center h-full"><Loader2 className="h-12 w-12 animate-spin" /></div>;
  }

  if (!team) {
    return <div className="text-center">No se encontró el equipo.</div>;
  }
  
  const memberCount = team.members?.length || 0;

  return (
    <div className="flex flex-col gap-8">
        <div className="flex w-full items-center justify-between">
            <Button asChild variant="outline" className="self-start">
                <Link href="/groups">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Volver a Grupos
                </Link>
            </Button>
        </div>

        <div className="flex flex-col items-center text-center gap-4">
            {team.jersey && (
              <div className="h-20 w-20 flex items-center justify-center overflow-hidden">
                <JerseyPreview jersey={team.jersey} size="md" />
              </div>
            )}
            <div className="flex flex-col items-center gap-2">
                <PageHeader title={team.name} className="justify-center text-center" />
                <Badge variant="outline" className="text-sm">
                    <Users className="mr-2 h-4 w-4"/>
                    {memberCount} Jugadores
                </Badge>
            </div>
        </div>
        
        <div className="space-y-4">
             <h2 className="text-xl font-bold">Plantel</h2>
             <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {teamPlayersWithDetails.map((player: DetailedTeamPlayer) => (
                    <TeamRosterPlayer key={player.id} player={player} number={player.number} />
                ))}
             </div>
        </div>
    </div>
  );
}
