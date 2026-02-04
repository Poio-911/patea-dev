/**
 * Script para sincronizar photoURL de users a players
 */

import * as dotenv from 'dotenv';
import { getAdminDb } from '../src/firebase/admin-init';

// Cargar variables de entorno
dotenv.config({ path: '.env.local' });

async function syncPlayerPhotos() {
    try {
        console.log('🔧 Sincronizando fotos de usuarios a jugadores...\n');

        const db = getAdminDb();

        // Obtener todos los jugadores
        const playersSnapshot = await db.collection('players').get();
        console.log(`📦 Encontrados ${playersSnapshot.size} jugadores\n`);

        let updated = 0;
        let skipped = 0;
        let noUserPhoto = 0;
        let errors = 0;

        for (const playerDoc of playersSnapshot.docs) {
            const playerData = playerDoc.data();
            const playerId = playerDoc.id;
            const ownerUid = playerData.ownerUid || playerId;

            try {
                // Obtener el usuario correspondiente
                const userDoc = await db.collection('users').doc(ownerUid).get();

                if (!userDoc.exists) {
                    console.warn(`⚠️  Usuario no encontrado: ${ownerUid}`);
                    errors++;
                    continue;
                }

                const userData = userDoc.data();
                const userPhotoURL = userData?.photoURL;

                if (!userPhotoURL) {
                    // Usuario no tiene foto
                    noUserPhoto++;
                    continue;
                }

                // Si el jugador ya tiene la misma foto, skip
                if (playerData.photoURL === userPhotoURL) {
                    skipped++;
                    continue;
                }

                // Actualizar el jugador con la foto del usuario
                await playerDoc.ref.update({
                    photoURL: userPhotoURL
                });

                console.log(`✅ ${playerData.name} → Foto sincronizada`);
                updated++;

            } catch (error: any) {
                console.error(`❌ Error actualizando ${playerId}:`, error.message);
                errors++;
            }
        }

        console.log('\n📊 Resumen:');
        console.log(`   ✅ Actualizados: ${updated}`);
        console.log(`   ⏭️  Omitidos (ya sincronizados): ${skipped}`);
        console.log(`   📷 Usuario sin foto: ${noUserPhoto}`);
        console.log(`   ❌ Errores: ${errors}`);
        console.log(`   📦 Total: ${playersSnapshot.size}`);

        process.exit(0);
    } catch (error: any) {
        console.error('\n❌ Error en sincronización:', error);
        process.exit(1);
    }
}

syncPlayerPhotos();
