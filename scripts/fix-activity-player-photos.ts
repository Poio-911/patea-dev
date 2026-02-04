/**
 * Script para actualizar playerPhotoUrl en actividades sociales
 */

import * as dotenv from 'dotenv';
import { getAdminDb } from '../src/firebase/admin-init';

// Cargar variables de entorno
dotenv.config({ path: '.env.local' });

async function fixActivityPlayerPhotos() {
    try {
        console.log('🔧 Actualizando playerPhotoUrl en actividades sociales...\n');

        const db = getAdminDb();

        // Obtener todas las actividades
        const activitiesSnapshot = await db
            .collection('socialActivities')
            .get();

        console.log(`📦 Encontradas ${activitiesSnapshot.size} actividades\n`);

        let updated = 0;
        let skipped = 0;
        let noPhoto = 0;

        for (const activityDoc of activitiesSnapshot.docs) {
            const activityData = activityDoc.data();

            // Si ya tiene playerPhotoUrl, skip
            if (activityData.playerPhotoUrl) {
                skipped++;
                continue;
            }

            try {
                // Determinar el playerId correcto
                const playerId = activityData.playerId || activityData.userId;

                if (!playerId) {
                    console.warn(`⚠️  Actividad ${activityDoc.id} no tiene playerId ni userId`);
                    noPhoto++;
                    continue;
                }

                // Obtener el jugador
                const playerDoc = await db.collection('players').doc(playerId).get();

                if (!playerDoc.exists) {
                    console.warn(`⚠️  Jugador no encontrado: ${playerId}`);
                    noPhoto++;
                    continue;
                }

                const playerData = playerDoc.data();
                const photoURL = playerData?.photoURL;

                if (!photoURL) {
                    // No tiene foto, pero no es un error
                    noPhoto++;
                    continue;
                }

                // Actualizar la actividad
                await activityDoc.ref.update({
                    playerPhotoUrl: photoURL
                });

                console.log(`✅ ${activityDoc.id} → ${photoURL.substring(0, 50)}...`);
                updated++;

            } catch (error: any) {
                console.error(`❌ Error actualizando ${activityDoc.id}:`, error.message);
            }
        }

        console.log('\n📊 Resumen:');
        console.log(`   ✅ Actualizados: ${updated}`);
        console.log(`   ⏭️  Omitidos (ya tenían foto): ${skipped}`);
        console.log(`   📷 Sin foto: ${noPhoto}`);
        console.log(`   📦 Total: ${activitiesSnapshot.size}`);

        process.exit(0);
    } catch (error: any) {
        console.error('\n❌ Error en migración:', error);
        process.exit(1);
    }
}

fixActivityPlayerPhotos();
