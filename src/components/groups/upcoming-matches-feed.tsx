
'use client';

import type { Match } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, MapPin, Newspaper } from 'lucide-react';
import Link from 'next/link';
import { Button } from '../ui/button';

interface UpcomingMatchesFeedProps {
    matches: Match[];
}

export function UpcomingMatchesFeed({ matches }: UpcomingMatchesFeedProps) {
    if (matches.length === 0) {
        return null; // Don't render anything if there are no upcoming matches
    }

    return (
        <div>
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <Newspaper className="h-6 w-6 text-primary"/>
                En la Pizarra
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {matches.map(match => (
                    <Link key={match.id} href={`/matches`} passHref>
                        <Card className="h-full hover:bg-muted/50 transition-colors">
                            <CardHeader>
                                <CardTitle className="text-base">{match.title}</CardTitle>
                                <CardDescription className="text-xs">{format(new Date(match.date), "EEEE, d MMM, yyyy", { locale: es })}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <MapPin className="h-3 w-3" />
                                    <span>{match.location.name}</span>
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>
        </div>
    )
}
