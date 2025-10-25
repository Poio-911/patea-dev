
'use client';

import { Suspense, useState } from 'react';
import { useCollection, useDoc } from '@/firebase';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Star, Users2, Calendar, MapPin, User, UserRound, Eye, Loader2, Locate, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirestore } from '@/firebase';
import { collection, query, where, orderBy, limit, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { useUser } from '@/firebase';
import { useMemo } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { Player, Match, AvailablePlayer } from '@/lib/types';
import { NextMatchCard } from '@/components/next-match-card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Separator } from '@/components/ui/separator';
import { SoccerPlayerIcon } from '@/components/icons/soccer-player-icon';
import { SetAvailabilityDialog } from '@/components/set-availability-dialog';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { MateIcon } from '@/components/icons/mate-icon';
import { FirstTimeInfoDialog } from '@/components/first-time-info-dialog';
import { logger } from '@/lib/logger';

const statusConfig: Record<Match['status'], { label: string; className: string }> = {
    upcoming: { label: 'Próximo', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' },
    active: { label: 'Activo', className: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' },
    completed: { label: 'Finalizado', className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' },
    evaluated: { label: 'Evaluado', className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300' },
};

function DashboardContent() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isToggling, setIsToggling] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // ✅ Query optimizada: Solo traemos top 5 jugadores ordenados por OVR
  const top5PlayersQuery = useMemo(() => {
    if (!firestore || !user?.activeGroupId) return null;
    return query(
      collection(firestore, 'players'),
      where('groupId', '==', user.activeGroupId),
      orderBy('ovr', 'desc'),
      limit(5)
    );
  }, [firestore, user?.activeGroupId]);

  // Query para contar jugadores del grupo (sin traer todos los datos)
  const allPlayersQuery = useMemo(() => {
    if (!firestore || !user?.activeGroupId) return null;
    return query(collection(firestore, 'players'), where('groupId', '==', user.activeGroupId));
  }, [firestore, user?.activeGroupId]);

  // ✅ Query optimizada: Solo últimos 10 partidos (suficiente para próximo + 2 recientes)
  const groupMatchesQuery = useMemo(() => {
    if (!firestore || !user?.activeGroupId) return null;
    return query(
      collection(firestore, 'matches'),
      where('groupId', '==', user.activeGroupId),
      orderBy('date', 'desc'),
      limit(10)
    );
  }, [firestore, user?.activeGroupId]);
  
  const joinedMatchesQuery = useMemo(() => {
    if (!firestore || !user?.uid) return null;
    return query(
        collection(firestore, 'matches'),
        where('playerUids', 'array-contains', user.uid)
    );
  }, [firestore, user?.uid]);
  
  const playerRef = useMemo(() => firestore && user?.uid ? doc(firestore, 'players', user.uid) : null, [firestore, user?.uid]);
  const { data: player, loading: playerLoading } = useDoc<Player>(playerRef);

  const availablePlayerRef = useMemo(() => firestore && user?.uid ? doc(firestore, 'availablePlayers', user.uid) : null, [firestore, user?.uid]);
  const { data: availablePlayerData, loading: availablePlayerLoading } = useDoc<AvailablePlayer>(availablePlayerRef);


  const { data: groupMatches, loading: groupMatchesLoading } = useCollection<Match>(groupMatchesQuery);
  const { data: joinedMatches, loading: joinedMatchesLoading } = useCollection<Match>(joinedMatchesQuery);

  // ✅ Top 5 ya viene ordenado y limitado desde Firestore
  const { data: top5Players, loading: top5Loading } = useCollection<Player>(top5PlayersQuery);

  // Para contar jugadores del grupo
  const { data: allPlayers, loading: allPlayersLoading } = useCollection<Player>(allPlayersQuery);
  
  const matches = useMemo(() => {
    if (!groupMatches && !joinedMatches) return null;
    
    const allMatchesMap = new Map<string, Match>();
    
    (groupMatches || []).forEach(match => allMatchesMap.set(match.id, match));

    (joinedMatches || []).forEach(match => {
        if (!allMatchesMap.has(match.id)) {
            allMatchesMap.set(match.id, match);
        }
    });

    return Array.from(allMatchesMap.values()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [groupMatches, joinedMatches]);

  const loading = top5Loading || allPlayersLoading || groupMatchesLoading || joinedMatchesLoading || playerLoading || availablePlayerLoading;

  const { nextMatch, recentMatches } = useMemo(() => {
    if (!matches) return { nextMatch: null, recentMatches: [] };

    const upcoming = matches
      .filter(m => m.status === 'upcoming' && new Date(m.date) >= new Date())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const recent = matches.filter(m => m.status !== 'upcoming').slice(0, 2);

    return {
      nextMatch: upcoming[0] || null,
      recentMatches: recent,
    };
  }, [matches]);

  const requestLocationAndToggle = () => {
    if (!firestore || !user || !player) return;
    setIsToggling(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const availablePlayerDocRef = doc(firestore, 'availablePlayers', user.uid);
        const newAvailablePlayer: Omit<AvailablePlayer, 'id'> = {
          uid: user.uid,
          displayName: player.name,
          photoUrl: player.photoUrl || '',
          position: player.position,
          ovr: player.ovr,
          location: { lat: latitude, lng: longitude },
          availability: {},
        };
        await setDoc(availablePlayerDocRef, newAvailablePlayer);
        toast({ title: 'Ahora estás visible', description: 'Otros DTs pueden encontrarte para invitarte.' });
        setIsToggling(false);
      },
      (error) => {
        const message = error.code === 1 
            ? 'Debes permitir el acceso a la ubicación en tu navegador para hacerte visible.'
            : 'No se pudo obtener tu ubicación. Inténtalo de nuevo.';
        setLocationError(message);
        setIsToggling(false);
      }
    );
  }

  const handleToggleAvailability = async (isAvailable: boolean) => {
    if (!firestore || !user || !player) return;

    if (isAvailable) {
        requestLocationAndToggle();
    } else {
        setIsToggling(true);
        try {
            const availablePlayerDocRef = doc(firestore, 'availablePlayers', user.uid);
            await deleteDoc(availablePlayerDocRef);
            toast({ title: 'Ya no estás visible', description: 'Has sido eliminado de la lista de jugadores libres.' });
            setLocationError(null);
        } catch (error) {
            logger.error('Error turning off availability', error, { userId: user.uid });
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo cambiar tu visibilidad.' });
        } finally{
            setIsToggling(false);
        }
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-full"><SoccerPlayerIcon className="h-16 w-16 color-cycle-animation" /></div>;
  }
  
  if (!user?.activeGroupId) {
    return (
        <div className="flex flex-col gap-8">
             <div className="flex items-center gap-3">
                <MateIcon className="h-8 w-8 text-primary" />
                <PageHeader
                    title="El Vestuario"
                    description="Bienvenido a tu vestuario virtual."
                />
             </div>
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
      <FirstTimeInfoDialog
        featureKey="hasSeenDashboardInfo"
        title="¡Bienvenid@ a tu Vestuario!"
        description="Este es tu panel de control. Acá vas a ver un resumen de todo: tu próximo partido, los cracks de tu grupo, y una opción clave: la 'Visibilidad Pública', que te permite ser encontrado por otros organizadores."
      />
      <div className="flex items-center gap-3">
        <MateIcon className="h-8 w-8 text-primary" />
        <PageHeader
            title="El Vestuario"
            description="Un pantallazo de cómo está el cuadro."
        />
      </div>

      <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-primary" />
                Visibilidad Pública
            </CardTitle>
            <CardDescription>
                {availablePlayerData ? 'Estás visible para que otros grupos te inviten a partidos.' : 'No estás visible para otros grupos.'}
            </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center space-x-2">
                    <Switch
                        id="availability-switch"
                        checked={!!availablePlayerData}
                        onCheckedChange={handleToggleAvailability}
                        disabled={isToggling}
                    />
                    <Label htmlFor="availability-switch" className="font-medium">
                        {isToggling ? 'Actualizando...' : (availablePlayerData ? 'Visible' : 'Oculto')}
                    </Label>
                    {isToggling && <SoccerPlayerIcon className="h-5 w-5 color-cycle-animation" />}
                </div>
                <SetAvailabilityDialog player={player} availability={availablePlayerData?.availability || {}}>
                    <Button variant="outline" disabled={!availablePlayerData}>
                        <UserRound className="mr-2 h-4 w-4" />
                        Ajustar Disponibilidad y Horarios
                    </Button>
                </SetAvailabilityDialog>
            </div>
            {locationError && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error de Ubicación</AlertTitle>
                    <AlertDescription>
                        {locationError}
                        <Button variant="link" className="p-0 h-auto ml-1 text-destructive" onClick={requestLocationAndToggle}>
                            Reintentar
                        </Button>
                    </AlertDescription>
                </Alert>
            )}
        </CardContent>
      </Card>

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
                                const owner = allPlayers?.find(p => p.id === match.ownerUid)
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
                                                        <span className="truncate">{ownerName.trim() || 'Desconocido'}</span>
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
                    <Badge variant="outline" className="text-xs font-normal">Por OVR</Badge>
                </CardTitle>
                <CardDescription>El Top 5 de jugadores por OVR.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {top5Players.length > 0 ? top5Players.map((player: Player, index: number) => {
                      const isManualPlayer = player.id !== player.ownerUid;
                      return (
                        <div key={player.id} className="flex items-center gap-4">
                          <div className="text-muted-foreground font-bold w-4">{index + 1}.</div>
                          <Avatar className={cn("h-10 w-10 border-2 border-primary/50", isManualPlayer && "border-dashed border-muted-foreground")}>
                            <AvatarImage src={player.photoUrl} alt={player.name} data-ai-hint="player portrait" />
                            <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                                <p className="font-semibold truncate">{player.name}</p>
                                {isManualPlayer && <Badge variant="outline" className="text-xs">Manual</Badge>}
                            </div>
                            <p className="text-sm text-muted-foreground">{player.position}</p>
                          </div>
                          <div className="text-lg font-bold text-primary">{player.ovr}</div>
                        </div>
                      )
                  }) : <p className="text-sm text-muted-foreground text-center py-4">Aún no hay jugadores en este grupo.</p>}
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
                    <div className="text-4xl font-bold">{allPlayers?.length || 0}</div>
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
        <Suspense fallback={<div className="flex justify-center items-center h-full"><SoccerPlayerIcon className="h-16 w-16 color-cycle-animation" /></div>}>
            <DashboardContent />
        </Suspense>
    )
}
