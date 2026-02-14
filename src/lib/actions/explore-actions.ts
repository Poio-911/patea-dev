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

        const trimmedQuery = query.trim().toLowerCase();

        // Get current user's active group and follows in parallel
        // REMOVED: db.collection('availablePlayers').select('location').get() to avoid downloading 10k+ docs
        const [userDoc, followsSnapshot] = await Promise.all([
            db.collection('users').doc(currentUserId).get(),
            db.collection('follows')
                .where('followerId', '==', currentUserId)
                .select('followingId')
                .get(),
        ]);

        const activeGroupId = userDoc.exists ? userDoc.data()?.activeGroupId : undefined;
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

        // Filter by name in memory
        const matchingPlayers: Array<{ id: string; data: Player }> = [];
        for (const doc of playersSnapshot.docs) {
            const data = doc.data() as Player;
            if (doc.id === currentUserId) continue; // Skip self

            if (trimmedQuery) {
                const name = (data.name || '').toLowerCase();
                if (!name.includes(trimmedQuery)) continue;
            }

            // Note: We removed the availablePlayerIds check here because we don't have the list.
            // If strict visibility check is required, we should check it individually or optimize differently.
            // For now, valid players are considered valid search results (or we rely on subsequent profile checks).

            matchingPlayers.push({ id: doc.id, data });
        }

        // Batch-read user profiles AND locations for the matching players (up to 30)
        const playerIds = matchingPlayers.slice(0, 30).map(p => p.id);

        if (playerIds.length === 0) {
            return { success: true, users: [] };
        }

        // Batch get user docs (for profile) and availablePlayer docs (for location)
        const userRefs = playerIds.map(id => db.collection('users').doc(id));
        const locationRefs = playerIds.map(id => db.collection('availablePlayers').doc(id));

        const [userDocs, locationDocs] = await Promise.all([
            db.getAll(...userRefs),
            db.getAll(...locationRefs)
        ]);

        const userDataMap = new Map<string, FirebaseFirestore.DocumentData>();
        userDocs.forEach(doc => {
            if (doc.exists) userDataMap.set(doc.id, doc.data()!);
        });

        const locationDataMap = new Map<string, { lat: number, lng: number }>();
        locationDocs.forEach(doc => {
            if (doc.exists && doc.data()?.location) {
                locationDataMap.set(doc.id, doc.data()!.location);
            }
        });

        // Build results
        const results: SuggestedUser[] = [];
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
                location: locationDataMap.get(id),
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

        // Optimized Query: Filter by status AND isPublic in Firestore
        // This requires a Composite Index: collection: matches, fields: status (ASC), isPublic (ASC), date (ASC)
        let query = db.collection('matches')
            .where('status', '==', 'upcoming')
            .where('isPublic', '==', true);

        // Apply type filter if provided
        if (filters?.matchTypes && filters.matchTypes.length > 0) {
            // 'in' query works well with other equality clauses
            query = query.where('type', 'in', filters.matchTypes);
        }

        // Order by date to get soonest matches
        // Note: verify if index supports this ordering mixed with equality filters
        query = query.orderBy('date', 'asc');

        const snapshot = await query.limit(50).get();

        let matches: Match[] = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as Match))
            // Exclude matches the user is already in (client-side filter is fine for this specific exclusion)
            .filter(m => !m.playerUids?.includes(currentUserId))
            // Exclude full matches
            .filter(m => (m.players?.length || 0) < m.matchSize);

        // Cap at 20 results after memory filters
        matches = matches.slice(0, 20);

        return { success: true, matches };
    } catch (error: any) {
        // Check for "FAILED_PRECONDITION" which usually means missing index
        if (error?.code === 9 || error?.message?.includes('index')) {
            console.error('Missing Firestore Index for Public Matches:', error.message);
            // Return specific error to help user/developer
            return {
                success: false,
                error: `Falta un índice en la base de datos. Para crearlo automáticamente, abre este enlace o revisa la consola del servidor: ${error.message}`
            };
        }
        const err = handleServerActionError(error, { currentUserId });
        return { success: false, error: err.error };
    }
}
