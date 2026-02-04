const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
import { getAdminDb } from '../src/firebase/admin-init';

const db = getAdminDb();

const LEAGUE_ID = '6bbkTypI0bGMsWpFaYPK';

async function inspectLeague() {
    console.log(`Inspecting League: ${LEAGUE_ID}`);

    // 1. Get League Doc
    const leagueDoc = await db.collection('leagues').doc(LEAGUE_ID).get();
    if (!leagueDoc.exists) {
        console.error('League not found');
        return;
    }
    const league = leagueDoc.data();
    console.log('\n--- League Data ---');
    console.log(JSON.stringify(league, null, 2));

    // 2. Get Matches
    const matchesSnap = await db.collection('matches')
        .where('leagueInfo.leagueId', '==', LEAGUE_ID)
        .get();

    console.log(`\n--- Matches Found: ${matchesSnap.size} ---`);

    if (matchesSnap.empty) {
        // Try searching by competitionId just in case schema is mixed
        const matchesSnapLegacy = await db.collection('matches')
            .where('competitionId', '==', LEAGUE_ID)
            .get();
        console.log(`Matches by competitionId: ${matchesSnapLegacy.size}`);
    }

    matchesSnap.docs.forEach(doc => {
        const m = doc.data();
        console.log(`Match ${doc.id}:`);
        console.log(`  Status: ${m.status}`);
        console.log(`  Teams: ${m.team1Name} vs ${m.team2Name}`);
        console.log(`  Scores: ${m.scoreTeam1} - ${m.scoreTeam2}`);
        console.log(`  Evaluated: ${m.evaluated}`);
        // Check for weird values
        if (isNaN(Number(m.scoreTeam1)) && m.scoreTeam1 !== undefined) console.warn('  WARNING: scoreTeam1 is NaN or invalid');
        if (isNaN(Number(m.scoreTeam2)) && m.scoreTeam2 !== undefined) console.warn('  WARNING: scoreTeam2 is NaN or invalid');
    });

    // 3. Get Teams to check references
    if (league?.teams && Array.isArray(league.teams)) {
        console.log(`\n--- Teams (${league.teams.length}) ---`);
        // Just verify a few
        const teamsSnap = await db.collection('teams').where('__name__', 'in', league.teams.slice(0, 5)).get();
        teamsSnap.docs.forEach(d => {
            console.log(`Team ${d.id}: ${d.data().name}`);
        });
    }
}

inspectLeague().catch(console.error);
