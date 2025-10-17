
'use client';

import { useCollection } from '@/firebase';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Star, Users2, Calendar, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirestore } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { useUser } from '@/firebase';
import { useMemo } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { Player, Match } from '@/lib/types';
import { BizarreQuoteCard } from '@/components/bizarre-quote-card';
import { NextMatchCard } from '@/components/next-match-card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Separator } from '@/components/ui/separator';
import { SoccerPlayerIcon } from '@/components/icons/soccer-player-icon';


const statusConfig: Record<Match['status'], { label: string; className: string }> = {
    upcoming: { label: 'Próximo', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' },
    active: { label: 'Activo', className: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' },
    completed: { label: 'Finalizado', className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' },
    evaluated: { label: 'Evaluado', className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300' },
};


export default function DashboardPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const playersQuery = useMemo(() => {
    if (!firestore || !user?.activeGroupId) return null;
    return query(collection(firestore, 'players'), where('groupId', '==', user.activeGroupId));
  }, [firestore, user?.activeGroupId]);

  const matchesQuery = useMemo(() => {
    if (!firestore || !user?.activeGroupId) return null;
    return query(collection(firestore, 'matches'), where('groupId', '==', user.activeGroupId), orderBy('date', 'desc'));
  }, [firestore, user?.activeGroupId]);

  const { data: players, loading: playersLoading } = useCollection<Player>(playersQuery);
  const { data: matches, loading: matchesLoading } = useCollection<Match>(matchesQuery);

  const loading = playersLoading || matchesLoading;

  const { upcomingMatches, nextMatch, recentMatches } = useMemo(() => {
    if (!matches) return { upcomingMatches: [], nextMatch: null, recentMatches: [] };
    const now = new Date();
    const upcoming = matches
      .filter(m => m.status === 'upcoming' && new Date(m.date) >= now)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const recent = matches.filter(m => m.status !== 'upcoming').slice(0, 2);

    return {
      upcomingMatches: upcoming,
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
                title="Panel de control"
                description="Bienvenido a tu Manager de Fútbol Amateur."
            />
            <Alert>
                <Users2 className="h-4 w-4" />
                <AlertTitle>¡Bienvenido!</AlertTitle>
                <AlertDescription>
                    Parece que eres nuevo por aquí. Para empezar, crea tu primer grupo o únete a uno existente.
                    <Button asChild variant="link" className="p-0 h-auto ml-1">
                        <Link href="/groups">Gestionar Grupos</Link>
                    </Button>
                </AlertDescription>
            </Alert>
        </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Panel de control"
        description="Un resumen de la actividad de tu grupo."
      />
      
      <BizarreQuoteCard />

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-8">
            <NextMatchCard match={nextMatch} />
            
            <Card>
                <CardHeader>
                    <CardTitle>Partidos Recientes</CardTitle>
                    <CardDescription>Los últimos partidos que se han jugado en el grupo.</CardDescription>
                </CardHeader>
                <CardContent>
                    {recentMatches.length > 0 ? (
                        <div className="space-y-4">
                            {recentMatches.map((match, index) => {
                                const statusInfo = statusConfig[match.status];
                                return (
                                    <div key={match.id}>
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-semibold">{match.title}</p>
                                                <div className="flex flex-col sm:flex-row sm:items-center gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <Calendar className="h-3.5 w-3.5" />
                                                        <span>{format(new Date(match.date), "d MMM, yyyy", { locale: es })}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <MapPin className="h-3.5 w-3.5" />
                                                        <span>{match.location.address}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <Badge variant="outline" className={cn("text-xs", statusInfo.className)}>{statusInfo.label}</Badge>
                                        </div>
                                        {index < recentMatches.length - 1 && <Separator className="mt-4" />}
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center text-center border-2 border-dashed border-muted-foreground/30 rounded-xl p-12">
                            <Calendar className="h-12 w-12 text-muted-foreground/50" />
                            <h2 className="mt-4 text-xl font-semibold">Sin Partidos Recientes</h2>
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
                    Mejores Jugadores
                </CardTitle>
                <CardDescription>El top 5 de jugadores por OVR en tu grupo.</CardDescription>
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
                        Plantilla
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
