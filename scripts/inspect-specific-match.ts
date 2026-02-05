
import * as dotenv from 'dotenv';
import { getAdminDb } from '../src/firebase/admin-init';

dotenv.config({ path: '.env.local' });

async function inspectMatch() {
    try {
        console.log('🔍 Inspecting matches...');
        const db = getAdminDb();
        const matchesSnapshot = await db.collection('matches').get();

        const targetMatches = matchesSnapshot.docs.filter(doc => {
            const data = doc.data();
            return data.title && (data.title.includes('Prueba Evaluaciones') || data.title.includes('Evaluación'));
        });

        if (targetMatches.length === 0) {
            console.log('❌ No matches found with title "Prueba Evaluaciones"');
            return;
        }

        for (const matchDoc of targetMatches) {
            const match = matchDoc.data();
            console.log(`\n📄 Match: ${match.title} (${matchDoc.id})`);
            console.log(`   📅 Date: ${match.date}`);

            console.log('   👥 Match Players (sample):');
            if (match.players && match.players.length > 0) {
                match.players.slice(0, 3).forEach((p: any) => {
                    console.log(`      - ${p.displayName} (UID: ${p.uid}): photoURL="${p.photoURL}"`);
                });
            } else {
                console.log('      (No players array)');
            }

            console.log('   👕 Teams (sample):');
            if (match.teams && match.teams.length > 0) {
                match.teams.forEach((t: any) => {
                    console.log(`      Team: ${t.name}`);
                    if (t.players && t.players.length > 0) {
                        t.players.slice(0, 3).forEach((p: any) => {
                            console.log(`         - ${p.displayName} (UID: ${p.uid || p.id}): photoURL="${p.photoURL}"`);
                        });
                    }
                });
            }
        }
        process.exit(0);

    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

inspectMatch();
