'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, TrendingUp, Users, Users2 } from 'lucide-react';
import type { Match, Player, AvailablePlayer, SavedLocation, Group } from '@/lib/types';
import { ResumenTab } from './resumen-tab';
import { ProgresoTab } from './progreso-tab';
import { SocialTab } from './social-tab';
import { GrupoTab } from './grupo-tab';

interface DashboardTabsProps {
    nextMatch: Match | null;
    liveMatches: Match[];
    liveLoading: boolean;
    top5Players: Player[];
    player: Player | null;
    recentMatches: Match[];
    availablePlayerData: AvailablePlayer | null;
    savedLocation?: SavedLocation;
    onOpenLiveMatch: (match: Match) => void;
    groupId?: string;
    userId?: string;
    activeGroup?: Group | null;
    allPlayersInGroup: Player[];
    upcomingMatches: Match[];
    friendlyMatches: Match[];
}

export function DashboardTabs({
    nextMatch,
    liveMatches,
    liveLoading,
    top5Players,
    player,
    recentMatches,
    availablePlayerData,
    savedLocation,
    onOpenLiveMatch,
    groupId,
    userId,
    activeGroup,
    allPlayersInGroup,
    upcomingMatches,
    friendlyMatches,
}: DashboardTabsProps) {
    const [activeTab, setActiveTab] = useState<string>('resumen');

    // Load saved tab from localStorage
    useEffect(() => {
        const savedTab = localStorage.getItem('dashboardActiveTab');
        if (savedTab && ['resumen', 'progreso', 'social', 'grupo'].includes(savedTab)) {
            setActiveTab(savedTab);
        }
    }, []);

    // Save tab to localStorage when changed
    const handleTabChange = (value: string) => {
        setActiveTab(value);
        localStorage.setItem('dashboardActiveTab', value);
    };

    const playerStats = {
        totalMatches: player?.stats?.matchesPlayed || 0,
        totalGoals: player?.stats?.goals || 0,
    };

    return (
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="flex w-full mb-6 h-auto p-1 gap-1 bg-muted/50 rounded-xl">
                <TabsTrigger value="resumen" className="flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 py-2 sm:py-2.5 text-[10px] sm:text-sm min-h-[44px] data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all duration-200">
                    <BarChart3 className="h-4 w-4 sm:h-4 sm:w-4 shrink-0" />
                    <span className="font-medium">Resumen</span>
                </TabsTrigger>
                <TabsTrigger value="progreso" className="flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 py-2 sm:py-2.5 text-[10px] sm:text-sm min-h-[44px] data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all duration-200">
                    <TrendingUp className="h-4 w-4 sm:h-4 sm:w-4 shrink-0" />
                    <span className="font-medium">Progreso</span>
                </TabsTrigger>
                <TabsTrigger value="social" className="flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 py-2 sm:py-2.5 text-[10px] sm:text-sm min-h-[44px] data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all duration-200">
                    <Users className="h-4 w-4 sm:h-4 sm:w-4 shrink-0" />
                    <span className="font-medium">Social</span>
                </TabsTrigger>
                <TabsTrigger value="grupo" className="flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 py-2 sm:py-2.5 text-[10px] sm:text-sm min-h-[44px] data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all duration-200">
                    <Users2 className="h-4 w-4 sm:h-4 sm:w-4 shrink-0" />
                    <span className="font-medium">Grupo</span>
                </TabsTrigger>
            </TabsList>

            <TabsContent value="resumen" className="mt-0">
                <ResumenTab
                    nextMatch={nextMatch}
                    liveMatches={liveMatches}
                    liveLoading={liveLoading}
                    top5Players={top5Players}
                    playerStats={playerStats}
                    onOpenLiveMatch={onOpenLiveMatch}
                />
            </TabsContent>

            <TabsContent value="progreso" className="mt-0">
                <ProgresoTab
                    player={player}
                    recentMatches={recentMatches}
                    groupId={groupId}
                    userId={userId}
                />
            </TabsContent>

            <TabsContent value="social" className="mt-0">
                <SocialTab
                    player={player}
                    availablePlayerData={availablePlayerData}
                    savedLocation={savedLocation}
                />
            </TabsContent>

            <TabsContent value="grupo" className="mt-0">
                <GrupoTab
                    activeGroup={activeGroup}
                    groupPlayers={allPlayersInGroup}
                    upcomingMatches={upcomingMatches}
                    friendlyMatches={friendlyMatches}
                    groupId={groupId}
                    userId={userId}
                />
            </TabsContent>
        </Tabs>
    );
}
