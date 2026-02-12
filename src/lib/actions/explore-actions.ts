'use server';

import { getAdminDb } from '../../firebase/admin-init';
import type { SuggestedUser, Match, PlayerPosition, Player } from '../../lib/types';
import { handleServerActionError } from '../../lib/errors';

// ============================================================================
// PLAYER SEARCH
// ============================================================================

export type PlayerSearchFilters = {
    positions?: PlayerPosition[];
    ovrRange?: [number, number];
    groupId?: string;
};

/**
 * Search players across the platform by name, with optional filters.
 * Used in the Explorar tab for player discovery.
 */
export async function searchPlayersAction(
    query: string,
    filters: PlayerSearchFilters,
    currentUserId: string
): Promise<{ success: boolean; users?: SuggestedUser[]; error?: string }> {
    try {
        const db = getAdminDb();
        const results: SuggestedUser[] = [];
        const trimmedQuery = query.trim().toLowerCase();

        // Get list of users the current user follows
        const followsSnapshot = await db.collection('follows')
            .where('followerId', '==', currentUserId)
            .select('followingId')
            .get();
        const followingIds = new Set(followsSnapshot.docs.map(d => d.data().followingId));

        // Strategy: query players collection (has name, position, ovr) then enrich with user data
        let playersQuery: FirebaseFirestore.Query = db.collection('players');

        // Apply group filter if provided
        if (filters.groupId) {
            playersQuery = playersQuery.where('groupId', '==', filters.groupId);
        }

        // Apply position filter (Firestore 'in' supports up to 30 values)
        if (filters.positions && filters.positions.length > 0) {
            playersQuery = playersQuery.where('position', 'in', filters.positions);
        }

        // Apply OVR range filter
        if (filters.ovrRange) {
            playersQuery = playersQuery
                .where('ovr', '>=', filters.ovrRange[0])
                .where('ovr', '<=', filters.ovrRange[1]);
        }

        // Limit to a reasonable number
        const playersSnapshot = await playersQuery.limit(100).get();

        // Filter by name in memory (Firestore doesn't support case-insensitive substring search)
        const matchingPlayers: Array<{ id: string; data: Player }> = [];
        for (const doc of playersSnapshot.docs) {
            const data = doc.data() as Player;
            if (doc.id === currentUserId) continue; // Skip self

            if (trimmedQuery) {
                const name = (data.name || '').toLowerCase();
                if (!name.includes(trimmedQuery)) continue;
            }

            matchingPlayers.push({ id: doc.id, data });
        }

        // Batch-read user profiles for the matching players (up to 30)
        const playerIds = matchingPlayers.slice(0, 30).map(p => p.id);

        if (playerIds.length === 0) {
            return { success: true, users: [] };
        }

        // Batch get user docs (Firestore getAll supports up to 100)
        const userRefs = playerIds.map(id => db.collection('users').doc(id));
        const userDocs = await db.getAll(...userRefs);
        const userDataMap = new Map<string, FirebaseFirestore.DocumentData>();
        for (const userDoc of userDocs) {
            if (userDoc.exists) {
                userDataMap.set(userDoc.id, userDoc.data()!);
            }
        }

        // Build results
        for (const { id, data: playerData } of matchingPlayers.slice(0, 30)) {
            const userData = userDataMap.get(id);
            if (!userData) continue; // Skip players without a user account

            results.push({
                uid: id,
                displayName: userData.displayName || playerData.name || 'Usuario',
                photoURL: userData.photoURL || playerData.photoURL,
                position: playerData.position,
                ovr: playerData.ovr,
                followerCount: 0, // Skip expensive count for search results
                matchesPlayed: playerData.stats?.matchesPlayed,
                reason: 'same_group', // Not really used in search context
                isFollowing: followingIds.has(id),
            });
        }

        // Sort by OVR descending
        results.sort((a, b) => (b.ovr || 0) - (a.ovr || 0));

        return { success: true, users: results };
    } catch (error) {
        const err = handleServerActionError(error, { query, currentUserId });
        return { success: false, error: err.error };
    }
}

// ============================================================================
// PUBLIC MATCHES
// ============================================================================

export type PublicMatchFilters = {
    matchTypes?: string[];
};

/**
 * Get upcoming public matches that the user hasn't joined yet.
 * Used in the "Partidos Abiertos" tab for match discovery.
 * Note: We query by status only and filter isPublic in memory to avoid
 * needing a composite Firestore index (isPublic + status + date).
 */
export async function getPublicMatchesAction(
    currentUserId: string,
    filters?: PublicMatchFilters
): Promise<{ success: boolean; matches?: Match[]; error?: string }> {
    try {
        const db = getAdminDb();

        // Query only by status to avoid composite index requirement
        const snapshot = await db.collection('matches')
            .where('status', '==', 'upcoming')
            .limit(100)
            .get();

        let matches: Match[] = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as Match))
            // Filter public matches in memory
            .filter(m => m.isPublic === true)
            // Exclude matches the user is already in
            .filter(m => !m.playerUids?.includes(currentUserId))
            // Exclude full matches
            .filter(m => (m.players?.length || 0) < m.matchSize);

        // Apply type filter
        if (filters?.matchTypes && filters.matchTypes.length > 0) {
            matches = matches.filter(m => filters.matchTypes!.includes(m.type));
        }

        // Sort by date ascending (soonest first)
        matches.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // Cap at 20 results
        matches = matches.slice(0, 20);

        return { success: true, matches };
    } catch (error) {
        const err = handleServerActionError(error, { currentUserId });
        return { success: false, error: err.error };
    }
}
