/**
 * Script para actualizar playerName en actividades sociales
 */

import * as dotenv from 'dotenv';
import { getAdminDb } from '../src/firebase/admin-init';

// Cargar variables de entorno
dotenv.config({ path: '.env.local' });

async function fixActivityPlayerNames() {
    try {
        console.log('🔧 Actualizando playerName en actividades sociales...\n');

        const db = getAdminDb();

        // Obtener todas las actividades
        const activitiesSnapshot = await db
            .collection('socialActivities')
            .get();

        console.log(`📦 Encontradas ${activitiesSnapshot.size} actividades\n`);

        let updated = 0;
        let skipped = 0;
        let errors = 0;

        for (const activityDoc of activitiesSnapshot.docs) {
            const activityData = activityDoc.data();

            // Si ya tiene playerName, skip
            if (activityData.playerName) {
                skipped++;
                continue;
            }

            try {
                // Determinar el playerId correcto
                const playerId = activityData.playerId || activityData.userId;

                if (!playerId) {
                    console.warn(`⚠️  Actividad ${activityDoc.id} no tiene playerId ni userId`);
                    errors++;
                    continue;
                }

                // Obtener el jugador
                const playerDoc = await db.collection('players').doc(playerId).get();

                if (!playerDoc.exists) {
                    console.warn(`⚠️  Jugador no encontrado: ${playerId}`);
                    errors++;
                    continue;
                }

                const playerData = playerDoc.data();
                const playerName = playerData?.name;

                if (!playerName) {
                    console.warn(`⚠️  Jugador ${playerId} no tiene nombre`);
                    errors++;
                    continue;
                }

                // Actualizar la actividad
                await activityDoc.ref.update({
                    playerName: playerName
                });

                console.log(`✅ ${activityDoc.id} → ${playerName}`);
                updated++;

            } catch (error: any) {
                console.error(`❌ Error actualizando ${activityDoc.id}:`, error.message);
                errors++;
            }
        }

        console.log('\n📊 Resumen:');
        console.log(`   ✅ Actualizados: ${updated}`);
        console.log(`   ⏭️  Omitidos (ya tenían playerName): ${skipped}`);
        console.log(`   ❌ Errores: ${errors}`);
        console.log(`   📦 Total: ${activitiesSnapshot.size}`);

        process.exit(0);
    } catch (error: any) {
        console.error('\n❌ Error en migración:', error);
        process.exit(1);
    }
}

fixActivityPlayerNames();
