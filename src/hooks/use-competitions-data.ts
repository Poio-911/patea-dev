
'use client';

import { useUser, useFirestore, useCollection } from '@/firebase';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { useMemo, useState, useEffect, useCallback } from 'react';
import type { GroupTeam, Invitation, League, Cup, Match } from '@/lib/types';

export function useCompetitionsData() {
    const { user, loading: userLoading } = useUser();
    const firestore = useFirestore();

    // 1. Teams Query
    const teamsQuery = useMemo(() => {
        if (!firestore || !user?.activeGroupId) return null;
        return query(
            collection(firestore, 'teams'),
            where('groupId', '==', user.activeGroupId)
        );
    }, [firestore, user?.activeGroupId]);

    const { data: teams, loading: teamsLoading } = useCollection<GroupTeam>(teamsQuery);

    // 2. Filter My Teams
    const myTeams = useMemo(() => teams?.filter(t => t.createdBy === user?.uid) || [], [teams, user]);
    const myTeamIds = useMemo(() => myTeams.map(t => t.id), [myTeams]);

    // 3. Leagues Query
    const leaguesQuery = useMemo(() => {
        if (!firestore || !user?.activeGroupId) return null;
        return query(
            collection(firestore, 'leagues'),
            where('groupId', '==', user.activeGroupId)
        );
    }, [firestore, user?.activeGroupId]);

    const { data: leagues, loading: leaguesLoading } = useCollection<League>(leaguesQuery);

    // 4. Cups Query
    const cupsQuery = useMemo(() => {
        if (!firestore || !user?.activeGroupId) return null;
        return query(
            collection(firestore, 'cups'),
            where('groupId', '==', user.activeGroupId)
        );
    }, [firestore, user?.activeGroupId]);

    const { data: cups, loading: cupsLoading } = useCollection<Cup>(cupsQuery);

    // 5. Upcoming competition matches query
    const upcomingMatchesQuery = useMemo(() => {
        if (!firestore || !user?.activeGroupId) return null;
        return query(
            collection(firestore, 'matches'),
            where('groupId', '==', user.activeGroupId),
            where('status', '==', 'upcoming'),
            orderBy('date', 'asc'),
            limit(20)
        );
    }, [firestore, user?.activeGroupId]);

    const { data: upcomingMatchesRaw } = useCollection<Match>(upcomingMatchesQuery);

    const upcomingCompetitionMatches = useMemo(() => {
        if (!upcomingMatchesRaw) return [];
        const competitionMatches = upcomingMatchesRaw.filter(m =>
            m.type === 'league' || m.type === 'cup' || m.type === 'league_final'
        );
        const nextByCompetition: Record<string, Match> = {};
        for (const m of competitionMatches) {
            const compId = m.leagueInfo?.leagueId ?? m.leagueInfo?.cupId;
            if (compId && !nextByCompetition[compId]) {
                nextByCompetition[compId] = m;
            }
        }
        return Object.values(nextByCompetition);
    }, [upcomingMatchesRaw]);

    // 6. Invitations / Challenges Logic
    const [invitations, setInvitations] = useState<Invitation[]>([]);
    const [invitationsLoading, setInvitationsLoading] = useState(true);

    const fetchInvitations = useCallback(async () => {
        if (!firestore || myTeamIds.length === 0) {
            setInvitations([]);
            setInvitationsLoading(false);
            return;
        }
        setInvitationsLoading(true);
        try {
            const allInvitations = await Promise.all(
                myTeamIds.map(async (teamId) => {
                    const q = query(
                        collection(firestore, 'teams', teamId, 'invitations'),
                        where('type', '==', 'team_challenge'),
                        where('status', '==', 'pending')
                    );
                    const snapshot = await getDocs(q);
                    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invitation));
                })
            );
            setInvitations(allInvitations.flat());
        } catch (error) {
            console.error('Error fetching invitations:', error);
            setInvitations([]);
        } finally {
            setInvitationsLoading(false);
        }
    }, [firestore, myTeamIds]);

    useEffect(() => {
        if (myTeamIds.length > 0) {
            fetchInvitations();
        } else if (!teamsLoading) {
            setInvitationsLoading(false);
        }
    }, [myTeamIds, teamsLoading, fetchInvitations]);

    const loading = userLoading || teamsLoading || leaguesLoading || cupsLoading;

    return {
        user,
        firestore,
        teams,
        myTeams,
        myTeamIds,
        leagues,
        leaguesLoading,
        cups,
        cupsLoading,
        invitations,
        invitationsLoading: invitationsLoading || teamsLoading,
        loading,
        fetchInvitations,
        activeGroupId: user?.activeGroupId,
        upcomingCompetitionMatches,
    };
}
