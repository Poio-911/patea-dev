import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, cert, getApps, ServiceAccount } from 'firebase-admin/app';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

if (getApps().length === 0) {
    const s = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
    initializeApp({ credential: cert(s as ServiceAccount), projectId: s.project_id });
}

const db = getFirestore();

async function deleteCollectionRecursively(collectionId: string) {
    const ref = db.collection(collectionId);
    console.log(`Eliminando rastro de: ${collectionId}...`);
    try {
        await db.recursiveDelete(ref);
        console.log(`✅ Colección ${collectionId} eliminada.`);
    } catch (error) {
        console.warn(`⚠️ Error en ${collectionId}:`, error);
    }
}

async function totalMatchAndStatsReset() {
    console.log('🚨 INICIANDO BORRADO TOTAL DE PARTIDOS Y ESTADÍSTICAS...');

    // 1. Eliminar colecciones de partidos y evaluaciones
    const collectionsToDelete = [
        'matches',
        'evaluationSubmissions',
        'evaluations',
        'activityFeed',
        'notifications',
        'chats',
        'location_votes',
        'match_votes',
        'invitations'
    ];

    for (const col of collectionsToDelete) {
        await deleteCollectionRecursively(col);
    }

    // 2. Resetear Jugadores (OVR y Stats a cero)
    console.log('🔄 Reseteando Jugadores (OVR 50 y Stats a 0)...');
    const playersSnap = await db.collection('players').get();

    const batchArray: FirebaseFirestore.WriteBatch[] = [];
    let batch = db.batch();
    let count = 0;
    let batchCount = 0;

    playersSnap.docs.forEach((doc) => {
        const resetData = {
            ovr: 50,
            pac: 50, sho: 50, pas: 50, dri: 50, def: 50, phy: 50,
            stats: {
                goals: 0,
                assists: 0,
                matchesPlayed: 0,
                mvpCount: 0,
                averageRating: 0,
                wins: 0,
                losses: 0,
                draws: 0,
                cleanSheets: 0
            },
            ovrHistory: [],
            evolution: []
        };

        batch.update(doc.ref, resetData);
        count++;
        batchCount++;

        if (batchCount >= 400) {
            batchArray.push(batch);
            batch = db.batch();
            batchCount = 0;
        }
    });

    batchArray.push(batch);

    for (const b of batchArray) {
        await b.commit();
    }

    console.log(`✅ Jugadores reseteados: ${count}`);
    console.log('🚀 LIMPIEZA TOTAL COMPLETADA.');
}

totalMatchAndStatsReset().catch(console.error).finally(() => process.exit(0));
