
'use client';

import { useMemo } from 'react';
import type { Player } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Star, Goal, Shield, TrendingUp, Users } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

interface GroupStatsCardsProps {
    players: Player[];
}

const StatCard = ({ title, icon, data }: { title: string, icon: React.ReactNode, data: { name: string; value: string | number; photoUrl?: string }[] }) => (
    <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-muted-foreground">
                {icon}
                {title}
            </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
            {data.length > 0 ? data.map((item, index) => (
                <div key={index} className="flex items-center gap-3">
                    <Avatar className="h-9 w-9 border">
                        <AvatarImage src={item.photoUrl} alt={item.name} />
                        <AvatarFallback>{item.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                        <p className="font-semibold text-sm truncate">{item.name}</p>
                    </div>
                    <p className="font-bold text-lg text-primary">{item.value}</p>
                </div>
            )) : <p className="text-sm text-muted-foreground text-center py-4">No hay datos</p>}
        </CardContent>
    </Card>
);

export function GroupStatsCards({ players }: GroupStatsCardsProps) {

    const topPlayers = useMemo(() => {
        return [...players].sort((a, b) => b.ovr - a.ovr).slice(0, 3).map(p => ({
            name: p.name,
            value: p.ovr,
            photoUrl: p.photoUrl
        }));
    }, [players]);
    
    const topGoalScorers = useMemo(() => {
        return [...players].sort((a, b) => (b.stats?.goals || 0) - (a.stats?.goals || 0)).slice(0, 3).map(p => ({
            name: p.name,
            value: p.stats?.goals || 0,
            photoUrl: p.photoUrl
        }));
    }, [players]);

    const mostMatchesPlayed = useMemo(() => {
        return [...players].sort((a, b) => (b.stats?.matchesPlayed || 0) - (a.stats?.matchesPlayed || 0)).slice(0, 3).map(p => ({
            name: p.name,
            value: p.stats?.matchesPlayed || 0,
            photoUrl: p.photoUrl
        }));
    }, [players]);

    return (
        <div>
            <h2 className="text-2xl font-bold mb-4">Estadísticas del Grupo</h2>
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <StatCard title="Mejores Jugadores" icon={<Star className="h-5 w-5" />} data={topPlayers} />
                <StatCard title="Máximos Goleadores" icon={<Goal className="h-5 w-5" />} data={topGoalScorers} />
                <StatCard title="Más Partidos Jugados" icon={<Users className="h-5 w-5" />} data={mostMatchesPlayed} />
            </div>
        </div>
    );
}
