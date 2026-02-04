/**
 * Script para migrar el campo 'name' en players desde users.displayName
 */

import * as dotenv from 'dotenv';
import { getAdminDb } from '../src/firebase/admin-init';

// Cargar variables de entorno
dotenv.config({ path: '.env.local' });

async function migratePlayerNames() {
    try {
        console.log('🔧 Migrando nombres de jugadores...\n');

        const db = getAdminDb();

        // Obtener todos los jugadores
        const playersSnapshot = await db.collection('players').get();
        console.log(`📦 Encontrados ${playersSnapshot.size} jugadores\n`);

        let updated = 0;
        let skipped = 0;
        let errors = 0;

        for (const playerDoc of playersSnapshot.docs) {
            const playerId = playerDoc.id;
            const playerData = playerDoc.data();

            // Si ya tiene nombre, skip
            if (playerData.name) {
                skipped++;
                continue;
            }

            try {
                // Obtener el usuario correspondiente
                const userDoc = await db.collection('users').doc(playerId).get();

                if (!userDoc.exists) {
                    console.warn(`⚠️  Usuario no encontrado para jugador ${playerId}`);
                    errors++;
                    continue;
                }

                const userData = userDoc.data();
                const displayName = userData?.displayName;

                if (!displayName) {
                    console.warn(`⚠️  Usuario ${playerId} no tiene displayName`);
                    errors++;
                    continue;
                }

                // Actualizar el jugador con el nombre
                await playerDoc.ref.update({
                    name: displayName
                });

                console.log(`✅ Actualizado: ${playerId} → ${displayName}`);
                updated++;

            } catch (error: any) {
                console.error(`❌ Error actualizando ${playerId}:`, error.message);
                errors++;
            }
        }

        console.log('\n📊 Resumen:');
        console.log(`   ✅ Actualizados: ${updated}`);
        console.log(`   ⏭️  Omitidos (ya tenían nombre): ${skipped}`);
        console.log(`   ❌ Errores: ${errors}`);
        console.log(`   📦 Total: ${playersSnapshot.size}`);

        process.exit(0);
    } catch (error: any) {
        console.error('\n❌ Error en migración:', error);
        process.exit(1);
    }
}

migratePlayerNames();
