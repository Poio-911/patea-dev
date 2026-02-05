
import * as dotenv from 'dotenv';
import { getAdminDb } from '../src/firebase/admin-init';

dotenv.config({ path: '.env.local' });

async function verifyMatchData() {
    try {
        console.log('🔍 Verifying match data...\n');
        const db = getAdminDb();

        // Get "Prueba Evaluaciones 2" specifically
        const matchesSnapshot = await db.collection('matches')
            .where('title', '==', 'Prueba Evaluaciones 2')
            .limit(1)
            .get();

        if (matchesSnapshot.empty) {
            console.log('❌ Match "Prueba Evaluaciones 2" not found');
            return;
        }

        const matchDoc = matchesSnapshot.docs[0];
        const match = matchDoc.data();

        console.log(`📄 Match: ${match.title} (${matchDoc.id})\n`);

        console.log('👥 Match Players Array:');
        if (match.players && match.players.length > 0) {
            match.players.forEach((p: any, i: number) => {
                console.log(`   [${i}] ${p.displayName}`);
                console.log(`       UID: ${p.uid}`);
                console.log(`       photoURL: ${p.photoURL || '(missing)'}`);
                console.log(`       Type: ${typeof p.photoURL}`);
            });
        } else {
            console.log('   (No players array)');
        }

        console.log('\n👕 Teams Array:');
        if (match.teams && match.teams.length > 0) {
            match.teams.forEach((t: any, ti: number) => {
                console.log(`   Team ${ti}: ${t.name}`);
                if (t.players && t.players.length > 0) {
                    t.players.forEach((p: any, pi: number) => {
                        console.log(`      [${pi}] ${p.displayName}`);
                        console.log(`          UID: ${p.uid || p.id || '(no uid)'}`);
                        console.log(`          photoURL: ${p.photoURL || '(missing)'}`);
                        console.log(`          Type: ${typeof p.photoURL}`);
                    });
                }
            });
        }

        // Also check a few player profiles
        console.log('\n🔍 Checking Player Profiles:');
        const sampleUIDs = ['3xcfOetChgYB4ax6oh3w5zzd2w82', 'QYx3MCcrYRTJ1aYB24tQy0A2fmM2'];
        for (const uid of sampleUIDs) {
            const playerDoc = await db.collection('players').doc(uid).get();
            if (playerDoc.exists) {
                const playerData = playerDoc.data();
                console.log(`   ${playerData?.name || 'Unknown'} (${uid})`);
                console.log(`      photoURL: ${playerData?.photoURL || '(missing)'}`);
            }
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

verifyMatchData();
