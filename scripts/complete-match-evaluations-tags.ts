import { initializeApp, cert, getApps, ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from 'dotenv';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { performanceTagsDb, PerformanceTag } from '../src/lib/performance-tags';

config({ path: join(process.cwd(), '.env.local') });

if (getApps().length === 0) {
    const s = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
    initializeApp({ credential: cert(s as ServiceAccount), projectId: s.project_id });
}

const db = getFirestore();

const MATCH_ID = '3Jz6qRePvVR8vPkbaGgr';

// ── Helpers ───────────────────────────────────────────────────────────────────
function tag(id: string): PerformanceTag {
    const t = performanceTagsDb.find(t => t.id === id);
    if (!t) throw new Error(`Tag not found: ${id}`);
    return t;
}

// ── Players ───────────────────────────────────────────────────────────────────
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

// ── Self-eval data ─────────────────────────────────────────────────────────────
const SELF_EVALS: Record<string, { goals: number; assists: number; personalChronicle: string; mvpVote: string }> = {
    // Doroteo (MED) — mvp: Aurelio
    '3xcfOetChgYB4ax6oh3w5zzd2w82': {
        goals: 0, assists: 2,
        personalChronicle: 'Partido muy intenso en el medio, tuve que cortar muchos contra-ataques y apoyar constantemente la salida. Mis dos asistencias fueron las jugadas que más me enorgullecen del día.',
        mvpVote: 'njH0OBBrmzSWOeoXamHUZyxavLv1',
    },
    // José P. (MED) — mvp: Alvaro M.
    '4Hjt7RpO28Trff70J2Z6YMSJshx1': {
        goals: 1, assists: 1,
        personalChronicle: 'Me encontré bastante cómodo circulando el balón. El gol fue un disparo de media distancia que sorprendió al arquero. La asistencia llegó después de una combinación de tres toques.',
        mvpVote: 'QYx3MCcrYRTJ1aYB24tQy0A2fmM2',
    },
    // Liroy (MED) — mvp: Aurelio
    '7LRVMYdOI8Sm9gahfBkh5rbVENt1': {
        goals: 0, assists: 1,
        personalChronicle: 'Cubrí bastante terreno hoy, intenté siempre apoyar a mis defensores y proyectarme al ataque cuando pude. La asistencia fue precisa pero me faltó llegar al remate.',
        mvpVote: 'njH0OBBrmzSWOeoXamHUZyxavLv1',
    },
    // Eminencia (DEF) — mvp: Fiorenzo
    'EFKPK6vDW4WrEosD6UrFRDGMG543': {
        goals: 0, assists: 0,
        personalChronicle: 'Defensivamente fue un partido exigente. Mantuve concentración en los duelos individuales y creo que cumplí bien en las coberturas. Sin errores graves en mi zona.',
        mvpVote: 'N7GKXwOa4vVeap4emu23x8jn8wF2',
    },
    // Clemente (DEF) — mvp: Aurelio
    'FZgnsSDMi4PBkI5jNORjYZm0zY32': {
        goals: 0, assists: 1,
        personalChronicle: 'Salí jugando bastante limpio hoy, hubo presión alta del rival pero logramos salir bien. Mi asistencia fue larga que habilitó a un delantero en carrera.',
        mvpVote: 'njH0OBBrmzSWOeoXamHUZyxavLv1',
    },
    // Fiorenzo (POR) — mvp: Alvaro M.
    'N7GKXwOa4vVeap4emu23x8jn8wF2': {
        goals: 0, assists: 0,
        personalChronicle: 'Tuve una tarde complicada bajo los palos, pero fui de más a menos y terminé seguro. Atajé un mano a mano clave en la segunda mitad que nos mantuvo en el partido.',
        mvpVote: 'QYx3MCcrYRTJ1aYB24tQy0A2fmM2',
    },
    // Alvaro M. (DEL) — mvp: Aurelio
    'QYx3MCcrYRTJ1aYB24tQy0A2fmM2': {
        goals: 2, assists: 1,
        personalChronicle: 'Mi mejor partido en mucho tiempo. Los dos goles fueron distintos: el primero de cabeza en un córner, el segundo con el pie izquierdo tras quiebre en el área. La asistencia fue un pase filtrado entre líneas.',
        mvpVote: 'njH0OBBrmzSWOeoXamHUZyxavLv1',
    },
    // Melisa (DEL) — mvp: Alvaro M.
    'gKe0DNivhfVeAi36OV1qGzkXpM63': {
        goals: 1, assists: 0,
        personalChronicle: 'Estuve activa todo el tiempo, aunque muchas pelotas me llegaron cerradas. El gol fue producto de insistencia: rebote que no dudé en empujar. Necesito mejorar el juego de espalda.',
        mvpVote: 'QYx3MCcrYRTJ1aYB24tQy0A2fmM2',
    },
    // Aurelio (DEL) — mvp: Alvaro M.
    'njH0OBBrmzSWOeoXamHUZyxavLv1': {
        goals: 2, assists: 1,
        personalChronicle: 'Me sentí muy suelto hoy, las combinaciones con mis compañeros fluyeron. Mis goles fueron de movimiento y anticipación. La asistencia fue en el último minuto cuando el rival ya estaba abierto.',
        mvpVote: 'QYx3MCcrYRTJ1aYB24tQy0A2fmM2',
    },
    // Briseida (DEL) — mvp: Aurelio
    'qrVOXyawztZBtTg7i6md6Opbt5H2': {
        goals: 1, assists: 1,
        personalChronicle: 'Tuve buen ritmo en el primer tiempo, menos en el segundo. El gol fue una jugada personal donde me escapé por el costado. La asistencia fue un centro que conectó bien mi compañero.',
        mvpVote: 'njH0OBBrmzSWOeoXamHUZyxavLv1',
    },
};

// ── Assignments with tags ──────────────────────────────────────────────────────
const ASSIGNMENTS: Array<{
    assignmentId: string;
    evaluatorId: string;
    subjectId: string;
    tagIds: string[];
}> = [
    // Doroteo → Eminencia (DEF)
    {
        assignmentId: 'OHsua3iW7Xuw5HiIswp2',
        evaluatorId: '3xcfOetChgYB4ax6oh3w5zzd2w82',
        subjectId: 'EFKPK6vDW4WrEosD6UrFRDGMG543',
        tagIds: ['impasable_mano_a_mano', 'patron_de_la_defensa', 'cobertura_perfecta', 'falta_innecesaria'],
    },
    // Doroteo → Fiorenzo (POR)
    {
        assignmentId: 'pbGC55dhW0urMtmBZdlv',
        evaluatorId: '3xcfOetChgYB4ax6oh3w5zzd2w82',
        subjectId: 'N7GKXwOa4vVeap4emu23x8jn8wF2',
        tagIds: ['achique_valiente', 'seguridad_de_arcos', 'saque_rapido', 'rebote_al_medio'],
    },
    // José P. → Aurelio (DEL)
    {
        assignmentId: 'C35X34tay75N4YAtny6l',
        evaluatorId: '4Hjt7RpO28Trff70J2Z6YMSJshx1',
        subjectId: 'njH0OBBrmzSWOeoXamHUZyxavLv1',
        tagIds: ['definio_como_dioses', 'terror_del_area', 'equipo_al_hombro', 'no_presiono_arriba'],
    },
    // José P. → Melisa (DEL)
    {
        assignmentId: 'dynBjGmvyS2CigJW5Z9z',
        evaluatorId: '4Hjt7RpO28Trff70J2Z6YMSJshx1',
        subjectId: 'gKe0DNivhfVeAi36OV1qGzkXpM63',
        tagIds: ['garra_charrua', 'terror_del_area', 'se_comio_un_elefante'],
    },
    // Liroy → Clemente (DEF)
    {
        assignmentId: 'kjrFSRnUQifvjtMckVqb',
        evaluatorId: '7LRVMYdOI8Sm9gahfBkh5rbVENt1',
        subjectId: 'FZgnsSDMi4PBkI5jNORjYZm0zY32',
        tagIds: ['cierre_providencial', 'pausa_y_vision', 'cobertura_perfecta', 'regalo_un_corner'],
    },
    // Liroy → José P. (MED)
    {
        assignmentId: 'tJJQ5p998d7umnW0kjO2',
        evaluatorId: '7LRVMYdOI8Sm9gahfBkh5rbVENt1',
        subjectId: '4Hjt7RpO28Trff70J2Z6YMSJshx1',
        tagIds: ['titiritero', 'pase_quirurgico', 'la_colgo_del_angulo', 'se_enamoro_de_la_pelota'],
    },
    // Eminencia → Briseida (DEL)
    {
        assignmentId: 'GuVxdkUTx3NW3htaSoiV',
        evaluatorId: 'EFKPK6vDW4WrEosD6UrFRDGMG543',
        subjectId: 'qrVOXyawztZBtTg7i6md6Opbt5H2',
        tagIds: ['gambeta_endiablada', 'asistidor_serial', 'garra_charrua', 'no_presiono_arriba'],
    },
    // Eminencia → Alvaro M. (DEL)
    {
        assignmentId: 'j15J0pHCtgSA9MfWIjqB',
        evaluatorId: 'EFKPK6vDW4WrEosD6UrFRDGMG543',
        subjectId: 'QYx3MCcrYRTJ1aYB24tQy0A2fmM2',
        tagIds: ['definio_como_dioses', 'terror_del_area', 'equipo_al_hombro', 'lento_para_definir'],
    },
    // Clemente → Doroteo (MED)
    {
        assignmentId: 'iP6FojVOGOhYBSVbjb4h',
        evaluatorId: 'FZgnsSDMi4PBkI5jNORjYZm0zY32',
        subjectId: '3xcfOetChgYB4ax6oh3w5zzd2w82',
        tagIds: ['titiritero', 'recuperacion_y_salida', 'cierre_providencial', 'pase_al_rival'],
    },
    // Clemente → Aurelio (DEL)
    {
        assignmentId: 'oQvA2ZJf6Dy0Ck8kWnt3',
        evaluatorId: 'FZgnsSDMi4PBkI5jNORjYZm0zY32',
        subjectId: 'njH0OBBrmzSWOeoXamHUZyxavLv1',
        tagIds: ['gambeta_endiablada', 'definio_como_dioses', 'equipo_al_hombro', 'no_bajo_a_marcar'],
    },
    // Fiorenzo → Melisa (DEL)
    {
        assignmentId: 'Hfs1oeWxCOIXeOpPQl12',
        evaluatorId: 'N7GKXwOa4vVeap4emu23x8jn8wF2',
        subjectId: 'gKe0DNivhfVeAi36OV1qGzkXpM63',
        tagIds: ['garra_charrua', 'terror_del_area', 'correcaminos', 'se_comio_un_elefante'],
    },
    // Fiorenzo → Clemente (DEF)
    {
        assignmentId: 'cc6xGT04P3R7OP4pZnzj',
        evaluatorId: 'N7GKXwOa4vVeap4emu23x8jn8wF2',
        subjectId: 'FZgnsSDMi4PBkI5jNORjYZm0zY32',
        tagIds: ['patron_de_la_defensa', 'pausa_y_vision', 'cobertura_perfecta', 'perdio_la_marca'],
    },
    // Alvaro M. → Briseida (DEL)
    {
        assignmentId: '8ZU9hNh7Ob8u4OE12B2e',
        evaluatorId: 'QYx3MCcrYRTJ1aYB24tQy0A2fmM2',
        subjectId: 'qrVOXyawztZBtTg7i6md6Opbt5H2',
        tagIds: ['gambeta_endiablada', 'asistidor_serial', 'garra_charrua', 'se_enamoro_de_la_pelota'],
    },
    // Alvaro M. → Fiorenzo (POR)
    {
        assignmentId: 'iGG58sZq6sDYR4PJNakh',
        evaluatorId: 'QYx3MCcrYRTJ1aYB24tQy0A2fmM2',
        subjectId: 'N7GKXwOa4vVeap4emu23x8jn8wF2',
        tagIds: ['atajadon_espectacular', 'achique_valiente', 'saque_rapido', 'rebote_al_medio'],
    },
    // Melisa → Alvaro M. (DEL)
    {
        assignmentId: 'ENULOslO1WbdMIIeRTI5',
        evaluatorId: 'gKe0DNivhfVeAi36OV1qGzkXpM63',
        subjectId: 'QYx3MCcrYRTJ1aYB24tQy0A2fmM2',
        tagIds: ['definio_como_dioses', 'terror_del_area', 'equipo_al_hombro', 'decision_incorrecta'],
    },
    // Melisa → Liroy (MED)
    {
        assignmentId: 'NMhTvh6EP2SfWsXVrajL',
        evaluatorId: 'gKe0DNivhfVeAi36OV1qGzkXpM63',
        subjectId: '7LRVMYdOI8Sm9gahfBkh5rbVENt1',
        tagIds: ['correcaminos', 'recuperacion_y_salida', 'cumplidor_tactico', 'miro_el_partido_de_adentro'],
    },
    // Aurelio → José P. (MED)
    {
        assignmentId: '0yXmc0UxTneagM4zzHUZ',
        evaluatorId: 'njH0OBBrmzSWOeoXamHUZyxavLv1',
        subjectId: '4Hjt7RpO28Trff70J2Z6YMSJshx1',
        tagIds: ['pase_quirurgico', 'la_colgo_del_angulo', 'titiritero', 'abuso_del_pelotazo'],
    },
    // Aurelio → Liroy (MED)
    {
        assignmentId: 'gGVsko5e43PH1b8xRhFR',
        evaluatorId: 'njH0OBBrmzSWOeoXamHUZyxavLv1',
        subjectId: '7LRVMYdOI8Sm9gahfBkh5rbVENt1',
        tagIds: ['correcaminos', 'garra_charrua', 'cumplidor_tactico', 'se_escondio'],
    },
    // Briseida → Doroteo (MED)
    {
        assignmentId: 'g6294kWlcBK5Q85s7tua',
        evaluatorId: 'qrVOXyawztZBtTg7i6md6Opbt5H2',
        subjectId: '3xcfOetChgYB4ax6oh3w5zzd2w82',
        tagIds: ['titiritero', 'asistidor_serial', 'recuperacion_y_salida', 'control_de_cemento'],
    },
    // Briseida → Eminencia (DEF)
    {
        assignmentId: 'z5rEB5aZOg2hrmaCgWNA',
        evaluatorId: 'qrVOXyawztZBtTg7i6md6Opbt5H2',
        subjectId: 'EFKPK6vDW4WrEosD6UrFRDGMG543',
        tagIds: ['impasable_mano_a_mano', 'patron_de_la_defensa', 'cobertura_perfecta', 'se_comio_el_amague'],
    },
];

// ─────────────────────────────────────────────────────────────────────────────

async function run() {
    console.log('\n🏟️  COMPLETANDO EVALUACIONES CON TAGS — PARTIDO');
    console.log('═'.repeat(60));
    console.log(`Match ID: ${MATCH_ID}\n`);

    const now = new Date().toISOString();
    let selfEvalCount = 0;
    let peerEvalCount = 0;
    let assignmentUpdateCount = 0;
    let cleanedCount = 0;

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

    // ── 2. Peer evaluations with tags + cleanup + assignment updates ──────────
    console.log('\n🏷️  Creando peer evaluations con tags y actualizando assignments...');
    await Promise.all(
        ASSIGNMENTS.map(async (a) => {
            const evaluatorName = PLAYERS.find(p => p.uid === a.evaluatorId)?.name ?? a.evaluatorId;
            const subjectName   = PLAYERS.find(p => p.uid === a.subjectId)?.name  ?? a.subjectId;

            const assignRef = db
                .collection('matches')
                .doc(MATCH_ID)
                .collection('assignments')
                .doc(a.assignmentId);

            // Check for existing evaluationId and clean up old eval doc
            const assignSnap = await assignRef.get();
            if (assignSnap.exists) {
                const existingEvalId = assignSnap.data()?.evaluationId as string | undefined;
                if (existingEvalId) {
                    await db.collection('evaluations').doc(existingEvalId).delete();
                    cleanedCount++;
                    console.log(`  🗑️  Borrado eval viejo ${existingEvalId.substring(0, 8)}... (${evaluatorName} → ${subjectName})`);
                }
            }

            // Build performanceTags array from tag IDs
            const performanceTags: PerformanceTag[] = a.tagIds.map(id => tag(id));

            const evalId = randomUUID();
            const evalRef = db.collection('evaluations').doc(evalId);

            await evalRef.set({
                id: evalId,
                assignmentId: a.assignmentId,
                playerId: a.subjectId,
                evaluatorId: a.evaluatorId,
                matchId: MATCH_ID,
                performanceTags,
                goals: 0,
                evaluatedAt: now,
            });
            peerEvalCount++;

            await assignRef.update({
                status: 'completed',
                evaluationId: evalId,
            });
            assignmentUpdateCount++;

            const tagNames = performanceTags.map(t => t.name).join(', ');
            console.log(`  ✅ ${evaluatorName} → ${subjectName} [${tagNames}]`);
        })
    );

    // ── Summary ───────────────────────────────────────────────────────────────
    console.log('\n' + '═'.repeat(60));
    if (cleanedCount > 0) {
        console.log(`🗑️  ${cleanedCount} evaluaciones viejas eliminadas`);
    }
    console.log(`✅ ${selfEvalCount} self-evaluations creadas`);
    console.log(`✅ ${peerEvalCount} peer evaluations con tags creadas`);
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
