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

const JERSEY_TEMPLATES: any[] = [
    { type: 'plain', primaryColor: '#FF0000', secondaryColor: '#FFFFFF' },
    { type: 'vertical', primaryColor: '#0000FF', secondaryColor: '#FFFFFF' },
    { type: 'band', primaryColor: '#FFFFFF', secondaryColor: '#000000' },
    { type: 'plain', primaryColor: '#FFFF00', secondaryColor: '#000000' },
    { type: 'vertical', primaryColor: '#008000', secondaryColor: '#FFFFFF' }
];

async function seedTeams() {
    const credsPath = join(process.cwd(), 'scripts/temp_credentials.json');
    const groupsPath = join(process.cwd(), 'scripts/temp_groups.json');

    if (!fs.existsSync(credsPath) || !fs.existsSync(groupsPath)) {
        console.error('❌ Falta temp_credentials.json o temp_groups.json. Ejecuta primero los scripts 1 y 2.');
        return;
    }

    const credentials = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
    const groupIds = JSON.parse(fs.readFileSync(groupsPath, 'utf8'));

    for (let i = 0; i < groupIds.length; i++) {
        const groupId = groupIds[i];
        const groupMembers = credentials.slice(i * 10, (i + 1) * 10);

        console.log(`\n⚽ Creando equipos para Grupo ID: ${groupId}`);

        for (let j = 1; j <= 3; j++) {
            const teamName = `Equipo ${i + 1}-${j}`;
            const teamRef = db.collection('teams').doc();

            // Assign 5 players (with some overlap since we have 10 players and need 3 teams of 5)
            // Team 1: p0-p4, Team 2: p5-p9, Team 3: p2-p6
            let teamPlayerIndices: number[] = [];
            if (j === 1) teamPlayerIndices = [0, 1, 2, 3, 4];
            else if (j === 2) teamPlayerIndices = [5, 6, 7, 8, 9];
            else teamPlayerIndices = [2, 3, 4, 5, 6];

            const selectedMembers = teamPlayerIndices.map(idx => groupMembers[idx]);
            const jersey = JERSEY_TEMPLATES[(i + j) % JERSEY_TEMPLATES.length];

            console.log(`   - Creando ${teamName} con ${selectedMembers.length} jugadores.`);

            await teamRef.set({
                id: teamRef.id,
                name: teamName,
                groupId: groupId,
                jersey: jersey,
                members: selectedMembers.map((m: any, idx) => ({
                    playerId: m.uid,
                    number: idx + 7,
                    status: 'titular'
                })),
                createdBy: groupMembers[0].uid,
                createdAt: new Date().toISOString()
            });

            // "Equilibrar" con 2 goles por equipo
            // Repartiremos 2 goles entre los primeros 2 jugadores del equipo
            for (let k = 0; k < 2; k++) {
                const playerUid = selectedMembers[k].uid;
                const playerRef = db.collection('players').doc(playerUid);

                await playerRef.update({
                    'stats.goals': admin.firestore.FieldValue.increment(1),
                    'stats.matchesPlayed': admin.firestore.FieldValue.increment(1)
                });
            }
        }
    }

    console.log('\n✅ Script 3 finalizado. Equipos creados y estadísticas actualizadas.');
}

seedTeams().catch(console.error);
