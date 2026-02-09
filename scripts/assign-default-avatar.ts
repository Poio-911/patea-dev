
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { config } from 'dotenv';
import { join } from 'path';
import { readFileSync, existsSync } from 'fs';

// Cargar variables de entorno
config({ path: join(process.cwd(), '.env.local') });

// Inicializar Firebase Admin
if (getApps().length === 0) {
    console.log('🔧 Intentando cargar variables de entorno...');

    if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        console.error('❌ Error: FIREBASE_SERVICE_ACCOUNT_KEY no está definido env vars carregadas.');
        // Intenta leer el archivo .env.local manualmente por si dotenv falla silenciosamente
        try {
            const fs = require('fs');
            const envPath = join(process.cwd(), '.env.local');
            if (fs.existsSync(envPath)) {
                console.log('📄 .env.local encontrado, pero dotenv no parece haberlo cargado bien o la variable falta.');
            }
        } catch (e) { }
        process.exit(1);
    }

    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'mil-disculpis.appspot.com';
    console.log(`🪣 Usando Bucket de Storage: ${bucketName}`);

    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    initializeApp({
        credential: cert(serviceAccount),
        storageBucket: bucketName
    });
}

const auth = getAuth();
const firestore = getFirestore();
const storage = getStorage();

const DEFAULT_AVATAR_PATH = join(process.cwd(), 'scripts', 'assets', 'default-avatar.jpg');
const STORAGE_DESTINATION = 'system/default-avatar-v2.jpg'; // v2 to avoid conflicts if exists

async function uploadDefaultAvatar() {
    if (!existsSync(DEFAULT_AVATAR_PATH)) {
        console.error(`❌ No se encontró la imagen en: ${DEFAULT_AVATAR_PATH}`);
        process.exit(1);
    }

    /* 
    const bucketNamesToTry = [
        process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        'mil-disculpis.appspot.com',
        'mil-disculpis.firebasestorage.app',
        'patea-911.appspot.com',
        'patea-911.firebasestorage.app'
    ].filter(Boolean) as string[];

    let bucket;
    let validBucketName = '';

    for (const name of bucketNamesToTry) {
        try {
            console.log(`🔍 Probando bucket: ${name}...`);
            const b = storage.bucket(name);
            const [exists] = await b.exists();
            if (exists) {
                console.log(`✅ Bucket válido encontrado: ${name}`);
                bucket = b;
                validBucketName = name;
                break;
            } else {
                console.log(`❌ Bucket ${name} no existe.`);
            }
        } catch (e) {
            console.log(`❌ Error accediendo a ${name}:`, e.message);
        }
    }

    if (!bucket) {
        console.error('❌ No se encontró ningún bucket válido. Verificá tu configuración.');
        process.exit(1);
    }
    */

    // Simplificación para depurar: Usar el que tenemos fe
    const bucketNameTarget = 'mil-disculpis.appspot.com';

    try {
        const bucket = storage.bucket(bucketNameTarget);

        const file = bucket.file(STORAGE_DESTINATION);

        console.log(`📤 Subiendo imagen a gs://${bucket.name}/${STORAGE_DESTINATION}...`);

        await bucket.upload(DEFAULT_AVATAR_PATH, {
            destination: STORAGE_DESTINATION,
            metadata: {
                contentType: 'image/jpeg',
                cacheControl: 'public, max-age=31536000',
            }
        });

        // Hacer el archivo público
        await file.makePublic();

        // Obtener la URL pública
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${STORAGE_DESTINATION}`;

        console.log(`✅ Imagen subida exitosamente. URL: ${publicUrl}`);
        return publicUrl;

    } catch (error) {
        console.error('❌ Error listando/accediendo buckets:', error);
        process.exit(1);
    }
}

async function assignAvatarToUsers(avatarUrl: string) {
    console.log('🔍 Buscando usuarios sin foto de perfil...');

    let pageToken;
    let totalUsers = 0;
    let updatedUsers = 0;

    do {
        const listUsersResult = await auth.listUsers(1000, pageToken);

        for (const user of listUsersResult.users) {
            totalUsers++;

            // Criterio: Si no tiene photoURL o es la default vieja (podríamos agregar más lógica)
            // Por ahora, asumimos que si no tiene o está vacía.
            // El usuario pidió: "ponersela a todos los usuarios que no tengan imagen"

            const needsUpdate = !user.photoURL;

            if (needsUpdate) {
                console.log(`🛠️  Actualizando usuario: ${user.email} (${user.uid})`);

                try {
                    // 1. Actualizar Authentication
                    await auth.updateUser(user.uid, {
                        photoURL: avatarUrl
                    });

                    // 2. Actualizar Firestore (Batch)
                    const batch = firestore.batch();
                    const userRef = firestore.collection('users').doc(user.uid);
                    const playerRef = firestore.collection('players').doc(user.uid);
                    const availablePlayerRef = firestore.collection('availablePlayers').doc(user.uid);

                    // Verificar existencia antes de actualizar para no crear docs vacíos indeseados
                    // Aunque el script anterior ya reparó usuarios, es buena práctica.
                    const userSnap = await userRef.get();
                    if (userSnap.exists) {
                        batch.update(userRef, { photoURL: avatarUrl });
                    }

                    const playerSnap = await playerRef.get();
                    if (playerSnap.exists) {
                        batch.update(playerRef, { photoUrl: avatarUrl }); // Nota: photoUrl vs photoURL (Firestore suele usar camelCase, revisar types)
                        // Revisando types.ts, Player usa `photoUrl` (minúscula 'rl')? 
                        // Voy a asumir photoUrl por convención común en este proyecto, 
                        // pero si falla, el merge: true podría salvarlo si fuera set. 
                        // Al ser update, debo estar seguro.
                        // Mirando player-detail-card.tsx: player.photoUrl
                    }

                    const availableSnap = await availablePlayerRef.get();
                    if (availableSnap.exists) {
                        batch.update(availablePlayerRef, { photoUrl: avatarUrl });
                    }

                    await batch.commit();
                    updatedUsers++;
                    console.log(`✅ Usuario ${user.email} actualizado.`);

                } catch (error) {
                    console.error(`❌ Error actualizando ${user.email}:`, error);
                }
            }
        }

        pageToken = listUsersResult.pageToken;
    } while (pageToken);

    console.log('------------------------------------------------');
    console.log(`🎉 Proceso finalizado.`);
    console.log(`- Total usuarios escaneados: ${totalUsers}`);
    console.log(`- Usuarios actualizados: ${updatedUsers}`);
}

async function main() {
    try {
        const avatarUrl = await uploadDefaultAvatar();
        await assignAvatarToUsers(avatarUrl);
    } catch (error) {
        console.error('❌ Error fatal:', error);
        process.exit(1);
    }
}

main();
