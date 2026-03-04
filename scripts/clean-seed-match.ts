import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { config } from 'dotenv';
import { join } from 'path';
import { PerformanceTag, performanceTagsDb } from '../src/lib/performance-tags';

config({ path: join(process.cwd(), '.env.local') });

if (getApps().length === 0) {
    const s = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
    initializeApp({ credential: cert(s), projectId: s.project_id });
}

const db = getFirestore();
const MATCH_ID = 'nTRvy0S3mJ1zEzfOYeFj';

// Helper para barajar
const shuffleArray = <T,>(array: T[]): T[] => {
    let currentIndex = array.length;
    while (currentIndex !== 0) {
        const randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
}

function getRandomTagsForPosition(position: string): PerformanceTag[] {
    const positionTags = performanceTagsDb.filter(
        (tag) => tag.positions.includes('ALL') || tag.positions.includes(position as any)
    );
    const selectedPositive = shuffleArray(positionTags.filter((t) => t.impact === 'positive')).slice(0, 2);
    const selectedNegative = shuffleArray(positionTags.filter((t) => t.impact === 'negative')).slice(0, 1);
    return shuffleArray([...selectedPositive, ...selectedNegative]);
}

const chroniclePool = [
    "Un partido muy intenso, me sentí bien físicamente y creo que aporté fluidez al juego.",
    "Dificil encontrar espacios hoy, pero el equipo se mantuvo ordenado. Contento con el esfuerzo.",
    "Me faltó un poco de precisión en los pases, pero compensé con sacrificio defensivo.",
    "Buen ambiente en la cancha. Siento que el equipo está conectando mejor cada semana.",
    "Físicamente me sentí un escalón arriba hoy, pude ganar varios duelos individuales.",
    "Partido trabado. Me enfoqué en mantener la posición y no regalar la pelota.",
    "Lindo partido para jugar, hubo mucha rotación y eso me favoreció.",
    "Un poco frustrado con el resultado, pero en lo personal me sentí con confianza.",
    "Hoy el mediocampo fue una batalla, pero logramos imponer nuestro ritmo.",
    "Pocos goles pero mucha táctica. Me gustó el despliegue de mis compañeros."
];

async function execute() {
    console.log(`🧹 Iniciando limpieza de MATCH_ID: ${MATCH_ID}`);
    const subsSnap = await db.collection('evaluationSubmissions').where('matchId', '==', MATCH_ID).get();
    if (subsSnap.size > 0) {
        const batch = db.batch();
        subsSnap.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        console.log(`✅ Borrados ${subsSnap.size} documentos duplicados.`);
    }

    console.log(`🚀 Cargando seed limpio...`);
    const matchSnap = await db.doc(`matches/${MATCH_ID}`).get();
    const matchData = matchSnap.data() as any;
    const players: any[] = [];
    for (const uid of matchData.playerUids) {
        const pSnap = await db.doc(`players/${uid}`).get();
        if (pSnap.exists) {
            players.push({ id: pSnap.id, name: pSnap.data()?.name, position: pSnap.data()?.position || 'MED', photoURL: pSnap.data()?.photoURL || '' });
        }
    }

    const assignmentsSnap = await db.collection(`matches/${MATCH_ID}/assignments`).get();
    const assignments = assignmentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    for (const evaluador of players) {
        const myAssignments = assignments.filter((a: any) => a.evaluatorId === evaluador.id);
        if (myAssignments.length === 0) continue;

        const misEvaluaciones: any[] = [];
        for (const assignment of myAssignments) {
            const sujeto = players.find(p => p.id === (assignment as any).subjectId);
            if (!sujeto) continue;
            misEvaluaciones.push({
                assignmentId: (assignment as any).id,
                subjectId: sujeto.id,
                displayName: sujeto.name,
                photoURL: sujeto.photoURL || '',
                position: sujeto.position,
                evaluationType: 'tags',
                performanceTags: getRandomTagsForPosition(sujeto.position)
            });
        }

        const candidatesForMvp = players.filter(p => p.id !== evaluador.id);
        const mvpVote = candidatesForMvp.length > 0 ? candidatesForMvp[Math.floor(Math.random() * candidatesForMvp.length)].id : players[0].id;

        await db.collection('evaluationSubmissions').add({
            evaluatorId: evaluador.id,
            matchId: MATCH_ID,
            submittedAt: new Date().toISOString(),
            submission: {
                evaluatorGoals: Math.random() > 0.7 ? Math.floor(Math.random() * 3) : 0,
                evaluatorAssists: Math.random() > 0.6 ? Math.floor(Math.random() * 2) + 1 : 0,
                personalChronicle: chroniclePool[Math.floor(Math.random() * chroniclePool.length)],
                mvpVote: mvpVote,
                evaluations: misEvaluaciones
            }
        });
    }
    console.log(`🎉 Finalizado. 10 submissions limpias cargadas.`);
}

execute().catch(console.error).finally(() => process.exit(0));
