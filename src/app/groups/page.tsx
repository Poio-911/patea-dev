
'use client';

import { useMemo } from 'react';
import { useUser, useFirestore, useDoc, useCollection } from '@/firebase';
import {
  collection,
  query,
  where,
  doc,
  orderBy,
  limit
} from 'firebase/firestore';
import type { Group, Player, Match } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Loader2, Users2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { TeamList } from '@/components/team-builder/team-list';
import { GroupStatsCards } from '@/components/groups/group-stats-cards';
import { UpcomingMatchesFeed } from '@/components/groups/upcoming-matches-feed';
import { FirstTimeInfoDialog } from '@/components/first-time-info-dialog';
import { Separator } from '@/components/ui/separator';
import { motion } from 'framer-motion';
import { GroupsFab } from '@/components/groups/groups-fab';
import { UserGroupsList } from '@/components/groups/user-groups-list';
import { Card, CardContent } from '@/components/ui/card';
import { GroupSwitcher } from '@/components/group-switcher';
import { CreateGroupDialog, JoinGroupDialog } from '@/components/groups/group-dialogs';

export default function GroupsPage() {
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();
  
  const activeGroupRef = useMemo(() => {
    if (!firestore || !user?.activeGroupId) return null;
    return doc(firestore, 'groups', user.activeGroupId);
  }, [firestore, user?.activeGroupId]);
  const { data: activeGroup, loading: activeGroupLoading } = useDoc<Group>(activeGroupRef);

  const groupPlayersQuery = useMemo(() => {
    if (!firestore || !user?.activeGroupId) return null;
    return query(collection(firestore, 'players'), where('groupId', '==', user.activeGroupId));
  }, [firestore, user?.activeGroupId]);
  const { data: groupPlayers, loading: playersLoading } = useCollection<Player>(groupPlayersQuery);
  
  const groupMatchesQuery = useMemo(() => {
    if (!firestore || !user?.activeGroupId) return null;
    return query(collection(firestore, 'matches'), where('groupId', '==', user.activeGroupId), where('status', '==', 'upcoming'), orderBy('date', 'asc'), limit(3));
  }, [firestore, user?.activeGroupId]);
  const { data: upcomingMatches, loading: matchesLoading } = useCollection<Match>(groupMatchesQuery);

  const loading = userLoading || activeGroupLoading || playersLoading || matchesLoading;
  
  return (
    <div className="flex flex-col gap-8">
        <FirstTimeInfoDialog
            featureKey="hasSeenGroupsInfo"
            title="¡Bienvenid@ a tus Grupos!"
            description="Esta es tu central de operaciones. Desde aquí podés cambiar tu grupo activo, crear nuevos o unirte a otros. Debajo verás toda la info del grupo que tengas seleccionado, ¡incluyendo los equipos que podés crear!"
        />
        
        <PageHeader title="Mis Grupos" />

        <Card>
            <CardContent className="p-4 flex flex-col sm:flex-row gap-4 justify-between items-center">
                <div className="w-full sm:w-auto sm:min-w-[250px]">
                    <GroupSwitcher />
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <CreateGroupDialog>
                        <Button variant="outline" className="w-full">Crear Grupo</Button>
                    </CreateGroupDialog>
                    <JoinGroupDialog>
                        <Button className="w-full">Unirse a Grupo</Button>
                    </JoinGroupDialog>
                </div>
            </CardContent>
        </Card>
      
        {loading ? (
            <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
        ) : !activeGroup || !user ? (
            <Alert className="text-center py-10">
              <Users2 className="h-6 w-6 mx-auto mb-2" />
              <AlertTitle>No hay un grupo activo</AlertTitle>
              <AlertDescription>Creá un grupo o unite a uno para empezar.</AlertDescription>
            </Alert>
        ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="space-y-8"
            >
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                    <TeamList groupId={activeGroup.id} players={groupPlayers || []} currentUserId={user.uid} />
                </motion.div>
                
                <Separator />

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                    <UpcomingMatchesFeed matches={upcomingMatches || []} />
                </motion.div>
                
                <Separator />

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                    <GroupStatsCards players={groupPlayers || []} />
                </motion.div>
            </motion.div>
        )}
    </div>
  );
}
