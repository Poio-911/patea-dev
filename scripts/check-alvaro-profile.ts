/**
 * Script para verificar el usuario Alvaro M. - versión mejorada
 */

import * as dotenv from 'dotenv';
import { getAdminDb } from '../src/firebase/admin-init';

// Cargar variables de entorno
dotenv.config({ path: '.env.local' });

async function checkAlvaroProfile() {
    try {
        console.log('🔍 Verificando perfil de Alvaro M...\n');

        const db = getAdminDb();

        // Buscar jugador por nombre
        const playersSnapshot = await db
            .collection('players')
            .where('name', '==', 'Alvaro M.')
            .get();

        if (playersSnapshot.empty) {
            console.log('❌ No se encontró jugador con nombre "Alvaro M."');
            process.exit(1);
        }

        for (const doc of playersSnapshot.docs) {
            const data = doc.data();
            console.log(`Jugador ID: ${doc.id}`);
            console.log(`Nombre: ${data.name}`);
            console.log(`PhotoURL en player: ${data.photoURL || '(vacío)'}`);
            console.log(`OwnerUid: ${data.ownerUid}`);
            console.log('');

            // Verificar usuario
            const userDoc = await db.collection('users').doc(data.ownerUid).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                console.log(`Usuario displayName: ${userData?.displayName}`);
                console.log(`Usuario photoURL: ${userData?.photoURL || '(vacío)'}`);
            }
        }

        process.exit(0);
    } catch (error: any) {
        console.error('\n❌ Error:', error);
        process.exit(1);
    }
}

checkAlvaroProfile();
