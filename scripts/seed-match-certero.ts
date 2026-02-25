
import { getAdminDb } from '../src/firebase/admin-init';
import { Player, Evaluation, PerformanceTag } from '../src/lib/types';

async function seedMatchCertero(matchId: string) {
    const db = getAdminDb();
    const matchRef = db.collection('matches').doc(matchId);

    console.log(`[seed-certero] Iniciando carga de prueba para partido ${matchId}...`);

    const matchSnap = await matchRef.get();
    if (!matchSnap.exists) {
        console.error('Partido no encontrado');
        return;
    }
    const matchData = matchSnap.data() as any;
    const players = matchData.players || [];
    const organizerId = matchData.ownerUid;

    // Obtener grupo del organizador
    const organizerSnap = await db.collection('players').doc(organizerId).get();
    const organizerGroup = organizerSnap.data()?.groupId || 'poio-911';

    // 1. Limpieza de datos previos para este partido
    const evalsSnap = await db.collection('evaluations').where('matchId', '==', matchId).get();
    const cleanupBatch = db.batch();
    evalsSnap.docs.forEach(doc => cleanupBatch.delete(doc.ref));

    const selfEvalsSnap = await matchRef.collection('selfEvaluations').get();
    selfEvalsSnap.docs.forEach(doc => cleanupBatch.delete(doc.ref));

    const assignmentsSnap = await matchRef.collection('assignments').get();
    assignmentsSnap.docs.forEach(doc => cleanupBatch.delete(doc.ref));

    await cleanupBatch.commit();
    console.log(`[seed-certero] Limpieza completada.`);

    // 2. Sincronizar jugadores (asegurar grupo y ownerUid para visualización)
    for (const p of players) {
        await db.collection('players').doc(p.uid).update({
            groupId: organizerGroup,
            ownerUid: p.uid
        }).catch(() => { });
    }

    // 3. Crónicas y Datos de Evaluación
    const chronicles: Record<string, string> = {
        "njH0OBBrmzSWOeoXamHUZyxavLv1": "Le di de lleno en la única que me quedó limpia cerca del área y por suerte se terminó metiendo bien abajo. Hoy me sentí con confianza para encarar y me salieron varias.",
        "7LRVMYdOI8Sm9gahfBkh5rbVENt1": "Traté de no cansarme al pedo y soltarla rápido. Siento que manejamos bien los tiempos en el medio, aunque sobre el final nos quedamos un poco sin piernas.",
        "JAn8pNSZoNP7rWWyZJD1gCFBC5t2": "Un laburo de hormiga hoy. Me tocó morder en el medio y salir rápido en las que podíamos. Terminé muerto porque el ritmo estuvo picante, pero valió la pena.",
        "N7GKXwOa4vVeap4emu23x8jn8wF2": "Tuve un par clave que sirvieron para aguantar el resultado. En los centros me sentí seguro saliendo a cortar y por suerte la defensa estuvo atenta para las que quedaron boyando.",
        "QYx3MCcrYRTJ1aYB24tQy0A2fmM2": "Hoy gané por velocidad en casi todas pero me faltó esa pausa final para elegir mejor. Generamos un montón por afuera, el tema fue que no siempre logramos conectar.",
        "gKe0DNivhfVeAi36OV1qGzkXpM63": "Fui a todas, no quería que salgan jugando tranquilos. Logré ensuciar varias salidas y así fue que forcé el error para el gol. Terminé conforme, se dejó todo.",
        "dRYXgsJ1Joa28L69MV9kFRpWfxC3": "Intenté darle prolijidad al medio, jugar simple que es lo que pedía el partido. Recuperé algunas y siempre busqué descargar en el compañero que estaba mejor perfilado.",
        "EFKPK6vDW4WrEosD6UrFRDGMG543": "Gané bastante de arriba y en los cruces me sentí firme. Traté de no complicarme y sacarla limpia cuando se armaba el entrevero en el área.",
        "3xcfOetChgYB4ax6oh3w5zzd2w82": "Fue un partido chivo en el medio, mucha fricción. Intenté buscar siempre la descarga al espacio y tratar de que no se nos parta el equipo.",
        "qrVOXyawztZBtTg7i6md6Opbt5H2": "Me moví por todo el frente de ataque para arrastrar marcas. Tuve una y por suerte la mandé a guardar. Me voy contenta porque se jugó con mucha intensidad."
    };

    const aiEvaluations: Record<string, { summary: string, changes: any[] }> = {
        "njH0OBBrmzSWOeoXamHUZyxavLv1": { summary: "Resolvió con una jerarquía bárbara en el área.", changes: [{ attribute: 'sho', change: 2 }] },
        "7LRVMYdOI8Sm9gahfBkh5rbVENt1": { summary: "Cada vez que la soltó, lo hizo con un criterio envidiable.", changes: [{ attribute: 'pas', change: 2 }] },
        "N7GKXwOa4vVeap4emu23x8jn8wF2": { summary: "Se hizo gigante en el arco, transmitiendo mucha seguridad.", changes: [{ attribute: 'def', change: 2 }] },
        "EFKPK6vDW4WrEosD6UrFRDGMG543": { summary: "Ganó todos los roces físicos y se impuso por presencia.", changes: [{ attribute: 'phy', change: 2 }] },
        "QYx3MCcrYRTJ1aYB24tQy0A2fmM2": { summary: "Fue incontenible cuando arrancó en velocidad.", changes: [{ attribute: 'pac', change: 2 }] },
        "gKe0DNivhfVeAi36OV1qGzkXpM63": { summary: "En el uno contra uno limpió el camino con mucha soltura.", changes: [{ attribute: 'dri', change: 2 }] }
    };

    const seedBatch = db.batch();

    // Distribución: Cada jugador evalúa a los siguientes 2
    for (let i = 0; i < players.length; i++) {
        const evaluator = players[i];

        // Autoevaluación
        const selfEvalRef = matchRef.collection('selfEvaluations').doc(evaluator.uid);
        seedBatch.set(selfEvalRef, {
            playerId: evaluator.uid,
            matchId: matchId,
            goals: (i % 2 === 0) ? 1 : 0,
            assists: (i % 3 === 0) ? 1 : 0,
            personalChronicle: chronicles[evaluator.uid] || "Se dejó todo en la cancha.",
            reportedAt: new Date().toISOString()
        });

        // Evaluaciones de Compañeros (2 por jugador)
        for (let j = 1; j <= 2; j++) {
            const subject = players[(i + j) % players.length];
            const assignmentId = `asgn_${matchId}_${evaluator.uid}_${subject.uid}`;
            const evaluationId = `eval_${matchId}_${evaluator.uid}_${subject.uid}`;

            const aiData = aiEvaluations[subject.uid];
            const isAiCase = aiData && (j === 1); // Solo una de las dos evaluaciones será por IA para probar el mix

            const evalData: any = {
                id: evaluationId,
                assignmentId,
                playerId: subject.uid,
                evaluatorId: evaluator.uid,
                matchId: matchId,
                evaluatedAt: new Date().toISOString(),
                status: 'completed'
            };

            if (isAiCase) {
                evalData.aiSummary = aiData.summary;
                evalData.aiAttributeChanges = aiData.changes;
                evalData.rating = 8.5;
            } else {
                evalData.rating = 8.0;
                // Tags aleatorios
                evalData.performanceTags = [
                    { id: 't1', label: 'Muro', effects: [{ attribute: 'def', change: 0.5 }] }
                ];
            }

            const evalRef = db.collection('evaluations').doc(evaluationId);
            seedBatch.set(evalRef, evalData);

            const assignmentRef = matchRef.collection('assignments').doc(assignmentId);
            seedBatch.set(assignmentRef, {
                id: assignmentId,
                matchId: matchId,
                evaluatorId: evaluator.uid,
                subjectId: subject.uid,
                status: 'completed',
                evaluationId: evaluationId
            });
        }
    }

    await seedBatch.commit();
    console.log(`[seed-certero] Carga completada. 20 asignaciones y 10 autoevaluaciones creadas.`);
    console.log(`[seed-certero] Partido: qV658LXdVOgmtt4HKkEe listo para ser finalizado.`);
}

seedMatchCertero('qV658LXdVOgmtt4HKkEe').then(() => process.exit(0));
