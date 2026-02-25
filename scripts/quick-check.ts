import { getAdminDb } from '../src/firebase/admin-init';

async function checkMatch(id: string) {
    const db = getAdminDb();
    const snap = await db.collection('matches').doc(id).get();
    if (snap.exists) {
        console.log('MATCH FOUND:');
        console.log(JSON.stringify(snap.data(), null, 2));
    } else {
        console.log('MATCH NOT FOUND: ' + id);
    }
}

checkMatch('sAul42BOyTjYph06xFds');
