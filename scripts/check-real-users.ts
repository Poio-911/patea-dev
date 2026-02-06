import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

if (getApps().length === 0) {
    const s = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
    initializeApp({ credential: cert(s), projectId: s.project_id });
}

async function checkPlayers(matchId: string) {
    const db = getFirestore();
    const matchDoc = await db.doc(`matches/${matchId}`).get();
    const playerUids = matchDoc.data()?.playerUids || [];

    console.log(`Checking ${playerUids.length} players for Match ${matchId}...`);

    let realCount = 0;
    let guestCount = 0;

    for (const uid of playerUids) {
        const pDoc = await db.doc(`players/${uid}`).get();
        const p = pDoc.data();
        if (!p) continue;

        const isReal = p.id === p.ownerUid;
        console.log(`- ${p.name}: ID=${p.id}, Owner=${p.ownerUid} => ${isReal ? '✅ REAL' : '👤 GUEST'}`);

        if (isReal) realCount++;
        else guestCount++;
    }

    console.log(`Summary: ${realCount} Real Users, ${guestCount} Guests`);
}

const matchId = process.argv[2] || 'hSUtIkUZbY0A1fs2CYTq';
checkPlayers(matchId).catch(console.error);
