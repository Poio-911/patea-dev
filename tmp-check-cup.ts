import { getAdminDb } from './src/firebase/admin-init';

async function checkCup() {
    const db = getAdminDb();
    const cupsDb = await db.collection('cups').get();

    for (const c of cupsDb.docs) {
        const cup = c.data();
        console.log(`--- ${cup.title} (${c.id}) ---`);
        console.log('Cup Teams array length:', cup.teams?.length);
        console.log('Cup Teams array:', cup.teams);
        console.log('Cup maxTeams:', cup.maxTeams);

        const apps = await db.collection('competitionApplications')
            .where('competitionId', '==', c.id)
            .where('status', '==', 'approved')
            .get();

        console.log('Approved applications count:', apps.docs.length);
    }
    process.exit(0);
}

checkCup().catch(e => { console.error(e); process.exit(1); });
