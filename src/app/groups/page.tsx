
'use client';

import { useMemo } from 'react';
import { useUser, useFirestore, useCollection } from '@/firebase';
import {
  collection,
  query,
  where,
  orderBy,
  limit
} from 'firebase/firestore';
import type { Player, Match } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Loader2, Users2, Swords, BarChart2, Shield } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { TeamList } from '@/components/team-builder/team-list';
import { GroupStatsCards } from '@/components/groups/group-stats-cards';
import { UpcomingMatchesFeed } from '@/components/groups/upcoming-matches-feed';
import { FirstTimeInfoDialog } from '@/components/first-time-info-dialog';
import { motion } from 'framer-motion';
import { GroupSwitcher } from '@/components/group-switcher';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GroupsFab } from '@/components/groups/groups-fab';

export default function GroupsPage() {
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();
  
  const groupPlayersQuery = useMemo(() => {
    if (!firestore || !user?.activeGroupId) return null;
    return query(collection(firestore, 'players'), where('groupId', '==', user.activeGroupId));
  }, [firestore, user?.activeGroupId]);
  const { data: groupPlayers, loading: playersLoading } = useCollection<Player>(groupPlayersQuery);
  
  const groupMatchesQuery = useMemo(() => {
    if (!firestore || !user?.activeGroupId) return null;
    return query(collection(firestore, 'matches'), where('groupId', '==', user.activeGroupId), where('status', '==', 'upcoming'), orderBy('date', 'asc'), limit(5));
  }, [firestore, user?.activeGroupId]);
  const { data: upcomingMatches, loading: matchesLoading } = useCollection<Match>(groupMatchesQuery);

  const loading = userLoading || playersLoading || matchesLoading;
  
  return (
    <div className="flex flex-col gap-6">
        <FirstTimeInfoDialog
            featureKey="hasSeenGroupsInfoV2"
            title="¡Bienvenid@ a tus Grupos!"
            description="Esta es tu central de operaciones. Desde aquí podés cambiar tu grupo activo, crear nuevos o unirte a otros. Debajo verás toda la info del grupo que tengas seleccionado, ¡incluyendo los equipos que podés crear!"
        />
        
        <PageHeader title="Mis Grupos" />

        <div className="w-full sm:max-w-xs">
          <GroupSwitcher />
        </div>
      
        {loading ? (
            <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
        ) : !user?.activeGroupId ? (
            <Alert className="text-center py-10">
              <Users2 className="h-6 w-6 mx-auto mb-2" />
              <AlertTitle>No hay un grupo activo</AlertTitle>
              <AlertDescription>Creá un grupo o unite a uno para empezar.</AlertDescription>
            </Alert>
        ) : (
            <Tabs defaultValue="teams" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="teams"><Shield className="h-4 w-4 mr-2"/>Equipos</TabsTrigger>
                <TabsTrigger value="matches"><Swords className="h-4 w-4 mr-2"/>Partidos</TabsTrigger>
                <TabsTrigger value="stats"><BarChart2 className="h-4 w-4 mr-2"/>Estadísticas</TabsTrigger>
              </TabsList>
              
              <motion.div
                key={user.activeGroupId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <TabsContent value="teams" className="mt-6">
                  <TeamList groupId={user.activeGroupId} players={groupPlayers || []} currentUserId={user.uid} />
                </TabsContent>
                <TabsContent value="matches" className="mt-6">
                  <UpcomingMatchesFeed matches={upcomingMatches || []} />
                </TabsContent>
                <TabsContent value="stats" className="mt-6">
                  <GroupStatsCards players={groupPlayers || []} />
                </TabsContent>
              </motion.div>
            </Tabs>
        )}

        <GroupsFab />
    </div>
  );
}
