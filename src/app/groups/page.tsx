
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
import { Loader2, Users2, PlusCircle, LogIn } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { TeamList } from '@/components/team-builder/team-list';
import { WhatsAppIcon } from '@/components/icons/whatsapp-icon';
import { UserGroupsList } from '@/components/groups/user-groups-list';
import { GroupStatsCards } from '@/components/groups/group-stats-cards';
import { UpcomingMatchesFeed } from '@/components/groups/upcoming-matches-feed';
import { FirstTimeInfoDialog } from '@/components/first-time-info-dialog';
<<<<<<< HEAD
import { CreateGroupDialog, JoinGroupDialog } from '@/components/groups/group-dialogs';
import { Separator } from '@/components/ui/separator';
=======
import { motion } from 'framer-motion';
>>>>>>> 0dc5ba21398c98eb64a7ee9065c8a1c496ed7551

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
  
  const shareText = useMemo(() => {
      if (!activeGroup) return '';
      return encodeURIComponent(`¡Sumate a nuestro grupo de fútbol "${activeGroup.name}" en Pateá! Usá este código para unirte: ${activeGroup.inviteCode}`);
  }, [activeGroup]);

  return (
    <div className="flex flex-col gap-8">
        <FirstTimeInfoDialog
            featureKey="hasSeenGroupsInfo"
            title="¡Bienvenid@ a tus Grupos!"
            description="Esta es tu central de operaciones. Desde 'Mis Grupos' podés crear nuevos grupos, unirte a otros, o cambiar tu grupo activo. Debajo verás toda la info del grupo que tengas seleccionado, ¡incluyendo los equipos que podés crear!"
        />
        
        <PageHeader title="Mis Grupos">
          <div className="flex flex-col sm:flex-row gap-2">
              <CreateGroupDialog>
                <Button variant="default">
                    <PlusCircle className="mr-2 h-4 w-4"/>
                    Crear Grupo
                </Button>
              </CreateGroupDialog>
              <JoinGroupDialog>
                <Button variant="outline">
                    <LogIn className="mr-2 h-4 w-4"/>
                    Unirse a Grupo
                </Button>
              </JoinGroupDialog>
          </div>
        </PageHeader>
        <UserGroupsList />
        
        <Separator className="my-4"/>
      
        {loading ? (
            <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
        ) : !activeGroup || !user ? (
            <Alert className="text-center py-10">
              <Users2 className="h-6 w-6 mx-auto mb-2" />
              <AlertTitle>No hay un grupo activo</AlertTitle>
              <AlertDescription>Creá un grupo o unite a uno desde la sección de arriba para empezar.</AlertDescription>
            </Alert>
        ) : (
<<<<<<< HEAD
            <>
                <PageHeader
                    title={activeGroup.name}
                    description={`Gestioná los equipos, estadísticas y partidos de tu grupo activo.`}
=======
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
            >
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
>>>>>>> 0dc5ba21398c98eb64a7ee9065c8a1c496ed7551
                >
                    <PageHeader
                        title={activeGroup.name}
                        description={`Gestioná los equipos, estadísticas y partidos de tu grupo.`}
                    >
                        <Button asChild>
                            <a href={`https://wa.me/?text=${shareText}`} target="_blank" rel="noopener noreferrer">
                                <WhatsAppIcon className="mr-2 h-4 w-4" />
                                Compartir Código
                            </a>
                        </Button>
                    </PageHeader>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                    <TeamList groupId={activeGroup.id} players={groupPlayers || []} currentUserId={user.uid} />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                    <UpcomingMatchesFeed matches={upcomingMatches || []} />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                    <GroupStatsCards players={groupPlayers || []} />
                </motion.div>
            </motion.div>
        )}
    </div>
  );
}
