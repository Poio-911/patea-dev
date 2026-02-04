/**
 * Script para inspeccionar actividades sociales y ver qué playerName tienen
 */

import * as dotenv from 'dotenv';
import { getAdminDb } from '../src/firebase/admin-init';

// Cargar variables de entorno
dotenv.config({ path: '.env.local' });

async function inspectActivities() {
    try {
        console.log('🔍 Inspeccionando actividades sociales...\n');

        const db = getAdminDb();

        // Obtener las últimas 10 actividades
        const activitiesSnapshot = await db
            .collection('socialActivities')
            .orderBy('timestamp', 'desc')
            .limit(10)
            .get();

        console.log(`📦 Encontradas ${activitiesSnapshot.size} actividades\n`);

        activitiesSnapshot.docs.forEach((doc, index) => {
            const data = doc.data();
            console.log(`${index + 1}. ID: ${doc.id}`);
            console.log(`   Type: ${data.type}`);
            console.log(`   PlayerName: "${data.playerName || '(vacío)'}"`);
            console.log(`   PlayerId: ${data.playerId}`);
            console.log(`   UserId: ${data.userId}`);
            console.log('');
        });

        process.exit(0);
    } catch (error: any) {
        console.error('\n❌ Error:', error);
        process.exit(1);
    }
}

inspectActivities();
