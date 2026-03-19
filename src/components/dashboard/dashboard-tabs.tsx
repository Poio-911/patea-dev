'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, TrendingUp, Users, Users2 } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Match, Player, AvailablePlayer, SavedLocation, Group } from '@/lib/types';
import { ResumenTab } from './resumen-tab';
import { GrupoTab } from './grupo-tab';

interface DashboardTabsProps {
    nextMatch: Match | null;
    liveMatches: Match[];
    liveLoading: boolean;
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
    groupRecentMatches: Match[];
    totalGroupMatchesCount: number;
}

export function DashboardTabs({
    nextMatch,
    liveMatches,
    liveLoading,
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
    groupRecentMatches,
    totalGroupMatchesCount,
}: DashboardTabsProps) {
    const [activeTab, setActiveTab] = useState<string>('resumen');

    // Load saved tab from localStorage
    useEffect(() => {
        const savedTab = localStorage.getItem('dashboardActiveTab');
        if (savedTab && ['resumen', 'grupo'].includes(savedTab)) {
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
            <TabsList className="flex w-full mb-6 h-auto p-1.5 gap-1.5 bg-card/40 rounded-xl backdrop-blur-xl border border-border/40">
                <TabsTrigger value="resumen" className="relative flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 py-2 sm:py-2.5 text-[10px] sm:text-sm min-h-[48px] text-muted-foreground data-[state=active]:text-foreground transition-colors duration-300 z-0 overflow-hidden rounded-lg">
                    {activeTab === 'resumen' && (
                        <motion.div
                            layoutId="active-dashboard-tab"
                            className="absolute inset-0 bg-background shadow-sm border border-border/50 rounded-lg -z-10"
                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        />
                    )}
                    <BarChart3 className="h-4 w-4 sm:h-4 sm:w-4 shrink-0 relative z-10" />
                    <span className="font-semibold relative z-10">Mi Resumen</span>
                </TabsTrigger>

                <TabsTrigger value="grupo" className="relative flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 py-2 sm:py-2.5 text-[10px] sm:text-sm min-h-[48px] text-muted-foreground data-[state=active]:text-foreground transition-colors duration-300 z-0 overflow-hidden rounded-lg">
                    {activeTab === 'grupo' && (
                        <motion.div
                            layoutId="active-dashboard-tab"
                            className="absolute inset-0 bg-background shadow-sm border border-border/50 rounded-lg -z-10"
                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        />
                    )}
                    <Users2 className="h-4 w-4 sm:h-4 sm:w-4 shrink-0 relative z-10" />
                    <span className="font-semibold relative z-10">Mi Grupo</span>
                </TabsTrigger>
            </TabsList>

            <TabsContent value="resumen" className="mt-0">
                <ResumenTab
                    nextMatch={nextMatch}
                    liveMatches={liveMatches}
                    liveLoading={liveLoading}
                    player={player}
                    recentMatches={recentMatches}
                    onOpenLiveMatch={onOpenLiveMatch}
                />
            </TabsContent>

            <TabsContent value="grupo" className="mt-0">
                <GrupoTab
                    activeGroup={activeGroup}
                    groupPlayers={allPlayersInGroup}
                    upcomingMatches={upcomingMatches}
                    friendlyMatches={friendlyMatches}
                    groupRecentMatches={groupRecentMatches}
                    totalGroupMatchesCount={totalGroupMatchesCount}
                    groupId={groupId}
                    userId={userId}
                />
            </TabsContent>
        </Tabs>
    );
}
