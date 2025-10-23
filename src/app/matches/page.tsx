
'use client';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Users2, Calendar, Loader2, Info } from 'lucide-react';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useMemo } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { AddMatchDialog } from '@/components/add-match-dialog';
import type { Match, Player } from '@/lib/types';
import { MatchCard } from '@/components/match-card';
import { InvitationsSheet } from '@/components/invitations-sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FirstTimeInfoDialog } from '@/components/first-time-info-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"


export default function MatchesPage() {
    const { user, loading: userLoading } = useUser();
    const firestore = useFirestore();

    const playersQuery = useMemo(() => {
        if (!firestore || !user?.activeGroupId) return null;
        return query(collection(firestore, 'players'), where('groupId', '==', user.activeGroupId));
    }, [firestore, user?.activeGroupId]);

    const { data: allGroupPlayers, loading: playersLoading } = useCollection<Player>(playersQuery);

    const groupMatchesQuery = useMemo(() => {
        if (!firestore || !user?.activeGroupId) return null;
        return query(
            collection(firestore, 'matches'), 
            where('groupId', '==', user.activeGroupId), 
            orderBy('date', 'desc')
        );
    }, [firestore, user?.activeGroupId]);
    
    // Query for public matches where the user is a player, but are NOT from the current active group.
    const joinedPublicMatchesQuery = useMemo(() => {
        if (!firestore || !user?.uid || !user?.activeGroupId) return null;
        return query(
            collection(firestore, 'matches'),
            where('playerUids', 'array-contains', user.uid),
            where('isPublic', '==', true),
            where('groupId', '!=', user.activeGroupId)
        );
    }, [firestore, user?.uid, user?.activeGroupId]);


    const { data: groupMatches, loading: groupMatchesLoading } = useCollection<Match>(groupMatchesQuery);
    const { data: joinedPublicMatches, loading: joinedPublicMatchesLoading } = useCollection<Match>(joinedPublicMatchesQuery);
    
    // Merge matches from the active group with any public matches the user has joined.
    const matches = useMemo(() => {
        const allMatchesMap = new Map<string, Match>();
        
        (groupMatches || []).forEach(match => allMatchesMap.set(match.id, match));
        (joinedPublicMatches || []).forEach(match => allMatchesMap.set(match.id, match));

        return Array.from(allMatchesMap.values()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [groupMatches, joinedPublicMatches]);
    
    const { upcomingMatches, pastMatches } = useMemo(() => {
        const upcoming: Match[] = [];
        const past: Match[] = [];
        matches.forEach(match => {
            if (match.status === 'upcoming' || match.status === 'active') {
                upcoming.push(match);
            } else {
                past.push(match);
            }
        });
        // Upcoming matches should be sorted ascending (closest first)
        upcoming.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        return { upcomingMatches: upcoming, pastMatches: past };
    }, [matches]);


    const loading = userLoading || playersLoading || groupMatchesLoading || joinedPublicMatchesLoading;
    
    const sortedPlayers = useMemo(() => {
        if (!allGroupPlayers) return [];
        return [...allGroupPlayers].sort((a, b) => b.ovr - a.ovr);
      }, [allGroupPlayers]);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-4 text-muted-foreground">Cargando partidos...</p>
            </div>
        )
    }
    
    return (
        <div className="flex flex-col gap-8">
            <FirstTimeInfoDialog
                featureKey="hasSeenMatchesInfo"
                title="Sección de Partidos"
                description="Acá podés crear nuevos partidos, ver los que están por jugarse y revisar el historial de los ya jugados. Usá las pestañas para navegar entre 'Próximos' e 'Historial'."
            />
            <PageHeader
                title="Partidos"
                description="Programa, visualiza y gestiona todos tus partidos."
            >
                <div className="flex items-center gap-2">
                   <AddMatchDialog allPlayers={sortedPlayers} disabled={!user?.activeGroupId} />
                   <InvitationsSheet />
                </div>
            </PageHeader>

            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                         <div className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer self-start">
                            <Info className="h-4 w-4" />
                            <span>¿Cómo funcionan los partidos y las evaluaciones?</span>
                        </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-md">
                        <div className="space-y-3 p-2">
                             <h4 className="font-bold">Tipos de Partido</h4>
                             <ul className="list-disc list-inside text-xs space-y-1">
                                <li><b>Manual:</b> El organizador elige a tod@s l@s jugador@s.</li>
                                <li><b>Colaborativo:</b> El organizador crea el evento y l@s demás se apuntan.</li>
                                <li><b>Por Equipos:</b> Se enfrentan dos equipos ya creados en tu grupo.</li>
                             </ul>
                             <h4 className="font-bold">Proceso Post-Partido</h4>
                             <ul className="list-disc list-inside text-xs space-y-1">
                                <li>Al <b>finalizar</b> un partido, si es colaborativo o manual y están tod@s, la IA arma los equipos.</li>
                                <li>Luego, se generan las <b>evaluaciones pendientes</b> para que cada participante evalúe a sus compañer@s.</li>
                                <li>Como organizador, tenés que ir al panel de supervisión para <b>cerrar la evaluación</b>. Esto dispara el cálculo y la actualización de los OVRs de tod@s.</li>
                             </ul>
                        </div>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>

            {!user?.activeGroupId && (
                <Alert>
                    <Users2 className="h-4 w-4" />
                    <AlertTitle>No hay grupo activo</AlertTitle>
                    <AlertDescription>
                        No tienes un grupo activo seleccionado. Por favor, crea o únete a un grupo para ver los partidos.
                        <Button asChild variant="link" className="p-0 h-auto ml-1">
                            <Link href="/groups">Ir a la página de grupos</Link>
                        </Button>
                    </AlertDescription>
                </Alert>
            )}

            {user?.activeGroupId && (
                <Tabs defaultValue="upcoming" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="upcoming">Próximos</TabsTrigger>
                        <TabsTrigger value="history">Historial</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="upcoming" className="mt-6">
                        <div className="flex flex-col gap-6">
                            {upcomingMatches.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {upcomingMatches.map((match) => (
                                        <MatchCard key={match.id} match={match} allPlayers={sortedPlayers} />
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center text-center border-2 border-dashed border-muted-foreground/30 rounded-xl p-12">
                                    <Calendar className="h-12 w-12 text-muted-foreground/50" />
                                    <h2 className="mt-4 text-xl font-semibold">No hay partidos programados</h2>
                                    <p className="mt-2 text-sm text-muted-foreground">
                                        ¡Usa el botón de arriba para empezar a jugar!
                                    </p>
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="history" className="mt-6">
                         {pastMatches.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {pastMatches.map((match) => (
                                    <MatchCard key={match.id} match={match} allPlayers={sortedPlayers} />
                                ))}
                            </div>
                        ) : (
                             <div className="flex flex-col items-center justify-center text-center border-2 border-dashed border-muted-foreground/30 rounded-xl p-12">
                                <Calendar className="h-12 w-12 text-muted-foreground/50" />
                                <h2 className="mt-4 text-xl font-semibold">Sin Historial de Partidos</h2>
                                <p className="mt-2 text-sm text-muted-foreground">
                                    Cuando completes tu primer partido, aparecerá aquí.
                                </p>
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            )}
        </div>
    );
}
