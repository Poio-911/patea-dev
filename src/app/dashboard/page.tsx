
'use client';

import { Suspense, useState, useMemo, useCallback, useEffect } from 'react';
import { useCollection, useDoc, useFirestore, useUser } from '@/firebase';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Star, Users2, Calendar, User, Eye, Loader2, LocateFixed, AlertCircle, UserRound, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { collection, query, where, orderBy, limit, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { Player, Match, AvailablePlayer } from '@/lib/types';
import { NextMatchCard } from '@/components/next-match-card';
import { Badge } from '@/components/ui/badge';
import { format, isToday, parseISO } from 'date-fns';
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
import { motion } from 'framer-motion';

const statusConfig: Record<Match['status'], { label: string; className: string }> = {
    upcoming: { label: 'Próximo', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' },
    active: { label: 'Activo', className: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' },
    completed: { label: 'Finalizado', className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' },
    evaluated: { label: 'Evaluado', className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300' },
};

const pageVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.5 } },
};

const listVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

function DashboardContent() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isToggling, setIsToggling] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const top5PlayersQuery = useMemo(() => {
    if (!firestore || !user?.activeGroupId) return null;
    return query(
      collection(firestore, 'players'),
      where('groupId', '==', user.activeGroupId),
      orderBy('ovr', 'desc'),
      limit(5)
    );
  }, [firestore, user?.activeGroupId]);

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

  const { data: top5Players, loading: top5PlayersLoading } = useCollection<Player>(top5PlayersQuery);

  const allPlayersInGroupQuery = useMemo(() => {
    if (!firestore || !user?.activeGroupId) return null;
    return query(collection(firestore, 'players'), where('groupId', '==', user.activeGroupId));
  }, [firestore, user?.activeGroupId]);
  const { data: allPlayersInGroup, loading: allPlayersLoading } = useCollection<Player>(allPlayersInGroupQuery);

  const { data: groupMatches, loading: groupMatchesLoading } = useCollection<Match>(groupMatchesQuery);
  const { data: joinedMatches, loading: joinedMatchesLoading } = useCollection<Match>(joinedMatchesQuery);

  const loading = top5PlayersLoading || allPlayersLoading || groupMatchesLoading || joinedMatchesLoading || playerLoading || availablePlayerLoading;
  
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
    <motion.div
        className="flex flex-col gap-8"
        variants={pageVariants}
        initial="initial"
        animate="animate"
    >
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

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-8">
          {nextMatch && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    Próximo Partido
                </CardTitle>
              </CardHeader>
              <CardContent>
                <NextMatchCard match={nextMatch} />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
                <CardTitle>Partidos Anteriores</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {recentMatches && recentMatches.length > 0 ? recentMatches.map(match => {
                     const statusInfo = statusConfig[match.status] || { label: 'Desconocido', className: 'bg-gray-100 text-gray-800' };
                     return (
                        <Link key={match.id} href={`/matches/${match.id}`} className="block">
                            <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
                                <div>
                                    <p className="font-semibold">{match.title}</p>
                                    <p className="text-sm text-muted-foreground">{format(new Date(match.date), "dd 'de' MMMM, yyyy", { locale: es })}</p>
                                </div>
                                <Badge variant="outline" className={cn(statusInfo.className)}>{statusInfo.label}</Badge>
                            </div>
                        </Link>
                     )
                }) : <p className="text-sm text-muted-foreground text-center py-4">Aún no hay partidos jugados en este grupo.</p>}
            </CardContent>
          </Card>
        </div>

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
                <motion.div 
                    className="space-y-4"
                    variants={listVariants}
                    initial="hidden"
                    animate="visible"
                >
                  {top5Players && top5Players.length > 0 ? top5Players.map((player: Player, index: number) => {
                      const isManualPlayer = player.id !== player.ownerUid;
                      return (
                        <motion.div
                          key={player.id}
                          variants={listVariants}
                          className="flex items-center gap-4"
                        >
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
                          <motion.div
                            className="text-lg font-bold text-primary"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: index * 0.1 + 0.2, type: "spring", stiffness: 200 }}
                          >
                            {player.ovr}
                          </motion.div>
                        </motion.div>
                      )
                  }) : <p className="text-sm text-muted-foreground text-center py-4">Aún no hay jugadores en este grupo.</p>}
                </motion.div>
              </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Eye className="h-5 w-5 text-primary" />
                        Visibilidad Pública
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between space-x-2">
                        <Label htmlFor="availability-switch" className="flex flex-col space-y-1">
                            <span>¿Disponible para otros?</span>
                            <span className="font-normal leading-snug text-muted-foreground text-xs">
                                Permití que otros DTs te encuentren y te inviten a sus partidos.
                            </span>
                        </Label>
                         <Switch 
                            id="availability-switch" 
                            checked={!!availablePlayerData} 
                            onCheckedChange={handleToggleAvailability}
                            disabled={isToggling}
                        />
                    </div>
                     {locationError && (
                        <Alert variant="destructive" className="mt-4">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Error de Ubicación</AlertTitle>
                            <AlertDescription>
                                {locationError}
                                <Button variant="link" className="p-0 h-auto ml-1 text-destructive" onClick={requestLocationAndToggle}>Reintentar</Button>
                            </AlertDescription>
                        </Alert>
                    )}
                     {availablePlayerData && (
                        <div className="mt-4 flex gap-2">
                             <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                             <p className="text-xs text-muted-foreground">Estás visible en la búsqueda de jugadores.</p>
                        </div>
                    )}
                    <Separator className="my-4" />
                    <SetAvailabilityDialog player={player} availability={availablePlayerData?.availability || {}}>
                        <Button variant="outline" className="w-full" disabled={!availablePlayerData}>
                            <Calendar className="mr-2 h-4 w-4" />
                            Definir mi Horario
                        </Button>
                    </SetAvailabilityDialog>
                </CardContent>
            </Card>
        </div>
      </div>
    </motion.div>
  );
}

export default function DashboardPage() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center h-full"><SoccerPlayerIcon className="h-16 w-16 color-cycle-animation" /></div>}>
            <DashboardContent />
        </Suspense>
    )
}
