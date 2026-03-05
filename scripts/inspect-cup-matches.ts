import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
if (!getApps().length) initializeApp({ credential: cert(sa), projectId: sa.project_id });
const db = getFirestore();

async function checkCup(cupId: string) {
  const cupDoc = await db.collection('cups').doc(cupId).get();
  if (!cupDoc.exists) {
    console.log('Cup not found');
    return;
  }
  const cupData = cupDoc.data();
  console.log('Cup status:', cupData.status);
  console.log('Bracket matches:');
  cupData.bracket.forEach((m: any) => {
    let teamsStr = 'TBD vs TBD';
    if (m.teams && Array.isArray(m.teams)) {
      teamsStr = m.teams.map((t: any) => t?.name || 'TBD').join(' vs ');
    }
    console.log(`- Round ${m.round}, Match ${m.matchIndex}: matchId=${m.matchId}, winnerId=${m.winnerId}, teams: ${teamsStr}`);
  });

  const matchesSnapshot = await db.collection('matches').where('leagueInfo.leagueId', '==', cupId).get();
  console.log('\nMatches collection:');
  matchesSnapshot.forEach((doc) => {
    const data = doc.data();
    console.log(`- Match ${doc.id}: status=${data.status}, round=${data.leagueInfo?.round}, finalScore=`, data.finalScore);
  });
}

checkCup('LTZECrLjILPRNg8YlQw5').catch(console.error);
