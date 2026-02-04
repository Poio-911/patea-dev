'use client';

import { useMemo } from 'react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { GroupTeam, Player } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shirt } from 'lucide-react';
import { JerseyPreview } from '@/components/team-builder/jersey-preview';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

interface PlayerTeamsListProps {
    playerId: string;
    groupId: string | null;
}

export function PlayerTeamsList({ playerId, groupId }: PlayerTeamsListProps) {
    const firestore = useFirestore();

    const teamsQuery = useMemo(() => {
        if (!firestore || !groupId) return null;
        return query(collection(firestore, 'teams'), where('groupId', '==', groupId));
    }, [firestore, groupId]);

    const { data: allTeams, loading } = useCollection<GroupTeam>(teamsQuery);

    const playerTeams = useMemo(() => {
        if (!allTeams) return [];
        return allTeams.filter(team =>
            team.members.some(member => member.playerId === playerId)
        );
    }, [allTeams, playerId]);

    if (loading) return null; // Or skeleton
    if (playerTeams.length === 0) return null;

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Shirt className="h-5 w-5 text-primary" />
                    Equipos Actuales
                </CardTitle>
            </CardHeader>
            <CardContent>
                <ScrollArea className="w-full whitespace-nowrap rounded-md border">
                    <div className="flex w-max space-x-4 p-4">
                        {playerTeams.map((team) => {
                            const memberInfo = team.members.find(m => m.playerId === playerId);

                            return (
                                <div key={team.id} className="flex flex-col items-center gap-2 w-[100px]">
                                    <div className="relative">
                                        <JerseyPreview jersey={team.jersey} size="md" />
                                        <Badge
                                            variant="secondary"
                                            className="absolute -bottom-2 -right-2 h-6 w-6 flex items-center justify-center rounded-full p-0 text-xs shadow-sm border-2 border-background"
                                        >
                                            {memberInfo?.number || '#'}
                                        </Badge>
                                    </div>
                                    <span className="text-xs font-medium truncate w-full text-center" title={team.name}>
                                        {team.name}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
