import { getAdminDb } from '../src/firebase/admin-init';

async function checkDistribution(matchId: string) {
    const db = getAdminDb();
    const evalsSnap = await db.collection('evaluations').where('matchId', '==', matchId).get();

    const stats: Record<string, { received: number, evaluators: string[] }> = {};

    evalsSnap.forEach(doc => {
        const data = doc.data();
        const pId = data.playerId;
        if (!stats[pId]) stats[pId] = { received: 0, evaluators: [] };
        stats[pId].received++;
        stats[pId].evaluators.push(data.evaluatorId);
    });

    console.log(JSON.stringify(stats, null, 2));
}

checkDistribution('sAul42BOyTjYph06xFds');
