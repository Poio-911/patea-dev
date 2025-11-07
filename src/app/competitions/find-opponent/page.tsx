
'use client';

import { useState, useMemo } from 'react';
import { useCollection, useFirestore } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { GroupTeam, Player } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Swords } from 'lucide-react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { JerseyPreview } from '@/components/team-builder/jersey-preview';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

export default function FindOpponentPage() {
    const firestore = useFirestore();
    const [searchTerm, setSearchTerm] = useState('');

    const teamsQuery = useMemo(() => {
        if (!firestore) return null;
        return collection(firestore, 'teams');
    }, [firestore]);

    const { data: teams, loading: teamsLoading } = useCollection<GroupTeam>(teamsQuery);
    
    // This is a placeholder, we'll need to fetch real player data
    const { data: allPlayers, loading: playersLoading } = useCollection<Player>(
        firestore ? collection(firestore, 'players') : null
    );

    const filteredTeams = useMemo(() => {
        if (!teams) return [];
        return teams.filter(team => team.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [teams, searchTerm]);
    
    const loading = teamsLoading || playersLoading;

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <PageHeader title="Buscar Rival" description="Encontrá otros equipos para desafiar a un amistoso." />
                <Button asChild variant="outline">
                    <Link href="/groups">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Volver
                    </Link>
                </Button>
            </div>
            
            <Input 
                placeholder="Buscar equipo por nombre..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="max-w-sm"
            />
            
            {loading ? (
                <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : (
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
                                <Button className="w-full" variant="secondary">
                                    <Swords className="mr-2 h-4 w-4" />
                                    Desafiar
                                </Button>
                             </CardFooter>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
