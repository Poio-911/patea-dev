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
import type { Player, Match, Group, GenerateMatchChronicleOutput } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Loader2, Users2, PlusCircle, LogIn, Shield, Newspaper, BarChart2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TeamList } from '@/components/team-builder/team-list';
import { UpcomingMatchesFeed } from '@/components/groups/upcoming-matches-feed';
import { FriendlyMatchCard } from '@/components/friendly-match-card';
import { FirstTimeInfoDialog } from '@/components/first-time-info-dialog';
import { motion } from 'framer-motion';
import { CreateGroupDialog, JoinGroupDialog } from '@/components/groups/group-dialogs';
import { useToast } from '@/hooks/use-toast';
import { GroupHeroCard } from '@/components/groups/group-hero-card';
import { UserGroupsList } from '@/components/groups/user-groups-list';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Trophy, MessageSquare, History, Medal, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export default function GroupsPage() {
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [joinGroupOpen, setJoinGroupOpen] = useState(false);

  // Queries
  const groupPlayersQuery = useMemo(() => {
    if (!firestore || !user?.activeGroupId) return null;
    return query(collection(firestore, 'players'), where('groupId', '==', user.activeGroupId));
  }, [firestore, user?.activeGroupId]);
  const { data: groupPlayers, loading: playersLoading } = useCollection<Player>(groupPlayersQuery);

  const groupMatchesQuery = useMemo(() => {
    if (!firestore || !user?.activeGroupId) return null;
    return query(collection(firestore, 'matches'), where('groupId', '==', user.activeGroupId), where('status', 'in', ['upcoming', 'planning']), orderBy('date', 'asc'), limit(5));
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

  const recentMatchesQuery = useMemo(() => {
    if (!firestore || !user?.activeGroupId) return null;
    return query(
      collection(firestore, 'matches'),
      where('groupId', '==', user.activeGroupId),
      where('status', '==', 'completed'),
      orderBy('date', 'desc'),
      limit(5)
    );
  }, [firestore, user?.activeGroupId]);
  const { data: recentMatches, loading: recentMatchesLoading } = useCollection<Match>(recentMatchesQuery);

  const activeGroupRef = useMemo(() => {
    if (!firestore || !user?.activeGroupId) return null;
    return doc(firestore, 'groups', user.activeGroupId);
  }, [firestore, user?.activeGroupId]);
  const { data: activeGroup, loading: groupLoading } = useDoc<Group>(activeGroupRef);

  // New query to check if user has ANY groups even if activeGroupId is null
  const userGroupsQuery = useMemo(() => {
    if (!firestore || !user?.uid) return null;
    return query(collection(firestore, 'groups'), where('members', 'array-contains', user.uid));
  }, [firestore, user?.uid]);
  const { data: allUserGroups, loading: allGroupsLoading } = useCollection<Group>(userGroupsQuery);

  const loading = userLoading || playersLoading || matchesLoading || friendlyMatchesLoading || recentMatchesLoading || groupLoading || allGroupsLoading;

  const safeRecentMatches = recentMatches || [];
  const lastMatchWithMVP = safeRecentMatches.find(m => m.bestPlayerId);
  const lastMVPPlayer = lastMatchWithMVP ? groupPlayers?.find(p => p.id === lastMatchWithMVP.bestPlayerId) : null;
  const totalMatches = activeGroup?.stats?.matchesPlayed || safeRecentMatches.length;

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
        <div className="space-y-6">
          <Alert className="bg-primary/5 border-primary/20">
            <Users2 className="h-5 w-5 text-primary" />
            <AlertTitle className="text-primary font-bold">No tenés un grupo seleccionado</AlertTitle>
            <AlertDescription>
              {allUserGroups && allUserGroups.length > 0
                ? "Seleccioná uno de tus grupos debajo para empezar a operar."
                : "Creá un grupo o unite a uno mediante un código para empezar."}
            </AlertDescription>
          </Alert>

          {allUserGroups && allUserGroups.length > 0 ? (
            <div className="space-y-4">
              <h3 className="text-lg font-bold font-headline uppercase tracking-tight flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Tus Grupos Disponibles
              </h3>
              <UserGroupsList />
            </div>
          ) : (
            <Card className="border-dashed py-10 flex flex-col items-center justify-center gap-4">
              <Users2 className="h-10 w-10 text-muted-foreground/50" />
              <div className="text-center space-y-1">
                <p className="font-bold text-lg">Bandeja de Grupos Vacía</p>
                <p className="text-sm text-muted-foreground">Todavía no formas parte de ningún grupo de fútbol.</p>
              </div>
              <div className="flex gap-3">
                <Button onClick={() => setJoinGroupOpen(true)} variant="outline">Unirse a uno</Button>
                <Button onClick={() => setCreateGroupOpen(true)}>Crear el mío</Button>
              </div>
            </Card>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <GroupHeroCard group={activeGroup} />


          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
            {/* Columna Izquierda (Principal - Equipos y Últimos Partidos) */}
            <div className="lg:col-span-8 space-y-4 sm:space-y-6">
              {/* Equipos */}
              <div className="relative overflow-hidden rounded-2xl bg-card/60 backdrop-blur-md border border-white/10 dark:border-white/5 shadow-xl transition-all">
                <div className="p-4 sm:p-5 border-b border-border/50 flex items-center gap-2 text-base uppercase tracking-widest text-primary font-black drop-shadow-sm bg-muted/20">
                  <Shield className="h-5 w-5" />
                  Equipos Guardados
                </div>
                <div className="p-4 sm:p-5">
                  <TeamList groupId={user.activeGroupId} players={groupPlayers || []} currentUserId={user.uid} compact={false} />
                </div>
              </div>

              {/* Últimos Partidos */}
              {safeRecentMatches.length > 0 && (
                <div className="relative overflow-hidden rounded-2xl bg-card/60 backdrop-blur-md border border-white/10 dark:border-white/5 shadow-xl transition-all">
                  <div className="p-4 sm:p-5 border-b border-border/50 flex items-center gap-2 text-base uppercase tracking-widest text-primary font-black drop-shadow-sm bg-muted/20">
                    <History className="h-5 w-5" />
                    Últimos Partidos
                  </div>
                  <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {safeRecentMatches.slice(0, 2).map((match) => (
                      <div key={match.id} className="relative overflow-hidden rounded-xl bg-card border border-border shadow-sm hover:border-primary/40 transition-colors duration-300 group p-4 flex flex-col gap-3">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                        <div className="flex justify-between items-start z-10 gap-2">
                          <div className="space-y-1">
                            <h4 className="font-bold text-base text-foreground leading-tight group-hover:text-primary transition-colors line-clamp-1">{match.title}</h4>
                            <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                              {format(new Date(match.date), "dd 'de' MMMM", { locale: es })}
                            </p>
                          </div>
                          <Badge variant="secondary" className="bg-muted/50 whitespace-nowrap text-[10px]">Finalizado</Badge>
                        </div>

                        {match.chronicle ? (
                          <p className="text-[11px] sm:text-xs text-card-foreground italic line-clamp-2 mt-1 z-10 border-l-2 border-primary/40 pl-2">
                            "{(match.chronicle as GenerateMatchChronicleOutput).story ?? (match.chronicle as GenerateMatchChronicleOutput).headline}"
                          </p>
                        ) : (
                          <div className="text-[11px] sm:text-xs text-muted-foreground flex flex-col gap-1 mt-1 z-10">
                            <span className="flex items-center gap-1.5"><Users2 className="h-3 w-3" /> Formato {match.format}v{match.format}</span>
                            {match.bestPlayerId && <span className="flex items-center gap-1.5 text-amber-500 font-medium"><Trophy className="h-3 w-3" /> MVP EAsignado</span>}
                          </div>
                        )}

                        <Link href={`/matches/${match.id}`} className="absolute top-0 right-0 w-full h-full opacity-0 z-20" aria-label="Ver partido completo" />
                      </div>
                    ))}
                  </div>

                  {safeRecentMatches.length > 2 && (
                    <div className="px-4 pb-4">
                      <Link href="/matches" className="text-sm font-semibold text-primary hover:text-primary/80 flex items-center justify-center group">
                        Ver todo el historial policial <ChevronRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Columna Derecha (Próximos Partidos y Mini Stats) */}
            <div className="lg:col-span-4 space-y-4 sm:space-y-6">

              {/* Quick Stats Group */}
              <div className="relative overflow-hidden rounded-2xl bg-card/60 backdrop-blur-md border border-white/10 dark:border-white/5 shadow-xl transition-all">
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full blur-2xl -mr-8 -mt-8 opacity-70 pointer-events-none" />
                <div className="p-4 sm:p-5 flex flex-col gap-4">
                  <h3 className="font-headline text-sm uppercase tracking-widest text-primary font-black drop-shadow-sm flex items-center gap-2">
                    <BarChart2 className="h-4 w-4" /> La Lupa
                  </h3>

                  <div className="grid grid-cols-2 gap-3 relative z-10">
                    {/* Box 1: Partidos Jugados */}
                    <div className="bg-muted/30 border border-border/50 rounded-xl p-3 flex flex-col items-center justify-center text-center gap-1 shadow-sm hover:border-primary/30 transition-colors">
                      <History className="h-5 w-5 text-muted-foreground mb-1" />
                      <span className="text-[10px] text-muted-foreground font-black uppercase tracking-widest text-center leading-tight">Partidos<br />Totales</span>
                      <span className="text-2xl font-black font-headline text-primary mt-1">{totalMatches}</span>
                    </div>

                    {/* Box 2: Último MVP */}
                    <div className="bg-muted/30 border border-amber-500/20 rounded-xl p-3 flex flex-col items-center justify-center text-center gap-1 shadow-[0_0_10px_rgba(245,158,11,0.05)] hover:border-amber-500/50 transition-colors relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-12 h-12 bg-amber-500/10 rounded-full blur-md -mr-4 -mt-4 opacity-50" />

                      {lastMVPPlayer ? (
                        <>
                          <Avatar className="h-6 w-6 border border-amber-500/50 mb-1 z-10">
                            <AvatarImage src={lastMVPPlayer.photoUrl} alt={lastMVPPlayer.name} />
                            <AvatarFallback className="text-[8px] bg-amber-500/20 text-amber-700">{lastMVPPlayer.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <span className="text-[10px] text-muted-foreground font-black uppercase tracking-widest text-center z-10 leading-tight">Último<br />MVP</span>
                          <span className="text-sm font-bold text-amber-500 truncate w-full px-1 z-10 leading-tight mt-1">{lastMVPPlayer.name.split(' ')[0]}</span>
                        </>
                      ) : (
                        <>
                          <Medal className="h-5 w-5 text-muted-foreground/50 mb-1 z-10" />
                          <span className="text-[10px] text-muted-foreground font-black uppercase tracking-widest text-center z-10 leading-tight">Último<br />MVP</span>
                          <span className="text-xs font-semibold text-muted-foreground mt-1.5 z-10 border-t border-border/50 pt-1 w-full text-center">-</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Próximos Partidos */}
              <div className="relative overflow-hidden rounded-2xl bg-card/60 backdrop-blur-md border border-white/10 dark:border-white/5 shadow-xl transition-all">
                <div className="p-4 sm:p-5 border-b border-border/50 flex items-center gap-2 text-base uppercase tracking-widest text-primary font-black drop-shadow-sm bg-muted/20">
                  <Newspaper className="h-5 w-5" />
                  En Agenda
                </div>
                <div className="p-4 sm:p-5">
                  <UpcomingMatchesFeed matches={upcomingMatches || []} compact={true} />
                </div>
              </div>

              {/* Amistosos */}
              {friendlyMatches && friendlyMatches.length > 0 && (
                <div className="space-y-4">
                  <h3 className="flex items-center gap-2 font-headline text-lg uppercase tracking-widest text-primary font-black drop-shadow-sm px-1">
                    Amistosos Intergrupos
                  </h3>
                  <div className="space-y-3">
                    {friendlyMatches.map(match => (
                      <FriendlyMatchCard key={match.id} match={match} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Diálogos */}
      <CreateGroupDialog open={createGroupOpen} onOpenChange={setCreateGroupOpen}>
        <div />
      </CreateGroupDialog>
      <JoinGroupDialog open={joinGroupOpen} onOpenChange={setJoinGroupOpen}>
        <div />
      </JoinGroupDialog>
    </div>
  );
}
