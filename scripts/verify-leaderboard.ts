
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

if (getApps().length === 0) {
    const s = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
    initializeApp({ credential: cert(s), projectId: s.project_id });
}

type LeaderboardCategory = 'ovr' | 'goals' | 'assists' | 'matches' | 'rating';

async function verify() {
    console.log('--- Verifying Leaderboard Logic for GOALS ---');
    const db = getFirestore();
    const category = 'goals' as LeaderboardCategory;

    // Same logic as leaderboard-actions.ts
    const fieldMap: Record<LeaderboardCategory, string> = {
        ovr: 'ovr',
        goals: 'stats.goals',
        assists: 'stats.assists',
        matches: 'stats.matchesPlayed',
        rating: 'stats.averageRating',
    };

    const orderField = fieldMap[category];
    console.log(`Order Field: ${orderField}`);

    const query = db.collection('players').orderBy(orderField, 'desc').limit(5);
    const snapshot = await query.get();

    snapshot.docs.forEach((doc, index) => {
        const player = doc.data();
        let value: number = 0;

        // Exact switch from action
        switch (category) {
            case 'ovr': value = player.ovr || 0; break;
            case 'goals': value = player.stats?.goals || 0; break;
            case 'assists': value = player.stats?.assists || 0; break;
            case 'matches': value = player.stats?.matchesPlayed || 0; break;
            case 'rating': value = player.stats?.averageRating || 0; break;
        }

        console.log(`#${index + 1} ${player.name}: Value=${value} (OVR=${player.ovr}, Goals=${player.stats?.goals})`);
    });
}

verify().catch(console.error);
