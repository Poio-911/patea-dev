import { initializeApp, cert, getApps, ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from 'dotenv';
import { join } from 'path';
import { randomUUID } from 'crypto';

config({ path: join(process.cwd(), '.env.local') });

if (getApps().length === 0) {
    const s = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
    initializeApp({ credential: cert(s as ServiceAccount), projectId: s.project_id });
}

const db = getFirestore();

const MATCH_ID = '3Jz6qRePvVR8vPkbaGgr';

// ── Players ──────────────────────────────────────────────────────────────────
const PLAYERS = [
    { uid: '3xcfOetChgYB4ax6oh3w5zzd2w82', name: 'Doroteo',   position: 'MED' },
    { uid: '4Hjt7RpO28Trff70J2Z6YMSJshx1', name: 'José P.',   position: 'MED' },
    { uid: '7LRVMYdOI8Sm9gahfBkh5rbVENt1', name: 'Liroy',     position: 'MED' },
    { uid: 'EFKPK6vDW4WrEosD6UrFRDGMG543', name: 'Eminencia', position: 'DEF' },
    { uid: 'FZgnsSDMi4PBkI5jNORjYZm0zY32', name: 'Clemente',  position: 'DEF' },
    { uid: 'N7GKXwOa4vVeap4emu23x8jn8wF2', name: 'Fiorenzo',  position: 'POR' },
    { uid: 'QYx3MCcrYRTJ1aYB24tQy0A2fmM2', name: 'Alvaro M.', position: 'DEL' },
    { uid: 'gKe0DNivhfVeAi36OV1qGzkXpM63', name: 'Melisa',    position: 'DEL' },
    { uid: 'njH0OBBrmzSWOeoXamHUZyxavLv1', name: 'Aurelio',   position: 'DEL' },
    { uid: 'qrVOXyawztZBtTg7i6md6Opbt5H2', name: 'Briseida',  position: 'DEL' },
] as const;

// ── Self-eval data ────────────────────────────────────────────────────────────
const SELF_EVALS: Record<string, { goals: number; assists: number; personalChronicle: string; mvpVote: string }> = {
    // Doroteo (MED) — mvp: Aurelio
    '3xcfOetChgYB4ax6oh3w5zzd2w82': {
        goals: 0, assists: 2,
        personalChronicle: 'Partido muy intenso en el medio, tuve que cortar muchos contra-ataques y apoyar constantemente la salida. Mis dos asistencias fueron las jugadas que más me enorgullecen del día.',
        mvpVote: 'njH0OBBrmzSWOeoXamHUZyxavLv1', // Aurelio
    },
    // José P. (MED) — mvp: Alvaro M.
    '4Hjt7RpO28Trff70J2Z6YMSJshx1': {
        goals: 1, assists: 1,
        personalChronicle: 'Me encontré bastante cómodo circulando el balón. El gol fue un disparo de media distancia que sorprendió al arquero. La asistencia llegó después de una combinación de tres toques.',
        mvpVote: 'QYx3MCcrYRTJ1aYB24tQy0A2fmM2', // Alvaro M.
    },
    // Liroy (MED) — mvp: Aurelio
    '7LRVMYdOI8Sm9gahfBkh5rbVENt1': {
        goals: 0, assists: 1,
        personalChronicle: 'Cubrí bastante terreno hoy, intenté siempre apoyar a mis defensores y proyectarme al ataque cuando pude. La asistencia fue precisa pero me faltó llegar al remate.',
        mvpVote: 'njH0OBBrmzSWOeoXamHUZyxavLv1', // Aurelio
    },
    // Eminencia (DEF) — mvp: Fiorenzo
    'EFKPK6vDW4WrEosD6UrFRDGMG543': {
        goals: 0, assists: 0,
        personalChronicle: 'Defensivamente fue un partido exigente. Mantuve concentración en los duelos individuales y creo que cumplí bien en las coberturas. Sin errores graves en mi zona.',
        mvpVote: 'N7GKXwOa4vVeap4emu23x8jn8wF2', // Fiorenzo
    },
    // Clemente (DEF) — mvp: Aurelio
    'FZgnsSDMi4PBkI5jNORjYZm0zY32': {
        goals: 0, assists: 1,
        personalChronicle: 'Salí jugando bastante limpio hoy, hubo presión alta del rival pero logramos salir bien. Mi asistencia fue larga que habilitó a un delantero en carrera.',
        mvpVote: 'njH0OBBrmzSWOeoXamHUZyxavLv1', // Aurelio
    },
    // Fiorenzo (POR) — mvp: Alvaro M.
    'N7GKXwOa4vVeap4emu23x8jn8wF2': {
        goals: 0, assists: 0,
        personalChronicle: 'Tuve una tarde complicada bajo los palos, pero fui de más a menos y terminé seguro. Atajé un mano a mano clave en la segunda mitad que nos mantuvo en el partido.',
        mvpVote: 'QYx3MCcrYRTJ1aYB24tQy0A2fmM2', // Alvaro M.
    },
    // Alvaro M. (DEL) — mvp: Aurelio
    'QYx3MCcrYRTJ1aYB24tQy0A2fmM2': {
        goals: 2, assists: 1,
        personalChronicle: 'Mi mejor partido en mucho tiempo. Los dos goles fueron distintos: el primero de cabeza en un córner, el segundo con el pie izquierdo tras quiebre en el área. La asistencia fue un pase filtrado entre líneas.',
        mvpVote: 'njH0OBBrmzSWOeoXamHUZyxavLv1', // Aurelio
    },
    // Melisa (DEL) — mvp: Alvaro M.
    'gKe0DNivhfVeAi36OV1qGzkXpM63': {
        goals: 1, assists: 0,
        personalChronicle: 'Estuve activa todo el tiempo, aunque muchas pelotas me llegaron cerradas. El gol fue producto de insistencia: rebote que no dudé en empujar. Necesito mejorar el juego de espalda.',
        mvpVote: 'QYx3MCcrYRTJ1aYB24tQy0A2fmM2', // Alvaro M.
    },
    // Aurelio (DEL) — mvp: Alvaro M.
    'njH0OBBrmzSWOeoXamHUZyxavLv1': {
        goals: 2, assists: 1,
        personalChronicle: 'Me sentí muy suelto hoy, las combinaciones con mis compañeros fluyeron. Mis goles fueron de movimiento y anticipación. La asistencia fue en el último minuto cuando el rival ya estaba abierto.',
        mvpVote: 'QYx3MCcrYRTJ1aYB24tQy0A2fmM2', // Alvaro M.
    },
    // Briseida (DEL) — mvp: Aurelio
    'qrVOXyawztZBtTg7i6md6Opbt5H2': {
        goals: 1, assists: 1,
        personalChronicle: 'Tuve buen ritmo en el primer tiempo, menos en el segundo. El gol fue una jugada personal donde me escapé por el costado. La asistencia fue un centro que conectó bien mi compañero.',
        mvpVote: 'njH0OBBrmzSWOeoXamHUZyxavLv1', // Aurelio
    },
};

// ── Assignments ───────────────────────────────────────────────────────────────
// assignmentId → { evaluatorId, subjectId, rating }
const ASSIGNMENTS: Array<{
    assignmentId: string;
    evaluatorId: string;
    subjectId: string;
    rating: number;
}> = [
    { assignmentId: 'OHsua3iW7Xuw5HiIswp2', evaluatorId: '3xcfOetChgYB4ax6oh3w5zzd2w82', subjectId: 'EFKPK6vDW4WrEosD6UrFRDGMG543', rating: 7 },
    { assignmentId: 'pbGC55dhW0urMtmBZdlv', evaluatorId: '3xcfOetChgYB4ax6oh3w5zzd2w82', subjectId: 'N7GKXwOa4vVeap4emu23x8jn8wF2', rating: 6 },
    { assignmentId: 'C35X34tay75N4YAtny6l', evaluatorId: '4Hjt7RpO28Trff70J2Z6YMSJshx1', subjectId: 'njH0OBBrmzSWOeoXamHUZyxavLv1', rating: 9 },
    { assignmentId: 'dynBjGmvyS2CigJW5Z9z', evaluatorId: '4Hjt7RpO28Trff70J2Z6YMSJshx1', subjectId: 'gKe0DNivhfVeAi36OV1qGzkXpM63', rating: 7 },
    { assignmentId: 'kjrFSRnUQifvjtMckVqb', evaluatorId: '7LRVMYdOI8Sm9gahfBkh5rbVENt1', subjectId: 'FZgnsSDMi4PBkI5jNORjYZm0zY32', rating: 7 },
    { assignmentId: 'tJJQ5p998d7umnW0kjO2', evaluatorId: '7LRVMYdOI8Sm9gahfBkh5rbVENt1', subjectId: '4Hjt7RpO28Trff70J2Z6YMSJshx1', rating: 8 },
    { assignmentId: 'GuVxdkUTx3NW3htaSoiV', evaluatorId: 'EFKPK6vDW4WrEosD6UrFRDGMG543', subjectId: 'qrVOXyawztZBtTg7i6md6Opbt5H2', rating: 8 },
    { assignmentId: 'j15J0pHCtgSA9MfWIjqB', evaluatorId: 'EFKPK6vDW4WrEosD6UrFRDGMG543', subjectId: 'QYx3MCcrYRTJ1aYB24tQy0A2fmM2', rating: 9 },
    { assignmentId: 'iP6FojVOGOhYBSVbjb4h', evaluatorId: 'FZgnsSDMi4PBkI5jNORjYZm0zY32', subjectId: '3xcfOetChgYB4ax6oh3w5zzd2w82', rating: 7 },
    { assignmentId: 'oQvA2ZJf6Dy0Ck8kWnt3', evaluatorId: 'FZgnsSDMi4PBkI5jNORjYZm0zY32', subjectId: 'njH0OBBrmzSWOeoXamHUZyxavLv1', rating: 9 },
    // Note: Fiorenzo is evaluatorId N7GKXwOa4vVeap4emu23x8jn8wF2
    { assignmentId: 'Hfs1oeWxCOIXeOpPQl12', evaluatorId: 'N7GKXwOa4vVeap4emu23x8jn8wF2', subjectId: 'gKe0DNivhfVeAi36OV1qGzkXpM63', rating: 7 },
    { assignmentId: 'cc6xGT04P3R7OP4pZnzj', evaluatorId: 'N7GKXwOa4vVeap4emu23x8jn8wF2', subjectId: 'FZgnsSDMi4PBkI5jNORjYZm0zY32', rating: 6 },
    { assignmentId: '8ZU9hNh7Ob8u4OE12B2e', evaluatorId: 'QYx3MCcrYRTJ1aYB24tQy0A2fmM2', subjectId: 'qrVOXyawztZBtTg7i6md6Opbt5H2', rating: 8 },
    { assignmentId: 'iGG58sZq6sDYR4PJNakh', evaluatorId: 'QYx3MCcrYRTJ1aYB24tQy0A2fmM2', subjectId: 'N7GKXwOa4vVeap4emu23x8jn8wF2', rating: 7 },
    { assignmentId: 'ENULOslO1WbdMIIeRTI5', evaluatorId: 'gKe0DNivhfVeAi36OV1qGzkXpM63', subjectId: 'QYx3MCcrYRTJ1aYB24tQy0A2fmM2', rating: 9 },
    { assignmentId: 'NMhTvh6EP2SfWsXVrajL', evaluatorId: 'gKe0DNivhfVeAi36OV1qGzkXpM63', subjectId: '7LRVMYdOI8Sm9gahfBkh5rbVENt1', rating: 7 },
    { assignmentId: '0yXmc0UxTneagM4zzHUZ', evaluatorId: 'njH0OBBrmzSWOeoXamHUZyxavLv1', subjectId: '4Hjt7RpO28Trff70J2Z6YMSJshx1', rating: 8 },
    { assignmentId: 'gGVsko5e43PH1b8xRhFR', evaluatorId: 'njH0OBBrmzSWOeoXamHUZyxavLv1', subjectId: '7LRVMYdOI8Sm9gahfBkh5rbVENt1', rating: 7 },
    { assignmentId: 'g6294kWlcBK5Q85s7tua', evaluatorId: 'qrVOXyawztZBtTg7i6md6Opbt5H2', subjectId: '3xcfOetChgYB4ax6oh3w5zzd2w82', rating: 8 },
    { assignmentId: 'z5rEB5aZOg2hrmaCgWNA', evaluatorId: 'qrVOXyawztZBtTg7i6md6Opbt5H2', subjectId: 'EFKPK6vDW4WrEosD6UrFRDGMG543', rating: 7 },
];

// ─────────────────────────────────────────────────────────────────────────────

async function run() {
    console.log('\n🏟️  COMPLETANDO EVALUACIONES DEL PARTIDO');
    console.log('═'.repeat(60));
    console.log(`Match ID: ${MATCH_ID}\n`);

    const now = new Date().toISOString();
    let selfEvalCount = 0;
    let peerEvalCount = 0;
    let assignmentUpdateCount = 0;

    // ── 1. Self-evaluations ──────────────────────────────────────────────────
    console.log('📝 Creando self-evaluations...');
    await Promise.all(
        PLAYERS.map(async (player) => {
            const se = SELF_EVALS[player.uid];
            if (!se) {
                console.warn(`  ⚠️  No self-eval data for ${player.name}`);
                return;
            }
            const ref = db
                .collection('matches')
                .doc(MATCH_ID)
                .collection('selfEvaluations')
                .doc(player.uid);

            await ref.set({
                id: player.uid,
                playerId: player.uid,
                matchId: MATCH_ID,
                goals: se.goals,
                assists: se.assists,
                personalChronicle: se.personalChronicle,
                mvpVote: se.mvpVote,
                reportedAt: now,
            });
            selfEvalCount++;
            console.log(`  ✅ ${player.name} — ${se.goals}G ${se.assists}A`);
        })
    );

    // ── 2. Peer evaluations + assignment updates ─────────────────────────────
    console.log('\n🎯 Creando peer evaluations y actualizando assignments...');
    await Promise.all(
        ASSIGNMENTS.map(async (a) => {
            const evaluatorName = PLAYERS.find(p => p.uid === a.evaluatorId)?.name ?? a.evaluatorId;
            const subjectName   = PLAYERS.find(p => p.uid === a.subjectId)?.name  ?? a.subjectId;

            const evalId = randomUUID();

            // Write evaluation doc (top-level collection)
            const evalRef = db.collection('evaluations').doc(evalId);
            await evalRef.set({
                id: evalId,
                assignmentId: a.assignmentId,
                playerId: a.subjectId,
                evaluatorId: a.evaluatorId,
                matchId: MATCH_ID,
                rating: a.rating,
                goals: 0,   // peer evals don't report goals
                evaluatedAt: now,
            });
            peerEvalCount++;

            // Update assignment status
            const assignRef = db
                .collection('matches')
                .doc(MATCH_ID)
                .collection('assignments')
                .doc(a.assignmentId);

            await assignRef.update({
                status: 'completed',
                evaluationId: evalId,
            });
            assignmentUpdateCount++;

            console.log(`  ✅ ${evaluatorName} → ${subjectName} (rating: ${a.rating}) [evalId: ${evalId.substring(0, 8)}...]`);
        })
    );

    // ── Summary ───────────────────────────────────────────────────────────────
    console.log('\n' + '═'.repeat(60));
    console.log(`✅ ${selfEvalCount} self-evaluations creadas`);
    console.log(`✅ ${peerEvalCount} peer evaluations creadas`);
    console.log(`✅ ${assignmentUpdateCount} assignments actualizados a 'completed'`);

    // ── Verification ──────────────────────────────────────────────────────────
    console.log('\n🔍 Verificando assignments...');
    const assignmentsSnap = await db
        .collection('matches')
        .doc(MATCH_ID)
        .collection('assignments')
        .get();

    const completed = assignmentsSnap.docs.filter(d => d.data().status === 'completed').length;
    const pending   = assignmentsSnap.docs.filter(d => d.data().status === 'pending').length;
    console.log(`  Assignments completed: ${completed}`);
    console.log(`  Assignments pending:   ${pending}`);

    if (pending === 0) {
        console.log('\n🎉 Todos los assignments están completed. Listo para finalizeMatchEvaluationAction!');
    } else {
        console.log('\n⚠️  Aún hay assignments pendientes.');
    }
}

run().catch(console.error).finally(() => process.exit(0));
