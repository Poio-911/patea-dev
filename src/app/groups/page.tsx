
'use client';

import { useMemo, useState } from 'react';
import { useUser, useFirestore, useCollection, useDoc } from '@/firebase';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  doc
} from 'firebase/firestore';
import type { Player, Match, Group } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Loader2, Users2, Copy, PlusCircle, LogIn, Shield, Newspaper, BarChart2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TeamList } from '@/components/team-builder/team-list';
import { GroupStatsCards } from '@/components/groups/group-stats-cards';
import { UpcomingMatchesFeed } from '@/components/groups/upcoming-matches-feed';
import { FriendlyMatchCard } from '@/components/friendly-match-card';
import { FirstTimeInfoDialog } from '@/components/first-time-info-dialog';
import { motion } from 'framer-motion';
import { GroupSwitcher } from '@/components/group-switcher';
import { CreateGroupDialog, JoinGroupDialog } from '@/components/groups/group-dialogs';
import { useToast } from '@/hooks/use-toast';
import { WhatsAppIcon } from '@/components/icons/whatsapp-icon';
import { cn } from '@/lib/utils';

export default function GroupsPage() {
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [joinGroupOpen, setJoinGroupOpen] = useState(false);

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

  const friendlyMatchesQuery = useMemo(() => {
    if (!firestore || !user?.activeGroupId) return null;
    return query(
      collection(firestore, 'matches'),
      where('type', '==', 'intergroup_friendly'),
      where('groupId', '==', user.activeGroupId)
    );
  }, [firestore, user?.activeGroupId]);
  const { data: friendlyMatches, loading: friendlyMatchesLoading } = useCollection<Match>(friendlyMatchesQuery);

  const activeGroupRef = useMemo(() => {
    if (!firestore || !user?.activeGroupId) return null;
    return doc(firestore, 'groups', user.activeGroupId);
  }, [firestore, user?.activeGroupId]);
  const { data: activeGroup, loading: groupLoading } = useDoc<Group>(activeGroupRef);

  const loading = userLoading || playersLoading || matchesLoading || friendlyMatchesLoading || groupLoading;

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: '¡Copiado!', description: 'Código de invitación copiado al portapapeles.' });
  };

  const whatsAppShareText = useMemo(() => {
    if (!activeGroup) return '';
    const message = `¡Sumate a nuestro grupo de fútbol "${activeGroup.name}" en Pateá! Usá este código para unirte: ${activeGroup.inviteCode}`;
    return encodeURIComponent(message);
  }, [activeGroup]);

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="flex flex-col gap-6">
        <FirstTimeInfoDialog
            featureKey="hasSeenGroupsInfoV2"
            title="¡Bienvenid@ a tus Grupos!"
            description="Esta es tu central de operaciones. Desde aquí podés cambiar tu grupo activo, crear nuevos o unirte a otros. Debajo verás toda la info del grupo que tengas seleccionado, ¡incluyendo los equipos que podés crear!"
        />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <PageHeader title="Mis Grupos" />
          <div className="flex items-center gap-2">
            <Button onClick={() => setJoinGroupOpen(true)} variant="outline">
              <LogIn className="mr-2 h-4 w-4" />
              Unirse a Grupo
            </Button>
            <Button onClick={() => setCreateGroupOpen(true)}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Crear Grupo
            </Button>
          </div>
        </div>

        {loading ? (
            <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
        ) : !user?.activeGroupId || !activeGroup ? (
            <Alert className="text-center py-10">
              <Users2 className="h-6 w-6 mx-auto mb-2" />
              <AlertTitle>No hay un grupo activo</AlertTitle>
              <AlertDescription>Creá un grupo o unite a uno para empezar.</AlertDescription>
            </Alert>
        ) : (
          <motion.div
            key={user.activeGroupId}
            variants={container}
            initial="hidden"
            animate="show"
            className="space-y-6"
          >
            {/* Group Switcher Card - Destacada con gradiente sutil */}
            <motion.div variants={item}>
              <Card className="relative overflow-hidden border-2">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-accent/5 to-transparent opacity-50" />
                <CardContent className="relative p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-3">
                        <Users2 className="h-6 w-6 text-primary" />
                        <h2 className="text-2xl font-bold">{activeGroup.name}</h2>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-muted-foreground">Código:</p>
                        <code className="text-sm font-bold font-mono bg-background/80 px-3 py-1.5 rounded-md border">{activeGroup.inviteCode}</code>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleCopyCode(activeGroup.inviteCode)}>
                          <Copy className="h-4 w-4"/>
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                      <div className="w-full sm:w-auto">
                        <GroupSwitcher />
                      </div>
                      <Button asChild className="bg-[#25D366] hover:bg-[#25D366]/90 text-white">
                        <a href={`https://wa.me/?text=${whatsAppShareText}`} target="_blank" rel="noopener noreferrer">
                          <WhatsAppIcon className="mr-2 h-4 w-4"/>
                          Compartir
                        </a>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Layout de 3 columnas responsive */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Columna 1: Estadísticas */}
              <motion.div variants={item} className="lg:col-span-1 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <BarChart2 className="h-5 w-5 text-primary" />
                      Estadísticas
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <GroupStatsCards players={groupPlayers || []} />
                  </CardContent>
                </Card>
              </motion.div>

              {/* Columna 2: Equipos */}
              <motion.div variants={item} className="lg:col-span-1">
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Shield className="h-5 w-5 text-primary" />
                      Equipos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TeamList groupId={user.activeGroupId} players={groupPlayers || []} currentUserId={user.uid} compact={true} />
                  </CardContent>
                </Card>
              </motion.div>

              {/* Columna 3: Próximos Partidos */}
              <motion.div variants={item} className="lg:col-span-1 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Newspaper className="h-5 w-5 text-primary" />
                      Próximos Partidos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <UpcomingMatchesFeed matches={upcomingMatches || []} compact={true} />
                  </CardContent>
                </Card>

                {friendlyMatches && friendlyMatches.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        Partidos Amistosos
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {friendlyMatches.map(match => (
                        <FriendlyMatchCard key={match.id} match={match} />
                      ))}
                    </CardContent>
                  </Card>
                )}
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* Diálogos */}
        <CreateGroupDialog open={createGroupOpen} onOpenChange={setCreateGroupOpen}>
          <></>
        </CreateGroupDialog>
        <JoinGroupDialog open={joinGroupOpen} onOpenChange={setJoinGroupOpen}>
          <></>
        </JoinGroupDialog>
    </div>
  );
}
