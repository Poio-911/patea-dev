'use client';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

type SearchToggleProps = {
    value: 'players' | 'matches';
    onChange: (value: 'players' | 'matches') => void;
    className?: string;
};

export function SearchToggle({ value, onChange, className }: SearchToggleProps) {
    return (
        <Tabs
            value={value}
            onValueChange={(v) => onChange(v as any)}
            className={cn("w-[240px] sm:w-[300px]", className)}
        >
            <TabsList className="grid w-full grid-cols-2 h-11 p-1 bg-background/60 backdrop-blur-xl border border-border/40 rounded-full shadow-lg">
                <TabsTrigger
                    value="players"
                    className="rounded-full transition-all duration-300 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg"
                >
                    <Users className="h-4 w-4 mr-2 shrink-0" />
                    <span className="truncate">Jugadores</span>
                </TabsTrigger>
                <TabsTrigger
                    value="matches"
                    className="rounded-full transition-all duration-300 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg"
                >
                    <Trophy className="h-4 w-4 mr-2 shrink-0" />
                    <span className="truncate">Partidos</span>
                </TabsTrigger>
            </TabsList>
        </Tabs>
    );
}
