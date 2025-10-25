'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useDoc, useCollection, useFirestore, useUser, initializeFirebase, useAuth } from '@/firebase';
import { 
  doc, 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  getDoc,
  writeBatch, 
  updateDoc 
} from 'firebase/firestore';
import type { Player, Evaluation, Match, OvrHistory, UserProfile, PerformanceTag } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, BarChart2, Star, Goal, Upload, Eye, ChevronDown, CheckCircle, BrainCircuit, Sparkles } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip as UiTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { FirstTimeInfoDialog } from './first-time-info-dialog';
import Link from 'next/link';
import { AnalysisIcon } from './icons/analysis-icon';
import { generatePlayerCardImageAction } from '@/lib/actions';

type PlayerProfileViewProps = {
  playerId: string;
};

const positionColors: Record<Player['position'], string> = {
  DEL: 'text-chart-1',
  MED: 'text-chart-2',
  DEF: 'text-chart-3',
  POR: 'text-chart-4',
};

const statusConfig: Record<Match['status'], { label: string; className: string }> = {
    upcoming: { label: 'Próximo', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' },
    active: { label: 'Activo', className: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' },
    completed: { label: 'Finalizado', className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' },
    evaluated: { label: 'Evaluado', className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300' },
};

const Stat = ({ label, value }: { label: string; value: number }) => (
  <div className="flex items-center justify-between text-sm py-1">
    <span className="font-semibold text-muted-foreground">{label}</span>
    <span className="font-bold">{value}</span>
  </div>
);

type DetailedEvaluation = Evaluation & { evaluatorName?: string; evaluatorPhoto?: string };
type MatchEvaluationSummary = {
    match: Match;
    teamName: string;
    avgRating: number;
    hasNumericRatings: boolean;
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
  const [isLoading, setIsLoading] = useState(true);
  const [openAccordion, setOpenAccordion] = useState<string | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isCurrentUserProfile = user?.uid === playerId;

  const playerRef = useMemo(() => firestore && playerId ? doc(firestore, 'players', playerId) : null, [firestore, playerId]);
  const { data: player, loading: playerLoading } = useDoc<Player>(playerRef);

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
  
  const sortedCreatedMatches = useMemo(() => {
    if (!createdMatches) return [];
    return [...createdMatches].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [createdMatches]);


  const ovrHistoryQuery = useMemo(() => {
    if (!firestore || !playerId) return null;
    return query(collection(firestore, 'players', playerId, 'ovrHistory'), orderBy('date', 'asc'));
  }, [firestore, playerId]);
  const { data: ovrHistory, loading: historyLoading } = useCollection<OvrHistory>(ovrHistoryQuery);
  
  useEffect(() => {
    async function fetchEvaluationData() {
        if (!firestore || !playerId) {
            setIsLoading(false);
            return;
        };

        setIsLoading(true);
        try {
            const evalsQuery = query(collection(firestore, 'evaluations'), where('playerId', '==', playerId));
            const evalsSnapshot = await getDocs(evalsQuery);
            const playerEvals = evalsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Evaluation));
            setEvaluations(playerEvals);

            const matchIds = [...new Set(playerEvals.map(e => e.matchId).filter(id => id))];
            if (matchIds.length > 0) {
                const matchChunks: string[][] = [];
                for (let i = 0; i < matchIds.length; i += 30) {
                    matchChunks.push(matchIds.slice(i, i + 30));
                }

                const matchPromises = matchChunks.map(chunk =>
                    getDocs(query(collection(firestore, 'matches'), where('__name__', 'in', chunk)))
                );
                
                const matchSnapshots = await Promise.all(matchPromises);
                const allMatches = matchSnapshots.flatMap(snapshot => snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Match)));
                setMatches(allMatches);
            } else {
                setMatches([]);
            }

            const evaluatorIds = [...new Set(playerEvals.map(e => e.evaluatorId).filter(id => id))];
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
            } else {
                setEvaluatorProfiles({});
            }
        } catch (error) {
            console.error("Error fetching evaluation data:", error);
        } finally {
            setIsLoading(false);
        }
    }
    fetchEvaluationData();
  }, [firestore, playerId]);

  const filteredEvaluationsByMatch: MatchEvaluationSummary[] = useMemo(() => {
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
        const hasNumericRatings = ratings.length > 0;
        const avgRating = hasNumericRatings ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
        const team = summary.match.teams?.find(t => t.players.some(p => p.uid === playerId));
        
        return {
            match: summary.match,
            teamName: team?.name || '',
            avgRating,
            hasNumericRatings,
            goals,
            individualEvaluations: summary.evaluations
        };
    }).sort((a,b) => new Date(b.match.date).getTime() - new Date(a.match.date).getTime());

  }, [evaluations, matches, evaluatorProfiles, isLoading, playerId]);

  const chartData = useMemo(() => {
    if (!ovrHistory) return [];
    if (ovrHistory.length === 0 && player) {
        return [{name: 'Inicial', OVR: player.ovr}]
    }
    return ovrHistory.map((entry, index) => ({
      name: `P. ${index + 1}`,
      OVR: entry.newOVR,
      Fecha: format(new Date(entry.date), 'dd/MM'),
      ...entry.attributeChanges
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
        
        const availablePlayerRef = doc(firestore, 'availablePlayers', user.uid);
        const availablePlayerSnap = await getDoc(availablePlayerRef);
        if (availablePlayerSnap.exists()) {
            batch.update(availablePlayerRef, { photoUrl: newPhotoURL });
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

  const handleGenerateAIPhoto = async () => {
    if (!user?.uid) return;

    setIsGeneratingAI(true);
    try {
      const result = await generatePlayerCardImageAction(user.uid);

      if ('error' in result) {
        toast({
          variant: 'destructive',
          title: 'Error al generar imagen',
          description: result.error,
        });
        return;
      }

      toast({
        title: 'Foto generada con éxito',
        description: 'Tu foto profesional ha sido creada con IA.',
      });

      // Reload page data to show new photo
      window.location.reload();
    } catch (error: any) {
      console.error('Error generating AI photo:', error);
      toast({
        variant: 'destructive',
        title: 'Error al generar imagen',
        description: error.message || 'No se pudo generar la imagen con IA.',
      });
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const loading = playerLoading || historyLoading || isLoading || (isCurrentUserProfile && (createdMatchesLoading || createdPlayersLoading));


  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!player) {
    return <div>No se encontró al jugador.</div>;
  }

  return (
    <>
        <FirstTimeInfoDialog 
            featureKey='hasSeenProfileInfo'
            title='Este es Tu Perfil de Jugador'
            description='Acá podés ver tu carta de jugador con tus atributos, que irán mejorando a medida que juegues y te evalúen. También podés ver tu historial de rendimiento y acceder a las herramientas de IA para recibir consejos y mejorar tu juego.'
        >
             <div className="flex items-center justify-center p-4 bg-primary/10 rounded-lg">
                <CheckCircle className="h-10 w-10 text-primary" />
             </div>
        </FirstTimeInfoDialog>
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
                                    <Button onClick={handleButtonClick} size="sm" variant="outline" disabled={isUploading || isGeneratingAI} className="w-full">
                                        {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                        {isUploading ? "Subiendo..." : "Cambiar Foto"}
                                    </Button>
                                    <Button
                                        onClick={handleGenerateAIPhoto}
                                        size="sm"
                                        variant="default"
                                        disabled={isUploading || isGeneratingAI}
                                        className="w-full relative"
                                    >
                                        {isGeneratingAI ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                                        {isGeneratingAI ? "Generando..." : "Generar Foto Pro"}
                                        {player?.cardGenerationCredits !== undefined && !isGeneratingAI && (
                                            <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                                                {player.cardGenerationCredits}
                                            </Badge>
                                        )}
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
                        {isCurrentUserProfile && (
                             <div className="mt-6 text-center">
                                 <Button asChild>
                                    <Link href={`/players/${playerId}/analysis`}>
                                        <AnalysisIcon className="mr-2 h-5 w-5" />
                                        Análisis Avanzado con IA
                                    </Link>
                                 </Button>
                            </div>
                        )}
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
                        <YAxis domain={([dataMin, dataMax]) => [Math.max(0, dataMin - 5), Math.min(100, dataMax + 5)]} />
                        <Tooltip
                            content={({ active, payload, label }) => {
                                if (active && payload && payload.length) {
                                    const data = payload[0].payload;
                                    const changes = ['pac', 'sho', 'pas', 'dri', 'def', 'phy'].map(attr => ({
                                        key: attr,
                                        value: data[attr]
                                    })).filter(item => item.value !== undefined && item.value !== 0);

                                    return (
                                        <div className="rounded-lg border bg-background p-3 shadow-sm">
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
                                            {changes.length > 0 && <Separator className="my-2" />}
                                            <div className="grid grid-cols-3 gap-x-4 gap-y-1">
                                                {changes.map(change => (
                                                    <div key={change.key} className={cn("text-xs font-medium", change.value > 0 ? 'text-green-600' : 'text-red-600')}>
                                                        {change.key.toUpperCase()}: {change.value > 0 ? '+' : ''}{change.value}
                                                    </div>
                                                ))}
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
            

            {isCurrentUserProfile ? (
                <div className="lg:col-span-3">
                    <Tabs defaultValue="evaluations" className="w-full">
                        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3">
                            <TabsTrigger value="evaluations">Mi Historial</TabsTrigger>
                            <TabsTrigger value="created-matches">Partidos Creados</TabsTrigger>
                            <TabsTrigger value="created-players">Jugadores Creados</TabsTrigger>
                        </TabsList>

                        <TabsContent value="evaluations" className="mt-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Historial de Evaluaciones</CardTitle>
                                    <CardDescription>Rendimiento del jugador en los últimos partidos evaluados. Haz clic en un partido para ver el detalle.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {filteredEvaluationsByMatch.length > 0 ? (
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-12"></TableHead>
                                                    <TableHead>Partido</TableHead>
                                                    <TableHead>Equipo</TableHead>
                                                    <TableHead className="text-center">Rating</TableHead>
                                                    <TableHead className="text-center">Goles</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {filteredEvaluationsByMatch.map(({ match, teamName, avgRating, goals, hasNumericRatings, individualEvaluations }) => {
                                                    const isOpen = openAccordion === match.id;
                                                    return (
                                                        <React.Fragment key={match.id}>
                                                            <TableRow onClick={() => setOpenAccordion(isOpen ? null : match.id)} className="cursor-pointer">
                                                                <TableCell><ChevronDown className={cn("transition-transform", isOpen && "rotate-180")} /></TableCell>
                                                                <TableCell className="font-medium">{match.title}</TableCell>
                                                                <TableCell><Badge variant="outline">{teamName}</Badge></TableCell>
                                                                <TableCell className="text-center">
                                                                    {hasNumericRatings ? (
                                                                        <Badge variant={avgRating >= 7 ? 'default' : avgRating >= 5 ? 'secondary' : 'destructive'}>
                                                                            <Star className="mr-1 h-3 w-3" /> {avgRating.toFixed(2)}
                                                                        </Badge>
                                                                    ) : (
                                                                        <Badge variant="outline" className="text-muted-foreground">N/A</Badge>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell className="text-center">
                                                                    <Badge variant="outline"><Goal className="mr-1 h-3 w-3" /> {goals}</Badge>
                                                                </TableCell>
                                                            </TableRow>
                                                            {isOpen && (
                                                                <TableRow>
                                                                    <TableCell colSpan={5}>
                                                                        <div className="p-4 bg-muted/50 rounded-md">
                                                                            <h4 className="font-semibold mb-2">Detalle de Evaluaciones:</h4>
                                                                            <Table>
                                                                                <TableHeader>
                                                                                    <TableRow>
                                                                                        <TableHead>Evaluador</TableHead>
                                                                                        <TableHead className="text-center">Rating</TableHead>
                                                                                        <TableHead>Etiquetas</TableHead>
                                                                                    </TableRow>
                                                                                </TableHeader>
                                                                                <TableBody>
                                                                                    {individualEvaluations.map(ev => (
                                                                                        <TableRow key={ev.id}>
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
                                                                                                {ev.rating !== undefined ? <Badge variant="secondary">{ev.rating}</Badge> : <span className="text-muted-foreground text-xs">-</span>}
                                                                                            </TableCell>
                                                                                            <TableCell>
                                                                                                <div className="flex gap-1 flex-wrap">
                                                                                                    {(ev.performanceTags || []).map((tag, idx) => {
                                                                                                        if (typeof tag === 'object' && tag && 'name' in tag) {
                                                                                                            const typedTag = tag as PerformanceTag;
                                                                                                            return (
                                                                                                                <TooltipProvider key={typedTag.id || idx}>
                                                                                                                    <UiTooltip>
                                                                                                                        <TooltipTrigger asChild>
                                                                                                                            <Badge variant="outline" className="cursor-help">{typedTag.name}</Badge>
                                                                                                                        </TooltipTrigger>
                                                                                                                        <TooltipContent>
                                                                                                                            <p className="font-semibold mb-1">{typedTag.description}</p>
                                                                                                                            {typedTag.effects && typedTag.effects.length > 0 && (
                                                                                                                                <div className="text-xs space-y-0.5">
                                                                                                                                    {typedTag.effects.map((effect, i) => (
                                                                                                                                        <p key={i} className={cn(effect.change > 0 ? 'text-green-600' : 'text-red-600')}>
                                                                                                                                            {effect.attribute.toUpperCase()}: {effect.change > 0 ? '+' : ''}{effect.change}
                                                                                                                                        </p>
                                                                                                                                    ))}
                                                                                                                                </div>
                                                                                                                            )}
                                                                                                                        </TooltipContent>
                                                                                                                    </UiTooltip>
                                                                                                                </TooltipProvider>
                                                                                                            );
                                                                                                        }
                                                                                                        return null;
                                                                                                    })}
                                                                                                    {(!ev.performanceTags || ev.performanceTags.length === 0) && <span className="text-muted-foreground text-xs">-</span>}
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
                                                })}
                                            </TableBody>
                                        </Table>
                                    ) : (
                                        <CardContent className="text-center text-muted-foreground py-10">
                                            Este jugador aún no tiene evaluaciones registradas.
                                        </CardContent>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="created-matches" className="mt-6">
                            <Card>
                                <CardContent className="pt-6">
                                    <div className="relative w-full overflow-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Partido</TableHead>
                                                    <TableHead>Fecha</TableHead>
                                                    <TableHead>Estado</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {sortedCreatedMatches && sortedCreatedMatches.length > 0 ? sortedCreatedMatches.map(match => {
                                                    const statusInfo = statusConfig[match.status] || statusConfig.completed;
                                                    return (
                                                        <TableRow key={match.id}>
                                                            <TableCell className="font-medium">{match.title}</TableCell>
                                                            <TableCell>{format(new Date(match.date), 'dd/MM/yyyy', { locale: es })}</TableCell>
                                                            <TableCell>
                                                                <Badge variant="outline" className={cn(statusInfo.className)}>{statusInfo.label}</Badge>
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                }) : (
                                                    <TableRow>
                                                        <TableCell colSpan={3} className="text-center h-24">No has creado ningún partido.</TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                        <TabsContent value="created-players" className="mt-6">
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
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle>Historial de Evaluaciones</CardTitle>
                        <CardDescription>Rendimiento del jugador en los últimos partidos evaluados.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {filteredEvaluationsByMatch.length > 0 ? filteredEvaluationsByMatch.map(({ match, teamName, avgRating, hasNumericRatings }) => (
                            <Card key={match.id} className="bg-muted/50">
                                <CardHeader className="flex flex-row items-center justify-between p-4">
                                    <div>
                                        <CardTitle className="text-lg">{match.title}</CardTitle>
                                        <CardDescription>{format(new Date(match.date), 'dd MMM, yyyy', { locale: es })}</CardDescription>
                                        <Badge variant="outline" className="mt-2">{teamName}</Badge>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        {hasNumericRatings ? (
                                            <Badge variant={avgRating >= 7 ? 'default' : avgRating >= 5 ? 'secondary' : 'destructive'} className="text-base">
                                                <Star className="mr-1 h-3 w-3" /> {avgRating.toFixed(2)}
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-muted-foreground">N/A</Badge>
                                        )}
                                    </div>
                                </CardHeader>
                            </Card>
                        )) : (
                            <CardContent className="text-center text-muted-foreground py-10">
                                Este jugador aún no tiene evaluaciones registradas.
                            </CardContent>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    </>
  );
}
