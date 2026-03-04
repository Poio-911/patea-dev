import * as admin from 'firebase-admin';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

if (admin.apps.length === 0) {
    const s = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
    admin.initializeApp({ credential: admin.credential.cert(s), projectId: s.project_id });
}

const db = admin.firestore();
const auth = admin.auth();

const PASSWORD = '123456';
const TOTAL_USERS = 30;

async function seedUsers() {
    console.log(`🚀 Iniciando creación de ${TOTAL_USERS} usuarios...`);

    const credentials: { email: string; pass: string; uid: string; name: string }[] = [];
    const positions = ['POR', 'DEF', 'MED', 'DEL'];

    for (let i = 1; i <= TOTAL_USERS; i++) {
        const email = `tester_${i}@test.com`;
        const name = `Tester Real ${i}`;

        try {
            // 1. Create Auth User
            let userRecord;
            try {
                userRecord = await auth.getUserByEmail(email);
                console.log(`- Usuario ${email} ya existe. Saltando creación Auth.`);
            } catch (e) {
                userRecord = await auth.createUser({
                    email,
                    password: PASSWORD,
                    displayName: name,
                });
                console.log(`✅ Creado Auth: ${email}`);
            }

            const uid = userRecord.uid;
            credentials.push({ email, pass: PASSWORD, uid, name });

            // 2. Create User Profile in Firestore
            await db.collection('users').doc(uid).set({
                uid,
                email,
                displayName: name,
                photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${uid}`,
                groups: [],
                activeGroupId: null,
                createdAt: new Date().toISOString()
            }, { merge: true });

            // 3. Create Player Profile in Firestore
            const position = positions[Math.floor(Math.random() * positions.length)];
            await db.collection('players').doc(uid).set({
                id: uid,
                name: name,
                position: position,
                ovr: 50,
                pac: 50, sho: 50, pas: 50, dri: 50, def: 50, phy: 50,
                stats: {
                    matchesPlayed: 0,
                    goals: 0,
                    assists: 0,
                    averageRating: 0,
                    mvpCount: 0
                },
                ownerUid: uid,
                groupId: null,
                photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${uid}`,
                createdAt: new Date().toISOString()
            }, { merge: true });

        } catch (error: any) {
            console.error(`❌ Error con ${email}:`, error.message);
        }
    }

    console.log('\n📄 Credenciales generadas:');
    console.log(JSON.stringify(credentials, null, 2));

    // Guardar credenciales en un archivo temporal para uso por los siguientes scripts
    const fs = require('fs');
    fs.writeFileSync(join(process.cwd(), 'scripts/temp_credentials.json'), JSON.stringify(credentials));
    console.log('\n✅ Script 1 finalizado. Datos guardados en scripts/temp_credentials.json');
}

seedUsers().catch(console.error);
