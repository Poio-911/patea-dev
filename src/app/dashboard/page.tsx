
'use client';

import { Suspense } from 'react';
import { useCollection } from '@/firebase';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Star, Users2, Calendar, MapPin, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirestore } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { useUser } from '@/firebase';
import { useMemo } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { Player, Match } from '@/lib/types';
import { NextMatchCard } from '@/components/next-match-card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Separator } from '@/components/ui/separator';
import { SoccerPlayerIcon } from '@/components/icons/soccer-player-icon';
import { WelcomeDialog } from '@/components/welcome-dialog';

const statusConfig: Record<Match['status'], { label: string; className: string }> = {
    upcoming: { label: 'Próximo', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' },
    active: { label: 'Activo', className: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' },
    completed: { label: 'Finalizado', className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' },
    evaluated: { label: 'Evaluado', className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300' },
};

function DashboardContent() {
  const { user } = useUser();
  const firestore = useFirestore();

  const playersQuery = useMemo(() => {
    if (!firestore || !user?.activeGroupId) return null;
    return query(collection(firestore, 'players'), where('groupId', '==', user.activeGroupId));
  }, [firestore, user?.activeGroupId]);

  const groupMatchesQuery = useMemo(() => {
    if (!firestore || !user?.activeGroupId) return null;
    return query(collection(firestore, 'matches'), where('groupId', '==', user.activeGroupId), orderBy('date', 'desc'));
  }, [firestore, user?.activeGroupId]);
  
  const joinedMatchesQuery = useMemo(() => {
    if (!firestore || !user?.uid) return null;
    return query(
        collection(firestore, 'matches'),
        where('playerUids', 'array-contains', user.uid)
    );
  }, [firestore, user?.uid]);


  const { data: groupMatches, loading: groupMatchesLoading } = useCollection<Match>(groupMatchesQuery);
  const { data: joinedMatches, loading: joinedMatchesLoading } = useCollection<Match>(joinedMatchesQuery);


  const { data: players, loading: playersLoading } = useCollection<Player>(playersQuery);
  
  const matches = useMemo(() => {
    if (!groupMatches && !joinedMatches) return null;
    
    const allMatchesMap = new Map<string, Match>();
    
    // Add all matches from the active group first
    (groupMatches || []).forEach(match => allMatchesMap.set(match.id, match));

    // Add joined matches (public or from other groups), avoiding duplicates
    (joinedMatches || []).forEach(match => {
        if (!allMatchesMap.has(match.id)) {
            allMatchesMap.set(match.id, match);
        }
    });

    return Array.from(allMatchesMap.values()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [groupMatches, joinedMatches]);

  const loading = playersLoading || groupMatchesLoading || joinedMatchesLoading;

  const { nextMatch, recentMatches } = useMemo(() => {
    if (!matches) return { nextMatch: null, recentMatches: [] };
    
    const upcoming = matches
      .filter(m => m.status === 'upcoming')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const recent = matches.filter(m => m.status !== 'upcoming').slice(0, 2);

    return {
      nextMatch: upcoming[0] || null,
      recentMatches: recent,
    };
  }, [matches]);

  const top5Players = useMemo(() => {
    if (!players) return [];
    return [...players].sort((a, b) => b.ovr - a.ovr).slice(0, 5);
  }, [players]);


  if (loading) {
    return <div>Cargando...</div>;
  }
  
  if (!user?.activeGroupId) {
    return (
        <div className="flex flex-col gap-8">
             <PageHeader
                title="El Vestuario"
                description="Bienvenido a tu vestuario virtual."
            />
            <Alert>
                <Users2 className="h-4 w-4" />
                <AlertTitle>¡Bienvenido, Capitán!</AlertTitle>
                <AlertDescription>
                    Parece que es tu primera vez acá. Para arrancar, armá tu primer grupo o metete en uno que ya exista.
                    <Button asChild variant="link" className="p-0 h-auto ml-1">
                        <Link href="/groups">Ir a Grupos</Link>
                    </Button>
                </AlertDescription>
            </Alert>
        </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <WelcomeDialog />
      <PageHeader
        title="El Vestuario"
        description="Un pantallazo de cómo está el cuadro."
      />
      

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle className="text-primary">Se Juega</CardTitle>
                </CardHeader>
                <CardContent>
                    <NextMatchCard match={nextMatch} />
                </CardContent>
            </Card>
            
            <Card>
                <CardHeader>
                    <CardTitle>Partidos Anteriores</CardTitle>
                    <CardDescription>Los últimos resultados del grupo.</CardDescription>
                </CardHeader>
                <CardContent>
                    {recentMatches.length > 0 ? (
                        <div className="space-y-4">
                            {recentMatches.map((match, index) => {
                                const statusInfo = statusConfig[match.status];
                                const owner = players?.find(p => p.id === match.ownerUid)
                                const ownerName = owner?.name || (match.ownerUid === user?.uid ? user.displayName : null) || 'Organizador';
                                
                                return (
                                    <div key={match.id}>
                                        <div className="flex justify-between items-start gap-4">
                                            <div className="flex-1">
                                                <p className="font-semibold">{match.title}</p>
                                                <div className="flex flex-col sm:flex-row sm:items-center sm:flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <Calendar className="h-3.5 w-3.5" />
                                                        <span>{format(new Date(match.date), "d MMM, yyyy", { locale: es })}</span>
                                                    </div>
                                                     <div className="flex items-center gap-1.5">
                                                        <User className="h-3.5 w-3.5" />
                                                        <span>{ownerName || 'Desconocido'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <Badge variant="outline" className={cn("text-xs shrink-0", statusInfo.className)}>{statusInfo.label}</Badge>
                                        </div>
                                        {index < recentMatches.length - 1 && <Separator className="mt-4" />}
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center text-center border-2 border-dashed border-muted-foreground/30 rounded-xl p-12">
                            <Calendar className="h-12 w-12 text-muted-foreground/50" />
                            <h2 className="mt-4 text-xl font-semibold">Sin Partidos Anteriores</h2>
                            <p className="mt-2 text-sm text-muted-foreground">
                                Aún no se ha completado ningún partido en este grupo.
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>

        {/* Side column */}
        <div className="lg:col-span-1 space-y-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Star className="h-5 w-5 text-primary" />
                    Los Cracks del Grupo
                </CardTitle>
                <CardDescription>El Top 5 de jugadores por OVR.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {top5Players.length > 0 ? top5Players.map((player, index) => (
                    <div key={player.id} className="flex items-center gap-4">
                      <div className="text-muted-foreground font-bold w-4">{index + 1}.</div>
                      <Avatar className="h-10 w-10 border-2 border-primary/50">
                        <AvatarImage src={player.photoUrl} alt={player.name} data-ai-hint="player portrait" />
                        <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-semibold">{player.name}</p>
                        <p className="text-sm text-muted-foreground">{player.position}</p>
                      </div>
                      <div className="text-lg font-bold text-primary">{player.ovr}</div>
                    </div>
                  )) : <p className="text-sm text-muted-foreground text-center py-4">Aún no hay jugadores en este grupo.</p>}
                </div>
              </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <SoccerPlayerIcon className="h-5 w-5 text-primary" />
                        Plantel
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-4xl font-bold">{players?.length || 0}</div>
                    <p className="text-xs text-muted-foreground">jugadores en el grupo</p>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}


export default function DashboardPage() {
    return (
        <Suspense fallback={<div>Cargando...</div>}>
            <DashboardContent />
        </Suspense>
    )
}
