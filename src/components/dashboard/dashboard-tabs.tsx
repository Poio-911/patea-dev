'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, TrendingUp, Users } from 'lucide-react';
import type { Match, Player, AvailablePlayer } from '@/lib/types';
import { ResumenTab } from './resumen-tab';
import { ProgresoTab } from './progreso-tab';
import { SocialTab } from './social-tab';

interface DashboardTabsProps {
    nextMatch: Match | null;
    liveMatches: Match[];
    liveLoading: boolean;
    top5Players: Player[];
    player: Player | null;
    recentMatches: Match[];
    availablePlayerData: AvailablePlayer | null;
    isToggling: boolean;
    locationError: string | null;
    onToggleAvailability: (isAvailable: boolean) => void;
    onRequestLocation: () => void;
    onOpenLiveMatch: (match: Match) => void;
    groupId?: string;
    userId?: string;
}

export function DashboardTabs({
    nextMatch,
    liveMatches,
    liveLoading,
    top5Players,
    player,
    recentMatches,
    availablePlayerData,
    isToggling,
    locationError,
    onToggleAvailability,
    onRequestLocation,
    onOpenLiveMatch,
    groupId,
    userId,
}: DashboardTabsProps) {
    const [activeTab, setActiveTab] = useState<string>('resumen');

    // Load saved tab from localStorage
    useEffect(() => {
        const savedTab = localStorage.getItem('dashboardActiveTab');
        if (savedTab && ['resumen', 'progreso', 'social'].includes(savedTab)) {
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
            <TabsList className="grid w-full grid-cols-3 mb-6">
                <TabsTrigger value="resumen" className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    <span className="hidden sm:inline">Resumen</span>
                </TabsTrigger>
                <TabsTrigger value="progreso" className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    <span className="hidden sm:inline">Mi Progreso</span>
                </TabsTrigger>
                <TabsTrigger value="social" className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span className="hidden sm:inline">Social</span>
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
                    isToggling={isToggling}
                    locationError={locationError}
                    onToggleAvailability={onToggleAvailability}
                    onRequestLocation={onRequestLocation}
                />
            </TabsContent>
        </Tabs>
    );
}
