const { getAdminDb } = require('./src/firebase/admin-init');

async function checkCup() {
    const db = getAdminDb();
    const cupsDb = await db.collection('cups').where('title', '==', 'COPA ADIDAS').get();
    if (cupsDb.empty) {
        console.log('No cup found');
        return;
    }

    const cup = cupsDb.docs[0].data();
    console.log('Cup Teams array length:', cup.teams?.length);
    console.log('Cup Teams array:', cup.teams);
    console.log('Cup maxTeams:', cup.maxTeams);

    // also get accepted applications
    const apps = await db.collection('competitionApplications')
        .where('competitionId', '==', cupsDb.docs[0].id)
        .where('status', '==', 'approved')
        .get();

    console.log('Approved applications count:', apps.docs.length);

    process.exit(0);
}

checkCup().catch(e => { console.error(e); process.exit(1); });
