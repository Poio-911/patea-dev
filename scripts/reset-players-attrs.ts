/**
 * Targeted player reset: sets correct flat attribute fields + mvpVotes to 0.
 * Fields: pac, sho, pas, dri, def, phy (flat on player doc) + stats.mvpVotes
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
if (!getApps().length) initializeApp({ credential: cert(sa as any), projectId: sa.project_id });
const db = getFirestore();

const BATCH_SIZE = 400;

async function run() {
    console.log('🔄 Reseteando atributos y MVP de todos los jugadores...\n');

    const snap = await db.collection('players').get();
    console.log(`📋 Jugadores encontrados: ${snap.size}`);

    // Log first player to verify field names
    if (!snap.empty) {
        const sample = snap.docs[0].data();
        console.log('\n🔍 Campos de un jugador de muestra:');
        console.log(JSON.stringify({
            ovr: sample.ovr,
            pac: sample.pac, sho: sample.sho, pas: sample.pas,
            dri: sample.dri, def: sample.def, phy: sample.phy,
            attributes: sample.attributes, // may exist as nested
            stats: sample.stats,
        }, null, 2));
        console.log('');
    }

    for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
        const batch = db.batch();
        const chunk = snap.docs.slice(i, i + BATCH_SIZE);
        for (const doc of chunk) {
            batch.update(doc.ref, {
                // Flat attribute fields (correct names from player-styles.tsx)
                ovr: 50,
                pac: 50,
                sho: 50,
                pas: 50,
                dri: 50,
                def: 50,
                phy: 50,
                // All stats including MVP
                'stats.matchesPlayed': 0,
                'stats.goals': 0,
                'stats.assists': 0,
                'stats.wins': 0,
                'stats.draws': 0,
                'stats.losses': 0,
                'stats.averageRating': 0,
                'stats.yellowCards': 0,
                'stats.redCards': 0,
                'stats.mvpVotes': 0,
            });
        }
        await batch.commit();
        console.log(`   ✅ ${Math.min(i + BATCH_SIZE, snap.docs.length)}/${snap.docs.length} jugadores actualizados`);
    }

    // Verify
    const verify = await db.collection('players').limit(3).get();
    console.log('\n✅ VERIFICACIÓN (primeros 3 jugadores):');
    for (const doc of verify.docs) {
        const d = doc.data();
        console.log(`  ${d.name}: ovr=${d.ovr}, pac=${d.pac}, sho=${d.sho}, pas=${d.pas}, dri=${d.dri}, def=${d.def}, phy=${d.phy}, mvpVotes=${d.stats?.mvpVotes}`);
    }

    console.log('\n🎉 Reset completado!');
}

run()
    .then(() => process.exit(0))
    .catch(e => { console.error('❌', e); process.exit(1); });
