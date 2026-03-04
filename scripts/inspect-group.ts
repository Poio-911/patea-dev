import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
if (!getApps().length) initializeApp({ credential: cert(sa as any), projectId: sa.project_id });
const db = getFirestore();

const GROUP_ID = 'Lo7Mz3sUg2PyRZDuCLbd';

async function main() {
    const groupDoc = await db.collection('groups').doc(GROUP_ID).get();
    if (!groupDoc.exists) { console.log('Grupo no encontrado'); return; }

    const g = groupDoc.data()!;
    console.log('=== GRUPO ===');
    console.log('Nombre:', g.name);
    console.log('OwnerUid:', g.ownerUid);

    const playerIds: string[] = g.playerIds || g.members || [];
    console.log(`\n=== JUGADORES (${playerIds.length}) ===`);

    for (const pid of playerIds) {
        const pDoc = await db.collection('players').doc(pid).get();
        const role = g.memberRoles?.[pid] || 'member';
        if (pDoc.exists) {
            const p = pDoc.data()!;
            console.log(`  [${role.padEnd(9)}] ${(p.name || '?').padEnd(20)} | ${p.position} | OVR: ${p.ovr} | id: ${pid}`);
        } else {
            console.log(`  [${role.padEnd(9)}] ??? (sin doc de jugador) | id: ${pid}`);
        }
    }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
