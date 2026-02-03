import { initializeApp, cert, getApps, ServiceAccount } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

function initializeFirebaseAdmin() {
    if (getApps().length === 0) {
        const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
        if (!rawServiceAccount) process.exit(1);
        const serviceAccountJson = JSON.parse(rawServiceAccount);
        initializeApp({
            credential: cert(serviceAccountJson as ServiceAccount),
            projectId: serviceAccountJson.project_id,
        });
    }
}

initializeFirebaseAdmin();
const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

const ORGANIZER_ID = 'njH0OBBrmzSWOeoXamHUZyxavLv1'; // Aurelio
const ORGANIZER_NAME = 'Aurelio';

// Mock Data
const VENUES = [
    { name: 'Canchas El 10', address: 'Av. Corrientes 1234', lat: -34.6037, lng: -58.3816, placeId: 'mock1' },
    { name: 'Futbol Urbano', address: 'Lavalle 500', lat: -34.6010, lng: -58.3750, placeId: 'mock2' },
    { name: 'La Canchita', address: 'Cordoba 2000', lat: -34.5990, lng: -58.3950, placeId: 'mock3' },
];

const COMMENTS = [
    "Gran partido, mucha garra.",
    "Le faltó soltarla un poco más.",
    "Impasable en el fondo.",
    "Corrió todo el partido.",
    "Muy buen pie, pero flojo en la marca.",
    "Jugadorazo, definió el partido.",
    "Estuvo medio desconectado hoy.",
    "Excelente compañero, siempre positivo.",
    "Tiene que bajar más a defender.",
    "Un muro en el arco.",
    null, null, null // Some empty
];

// Simplified Tags from performance-tags.ts
const MOCK_TAGS = [
    { id: 'correcaminos', name: 'Correcaminos', impact: 'positive' },
    { id: 'garra_charrua', name: 'Corazón y Garra', impact: 'positive' },
    { id: 'pase_quirurgico', name: 'Pase Quirúrgico', impact: 'positive' },
    { id: 'la_colgo_del_angulo', name: 'La Colgó del Ángulo', impact: 'positive' },
    { id: 'muro', name: 'Un Muro', impact: 'positive' },
    { id: 'comilon', name: 'Se Enamoró de la Pelota', impact: 'negative' },
    { id: 'lento', name: 'Lento para definir', impact: 'negative' },
];

// Random helpers
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomPick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const randomSubset = <T>(arr: T[], count: number): T[] => {
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
};

async function seedMatches() {
    console.log(`🚀 Generando partidos para ${ORGANIZER_NAME} (${ORGANIZER_ID})...`);

    // 0. Hardcoded Group ID as requested
    const groupId = 'Lo7Mz3sUg2PyRZDuCLbd';
    console.log(`info: Usando Group ID Forzado: ${groupId}`);

    // 1. Get Real Players
    const playersSnap = await db.collection('players').get();
    // Assuming we mostly want "real" players, but for now we'll take any from the collection
    // (User said "con los jugadores reales", referring to the ones we kept in previous step)
    const allPlayers = playersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (allPlayers.length < 10) {
        console.error('❌ No hay suficientes jugadores en la base de datos (mínimo 10).');
        process.exit(1);
    }

    const MATCH_COUNT = 5;

    for (let i = 0; i < MATCH_COUNT; i++) {
        // Create Match Data
        const date = new Date();
        date.setDate(date.getDate() - randomInt(1, 60)); // Past 2 months

        const selectedPlayers = randomSubset(allPlayers, 10); // 5v5
        const team1Players = selectedPlayers.slice(0, 5);
        const team2Players = selectedPlayers.slice(5, 10);

        const team1Goals = randomInt(2, 8);
        const team2Goals = randomInt(2, 8);

        const matchRef = db.collection('matches').doc();
        const matchId = matchRef.id;

        const matchData = {
            id: matchId,
            title: `Partido Amistoso ${i + 1}`,
            date: date.toISOString(),
            status: 'evaluated', // Estado que permite ver evaluaciones pero quizás procesar cosas extra
            ownerUid: ORGANIZER_ID,
            groupId: groupId,
            isPublic: false,
            location: randomPick(VENUES),
            players: 10,
            teams: [
                {
                    id: 'team1',
                    name: 'Equipo A',
                    color: 'White',
                    players: team1Players.map((p: any) => ({
                        uid: p.id,
                        name: p.name || 'Jugador',
                        photoURL: p.photoURL || null
                    }))
                },
                {
                    id: 'team2',
                    name: 'Equipo B',
                    color: 'Black',
                    players: team2Players.map((p: any) => ({
                        uid: p.id,
                        name: p.name || 'Jugador',
                        photoURL: p.photoURL || null
                    }))
                }
            ],
            playerUids: selectedPlayers.map(p => p.id),
            result: { team1: team1Goals, team2: team2Goals }
        };

        await matchRef.set(matchData);
        console.log(`   🏟️ Partido creado: ${matchData.title} (${matchId})`);

        // ✅ FIXED V2: Guarantee EVERY player receives exactly 2 evaluations
        // Use round-robin assignment instead of random selection
        const batch = db.batch();

        // Create evaluation pairs: each player evaluated by 2 specific peers
        const evaluationPairs: Array<{ evaluatorId: string; peerId: string }> = [];

        for (let i = 0; i < selectedPlayers.length; i++) {
            const peer = selectedPlayers[i];
            // Assign 2 evaluators using offset pattern (ensures everyone gets 2)
            const evaluator1 = selectedPlayers[(i + 1) % selectedPlayers.length];
            const evaluator2 = selectedPlayers[(i + 2) % selectedPlayers.length];

            evaluationPairs.push(
                { evaluatorId: evaluator1.id, peerId: peer.id },
                { evaluatorId: evaluator2.id, peerId: peer.id }
            );
        }

        // Create evaluations for each pair
        for (const pair of evaluationPairs) {
            const style = randomInt(1, 3);
            const hasRating = style !== 2 || Math.random() > 0.5;
            const hasText = style !== 1 || Math.random() > 0.5;
            const hasTags = true;

            const rating = hasRating ? randomInt(4, 10) : undefined;
            const text = hasText ? randomPick(COMMENTS) : undefined;
            const tags = hasTags ? randomSubset(MOCK_TAGS, randomInt(1, 3)) : [];
            const goals = Math.random() > 0.7 ? randomInt(1, 3) : 0;
            const assists = Math.random() > 0.8 ? randomInt(1, 2) : 0;

            const evalRef = db.collection('evaluations').doc();
            batch.set(evalRef, {
                matchId: matchId,
                playerId: pair.peerId,
                evaluatorId: pair.evaluatorId,
                rating: rating,
                textDescription: text,
                performanceTags: tags,
                goals: goals,
                assists: assists,
                evaluatedAt: new Date().toISOString(),
                identityRevealed: false
            });
        }

        await batch.commit();
        const expectedEvals = selectedPlayers.length * 2;  // Each player evaluates 2 others
        console.log(`      ✅ ~${expectedEvals} evaluaciones generadas (${selectedPlayers.length} jugadores × 2 evals c/u)`);
    }
}

seedMatches()
    .then(() => {
        console.log('\n🎉 Generación de datos completada.');
        process.exit(0);
    })
    .catch(e => {
        console.error(e);
        process.exit(1);
    });
