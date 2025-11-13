
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { TeamAvailabilityPost, GroupTeam } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Swords, MapPin, Calendar, Clock } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { challengeTeamPostAction, getAvailableTeamPostsAction } from '@/lib/actions/server-actions';
import { JerseyPreview } from '@/components/team-builder/jersey-preview';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { celebrationConfetti } from '@/lib/animations';
import { Badge } from '@/components/ui/badge';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function ChallengeTeamPage() {
    const { postId } = useParams();
    const { user } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const { toast } = useToast();

    const [post, setPost] = useState<TeamAvailabilityPost | null>(null);
    const [loading, setLoading] = useState(true);
    const [challenging, setChallenging] = useState(false);
    const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
    const [showCodeOfConduct, setShowCodeOfConduct] = useState(false);

    // Obtener equipos del usuario
    const myTeamsQuery = useMemo(() => {
        if (!firestore || !user?.uid) return null;
        return query(
            collection(firestore, 'teams'),
            where('createdBy', '==', user.uid)
        );
    }, [firestore, user?.uid]);

    const { data: myTeams, loading: teamsLoading } = useCollection<GroupTeam>(myTeamsQuery);

    // Cargar el post
    useEffect(() => {
        if (!user?.uid || !postId) {
            setLoading(false);
            return;
        }

        const fetchPost = async () => {
            try {
                const result = await getAvailableTeamPostsAction(user.uid);
                if ('error' in result) {
                    throw new Error(result.error);
                }
                if ('posts' in result && result.posts) {
                    const foundPost = result.posts.find((p: TeamAvailabilityPost) => p.id === postId);
                    if (!foundPost) {
                        throw new Error('Postulación no encontrada');
                    }
                    setPost(foundPost);
                }
            } catch (error: any) {
                toast({
                    variant: 'destructive',
                    title: 'Error',
                    description: error.message || 'No se pudo cargar la postulación.',
                });
            } finally {
                setLoading(false);
            }
        };

        fetchPost();
    }, [postId, user?.uid, toast]);

    const handleInitiateChallenge = () => {
        if (!selectedTeamId) {
            toast({
                variant: 'destructive',
                title: 'Seleccioná un equipo',
                description: 'Primero seleccioná el equipo con el que querés desafiar.',
            });
            return;
        }
        setShowCodeOfConduct(true);
    };

    const handleConfirmChallenge = async () => {
        if (!selectedTeamId || !user || !postId) return;

        setShowCodeOfConduct(false);
        setChallenging(true);
        try {
            const result = await challengeTeamPostAction(postId as string, selectedTeamId, user.uid);
            if ('error' in result && result.error) {
                throw new Error(String(result.error));
            }

            celebrationConfetti();
            toast({
                title: '¡Desafío Aceptado!',
                description: 'El partido amistoso fue creado exitosamente.',
            });

            // Redirigir al partido creado
            if ('matchId' in result && result.matchId) {
                router.push(`/matches/${result.matchId}`);
            } else {
                router.push('/competitions');
            }
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.message || 'No se pudo aceptar el desafío.',
            });
        } finally {
            setChallenging(false);
        }
    };

    if (loading || teamsLoading) {
        return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    if (!user || !post) {
        return (
            <div className="text-center p-8">
                <Alert variant="destructive">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>No se pudo cargar la información del desafío.</AlertDescription>
                </Alert>
                <Button asChild variant="link" className="mt-4">
                    <Link href="/competitions">Volver</Link>
                </Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 max-w-4xl mx-auto">
            <div className="flex items-center justify-between">
                <PageHeader
                    title="Seleccionar Tu Equipo"
                    description="Elegí el equipo con el que querés desafiar"
                />
                <Button asChild variant="outline" className="shrink-0">
                    <Link href="/competitions">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Volver
                    </Link>
                </Button>
            </div>

            {/* Equipo a desafiar */}
            <Card className="border-2">
                <CardHeader className="bg-muted/30">
                    <CardTitle className="flex items-center gap-2">
                        <Swords className="h-5 w-5 text-primary" />
                        Equipo a Desafiar
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="flex flex-col md:flex-row gap-6">
                        <div className="flex flex-col items-center">
                            <div className="w-24 h-24">
                                <JerseyPreview jersey={post.jersey} size="lg" />
                            </div>
                            <h3 className="font-bold text-xl mt-3">{post.teamName}</h3>
                            <Badge variant="secondary" className="mt-2">Rival</Badge>
                        </div>
                        <div className="flex-1 space-y-3">
                            <div className="flex items-start gap-2">
                                <MapPin className="h-4 w-4 mt-1 text-muted-foreground flex-shrink-0" />
                                <div>
                                    <p className="font-medium">{post.location.name}</p>
                                    <p className="text-sm text-muted-foreground">{post.location.address}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm">{format(new Date(post.date), "EEEE, d 'de' MMMM, yyyy", { locale: es })}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm">{post.time}</span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Mis equipos */}
            <div>
                <h2 className="text-xl font-bold mb-4">Tus Equipos</h2>
                {myTeams && myTeams.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {myTeams.map(team => (
                            <Card
                                key={team.id}
                                className={`cursor-pointer transition-all ${selectedTeamId === team.id ? 'ring-2 ring-primary shadow-lg' : 'hover:shadow-md'
                                    }`}
                                onClick={() => setSelectedTeamId(team.id)}
                            >
                                <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                                    <div className="w-16 h-16">
                                        <JerseyPreview jersey={team.jersey} size="md" />
                                    </div>
                                    <div className="flex-1">
                                        <CardTitle className="text-lg">{team.name}</CardTitle>
                                        <CardDescription>{team.members?.length || 0} jugadores</CardDescription>
                                    </div>
                                    {selectedTeamId === team.id && (
                                        <Badge>Seleccionado</Badge>
                                    )}
                                </CardHeader>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <Alert>
                        <AlertTitle>No tenés equipos</AlertTitle>
                        <AlertDescription>
                            Necesitás crear un equipo antes de poder desafiar a otros.
                        </AlertDescription>
                        <Button asChild variant="link" className="mt-2">
                            <Link href="/groups">Crear Equipo</Link>
                        </Button>
                    </Alert>
                )}
            </div>

            {/* Botón de desafío */}
            {myTeams && myTeams.length > 0 && (
                <div className="flex justify-end gap-3">
                    <Button asChild variant="outline">
                        <Link href="/competitions">Cancelar</Link>
                    </Button>
                    <Button
                        size="lg"
                        onClick={handleInitiateChallenge}
                        disabled={!selectedTeamId || challenging}
                    >
                        {challenging ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Creando Partido...
                            </>
                        ) : (
                            <>
                                <Swords className="mr-2 h-4 w-4" />
                                Confirmar Desafío
                            </>
                        )}
                    </Button>
                </div>
            )}

            {/* Código de conducta */}
            <AlertDialog open={showCodeOfConduct} onOpenChange={setShowCodeOfConduct}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Código de Conducta</AlertDialogTitle>
                        <AlertDialogDescription className="space-y-3">
                            <p>
                                Antes de confirmar el desafío, por favor recordá que:
                            </p>
                            <ul className="list-disc list-inside space-y-2 text-sm">
                                <li>Debés respetar a tus rivales en todo momento</li>
                                <li>No se toleran insultos ni faltas de respeto</li>
                                <li>El juego limpio es fundamental para todos</li>
                                <li>Recordá que esto es para divertirse y compartir</li>
                            </ul>
                            <p className="font-medium">
                                ¿Aceptás estas condiciones y querés continuar con el desafío?
                            </p>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmChallenge}>
                            Aceptar y Desafiar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
