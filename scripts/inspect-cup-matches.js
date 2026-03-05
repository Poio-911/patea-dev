const admin = require('firebase-admin');
const config = require('../src/firebase/admin-config');
if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(config.serviceAccountKey) });
}
const db = admin.firestore();

async function checkCup(cupId) {
    const cupDoc = await db.collection('cups').doc(cupId).get();
    if (!cupDoc.exists) {
        console.log('Cup not found');
        return;
    }
    const cupData = cupDoc.data();
    console.log('Cup status:', cupData.status);
    console.log('Bracket matches:');
    cupData.bracket.forEach(m => {
        console.log(`- Round ${m.round}, Match ${m.matchIndex}: matchId=${m.matchId}, winnerId=${m.winnerId}, teams: ${m.teams.map(t => t?.name || 'TBD').join(' vs ')}`);
    });

    const matchesSnapshot = await db.collection('matches').where('leagueInfo.leagueId', '==', cupId).get();
    console.log('\nMatches collection:');
    matchesSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`- Match ${doc.id}: status=${data.status}, round=${data.leagueInfo?.round}, finalScore=`, data.finalScore);
    });
}

checkCup('LTZECrLjILPRNg8YlQw5').catch(console.error);
