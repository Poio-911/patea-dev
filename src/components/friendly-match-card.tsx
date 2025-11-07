'use client';

import { useState, useEffect } from 'react';
import type { Match, UserProfile } from '@/lib/types';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { JerseyPreview } from './team-builder/jersey-preview';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Calendar, Clock, MapPin, Users, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';
import { useFirestore } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface FriendlyMatchCardProps {
    match: Match;
}

export function FriendlyMatchCard({ match }: FriendlyMatchCardProps) {
    const firestore = useFirestore();
    const [creator, setCreator] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCreator = async () => {
            if (!firestore || !match.ownerUid) return;
            try {
                const userDoc = await getDoc(doc(firestore, 'users', match.ownerUid));
                if (userDoc.exists()) {
                    setCreator(userDoc.data() as UserProfile);
                }
            } catch (error) {
                console.error('Error fetching creator:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchCreator();
    }, [firestore, match.ownerUid]);

    const team1 = match.teams?.[0];
    const team2 = match.teams?.[1];

    if (!team1 || !team2) return null;

    return (
        <Card className="overflow-hidden hover:shadow-lg transition-shadow">
            <CardHeader className="bg-gradient-to-r from-primary/10 via-background to-primary/10 pb-8">
                <div className="flex items-center justify-center gap-8">
                    {/* Team 1 */}
                    <div className="flex flex-col items-center gap-3 flex-1">
                        <div className="w-20 h-20">
                            <JerseyPreview jersey={team1.jersey!} size="lg" />
                        </div>
                        <div className="text-center">
                            <h3 className="font-bold text-lg">{team1.name}</h3>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                                <Users className="h-3 w-3" />
                                <span>{team1.players.length} jugadores</span>
                            </div>
                        </div>
                    </div>

                    {/* VS Divider */}
                    <div className="flex flex-col items-center">
                        <div className="bg-primary text-primary-foreground rounded-full w-12 h-12 flex items-center justify-center font-bold text-lg">
                            VS
                        </div>
                    </div>

                    {/* Team 2 */}
                    <div className="flex flex-col items-center gap-3 flex-1">
                        <div className="w-20 h-20">
                            <JerseyPreview jersey={team2.jersey!} size="lg" />
                        </div>
                        <div className="text-center">
                            <h3 className="font-bold text-lg">{team2.name}</h3>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                                <Users className="h-3 w-3" />
                                <span>{team2.players.length} jugadores</span>
                            </div>
                        </div>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="pt-6 space-y-4">
                {/* Match Details */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{format(new Date(match.date), "EEEE, d 'de' MMMM, yyyy", { locale: es })}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>{match.time}</span>
                    </div>
                    <div className="flex items-start gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="font-medium">{match.location.name}</p>
                            <p className="text-xs text-muted-foreground">{match.location.address}</p>
                        </div>
                    </div>
                </div>

                {/* Creator Info */}
                {!loading && creator && (
                    <div className="flex items-center gap-2 pt-2 border-t">
                        <Avatar className="h-6 w-6">
                            <AvatarImage src={creator.photoURL || undefined} />
                            <AvatarFallback className="text-xs">
                                {creator.displayName?.charAt(0).toUpperCase() || 'U'}
                            </AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-muted-foreground">
                            Organizado por {creator.displayName || 'Usuario'}
                        </span>
                    </div>
                )}

                {/* Status Badge */}
                <div className="flex justify-center">
                    <Badge variant={match.status === 'upcoming' ? 'default' : 'secondary'}>
                        {match.status === 'upcoming' && 'Próximo'}
                        {match.status === 'active' && 'En curso'}
                        {match.status === 'completed' && 'Finalizado'}
                        {match.status === 'evaluated' && 'Evaluado'}
                    </Badge>
                </div>
            </CardContent>

            <CardFooter className="flex gap-2 border-t pt-4">
                <Button asChild variant="outline" className="flex-1">
                    <Link href={`/matches/${match.id}`}>
                        <Users className="mr-2 h-4 w-4" />
                        Ver Equipos
                    </Link>
                </Button>
                <Button asChild className="flex-1">
                    <Link href={`/matches/${match.id}`}>
                        <MessageCircle className="mr-2 h-4 w-4" />
                        Chat
                    </Link>
                </Button>
            </CardFooter>
        </Card>
    );
}
