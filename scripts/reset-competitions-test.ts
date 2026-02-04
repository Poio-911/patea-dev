/**
 * Script para resetear competiciones y equipos, y crear datos de prueba limpios
 */

import { initializeApp, cert, getApps, ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

if (getApps().length === 0) {
    const s = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
    initializeApp({ credential: cert(s as ServiceAccount), projectId: s.project_id });
}

const db = getFirestore();

async function resetAndCreateTestData() {
    console.log('🧹 Starting cleanup and test data creation...\n');

    try {
        // 1. Get all competitions
        console.log('📋 Step 1: Fetching existing competitions...');
        const [cupsSnap, leaguesSnap] = await Promise.all([
            db.collection('cups').get(),
            db.collection('leagues').get()
        ]);

        console.log(`   Found ${cupsSnap.size} cups and ${leaguesSnap.size} leagues`);

        // 2. Delete all matches associated with competitions
        console.log('\n🗑️  Step 2: Deleting competition matches...');
        const allCompetitionIds = [
            ...cupsSnap.docs.map(d => d.id),
            ...leaguesSnap.docs.map(d => d.id)
        ];

        if (allCompetitionIds.length > 0) {
            const matchesSnap = await db.collection('matches')
                .where('leagueInfo.leagueId', 'in', allCompetitionIds.slice(0, 10))
                .get();

            console.log(`   Found ${matchesSnap.size} matches to delete`);

            const batch = db.batch();
            matchesSnap.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
            console.log('   ✅ Matches deleted');
        }

        // 3. Delete all competitions
        console.log('\n🗑️  Step 3: Deleting competitions...');
        const compBatch = db.batch();
        cupsSnap.docs.forEach(doc => compBatch.delete(doc.ref));
        leaguesSnap.docs.forEach(doc => compBatch.delete(doc.ref));
        await compBatch.commit();
        console.log('   ✅ Competitions deleted');

        // 4. Delete all teams
        console.log('\n🗑️  Step 4: Deleting teams...');
        const teamsSnap = await db.collection('teams').get();
        console.log(`   Found ${teamsSnap.size} teams to delete`);

        const teamsBatch = db.batch();
        teamsSnap.docs.forEach(doc => teamsBatch.delete(doc.ref));
        await teamsBatch.commit();
        console.log('   ✅ Teams deleted');

        // 5. Get group and players for test data
        console.log('\n📊 Step 5: Fetching group and players...');

        // Find the group with the most players
        const allPlayersSnap = await db.collection('players').get();
        const playersByGroup = new Map<string, any[]>();

        allPlayersSnap.docs.forEach(doc => {
            const player = { id: doc.id, ...doc.data() };
            const groupId = (player as any).groupId;
            if (groupId) {
                if (!playersByGroup.has(groupId)) {
                    playersByGroup.set(groupId, []);
                }
                playersByGroup.get(groupId)!.push(player);
            }
        });

        // Find group with most players
        let bestGroupId: string | null = null;
        let maxPlayers = 0;
        for (const [groupId, players] of playersByGroup.entries()) {
            if (players.length > maxPlayers) {
                maxPlayers = players.length;
                bestGroupId = groupId;
            }
        }

        if (!bestGroupId || maxPlayers < 8) {
            console.error(`   ❌ Need at least 8 players in a group, found ${maxPlayers}`);
            return;
        }

        const groupDoc = await db.collection('groups').doc(bestGroupId).get();
        if (!groupDoc.exists) {
            console.error('   ❌ Group not found!');
            return;
        }

        const group = { id: groupDoc.id, ...groupDoc.data() } as any;
        const players = playersByGroup.get(bestGroupId)!;
        console.log(`   Using group: ${group.name} (${group.id})`);
        console.log(`   Found ${players.length} players`);

        // 6. Create 4 new teams (2 players each)
        console.log('\n🏆 Step 6: Creating 4 test teams...');
        const teamColors = [
            { primary: '#FF0000', secondary: '#FFFFFF', name: 'Equipo Rojo' },
            { primary: '#0000FF', secondary: '#FFFFFF', name: 'Equipo Azul' },
            { primary: '#00FF00', secondary: '#000000', name: 'Equipo Verde' },
            { primary: '#FFFF00', secondary: '#000000', name: 'Equipo Amarillo' }
        ];

        const createdTeams = [];
        for (let i = 0; i < 4; i++) {
            const teamPlayers = players.slice(i * 2, i * 2 + 2);
            const teamData = {
                name: teamColors[i].name,
                groupId: group.id,
                createdAt: new Date().toISOString(),
                members: teamPlayers.map(p => ({
                    playerId: p.id,
                    playerName: p.name,
                    position: p.position || 'MED',
                    ovr: p.ovr || 50
                })),
                jersey: {
                    type: 'plain',
                    primaryColor: teamColors[i].primary,
                    secondaryColor: teamColors[i].secondary
                }
            };

            const teamRef = await db.collection('teams').add(teamData);
            createdTeams.push({ id: teamRef.id, ...teamData });
            console.log(`   ✅ Created ${teamColors[i].name} (${teamRef.id})`);
        }

        // 7. Create 1 League (draft status)
        console.log('\n🏅 Step 7: Creating test league...');
        const leagueData = {
            name: 'Liga de Prueba',
            format: 'round_robin',
            status: 'draft',
            ownerUid: group.ownerUid,
            groupId: group.id,
            isPublic: false,
            teams: createdTeams.map(t => t.id),
            createdAt: new Date().toISOString(),
            matchesPerRound: 2,
            homeAndAway: true
        };

        const leagueRef = await db.collection('leagues').add(leagueData);
        console.log(`   ✅ Created league: ${leagueRef.id}`);

        // 8. Create 1 Cup (draft status)
        console.log('\n🏆 Step 8: Creating test cup...');
        const cupData = {
            name: 'Copa de Prueba',
            format: 'single_elimination',
            status: 'draft',
            ownerUid: group.ownerUid,
            groupId: group.id,
            isPublic: false,
            teams: createdTeams.map(t => t.id),
            createdAt: new Date().toISOString()
        };

        const cupRef = await db.collection('cups').add(cupData);
        console.log(`   ✅ Created cup: ${cupRef.id}`);

        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('✅ RESET COMPLETE');
        console.log('='.repeat(60));
        console.log(`\n📊 Summary:`);
        console.log(`   - Group: ${group.name}`);
        console.log(`   - Teams created: ${createdTeams.length}`);
        console.log(`   - League ID: ${leagueRef.id} (status: draft)`);
        console.log(`   - Cup ID: ${cupRef.id} (status: draft)`);
        console.log(`\n⚠️  IMPORTANT: Do NOT click "Iniciar" yet!`);
        console.log(`   Navigate to the competitions and verify they appear correctly.\n`);

    } catch (error) {
        console.error('\n❌ Error:', error);
        throw error;
    }
}

resetAndCreateTestData()
    .then(() => {
        console.log('Script completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Script failed:', error);
        process.exit(1);
    });
