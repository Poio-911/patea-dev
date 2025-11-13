
'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useCollection, useFirestore, useUser, useDoc } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import type { GroupTeam } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Swords, Search } from 'lucide-react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { JerseyPreview } from '@/components/team-builder/jersey-preview';
import { Card, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { sendTeamChallengeAction } from '@/lib/actions/server-actions';
import { celebrationConfetti } from '@/lib/animations';

export default function FindOpponentForTeamPage() {
    const { teamId } = useParams();
    const firestore = useFirestore();
    const { user } = useUser();
    const [searchTerm, setSearchTerm] = useState('');
    const [isChallenging, setIsChallenging] = useState<string | null>(null);
    const { toast } = useToast();

    const teamRef = useMemo(() => {
        if (!firestore || !teamId) return null;
        return doc(firestore, 'teams', teamId as string);
    }, [firestore, teamId]);
    const { data: challengingTeam, loading: teamLoading } = useDoc<GroupTeam>(teamRef);

    const teamsQuery = useMemo(() => {
        if (!firestore || !user?.uid) return null;
        return query(
            collection(firestore, 'teams'),
            where('isChallengeable', '==', true),
            where('createdBy', '!=', user.uid)
        );
    }, [firestore, user?.uid]);

    const { data: teams, loading: teamsLoading } = useCollection<GroupTeam>(teamsQuery);

    const filteredTeams = useMemo(() => {
        if (!teams) return [];
        return teams.filter(team => 
            team.id !== teamId && 
            team.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [teams, searchTerm, teamId]);
    
    const handleChallenge = async (challengedTeamId: string) => {
        if (!user || !teamId) return;
        setIsChallenging(challengedTeamId);
        try {
            const result = await sendTeamChallengeAction(teamId as string, challengedTeamId, user.uid);
            if ('error' in result) {
                throw new Error(result.error);
            }
            celebrationConfetti();
            toast({
                title: '¡Desafío Enviado!',
                description: 'El capitán del otro equipo ha sido notificado.',
            });
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.message || 'No se pudo enviar el desafío.',
            });
        } finally {
            setIsChallenging(null);
        }
    };

    const loading = teamLoading || teamsLoading;

    if (loading) {
        return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }
    
    if (!challengingTeam) {
        return (
            <div className="text-center p-8">
                <Alert variant="destructive">
                    <AlertTitle>Equipo no encontrado</AlertTitle>
                    <AlertDescription>No se pudo encontrar el equipo con el que querés desafiar.</AlertDescription>
                </Alert>
                <Button asChild variant="link" className="mt-4">
                    <Link href="/competitions">Volver a Competiciones</Link>
                </Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <PageHeader 
                    title={`Buscar Rival para ${challengingTeam.name}`}
                    description="Encontrá equipos abiertos a desafíos y enviales una invitación." />
                <Button asChild variant="outline">
                    <Link href="/competitions">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Elegir otro equipo
                    </Link>
                </Button>
            </div>
            
            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Buscar equipo por nombre..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-10"
                />
            </div>
            
            {filteredTeams.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {filteredTeams.map(team => (
                        <Card key={team.id} className="overflow-hidden h-full flex flex-col">
                             <CardHeader className="flex-grow flex flex-col items-center justify-center p-4">
                                 <div className="w-24 h-24 mx-auto">
                                    <JerseyPreview jersey={team.jersey} size="lg" />
                                 </div>
                                 <CardTitle className="text-center mt-2 text-base font-bold">{team.name}</CardTitle>
                             </CardHeader>
                             <CardFooter className="p-2 border-t">
                                <Button className="w-full" variant="secondary" onClick={() => handleChallenge(team.id)} disabled={!!isChallenging}>
                                    {isChallenging === team.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Swords className="mr-2 h-4 w-4" />}
                                    {isChallenging === team.id ? 'Enviando...' : 'Desafiar'}
                                </Button>
                             </CardFooter>
                        </Card>
                    ))}
                </div>
            ) : (
                 <Alert>
                    <AlertTitle>No hay rivales disponibles</AlertTitle>
                    <AlertDescription>
                        Actualmente no hay equipos abiertos a desafíos que coincidan con tu búsqueda. ¡Volvé a intentarlo más tarde!
                    </AlertDescription>
                </Alert>
            )}
        </div>
    );
}
