import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from 'dotenv';
import { join } from 'path';
config({ path: join(process.cwd(), '.env.local') });
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
if (!getApps().length) initializeApp({ credential: cert(sa as any), projectId: sa.project_id });
const db = getFirestore();

const matchId = '3Jz6qRePvVR8vPkbaGgr';

async function run() {
  const matchDoc = await db.collection('matches').doc(matchId).get();
  const md = matchDoc.data() as any;
  console.log('=== MATCH ===');
  console.log(JSON.stringify({
    id: matchDoc.id, status: md?.status, type: md?.type, title: md?.title,
    playerUids: md?.playerUids,
    players: md?.players?.map((p: any) => ({ uid: p.uid, name: p.displayName, position: p.position, team: p.team })),
    teams: md?.teams?.map((t: any) => ({ name: t.name, playerUids: t.playerUids }))
  }, null, 2));

  const assignments = await db.collection('matches').doc(matchId).collection('assignments').get();
  console.log('\n=== ASSIGNMENTS (' + assignments.size + ') ===');
  assignments.docs.forEach(d => console.log(JSON.stringify({ id: d.id, ...d.data() })));

  const selfEvals = await db.collection('matches').doc(matchId).collection('selfEvaluations').get();
  console.log('\n=== SELF EVALUATIONS (' + selfEvals.size + ') ===');
  selfEvals.docs.forEach(d => console.log(JSON.stringify({ id: d.id, ...d.data() })));

  const submissions = await db.collection('evaluationSubmissions').where('matchId', '==', matchId).get();
  console.log('\n=== PENDING SUBMISSIONS ===', submissions.size);
  submissions.docs.forEach(d => console.log(JSON.stringify({ id: d.id, evaluatorId: (d.data() as any).evaluatorId })));

  const processedSubs = await db.collection('matches').doc(matchId).collection('processedSubmissions').get();
  console.log('\n=== PROCESSED SUBMISSIONS ===', processedSubs.size);
  processedSubs.docs.forEach(d => console.log(JSON.stringify({ id: d.id, evaluatorId: (d.data() as any).evaluatorId })));
}
run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
