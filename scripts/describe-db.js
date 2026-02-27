const admin = require('firebase-admin');
const fs = require('fs');

const serviceAccountStr = fs.readFileSync('mil-disculpis-firebase-adminsdk-fbsvc-41dd3959c4.json', 'utf8');

try {
    const serviceAccount = JSON.parse(serviceAccountStr);

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });

    const db = admin.firestore();

    async function printSchema() {
        const collections = await db.listCollections();
        console.log(`Found ${collections.length} root collections.`);

        const schema = {};

        for (const collection of collections) {
            schema[collection.id] = { _sampleFields: [] };

            // Get 1 document
            const snapshot = await collection.limit(1).get();
            if (!snapshot.empty) {
                const doc = snapshot.docs[0];
                const data = doc.data();
                schema[collection.id]._sampleFields = Object.keys(data).map(k => {
                    const val = data[k];
                    const type = Array.isArray(val) ? 'array' : (val === null ? 'null' : typeof val);
                    return `${k} (${type})`;
                });

                // Also list subcollections of this document
                const subCollections = await doc.ref.listCollections();
                if (subCollections.length > 0) {
                    schema[collection.id]._subcollections = subCollections.map(s => s.id);
                }
            } else {
                schema[collection.id]._sampleFields = ['(Empty Collection)'];
            }
        }

        console.log(JSON.stringify(schema, null, 2));
    }

    printSchema().then(() => {
        console.log('Done.');
        process.exit(0);
    }).catch(e => {
        console.error('Error fetching schema:', e);
        process.exit(1);
    });
} catch (e) {
    console.error('Failed to parse credentials or connect:', e);
    process.exit(1);
}
