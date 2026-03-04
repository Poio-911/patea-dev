
'use client';

import { useUser, useFirestore, useCollection } from '@/firebase';
import { collection, query, where, orderBy, limit, getDocs, or, and } from 'firebase/firestore';
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

    // 3. Leagues Logic
    const [leagues, setLeagues] = useState<League[]>([]);
    const [leaguesLoading, setLeaguesLoading] = useState(true);

    const fetchLeagues = useCallback(async () => {
        if (!firestore || !user?.activeGroupId) {
            setLeagues([]);
            setLeaguesLoading(false);
            return;
        }
        setLeaguesLoading(true);
        try {
            // Query 1: By Group (Active Group)
            const qGroup = query(
                collection(firestore, 'leagues'),
                where('groupId', '==', user.activeGroupId)
            );
            const snapGroup = await getDocs(qGroup);
            const leaguesGroup = snapGroup.docs.map(doc => ({ id: doc.id, ...doc.data() } as League));

            // Query 2: By Participation (User Teams)
            let leaguesParticipating: League[] = [];
            if (myTeamIds.length > 0) {
                // Firestore limit for 'array-contains-any' is 10. If more, we'd need to batch.
                // Assuming typical user has < 10 teams.
                const qPart = query(
                    collection(firestore, 'leagues'),
                    where('teams', 'array-contains-any', myTeamIds.slice(0, 10))
                );
                const snapPart = await getDocs(qPart);
                leaguesParticipating = snapPart.docs.map(doc => ({ id: doc.id, ...doc.data() } as League));
            }

            // Combine and unique
            const combined = [...leaguesGroup, ...leaguesParticipating];
            const unique = new Map<string, League>();
            combined.forEach(l => unique.set(l.id, l));
            setLeagues(Array.from(unique.values()));
        } catch (error) {
            console.error('Error fetching leagues:', error);
        } finally {
            setLeaguesLoading(false);
        }
    }, [firestore, user?.activeGroupId, myTeamIds]);

    useEffect(() => {
        fetchLeagues();
    }, [fetchLeagues]);

    // 4. Cups Logic
    const [cups, setCups] = useState<Cup[]>([]);
    const [cupsLoading, setCupsLoading] = useState(true);

    const fetchCups = useCallback(async () => {
        if (!firestore || !user?.activeGroupId) {
            setCups([]);
            setCupsLoading(false);
            return;
        }
        setCupsLoading(true);
        try {
            // Query 1: By Group
            const qGroup = query(
                collection(firestore, 'cups'),
                where('groupId', '==', user.activeGroupId)
            );
            const snapGroup = await getDocs(qGroup);
            const cupsGroup = snapGroup.docs.map(doc => ({ id: doc.id, ...doc.data() } as Cup));

            // Query 2: By Participation
            let cupsParticipating: Cup[] = [];
            if (myTeamIds.length > 0) {
                const qPart = query(
                    collection(firestore, 'cups'),
                    where('teams', 'array-contains-any', myTeamIds.slice(0, 10))
                );
                const snapPart = await getDocs(qPart);
                cupsParticipating = snapPart.docs.map(doc => ({ id: doc.id, ...doc.data() } as Cup));
            }

            // Combine and unique
            const combined = [...cupsGroup, ...cupsParticipating];
            const unique = new Map<string, Cup>();
            combined.forEach(c => unique.set(c.id, c));
            setCups(Array.from(unique.values()));
        } catch (error) {
            console.error('Error fetching cups:', error);
        } finally {
            setCupsLoading(false);
        }
    }, [firestore, user?.activeGroupId, myTeamIds]);

    useEffect(() => {
        fetchCups();
    }, [fetchCups]);

    // 5. Upcoming competition matches query
    const upcomingMatchesQuery1 = useMemo(() => {
        if (!firestore || !user?.activeGroupId) return null;
        return query(
            collection(firestore, 'matches'),
            where('groupId', '==', user.activeGroupId),
            where('status', '==', 'upcoming'),
            orderBy('date', 'asc'),
            limit(50)
        );
    }, [firestore, user?.activeGroupId]);

    const upcomingMatchesQuery2 = useMemo(() => {
        if (!firestore || !user?.activeGroupId) return null;
        return query(
            collection(firestore, 'matches'),
            where('participantGroupIds', 'array-contains', user.activeGroupId),
            where('status', '==', 'upcoming'),
            orderBy('date', 'asc'),
            limit(50)
        );
    }, [firestore, user?.activeGroupId]);

    const { data: upcoming1 } = useCollection<Match>(upcomingMatchesQuery1);
    const { data: upcoming2 } = useCollection<Match>(upcomingMatchesQuery2);

    const upcomingCompetitionMatches = useMemo(() => {
        const combined = [...(upcoming1 || []), ...(upcoming2 || [])];
        const unique = new Map<string, Match>();
        combined.forEach(m => unique.set(m.id, m));
        const matches = Array.from(unique.values());

        const competitionMatches = matches.filter(m =>
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
    }, [upcoming1, upcoming2]);

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
