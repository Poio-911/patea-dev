
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useDoc, useCollection, useFirestore, useUser } from '@/firebase';
import { 
  doc, 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
} from 'firebase/firestore';
import type { Player, Evaluation, Match, OvrHistory, UserProfile, PerformanceTag, AttributeKey } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, BarChart2, Star, Goal, Eye, ChevronDown, CheckCircle, BrainCircuit, Sparkles, Zap, Target, Send, Footprints, Shield, Dumbbell } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Tooltip as UiTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { FirstTimeInfoDialog } from './first-time-info-dialog';
import Link from 'next/link';
import { AnalysisIcon } from './icons/analysis-icon';
import { ImageCropperDialog } from '@/components/image-cropper-dialog';
import { generatePlayerCardImageAction } from '@/lib/actions';
import { AttributesHelpDialog } from './attributes-help-dialog';

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

const statIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  RIT: Zap,
  TIR: Target,
  PAS: Send,
  REG: Footprints,
  DEF: Shield,
  FIS: Dumbbell,
};

const Stat = ({ label, value }: { label: string; value: number }) => {
  const Icon = statIcons[label] || Zap;
  return (
    <div className="flex items-center justify-between text-base py-2 group">
        <div className="flex items-center gap-2 font-semibold text-muted-foreground">
            <Icon className="h-5 w-5 group-hover:text-primary transition-colors" />
            <span>{label}</span>
        </div>
        <span className="font-bold text-lg">{value}</span>
    </div>
  );
};


type DetailedEvaluation = Evaluation & { evaluatorName?: string; evaluatorPhoto?: string };

type PerformanceLevel = 'Excelente' | 'Bueno' | 'Medio' | 'Regular' | 'Bajo';

type MatchEvaluationSummary = {
    match: Match;
    teamName: string;
    hasNumericRatings: boolean;
    performance: {
        level: PerformanceLevel;
        color: string;
    };
    goals: number;
    individualEvaluations: DetailedEvaluation[];
};

const getPerformanceFromRating = (rating: number): { level: PerformanceLevel; color: string } => {
    if (rating >= 9) return { level: 'Excelente', color: 'bg-green-500' };
    if (rating >= 7) return { level: 'Bueno', color: 'bg-green-400' };
    if (rating >= 5) return { level: 'Medio', color: 'bg-yellow-500' };
    if (rating >= 3) return { level: 'Regular', color: 'bg-orange-500' };
    return { level: 'Bajo', color: 'bg-red-500' };
};

const getPerformanceFromTags = (tags: PerformanceTag[]): { level: PerformanceLevel; color: string } => {
    if (!tags || tags.length === 0) return { level: 'Medio', color: 'bg-yellow-500' };
    const score = tags.reduce((acc, tag) => {
        if (tag.impact === 'positive') return acc + 1;
        if (tag.impact === 'negative') return acc - 1;
        return acc;
    }, 0);

    if (score >= 3) return { level: 'Excelente', color: 'bg-green-500' };
    if (score > 0) return { level: 'Bueno', color: 'bg-green-400' };
    if (score === 0) return { level: 'Medio', color: 'bg-yellow-500' };
    if (score < 0) return { level: 'Regular', color: 'bg-orange-500' };
    return { level: 'Bajo', color: 'bg-red-500' };
};

export default function PlayerProfileView({ playerId }: PlayerProfileViewProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [evaluatorProfiles, setEvaluatorProfiles] = useState<Record<string, {displayName: string, photoURL: string}>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [openAccordion, setOpenAccordion] = useState<string | null>(null);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  const isCurrentUserProfile = user?.uid === playerId;

  const playerRef = useMemo(() => firestore && playerId ? doc(firestore, 'players', playerId) : null, [firestore, playerId]);
  const { data: player, loading: playerLoading } = useDoc<Player>(playerRef);

 const createdPlayersQuery = useMemo(() => {
    if (!firestore || !playerId) return null;
    return query(collection(firestore, 'players'), where('ownerUid', '==', playerId));
  }, [firestore, playerId]);
  const { data: createdPlayers, loading: createdPlayersLoading } = useCollection<Player>(createdPlayersQuery);
  
  const createdMatchesQuery = useMemo(() => {
    if (!firestore || !playerId) return null;
    return query(collection(firestore, 'matches'), where('ownerUid', '==', playerId));
  }, [firestore, playerId]);
  const { data: createdMatches, loading: createdMatchesLoading } = useCollection<Match>(createdMatchesQuery);
  
  const manualPlayers = useMemo(() => {
    if(!createdPlayers) return [];
    // Filter out the player's own profile if they are the owner
    return createdPlayers.filter(p => p.id !== p.ownerUid);
  }, [createdPlayers]);
  
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
      const hasNumericRatings = ratings.length > 0;
      const goals = summary.evaluations.reduce((sum, ev) => sum + (ev.goals || 0), 0);
      const allTags = summary.evaluations.flatMap(ev => ev.performanceTags || [])
          .filter((tag): tag is PerformanceTag => typeof tag === 'object' && tag !== null && 'impact' in tag);
      
      let performance: { level: PerformanceLevel; color: string };
      if (hasNumericRatings) {
          const avgRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
          performance = getPerformanceFromRating(avgRating);
      } else {
          performance = getPerformanceFromTags(allTags);
      }

      const team = summary.match.teams?.find(t => t.players.some(p => p.uid === playerId));

      return {
        match: summary.match,
        teamName: team?.name || '',
        hasNumericRatings,
        performance,
        goals,
        individualEvaluations: summary.evaluations,
      };
    }).sort((a, b) => new Date(b.match.date).getTime() - new Date(a.match.date).getTime());

  }, [evaluations, matches, evaluatorProfiles, isLoading, playerId]);

  const chartData = useMemo(() => {
    if (!ovrHistory) return [];
    if (ovrHistory.length === 0 && player) {
        return [{name: 'Inicial', OVR: player.ovr, Fecha: format(new Date(), 'dd/MM')}]
    }
    return ovrHistory.map((entry, index) => ({
      name: `P. ${index + 1}`,
      OVR: entry.newOVR,
      Fecha: format(new Date(entry.date), 'dd/MM'),
      ...entry.attributeChanges
    }));
  }, [ovrHistory, player]);

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

  const loading = playerLoading || historyLoading || isLoading || createdMatchesLoading || createdPlayersLoading;


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
                        <div className="flex flex-col items-center gap-4">
                            <div className="text-center">
                                <h2 className="text-3xl font-bold font-headline">{player.name}</h2>
                                <div className="flex items-center justify-center gap-4 mt-2">
                                    <span className={cn("text-5xl font-bold", positionColors[player.position])}>{player.ovr}</span>
                                    <Badge variant="secondary" className="text-lg">{player.position}</Badge>
                                </div>
                            </div>
                            <div className="relative w-full flex justify-center">
                                {isCurrentUserProfile ? (
                                    <ImageCropperDialog
                                        player={player}
                                        onGenerateAI={handleGenerateAIPhoto}
                                        isGeneratingAI={isGeneratingAI}
                                        onSaveComplete={() => window.location.reload()}
                                    >
                                        <button className="group relative">
                                            <Avatar className="h-40 w-40 border-4 border-primary/50 group-hover:scale-105 group-hover:ring-4 group-hover:ring-primary/50 transition-all duration-300">
                                                <AvatarImage src={player.photoUrl} alt={player.name} data-ai-hint="player portrait" />
                                                <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Eye className="h-10 w-10 text-white" />
                                            </div>
                                        </button>
                                    </ImageCropperDialog>
                                ) : (
                                    <Avatar className="h-40 w-40 border-4 border-primary/50">
                                        <AvatarImage src={player.photoUrl} alt={player.name} data-ai-hint="player portrait" />
                                        <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                )}
                            </div>
                        </div>
                        
                        <Separator className="my-6"/>
                        <div className="w-full px-4">
                            <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-bold text-lg">Atributos</h4>
                                <AttributesHelpDialog />
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-1 gap-x-8">
                                <Stat label="RIT" value={player.pac} icon={statIcons.RIT} />
                                <Stat label="TIR" value={player.sho} icon={statIcons.TIR} />
                                <Stat label="PAS" value={player.pas} icon={statIcons.PAS} />
                                <Stat label="REG" value={player.dri} icon={statIcons.REG} />
                                <Stat label="DEF" value={player.def} icon={statIcons.DEF} />
                                <Stat label="FIS" value={player.phy} icon={statIcons.FIS} />
                            </div>
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

                <div className="lg:col-span-2 space-y-8">
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
                                                        <div key={change.key} className={cn("text-xs font-medium", (change.value || 0) > 0 ? 'text-green-600' : 'text-red-600')}>
                                                            {change.key.toUpperCase()}: {(change.value || 0) > 0 ? '+' : ''}{change.value}
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
                    <Card>
                      <CardHeader>
                          <CardTitle>Historial de Evaluaciones</CardTitle>
                          <CardDescription>Rendimiento del jugador en los últimos partidos evaluados. Haz clic en un partido para ver el detalle.</CardDescription>
                      </CardHeader>
                      <CardContent>
                          {filteredEvaluationsByMatch.length > 0 ? (
                              <Table>
                                  <TableHeader>
                                      <TableRow>
                                          <TableHead>Partido</TableHead>
                                          <TableHead>Fecha</TableHead>
                                          <TableHead className="text-right">Acciones</TableHead>
                                      </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                      {filteredEvaluationsByMatch.map(({ match, teamName, hasNumericRatings, performance, goals, individualEvaluations }) => {
                                          const isOpen = openAccordion === match.id;
                                          return (
                                              <React.Fragment key={match.id}>
                                                  <TableRow onClick={() => setOpenAccordion(isOpen ? null : match.id)} className="cursor-pointer">
                                                      <TableCell className="font-medium">{match.title}</TableCell>
                                                      <TableCell>{format(new Date(match.date), 'dd MMM', { locale: es })}</TableCell>
                                                      <TableCell className="text-right">
                                                          <Button variant="ghost" size="sm">
                                                              Ver Detalles
                                                              <ChevronDown className={cn("ml-2 h-4 w-4 transition-transform", isOpen && "rotate-180")} />
                                                          </Button>
                                                      </TableCell>
                                                  </TableRow>
                                                  {isOpen && (
                                                      <TableRow>
                                                          <TableCell colSpan={3} className="p-0">
                                                              <div className="p-4 bg-muted/50 rounded-md">
                                                                  <div className="flex justify-between items-center mb-2">
                                                                      <div className="flex items-center gap-4">
                                                                          <Badge variant="outline">Equipo: {teamName}</Badge>
                                                                          <Badge variant="outline"><Goal className="mr-1 h-3 w-3" /> {goals} Goles</Badge>
                                                                      </div>
                                                                       <Badge style={{ backgroundColor: performance.color }} className="text-white">
                                                                          {performance.level}
                                                                      </Badge>
                                                                  </div>
                                                                  <h4 className="font-semibold mb-2 mt-4">Detalle de Evaluaciones:</h4>
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
                                                                                            if (tag && typeof tag === 'object' && 'name' in tag) {
                                                                                                const typedTag = tag as PerformanceTag;
                                                                                                return (
                                                                                                    <UiTooltipProvider key={typedTag.id || idx}>
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
                                                                                                    </UiTooltipProvider>
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
                              <div className="text-center text-muted-foreground py-10">Este jugador aún no tiene evaluaciones registradas.</div>
                          )}
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                          <CardTitle>Actividad de {isCurrentUserProfile ? 'Mi' : 'su'} Actividad</CardTitle>
                          <CardDescription>Partidos y jugadores creados por {isCurrentUserProfile ? 'vos' : player.name}.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                          <h3 className="font-semibold">Partidos Organizados ({sortedCreatedMatches.length})</h3>
                          {sortedCreatedMatches.length > 0 ? (
                            <Table>
                                <TableHeader><TableRow><TableHead>Partido</TableHead><TableHead>Fecha</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader>
                                <TableBody>{sortedCreatedMatches.slice(0, 3).map(match => {
                                      const statusInfo = statusConfig[match.status] || statusConfig.completed;
                                      return (<TableRow key={match.id}><TableCell className="font-medium">{match.title}</TableCell><TableCell>{format(new Date(match.date), 'dd/MM/yyyy', { locale: es })}</TableCell><TableCell><Badge variant="outline" className={cn(statusInfo.className)}>{statusInfo.label}</Badge></TableCell></TableRow>);
                                  })}
                                </TableBody>
                            </Table>
                          ) : <p className="text-sm text-muted-foreground">Este jugador no ha creado ningún partido.</p>}
                          
                          <Separator />

                          <h3 className="font-semibold">Jugadores Manuales Creados ({manualPlayers.length})</h3>
                           {manualPlayers.length > 0 ? (
                                <Table>
                                    <TableHeader><TableRow><TableHead>Jugador</TableHead><TableHead>Posición</TableHead><TableHead>OVR</TableHead></TableRow></TableHeader>
                                    <TableBody>{manualPlayers.slice(0, 3).map(p => (
                                          <TableRow key={p.id}>
                                              <TableCell><div className="flex items-center gap-3"><Avatar className="h-9 w-9"><AvatarImage src={p.photoUrl} alt={p.name} /><AvatarFallback>{p.name.charAt(0)}</AvatarFallback></Avatar><span className="font-medium">{p.name}</span></div></TableCell>
                                              <TableCell><Badge variant="outline">{p.position}</Badge></TableCell>
                                              <TableCell><Badge>{p.ovr}</Badge></TableCell>
                                          </TableRow>
                                    ))}</TableBody>
                                </Table>
                           ) : <p className="text-sm text-muted-foreground">Este jugador no ha creado jugadores manuales.</p>}
                      </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    </>
  );
}
