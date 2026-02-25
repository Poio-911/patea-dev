import { getAdminDb } from '../src/firebase/admin-init';
import { FieldValue } from 'firebase-admin/firestore';

async function fixSeedEvaluations(matchId: string) {
    const db = getAdminDb();
    const matchRef = db.collection('matches').doc(matchId);

    console.log(`[fix-seed] Fixing evaluations for match ${matchId}...`);

    try {
        const matchSnap = await matchRef.get();
        if (!matchSnap.exists) return;
        const matchData = matchSnap.data() as any;
        const organizerId = matchData.ownerUid;

        // Get organizer's group
        const organizerSnap = await db.collection('players').doc(organizerId).get();
        const organizerGroup = organizerSnap.data()?.groupId || 'poio-911';

        const players = matchData.players || [];
        console.log(`[fix-seed] Processing ${players.length} players...`);

        // 1. Sync players to the same group so they show up in the UI
        for (const p of players) {
            await db.collection('players').doc(p.uid).update({
                groupId: organizerGroup,
                ownerUid: p.uid // Ensure they are "real users" for the UI logic
            }).catch(() => { });
        }

        // 2. Map existing subcollection assignments to a completed state
        const assignmentsSnap = await matchRef.collection('assignments').get();
        console.log(`[fix-seed] Found ${assignmentsSnap.size} assignments in match subcollection.`);

        const uniqueChronicles = [
            "Fue un partido de ida y vuelta, me sentí muy cómodo dominando el mediocampo.",
            "No paré de correr en todo el encuentro, el sacrificio valió la pena para la victoria.",
            "Lástima que no se nos dio el resultado, pero a nivel personal me voy conforme con mi entrega.",
            "Meter ese gol en los últimos minutos fue una descarga de adrenalina pura.",
            "Me tocó bailar con la más difícil marcando al delantero de ellos, pero cumplí con creces.",
            "El equipo se mostró muy sólido y yo pude aportar mi granito de arena en la distribución.",
            "Siento que me faltó un poco de precisión en los pases, pero físicamente estuve a tope.",
            "Qué lindo es volver a las canchas y sentirse así de bien con la pelota en los pies.",
            "Hoy la suerte no estuvo de mi lado frente al arco, pero seguiremos intentando.",
            "Una victoria trabajada donde cada uno de nosotros dejó todo lo que tenía."
        ];

        const aiSummaries = [
            "Mostró una visión de juego excepcional, rompiendo líneas con pases precisos y una lectura táctica impecable.",
            "Un muro defensivo infranqueable. Su capacidad de anticipación evitó múltiples situaciones de gol claras.",
            "Velocidad explosiva por las bandas. Su regate corto y desborde constante descolocaron a la defensa rival."
        ];

        const batch = db.batch();

        // We need to group assignments by evaluator to know who "voted"
        const evaluators = new Set(assignmentsSnap.docs.map(d => d.data().evaluatorId));
        console.log(`[fix-seed] There are ${evaluators.size} distinct evaluators in assignments.`);

        for (const assignmentDoc of assignmentsSnap.docs) {
            const assignmentData = assignmentDoc.data();
            const assignmentId = assignmentDoc.id;
            const subjectId = assignmentData.subjectId;
            const evaluatorId = assignmentData.evaluatorId;

            // Create Evaluation
            const evaluationId = `eval_${matchId}_${evaluatorId}_${subjectId}`;
            const evaluationRef = db.collection('evaluations').doc(evaluationId);

            batch.set(evaluationRef, {
                id: evaluationId,
                assignmentId,
                playerId: subjectId,
                evaluatorId: evaluatorId,
                matchId: matchId,
                rating: Math.floor(Math.random() * 3) + 7, // 7 to 9
                aiSummary: aiSummaries[Math.floor(Math.random() * aiSummaries.length)],
                evaluatedAt: new Date().toISOString(),
                status: 'completed'
            });

            // Mark assignment as completed in subcollection
            batch.update(assignmentDoc.ref, {
                status: 'completed',
                evaluationId: evaluationId
            });
        }

        // Create Self-Evaluations for each evaluator
        let i = 0;
        for (const evaluatorId of evaluators) {
            const selfEvalRef = matchRef.collection('selfEvaluations').doc(evaluatorId);
            batch.set(selfEvalRef, {
                playerId: evaluatorId,
                matchId: matchId,
                goals: Math.floor(Math.random() * 2),
                assists: Math.floor(Math.random() * 2),
                personalChronicle: uniqueChronicles[i % uniqueChronicles.length],
                reportedAt: new Date().toISOString()
            });
            i++;
        }

        await batch.commit();
        console.log(`[fix-seed] Successfully fixed assignments and evaluations.`);

    } catch (error) {
        console.error(`[fix-seed] Error:`, error);
    }
}

fixSeedEvaluations('sAul42BOyTjYph06xFds').then(() => process.exit(0));
