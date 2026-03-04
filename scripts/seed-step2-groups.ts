import * as admin from 'firebase-admin';
import { config } from 'dotenv';
import { join } from 'path';
import * as fs from 'fs';

config({ path: join(process.cwd(), '.env.local') });

if (admin.apps.length === 0) {
    const s = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
    admin.initializeApp({ credential: admin.credential.cert(s), projectId: s.project_id });
}

const db = admin.firestore();

async function seedGroups() {
    const credsPath = join(process.cwd(), 'scripts/temp_credentials.json');
    if (!fs.existsSync(credsPath)) {
        console.error('❌ No se encontró scripts/temp_credentials.json. Ejecuta primero el script 1.');
        return;
    }

    const credentials = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
    console.log(`📂 Cargados ${credentials.length} usuarios para asignar a grupos.`);

    const groupNames = ['Liga de los Martes', 'Picadito de los Jueves', 'Torneo de Amigos'];
    const groups: string[] = [];

    for (let i = 0; i < 3; i++) {
        const groupName = groupNames[i];
        const groupMembers = credentials.slice(i * 10, (i + 1) * 10);
        const owner = groupMembers[0];

        console.log(`🏗️ Creando grupo: ${groupName} (Dueño: ${owner.email})`);

        const groupRef = db.collection('groups').doc();
        const groupId = groupRef.id;

        const members = groupMembers.map((m: any) => m.uid);
        const memberRoles = groupMembers.map((m: any) => ({
            userId: m.uid,
            role: m.uid === owner.uid ? 'admin' : 'member',
            joinedAt: new Date().toISOString()
        }));

        await groupRef.set({
            id: groupId,
            name: groupName,
            ownerUid: owner.uid,
            inviteCode: `TEST-${i + 1}-${Math.random().toString(36).substring(7).toUpperCase()}`,
            members: members,
            memberRoles: memberRoles,
            description: `Grupo de prueba ${groupName} para testing masivo.`,
            createdAt: new Date().toISOString()
        });

        // Update each player and user in the group
        for (const m of groupMembers) {
            await db.collection('players').doc(m.uid).update({
                groupId: groupId
            });
            await db.collection('users').doc(m.uid).update({
                activeGroupId: groupId,
                groups: admin.firestore.FieldValue.arrayUnion(groupId)
            });
        }

        groups.push(groupId);
        console.log(`✅ Grupo ${groupName} creado con ID: ${groupId}`);
    }

    fs.writeFileSync(join(process.cwd(), 'scripts/temp_groups.json'), JSON.stringify(groups));
    console.log('\n✅ Script 2 finalizado. IDs de grupos guardados en scripts/temp_groups.json');
}

seedGroups().catch(console.error);
