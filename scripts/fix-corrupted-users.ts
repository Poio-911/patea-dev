import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { config } from 'dotenv';
import { join } from 'path';

// Cargar variables de entorno desde .env.local
config({ path: join(process.cwd(), '.env.local') });

// Inicializar Firebase Admin usando la variable de entorno
if (getApps().length === 0) {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        console.error('❌ Error: FIREBASE_SERVICE_ACCOUNT_KEY no está definido en .env.local');
        process.exit(1);
    }
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    initializeApp({
        credential: cert(serviceAccount),
        // Si tienes storageBucket en env, úsalo, si no, hardcode o ignorar si no se usa storage
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'patea-911.firebasestorage.app'
    });
}

const db = getFirestore();
const auth = getAuth();

console.log("----------------------------------------------------------------");
console.log("   REPARADOR DE USUARIOS CORRUPTOS - PATEÁ (ENV MODE)");
console.log("----------------------------------------------------------------");

async function fixCorruptedUsers() {
    console.log('🚀 Iniciando escaneo de usuarios corruptos...');

    try {
        // 1. Obtener todos los usuarios de Auth
        // Nota: listUsers descarga en lotes (default 1000). Para todos, habría que paginar.
        // Para este fix, 1000 suele ser suficiente por ahora.
        const listUsersResult = await auth.listUsers(1000);
        const users = listUsersResult.users;

        console.log(`🔍 Analizando ${users.length} usuarios de Authentication...`);

        let fixedCount = 0;
        let errorCount = 0;
        let skippedCount = 0;

        for (const user of users) {
            const uid = user.uid;
            const email = user.email || 'no-email';
            // Fallback for displayName
            const displayName = user.displayName || email.split('@')[0];
            const photoURL = user.photoURL || null;

            // Check if documents exist in Firestore
            const userDocRef = db.collection('users').doc(uid);
            const playerDocRef = db.collection('players').doc(uid);

            const [userSnap, playerSnap] = await Promise.all([
                userDocRef.get(),
                playerDocRef.get()
            ]);

            let needsFix = false;
            let fixReason: string[] = [];

            // Check User Document
            if (!userSnap.exists) {
                needsFix = true;
                fixReason.push('Falta documento /users');
            }

            // Check Player Document
            if (!playerSnap.exists) {
                needsFix = true;
                fixReason.push('Falta documento /players');
            } else {
                // Check for critical fields in player (like position)
                const playerData = playerSnap.data();
                if (!playerData?.position) {
                    needsFix = true;
                    fixReason.push('Falta posición en /players');
                }
            }

            if (needsFix) {
                console.log(`🛠️  Reparando usuario: ${email} (${uid})`);
                console.log(`    Razón: ${fixReason.join(', ')}`);

                try {
                    const batch = db.batch();

                    // 1. Restore /users document if missing
                    if (!userSnap.exists) {
                        const newUserProfile = {
                            uid: uid,
                            email: email,
                            displayName: displayName,
                            photoURL: photoURL,
                            groups: [],
                            activeGroupId: null,
                            phoneNumber: user.phoneNumber || null,
                            createdAt: FieldValue.serverTimestamp()
                        };
                        batch.set(userDocRef, newUserProfile);
                    }

                    // 2. Restore /players document if missing or incomplete
                    if (!playerSnap.exists || !playerSnap.data()?.position) {
                        const baseStat = 50;
                        // Default generic info if missing
                        const newPlayer = {
                            name: displayName,
                            position: playerSnap.data()?.position || 'MED', // Default to MED if unknown
                            pac: baseStat,
                            sho: baseStat,
                            pas: baseStat,
                            dri: baseStat,
                            def: baseStat,
                            phy: baseStat,
                            ovr: baseStat,
                            photoUrl: photoURL || '',
                            stats: { matchesPlayed: 0, goals: 0, assists: 0, averageRating: 0 },
                            ownerUid: uid,
                            groupId: null,
                            cardGenerationCredits: 3,
                            lastCreditReset: new Date().toISOString(),
                        };
                        // Use set with merge: true to avoid overwriting existing valid data
                        batch.set(playerDocRef, newPlayer, { merge: true });
                    }

                    await batch.commit();
                    console.log(`✅ Reparado exitosamente: ${email}`);
                    fixedCount++;

                } catch (error) {
                    console.error(`❌ Error reparando usuario ${email}:`, error);
                    errorCount++;
                }
            } else {
                skippedCount++;
            }
        }

        console.log(`\n🎉 Finalizado.`);
        console.log(`- Usuarios analizados: ${users.length}`);
        console.log(`- Usuarios OK (Saltados): ${skippedCount}`);
        console.log(`- Usuarios Reparados: ${fixedCount}`);
        console.log(`- Errores de Reparación: ${errorCount}`);

    } catch (error) {
        console.error("Error listando usuarios:", error);
        process.exit(1);
    }
}

fixCorruptedUsers().then(() => process.exit(0));
