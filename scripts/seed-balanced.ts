import { getAdminDb } from '../src/firebase/admin-init';

async function seedBalanced(matchId: string) {
    const db = getAdminDb();
    const matchRef = db.collection('matches').doc(matchId);

    console.log(`[seed] Seeding balanced evaluations for match ${matchId}...`);

    const matchSnap = await matchRef.get();
    const matchData = matchSnap.data() as any;
    const players = matchData.players || [];

    if (players.length !== 10) {
        console.warn(`[seed] Expected 10 players, found ${players.length}. proceeding anyway.`);
    }

    const chronicles = [
        "Dominé el mediocampo con pases filtrados.",
        "Mucha entrega física, aunque faltó puntería.",
        "Me sentí muy seguro en la marca hoy.",
        "Un golazo al ángulo para cerrar el partido.",
        "Corrí todas las pelotas como si fuera la última.",
        "Buena visión de juego, repartí varias asistencias.",
        "Atajé un penal clave que nos mantuvo en juego.", // even if they aren't GK, it's just seed data
        "Faltó resto físico al final, pero conforme.",
        "Me entendí muy bien con la delantera hoy.",
        "Partido trabado, pero logré desbordar varias veces."
    ];

    const aiSummaries = [
        "Visión periférica sobresaturada, pases quirúrgicos.",
        "Despliegue físico incansable y presión alta constante.",
        "Solidez defensiva impecable, anticipación de élite.",
        "Efectividad goleadora y desmarque inteligente.",
        "Creatividad en el último tercio y control de balón superior."
    ];

    const batch = db.batch();

    // Balanced distribution: Each player evaluates the next 2 (i+1, i+2)
    for (let i = 0; i < players.length; i++) {
        const evaluator = players[i];

        // 1. Peer Evaluations (2 per player)
        for (let j = 1; j <= 2; j++) {
            const subject = players[(i + j) % players.length];
            const assignmentId = `asgn_${matchId}_${evaluator.uid}_${subject.uid}`;
            const evaluationId = `eval_${matchId}_${evaluator.uid}_${subject.uid}`;

            // Create Peer Evaluation
            const evalRef = db.collection('evaluations').doc(evaluationId);
            batch.set(evalRef, {
                id: evaluationId,
                assignmentId,
                playerId: subject.uid,
                evaluatorId: evaluator.uid,
                matchId: matchId,
                rating: 8 + (Math.random() > 0.5 ? 1 : 0), // 8 or 9
                aiSummary: aiSummaries[Math.floor(Math.random() * aiSummaries.length)],
                evaluatedAt: new Date().toISOString(),
                status: 'completed'
            });

            // Update assignment in match subcollection
            const assignmentRef = matchRef.collection('assignments').doc(assignmentId);
            batch.set(assignmentRef, {
                id: assignmentId,
                matchId: matchId,
                evaluatorId: evaluator.uid,
                subjectId: subject.uid,
                status: 'completed',
                evaluationId: evaluationId
            }, { merge: true });
        }

        // 2. Self Evaluation
        const selfEvalRef = matchRef.collection('selfEvaluations').doc(evaluator.uid);
        batch.set(selfEvalRef, {
            playerId: evaluator.uid,
            matchId: matchId,
            goals: Math.floor(Math.random() * 2),
            assists: Math.floor(Math.random() * 2),
            personalChronicle: chronicles[i % chronicles.length],
            reportedAt: new Date().toISOString()
        });
    }

    await batch.commit();
    console.log(`[seed] Done. Created ${players.length * 2} peer evaluations and ${players.length} self-evaluations.`);
}

seedBalanced('sAul42BOyTjYph06xFds').then(() => process.exit(0));
