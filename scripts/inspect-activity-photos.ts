/**
 * Script para inspeccionar si las actividades tienen playerPhotoUrl
 */

import * as dotenv from 'dotenv';
import { getAdminDb } from '../src/firebase/admin-init';

// Cargar variables de entorno
dotenv.config({ path: '.env.local' });

async function inspectActivityPhotos() {
    try {
        console.log('🔍 Inspeccionando fotos en actividades...\n');

        const db = getAdminDb();

        // Obtener las últimas 10 actividades
        const activitiesSnapshot = await db
            .collection('socialActivities')
            .orderBy('timestamp', 'desc')
            .limit(10)
            .get();

        console.log(`📦 Encontradas ${activitiesSnapshot.size} actividades\n`);

        for (const doc of activitiesSnapshot.docs) {
            const data = doc.data();
            const playerId = data.playerId || data.userId;

            console.log(`ID: ${doc.id}`);
            console.log(`  PlayerName: ${data.playerName || '(vacío)'}`);
            console.log(`  PlayerPhotoUrl: ${data.playerPhotoUrl || '(vacío)'}`);
            console.log(`  PlayerId: ${playerId}`);

            // Verificar si el jugador tiene foto
            if (playerId) {
                const playerDoc = await db.collection('players').doc(playerId).get();
                if (playerDoc.exists) {
                    const playerData = playerDoc.data();
                    console.log(`  Player.photoURL: ${playerData?.photoURL || '(vacío)'}`);
                }
            }
            console.log('');
        }

        process.exit(0);
    } catch (error: any) {
        console.error('\n❌ Error:', error);
        process.exit(1);
    }
}

inspectActivityPhotos();
