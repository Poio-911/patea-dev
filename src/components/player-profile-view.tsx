
'use client';

import React, { useState, useMemo, useEffect, useRef, useTransition } from 'react';
import { useDoc, useCollection, useFirestore, useUser, initializeFirebase, useAuth } from '@/firebase';
import { doc, collection, query, where, orderBy, getDocs, writeBatch, updateDoc, increment } from 'firebase/firestore';
import type { Player, Evaluation, Match, OvrHistory, UserProfile, AvailablePlayer } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, BarChart2, Star, Goal, ChevronDown, Upload, Sparkles, UserRound } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updateProfile } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { SetAvailabilityDialog } from './set-availability-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type PlayerProfileViewProps = {
  playerId: string;
};

const positionColors: Record<Player['position'], string> = {
  DEL: 'text-chart-1',
  MED: 'text-chart-2',
  DEF: 'text-chart-3',
  POR: 'text-chart-4',
};

const Stat = ({ label, value }: { label: string; value: number }) => (
  <div className="flex items-center justify-between text-sm">
    <span className="font-semibold text-muted-foreground">{label}</span>
    <span className="font-bold">{value}</span>
  </div>
);

type DetailedEvaluation = Evaluation & { evaluatorName?: string; evaluatorPhoto?: string };
type MatchEvaluationSummary = {
    match: Match;
    avgRating: number;
    goals: number;
    individualEvaluations: DetailedEvaluation[];
};

export default function PlayerProfileView({ playerId }: PlayerProfileViewProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const auth = useAuth();
  const { toast } = useToast();

  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [evaluatorProfiles, setEvaluatorProfiles] = useState<Record<string, {displayName: string, photoURL: string}>>({});
  const [openAccordion, setOpenAccordion] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isCurrentUserProfile = user?.uid === playerId;

  const playerRef = useMemo(() => firestore && playerId ? doc(firestore, 'players', playerId) : null, [firestore, playerId]);
  const { data: player, loading: playerLoading } = useDoc<Player>(playerRef);

  const availablePlayerRef = useMemo(() => firestore && playerId ? doc(firestore, 'availablePlayers', playerId) : null, [firestore, playerId]);
  const { data: availablePlayerData, loading: availablePlayerLoading } = useDoc<AvailablePlayer>(availablePlayerRef);

  const createdPlayersQuery = useMemo(() => {
    if (!firestore || !isCurrentUserProfile || !playerId) return null;
    return query(collection(firestore, 'players'), where('ownerUid', '==', playerId));
  }, [firestore, playerId, isCurrentUserProfile]);
  const { data: createdPlayers, loading: createdPlayersLoading } = useCollection<Player>(createdPlayersQuery);

  const createdMatchesQuery = useMemo(() => {
    if (!firestore || !isCurrentUserProfile || !playerId) return null;
    return query(collection(firestore, 'matches'), where('ownerUid', '==', playerId));
  }, [firestore, playerId, isCurrentUserProfile]);
  const { data: createdMatches, loading: createdMatchesLoading } = useCollection<Match>(createdMatchesQuery);
  
  const manualPlayers = useMemo(() => {
    if(!createdPlayers || !user) return [];
    return createdPlayers.filter(p => p.id !== user.uid);
  }, [createdPlayers, user]);


  const ovrHistoryQuery = useMemo(() => {
    if (!firestore || !playerId) return null;
    return query(collection(firestore, 'players', playerId, 'ovrHistory'), orderBy('date', 'asc'));
  }, [firestore, playerId]);
  const { data: ovrHistory, loading: historyLoading } = useCollection<OvrHistory>(ovrHistoryQuery);
  
  useEffect(() => {
    async function fetchEvaluationData() {
        if (!firestore || !playerId) return;

        setIsLoading(true);
        try {
            const evalsQuery = query(collection(firestore, 'evaluations'), where('playerId', '==', playerId));
            const evalsSnapshot = await getDocs(evalsQuery);
            const playerEvals = evalsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Evaluation));
            setEvaluations(playerEvals);

            const matchIds = [...new Set(playerEvals.map(e => e.matchId))];
            const evaluatorIds = [...new Set(playerEvals.map(e => e.evaluatorId))];

            if (matchIds.length > 0) {
                const matchesQuery = query(collection(firestore, 'matches'), where('__name__', 'in', matchIds));
                const matchesSnapshot = await getDocs(matchesQuery);
                const fetchedMatches = matchesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Match));
                setMatches(fetchedMatches);
            }

            if (evaluatorIds.length > 0) {
                const usersQuery = query(collection(firestore, 'users'), where('__name__', 'in', evaluatorIds));
                const usersSnapshot = await getDocs(usersQuery);
                const newProfiles: Record<string, {displayName: string, photoURL: string}> = {};
                usersSnapshot.forEach(doc => {
                    const data = doc.data() as UserProfile;
                    newProfiles[doc.id] = {
                        displayName: data.displayName || 'Anónimo',
                        photoURL: data.photoURL || '',
                    };
                });
                setEvaluatorProfiles(newProfiles);
            }
        } catch (error) {
            console.error("Error fetching evaluation data:", error);
        } finally {
            setIsLoading(false);
        }
    }
    fetchEvaluationData();
  }, [firestore, playerId]);

  const filteredEvaluationsByMatch = useMemo((): MatchEvaluationSummary[] => {
    if (isLoading || evaluations.length === 0) return [];
    
    const evalsByMatch: Record<string, { match: Match; evaluations: DetailedEvaluation[] }> = {};

    evaluations.forEach(ev => {
        const matchForEval = matches.find(m => m.id === ev.matchId);
        if (matchForEval) {
            if (!evalsByMatch[ev.matchId]) {
                evalsByMatch[ev.matchId] = { match: matchForEval, evaluations: [] };
            }
            const detailedEval: DetailedEvaluation = {
                ...ev,
                evaluatorName: evaluatorProfiles[ev.evaluatorId]?.displayName || 'Cargando...',
                evaluatorPhoto: evaluatorProfiles[ev.evaluatorId]?.photoURL || '',
            };
            evalsByMatch[ev.matchId].evaluations.push(detailedEval);
        }
    });

    return Object.values(evalsByMatch).map(summary => {
        const ratings = summary.evaluations.map(ev => ev.rating).filter((r): r is number => typeof r === 'number' && !isNaN(r));
        const goals = summary.evaluations.reduce((sum, ev) => sum + (ev.goals || 0), 0);
        const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
        
        return {
            match: summary.match,
            avgRating,
            goals,
            individualEvaluations: summary.evaluations
        };
    }).sort((a,b) => new Date(b.match.date).getTime() - new Date(a.match.date).getTime());

  }, [evaluations, matches, evaluatorProfiles, isLoading]);

  const chartData = useMemo(() => {
    if (!ovrHistory) return [];
    if (ovrHistory.length === 0 && player) {
        return [{name: 'Inicial', OVR: player.ovr}]
    }
    return ovrHistory.map((entry, index) => ({
      name: `P. ${index + 1}`,
      OVR: entry.newOVR,
      Fecha: format(new Date(entry.date), 'dd/MM'),
    }));
  }, [ovrHistory, player]);

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !auth?.currentUser || !firestore) return;
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    
    try {
        const { firebaseApp } = initializeFirebase();
        const storage = getStorage(firebaseApp);

        const fileExtension = file.name.split('.').pop();
        const fileName = `${user.uid}-${Date.now()}.${fileExtension}`;
        const filePath = `profile-images/${user.uid}/${fileName}`;
        
        const storageRef = ref(storage, filePath);
        const uploadResult = await uploadBytes(storageRef, file);
        const newPhotoURL = await getDownloadURL(uploadResult.ref);

        const userDocRef = doc(firestore, 'users', user.uid);
        const playerDocRef = doc(firestore, 'players', user.uid);

        const batch = writeBatch(firestore);
        batch.update(userDocRef, { photoURL: newPhotoURL });
        batch.update(playerDocRef, { photoUrl: newPhotoURL });
        
        if (availablePlayerData) {
             const availablePlayerDocRef = doc(firestore, 'availablePlayers', user.uid);
             batch.update(availablePlayerDocRef, { photoUrl: newPhotoURL });
        }
        
        await batch.commit();

        await updateProfile(auth.currentUser, { photoURL: newPhotoURL });

        toast({
            title: '¡Foto actualizada!',
            description: 'Tu foto de perfil ha cambiado.'
        });

    } catch (error: any) {
        console.error('Error updating photo:', error);
        toast({
            variant: 'destructive',
            title: 'Error al subir la imagen',
            description: error.message || 'No se pudo actualizar la foto de perfil.',
        });
    } finally {
        setIsUploading(false);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const loading = playerLoading || historyLoading || isLoading || (isCurrentUserProfile && (createdMatchesLoading || createdPlayersLoading || availablePlayerLoading));


  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!player) {
    return <div>No se encontró al jugador.</div>;
  }

  return (
    <div className="flex flex-col gap-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-1">
                <CardContent className="pt-6">
                    <div className="flex flex-col sm:flex-row items-center gap-6">
                         <div className="relative">
                            <Avatar className="h-32 w-32 border-4 border-primary/50">
                                <AvatarImage src={player.photoUrl} alt={player.name} data-ai-hint="player portrait" />
                                <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            {isUploading && (
                                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                                    <Loader2 className="h-8 w-8 animate-spin text-white" />
                                </div>
                            )}
                        </div>
                        {isCurrentUserProfile && (
                            <div className="flex flex-col gap-2 w-full sm:w-auto">
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    onChange={handlePhotoUpload}
                                    className="hidden"
                                    accept="image/png, image/jpeg, image/gif" 
                                />
                                <Button onClick={handleButtonClick} size="sm" variant="outline" disabled={isUploading} className="w-full">
                                    {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                    {isUploading ? "Subiendo..." : "Cambiar Foto"}
                                </Button>
                            </div>
                        )}
                    </div>
                    <div className="text-center mt-6">
                        <h2 className="text-2xl font-bold font-headline">{player.name}</h2>
                        <div className="flex items-center justify-center gap-4 mt-1">
                            <span className={cn("text-4xl font-bold", positionColors[player.position])}>{player.ovr}</span>
                            <Badge variant="secondary" className="text-lg">{player.position}</Badge>
                        </div>
                    </div>
                    <Separator className="my-4"/>
                    <div className="w-full grid grid-cols-2 gap-x-8 gap-y-3 px-4">
                        <Stat label="RIT" value={player.pac} />
                        <Stat label="TIR" value={player.sho} />
                        <Stat label="PAS" value={player.pas} />
                        <Stat label="REG" value={player.dri} />
                        <Stat label="DEF" value={player.def} />
                        <Stat label="FIS" value={player.phy} />
                    </div>
                </CardContent>
            </Card>

            <div className="lg:col-span-2">
            <Card>
                <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <BarChart2 className="h-6 w-6" />
                    Progresión de OVR
                </CardTitle>
                <CardDescription>Evolución del OVR del jugador a lo largo de los últimos partidos.</CardDescription>
                </CardHeader>
                <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis domain={['dataMin - 2', 'dataMax + 2']} />
                    <Tooltip
                        content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                                return (
                                    <div className="rounded-lg border bg-background p-2 shadow-sm">
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="flex flex-col">
                                            <span className="text-[0.70rem] uppercase text-muted-foreground">
                                                Partido
                                            </span>
                                            <span className="font-bold text-muted-foreground">
                                                {label} ({payload[0].payload.Fecha})
                                            </span>
                                            </div>
                                            <div className="flex flex-col">
                                            <span className="text-[0.70rem] uppercase text-muted-foreground">
                                                OVR
                                            </span>
                                            <span className="font-bold text-foreground">
                                                {payload[0].value}
                                            </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="OVR" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 8 }} />
                    </LineChart>
                </ResponsiveContainer>
                </CardContent>
            </Card>
            </div>
        </div>
        
        {isCurrentUserProfile && (
            <div className="lg:col-span-3">
                <Tabs defaultValue="evaluations" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="evaluations">Mi Historial</TabsTrigger>
                        <TabsTrigger value="created-matches">Partidos Creados</TabsTrigger>
                        <TabsTrigger value="created-players">Jugadores Creados</TabsTrigger>
                    </TabsList>
                    <TabsContent value="evaluations">
                        <Card>
                            <CardHeader>
                            <CardTitle>Historial de Evaluaciones</CardTitle>
                            <CardDescription>Rendimiento del jugador en los últimos partidos evaluados. Haz clic en un partido para ver el detalle.</CardDescription>
                            </CardHeader>
                            <CardContent>
                            <Table>
                                <TableHeader>
                                <TableRow>
                                    <TableHead className='w-12'></TableHead>
                                    <TableHead>Partido</TableHead>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead className="text-center">Rating Prom.</TableHead>
                                    <TableHead className="text-center">Goles</TableHead>
                                </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredEvaluationsByMatch.length > 0 ? filteredEvaluationsByMatch.map(({ match, avgRating, goals, individualEvaluations }) => {
                                        const isOpen = openAccordion === match.id;
                                        return (
                                            <React.Fragment key={match.id}>
                                                <TableRow 
                                                    className="cursor-pointer"
                                                    onClick={() => setOpenAccordion(isOpen ? null : match.id)}
                                                >
                                                    <TableCell>
                                                        <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
                                                    </TableCell>
                                                    <TableCell className="font-medium">{match.title}</TableCell>
                                                    <TableCell>{format(new Date(match.date), 'dd MMM, yyyy', { locale: es })}</TableCell>
                                                    <TableCell className="text-center">
                                                        <Badge variant={avgRating >= 7 ? 'default' : avgRating >= 5 ? 'secondary' : 'destructive'} className="text-base">
                                                        <Star className="mr-1 h-3 w-3" /> {avgRating.toFixed(2)}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Badge variant="outline" className="text-base">
                                                            <Goal className="mr-1 h-3 w-3" /> {goals}
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>
                                                {isOpen && (
                                                    <TableRow>
                                                        <TableCell colSpan={5} className="p-0">
                                                            <div className="bg-muted/50 p-4">
                                                                <h4 className="font-semibold text-md mb-2 ml-4">Detalle de evaluaciones:</h4>
                                                                <Table>
                                                                    <TableHeader>
                                                                        <TableRow>
                                                                            <TableHead>Evaluador</TableHead>
                                                                            <TableHead className="text-center">Rating</TableHead>
                                                                            <TableHead>Etiquetas de Rendimiento</TableHead>
                                                                        </TableRow>
                                                                    </TableHeader>
                                                                    <TableBody>
                                                                        {individualEvaluations.map(ev => (
                                                                            <TableRow key={ev.id} className="bg-background">
                                                                                <TableCell>
                                                                                    <div className="flex items-center gap-2">
                                                                                        <Avatar className="h-8 w-8">
                                                                                            <AvatarImage src={ev.evaluatorPhoto} alt={ev.evaluatorName} />
                                                                                            <AvatarFallback>{ev.evaluatorName?.charAt(0)}</AvatarFallback>
                                                                                        </Avatar>
                                                                                        <span>{ev.evaluatorName}</span>
                                                                                    </div>
                                                                                </TableCell>
                                                                                <TableCell className="text-center">
                                                                                    <Badge variant="secondary">{ev.rating}</Badge>
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                    <div className="flex gap-1 flex-wrap">
                                                                                    {ev.performanceTags && ev.performanceTags.length > 0 ? ev.performanceTags.map(tag => (
                                                                                        <Badge key={tag.id} variant="outline">{tag.name}</Badge>
                                                                                    )) : <span className="text-muted-foreground text-xs">Sin etiquetas</span>}
                                                                                    </div>
                                                                                </TableCell>
                                                                            </TableRow>
                                                                        ))}
                                                                    </TableBody>
                                                                </Table>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </React.Fragment>
                                        )
                                    }) : (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center text-muted-foreground h-24">
                                                Este jugador aún no tiene evaluaciones registradas.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    </TableBody>
                            </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>
                    <TabsContent value="created-matches">
                        <Card>
                            <CardContent className="pt-6">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Partido</TableHead>
                                            <TableHead>Fecha</TableHead>
                                            <TableHead>Jugadores</TableHead>
                                            <TableHead>Estado</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {createdMatches && createdMatches.length > 0 ? createdMatches.map(match => (
                                            <TableRow key={match.id}>
                                                <TableCell className="font-medium">{match.title}</TableCell>
                                                <TableCell>{format(new Date(match.date), 'dd/MM/yyyy', { locale: es })}</TableCell>
                                                <TableCell>{match.players.length} / {match.matchSize}</TableCell>
                                                <TableCell>
                                                    <Badge variant={match.status === 'completed' ? 'secondary' : 'default'}>{match.status}</Badge>
                                                </TableCell>
                                            </TableRow>
                                        )) : (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center h-24">No has creado ningún partido.</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>
                    <TabsContent value="created-players">
                         <Card>
                            <CardContent className="pt-6">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Jugador</TableHead>
                                            <TableHead>Posición</TableHead>
                                            <TableHead>OVR</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {manualPlayers && manualPlayers.length > 0 ? manualPlayers.map(player => (
                                            <TableRow key={player.id}>
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="h-9 w-9">
                                                            <AvatarImage src={player.photoUrl} alt={player.name} data-ai-hint="player portrait" />
                                                            <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
                                                        </Avatar>
                                                        <span className="font-medium">{player.name}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline">{player.position}</Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge>{player.ovr}</Badge>
                                                </TableCell>
                                            </TableRow>
                                        )) : (
                                            <TableRow>
                                                <TableCell colSpan={3} className="text-center h-24">No has creado ningún jugador manual.</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        )}
    </div>
  );
}
