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
    <div className="bg-card text-card-foreground rounded-xl border border-border p-4 hover:border-primary/30 transition-all shadow-sm group">
        <div className="flex items-center gap-2 mb-4 text-primary font-headline uppercase tracking-wide text-sm font-bold">
            <div className="p-1.5 bg-primary/10 rounded-md group-hover:bg-primary/20 transition-colors">
                {icon}
            </div>
            {title}
        </div>
        <div className="space-y-3">
            {data.length > 0 ? data.map((item, index) => (
                <div key={index} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="relative">
                        <Avatar className="h-10 w-10 border-2 border-background shadow-sm">
                            <AvatarImage src={item.photoUrl} alt={item.name} />
                            <AvatarFallback className="bg-muted text-muted-foreground font-bold">{item.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        {index === 0 && (
                            <div className="absolute -top-1 -right-1 bg-yellow-400 text-[10px] items-center justify-center flex h-4 w-4 rounded-full text-white font-bold shadow-sm ring-2 ring-background">
                                1
                            </div>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-card-foreground truncate">{item.name}</p>
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="font-headline font-black text-xl text-primary">{item.value}</span>
                    </div>
                </div>
            )) : <p className="text-sm text-muted-foreground text-center py-4 italic">Sin datos registrados</p>}
        </div>
    </div>
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
        <div className="space-y-4">
            <StatCard title="Top Valoración" icon={<Star className="h-4 w-4" />} data={topPlayers} />
            <StatCard title="Goleadores" icon={<Goal className="h-4 w-4" />} data={topGoalScorers} />
            <StatCard title="Presencia Perfecta" icon={<Users className="h-4 w-4" />} data={mostMatchesPlayed} />
        </div>
    );
}
