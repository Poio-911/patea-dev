
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// --- Configuration ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load service account
const serviceAccountPath = path.join(__dirname, '../mil-disculpis-firebase-adminsdk-fbsvc-5d1f71eeb1.json');
if (!fs.existsSync(serviceAccountPath)) {
    console.error('ERROR: service-account.json not found at', serviceAccountPath);
    process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

if (!getApps().length) {
    initializeApp({
        credential: cert(serviceAccount),
        storageBucket: 'mil-disculpis.firebasestorage.app'
    });
    console.log('🔥 Firebase Admin initialized');
}

const db = getFirestore();
const TARGET_OWNER_UID = 'dRYXgsJ1Joa28L69MV9kFRpWfxC3';

async function updateOrganizer() {
    console.log(`🔄 Updating competitions to new organizer: ${TARGET_OWNER_UID}`);

    try {
        // 1. Update Leagues
        console.log('Updating Leagues...');
        const leaguesSnapshot = await db.collection('leagues').get();
        if (leaguesSnapshot.empty) {
            console.log('No leagues found.');
        } else {
            const batch = db.batch();
            leaguesSnapshot.docs.forEach(doc => {
                batch.update(doc.ref, { ownerUid: TARGET_OWNER_UID });
            });
            await batch.commit();
            console.log(`✅ Updated ${leaguesSnapshot.size} leagues.`);
        }

        // 2. Update Cups
        console.log('Updating Cups...');
        const cupsSnapshot = await db.collection('cups').get();
        if (cupsSnapshot.empty) {
            console.log('No cups found.');
        } else {
            const batch = db.batch();
            cupsSnapshot.docs.forEach(doc => {
                batch.update(doc.ref, { ownerUid: TARGET_OWNER_UID });
            });
            await batch.commit();
            console.log(`✅ Updated ${cupsSnapshot.size} cups.`);
        }

        // Optional: Update Teams created by seed to this owner too?
        // The user strictly said "leagues and/or cups", but usually the organizer also owns the teams they created.
        // However, the teams might be "owned" by the players. 
        // Given the request "Edita las ligas y/o copas", I'll stick to those to be safe. 
        // BUT, usually for testing, it helps if the user owns the teams to manage them if logic requires it.
        // For now, I'll stick to the specific request.

        console.log('✨ Update complete.');

    } catch (error) {
        console.error('❌ Error updating organizer:', error);
    }
}

updateOrganizer();
