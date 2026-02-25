import { getAdminDb } from '../src/firebase/admin-init';

async function exportEvaluations(matchId: string) {
    const db = getAdminDb();
    const matchRef = db.collection('matches').doc(matchId);

    // 1. Get Match Data
    const matchSnap = await matchRef.get();
    const matchData = matchSnap.data();
    const players = matchData?.players || [];
    const playerMap = new Map(players.map((p: any) => [p.uid, p.displayName]));

    // 2. Get Self Evaluations
    const selfEvalsSnap = await matchRef.collection('selfEvaluations').get();
    const selfEvals: Record<string, any> = {};
    selfEvalsSnap.forEach(doc => {
        selfEvals[doc.id] = doc.data();
    });

    // 3. Get Peer Evaluations
    const peerEvalsSnap = await db.collection('evaluations').where('matchId', '==', matchId).get();
    const peerEvals: Record<string, any[]> = {};
    peerEvalsSnap.forEach(doc => {
        const data = doc.data();
        if (!peerEvals[data.playerId]) peerEvals[data.playerId] = [];
        peerEvals[data.playerId].push(data);
    });

    console.log(JSON.stringify({
        players,
        selfEvals,
        peerEvals
    }, null, 2));
}

exportEvaluations('sAul42BOyTjYph06xFds');
