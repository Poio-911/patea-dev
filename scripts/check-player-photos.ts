/**
 * Script para ver qué jugadores tienen fotos
 */

import * as dotenv from 'dotenv';
import { getAdminDb } from '../src/firebase/admin-init';

// Cargar variables de entorno
dotenv.config({ path: '.env.local' });

async function checkPlayerPhotos() {
    try {
        console.log('🔍 Verificando fotos de jugadores...\n');

        const db = getAdminDb();

        // Obtener todos los jugadores
        const playersSnapshot = await db.collection('players').get();

        console.log(`📦 Total jugadores: ${playersSnapshot.size}\n`);

        let withPhoto = 0;
        let withoutPhoto = 0;

        playersSnapshot.docs.forEach((doc) => {
            const data = doc.data();
            if (data.photoURL) {
                withPhoto++;
                console.log(`✅ ${data.name}: ${data.photoURL.substring(0, 60)}...`);
            } else {
                withoutPhoto++;
            }
        });

        console.log(`\n📊 Resumen:`);
        console.log(`   ✅ Con foto: ${withPhoto}`);
        console.log(`   ❌ Sin foto: ${withoutPhoto}`);

        process.exit(0);
    } catch (error: any) {
        console.error('\n❌ Error:', error);
        process.exit(1);
    }
}

checkPlayerPhotos();
