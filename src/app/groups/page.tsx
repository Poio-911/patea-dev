
'use client';

import { useMemo } from 'react';
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
import { Loader2, Users2, Swords, BarChart2, Shield, Copy } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { TeamList } from '@/components/team-builder/team-list';
import { GroupStatsCards } from '@/components/groups/group-stats-cards';
import { UpcomingMatchesFeed } from '@/components/groups/upcoming-matches-feed';
import { FriendlyMatchCard } from '@/components/friendly-match-card';
import { FirstTimeInfoDialog } from '@/components/first-time-info-dialog';
import { motion } from 'framer-motion';
import { GroupSwitcher } from '@/components/group-switcher';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GroupsFab } from '@/components/groups/groups-fab';
import { useToast } from '@/hooks/use-toast';
import { WhatsAppIcon } from '@/components/icons/whatsapp-icon';

export default function GroupsPage() {
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
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
        ) : !user?.activeGroupId || !activeGroup ? (
            <Alert className="text-center py-10">
              <Users2 className="h-6 w-6 mx-auto mb-2" />
              <AlertTitle>No hay un grupo activo</AlertTitle>
              <AlertDescription>Creá un grupo o unite a uno para empezar.</AlertDescription>
            </Alert>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border bg-card">
              <div>
                  <h2 className="text-xl font-bold">{activeGroup.name}</h2>
                  <div className="flex items-center gap-2 mt-2">
                      <p className="text-sm text-muted-foreground">Código:</p>
                      <code className="text-sm font-bold font-mono bg-muted px-2 py-1 rounded-md">{activeGroup.inviteCode}</code>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleCopyCode(activeGroup.inviteCode)}>
                          <Copy className="h-4 w-4"/>
                      </Button>
                  </div>
              </div>
              <Button asChild size="sm" className="bg-[#25D366] hover:bg-[#25D366]/90 text-white">
                  <a href={`https://wa.me/?text=${whatsAppShareText}`} target="_blank" rel="noopener noreferrer">
                      <WhatsAppIcon className="mr-2 h-4 w-4"/>
                      Compartir Grupo
                  </a>
              </Button>
            </div>
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
                <TabsContent value="matches" className="mt-6 space-y-8">
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Próximos Partidos</h3>
                    <UpcomingMatchesFeed matches={upcomingMatches || []} />
                  </div>

                  {friendlyMatches && friendlyMatches.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Swords className="h-5 w-5 text-primary" />
                        Partidos Amistosos
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {friendlyMatches.map(match => (
                          <FriendlyMatchCard key={match.id} match={match} />
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="stats" className="mt-6">
                  <GroupStatsCards players={groupPlayers || []} />
                </TabsContent>
              </motion.div>
            </Tabs>
          </>
        )}

        <GroupsFab />
    </div>
  );
}
