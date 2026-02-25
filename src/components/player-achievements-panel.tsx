'use client';

import { useMemo } from 'react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { PlayerAchievement } from '@/lib/types';
import { ACHIEVEMENTS } from '@/lib/achievements-config';
import { AchievementGrid } from './achievement-badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Trophy } from 'lucide-react';

interface PlayerAchievementsPanelProps {
    playerId: string;
}

export function PlayerAchievementsPanel({ playerId }: PlayerAchievementsPanelProps) {
    const firestore = useFirestore();

    const achievementsQuery = useMemo(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, 'playerAchievements'),
            where('playerId', '==', playerId)
        );
    }, [firestore, playerId]);

    const { data: unlockedAchievements, loading } = useCollection<PlayerAchievement>(achievementsQuery);

    const mappedAchievements = useMemo(() => {
        const unlockedIds = new Set(unlockedAchievements?.map((a) => a.achievementId) || []);
        const unlockedMap = new Map(unlockedAchievements?.map((a) => [a.achievementId, a]) || []);

        return ACHIEVEMENTS.map((achievement) => {
            const isUnlocked = unlockedIds.has(achievement.id);
            const unlockData = unlockedMap.get(achievement.id);

            return {
                achievement,
                unlocked: isUnlocked,
                unlockedAt: unlockData?.unlockedAt,
                // Since we don't actively track real-time partial progress for all achievements deeply in the frontend yet,
                // we'll just show full / max for unlocked, or 0 / max for locked (or hide progress).
                current: isUnlocked ? achievement.requirement.count : 0,
            };
        }).sort((a, b) => {
            // Sort: unlocked first, then by category
            if (a.unlocked && !b.unlocked) return -1;
            if (!a.unlocked && b.unlocked) return 1;
            return 0;
        });
    }, [unlockedAchievements]);

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-primary" /> Vitrina de Trofeos</CardTitle>
                </CardHeader>
                <CardContent className="flex justify-center py-8">
                    <div className="animate-pulse flex gap-4">
                        {[1, 2, 3, 4].map(i => <div key={i} className="h-14 w-14 rounded-full bg-muted"></div>)}
                    </div>
                </CardContent>
            </Card>
        );
    }

    const unlockedCount = unlockedAchievements?.length || 0;
    const totalCount = ACHIEVEMENTS.length;

    return (
        <Card className="surface">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-primary" />
                    Vitrina de Trofeos
                </CardTitle>
                <CardDescription>
                    {unlockedCount} de {totalCount} logros desbloqueados
                </CardDescription>
            </CardHeader>
            <CardContent>
                <AchievementGrid
                    achievements={mappedAchievements}
                    showProgress={false}
                    size="md"
                />
            </CardContent>
        </Card>
    );
}
