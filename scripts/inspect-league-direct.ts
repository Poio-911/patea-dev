const admin = require('firebase-admin');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables manually
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const LEAGUE_ID = '6bbkTypI0bGMsWpFaYPK';

async function init() {
    if (admin.apps.length === 0) {
        const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
        if (!serviceAccountKey) {
            console.error('FIREBASE_SERVICE_ACCOUNT_KEY is missing in .env.local');
            process.exit(1);
        }

        try {
            const serviceAccount = JSON.parse(serviceAccountKey);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                projectId: serviceAccount.project_id
            });
            console.log('Firebase Admin initialized successfully.');
        } catch (e) {
            console.error('Error parsing service account:', e);
            process.exit(1);
        }
    }
    return admin.firestore();
}

async function inspect() {
    const db = await init();

    console.log(`\n=== INSPECTING LEAGUE: ${LEAGUE_ID} ===`);

    // 1. Check League Doc
    const leagueRef = db.collection('leagues').doc(LEAGUE_ID);
    const leagueSnap = await leagueRef.get();

    if (!leagueSnap.exists) {
        console.error('League not found!');
        return;
    }

    const league = leagueSnap.data();
    console.log('League Status:', league.status);
    console.log('League Teams:', league.teams?.length);

    // 2. Check Matches
    console.log('\n--- MATCHES ---');
    const matchesSnap = await db.collection('matches')
        .where('leagueInfo.leagueId', '==', LEAGUE_ID)
        .get();

    if (matchesSnap.empty) {
        console.log('No matches found for this league.');
    } else {
        console.log(`Found ${matchesSnap.size} matches.`);

        // Analyze scores and status
        matchesSnap.forEach((doc: any) => {
            const m = doc.data();
            console.log(`Match ${doc.id} [${m.status}]: ${m.team1Name} (${m.scoreTeam1}) vs ${m.team2Name} (${m.scoreTeam2})`);

            // Check for NaN or inconsistent types
            if (typeof m.scoreTeam1 !== 'number' && m.scoreTeam1 !== undefined) console.warn(`  WARNING: scoreTeam1 is type ${typeof m.scoreTeam1}: ${m.scoreTeam1}`);
            if (typeof m.scoreTeam2 !== 'number' && m.scoreTeam2 !== undefined) console.warn(`  WARNING: scoreTeam2 is type ${typeof m.scoreTeam2}: ${m.scoreTeam2}`);
            if (isNaN(Number(m.scoreTeam1)) && m.scoreTeam1 !== undefined) console.warn('  ERROR: scoreTeam1 is NaN');

            // Check if evaluated but no result
            if (m.status === 'evaluated' && (m.scoreTeam1 === undefined || m.scoreTeam2 === undefined)) {
                console.warn('  ERROR: Match evaluated but missing scores');
            }
        });
    }

    // 3. Inspect Teams (optional check for owner)
    // ...
}

inspect().catch(err => console.error('Script failed:', err));
