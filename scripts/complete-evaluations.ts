/**
 * complete-evaluations.ts
 *
 * Dado un matchId, completa TODAS las evaluaciones asignadas (assignments)
 * creando evaluaciones realistas directamente en `evaluations/` y
 * selfEvaluations en `matches/{matchId}/selfEvaluations/`.
 *
 * A diferencia de seed-evaluations.ts que crea submissions intermedias,
 * este script escribe los resultados finales directamente.
 *
 * Uso:
 *   npx tsx scripts/complete-evaluations.ts <matchId>
 *   npx tsx scripts/complete-evaluations.ts <matchId> --dry-run
 */

import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

if (getApps().length === 0) {
    const s = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
    initializeApp({ credential: cert(s), projectId: s.project_id });
}

// ── Types ──────────────────────────────────────────────────────────

type TagEffect = {
    attribute: 'pac' | 'sho' | 'pas' | 'dri' | 'def' | 'phy';
    change: number;
};

type PerformanceTag = {
    id: string;
    name: string;
    description: string;
    effects: TagEffect[];
    impact: 'positive' | 'negative' | 'neutral';
    positions: ('DEL' | 'MED' | 'DEF' | 'POR' | 'ALL')[];
};

type PlayerPosition = 'DEL' | 'MED' | 'DEF' | 'POR';

interface Player {
    id: string;
    name: string;
    position: PlayerPosition;
    photoURL?: string;
    photoUrl?: string;
    ownerUid: string;
}

interface Assignment {
    id: string;
    evaluatorId: string;
    subjectId: string;
    matchId: string;
    status: string;
}

// ── Performance Tags DB ────────────────────────────────────────────

const performanceTagsDb: PerformanceTag[] = [
    // POSITIVE
    { id: 'cierre_providencial', name: 'Cierre Providencial', description: 'Llegó con lo justo para barrer y evitar un gol cantado.', effects: [{ attribute: 'def', change: 3 }, { attribute: 'pac', change: 1 }], impact: 'positive', positions: ['DEF', 'MED'] },
    { id: 'pase_quirurgico', name: 'Pase Quirúrgico', description: 'Metió un pase filtrado que dejó a un compañero solo frente al arco.', effects: [{ attribute: 'pas', change: 3 }, { attribute: 'dri', change: 1 }], impact: 'positive', positions: ['MED', 'DEL'] },
    { id: 'gambeta_endiablada', name: 'Gambeta Endiablada', description: 'Se sacó a dos o más rivales de encima con habilidad pura.', effects: [{ attribute: 'dri', change: 3 }, { attribute: 'pac', change: 1 }], impact: 'positive', positions: ['DEL', 'MED'] },
    { id: 'la_colgo_del_angulo', name: 'La Colgó del Ángulo', description: 'Remate perfecto, al ángulo, inatajable para el arquero.', effects: [{ attribute: 'sho', change: 3 }, { attribute: 'dri', change: 1 }], impact: 'positive', positions: ['DEL', 'MED'] },
    { id: 'correcaminos', name: 'Correcaminos', description: 'Corrió por toda la cancha los 90 minutos, un pulmón extra.', effects: [{ attribute: 'pac', change: 2 }, { attribute: 'phy', change: 2 }], impact: 'positive', positions: ['ALL'] },
    { id: 'garra_charrua', name: 'Corazón y Garra', description: 'No dio una pelota por perdida, puro huevo y sacrificio por el equipo.', effects: [{ attribute: 'phy', change: 3 }], impact: 'positive', positions: ['ALL'] },
    { id: 'definio_como_dioses', name: 'Definió como los Dioses', description: 'Le quedó una y la mandó a guardar con clase y frialdad.', effects: [{ attribute: 'sho', change: 3 }], impact: 'positive', positions: ['DEL'] },
    { id: 'impasable_mano_a_mano', name: 'Un Muro', description: 'Ganó todos los duelos individuales, impasable en el mano a mano.', effects: [{ attribute: 'def', change: 3 }], impact: 'positive', positions: ['DEF'] },
    { id: 'titiritero', name: 'El Titiritero', description: 'Manejó los hilos del mediocampo, todas las pelotas pasaron por él.', effects: [{ attribute: 'pas', change: 2 }, { attribute: 'dri', change: 1 }], impact: 'positive', positions: ['MED'] },
    { id: 'atajadon_espectacular', name: 'El Pulpo', description: 'Atajadón espectacular que salvó al equipo.', effects: [{ attribute: 'def', change: 3 }], impact: 'positive', positions: ['POR'] },
    { id: 'cumplidor_tactico', name: 'Cumplidor Táctico', description: 'Hizo exactamente lo que el equipo necesitaba, sin lujos pero efectivo.', effects: [{ attribute: 'pas', change: 1 }, { attribute: 'def', change: 1 }], impact: 'positive', positions: ['ALL'] },
    { id: 'asistidor_serial', name: 'Asistidor Serial', description: 'Puso una pelota de gol increíble a un compañero.', effects: [{ attribute: 'pas', change: 3 }], impact: 'positive', positions: ['DEL', 'MED'] },
    // NEGATIVE
    { id: 'se_comio_un_elefante', name: 'Se Comió un Elefante', description: 'Le erró a un gol hecho, abajo del arco.', effects: [{ attribute: 'sho', change: -3 }], impact: 'negative', positions: ['DEL', 'MED'] },
    { id: 'pase_al_rival', name: 'Pase al Rival', description: 'Dio un pase comprometido que generó un contraataque peligroso.', effects: [{ attribute: 'pas', change: -3 }], impact: 'negative', positions: ['MED', 'DEF'] },
    { id: 'se_canso', name: 'Se Acalambró a los 10', description: 'No tuvo resto físico para aguantar el ritmo del partido.', effects: [{ attribute: 'phy', change: -3 }], impact: 'negative', positions: ['ALL'] },
    { id: 'control_de_cemento', name: 'Control de Cemento', description: 'No pudo parar una pelota fácil y se le fue larga.', effects: [{ attribute: 'dri', change: -2 }], impact: 'negative', positions: ['ALL'] },
    { id: 'salio_con_el_diario', name: 'Salió con el Diario', description: 'Midió mal el cruce, salió a destiempo y quedó pagando.', effects: [{ attribute: 'def', change: -3 }, { attribute: 'pac', change: -1 }], impact: 'negative', positions: ['DEF'] },
    { id: 'se_escondio', name: 'Se Escondió del Juego', description: 'No se mostró como opción de pase, caminó la cancha.', effects: [{ attribute: 'phy', change: -1 }, { attribute: 'pac', change: -1 }], impact: 'negative', positions: ['ALL'] },
];

// ── Helpers ────────────────────────────────────────────────────────

function gaussianRandom(mean: number, stdDev: number): number {
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return z0 * stdDev + mean;
}

function generateRating(): number {
    return Math.max(1, Math.min(10, Math.round(gaussianRandom(7, 1.5))));
}

function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function selectRandomTags(position: PlayerPosition, count: number): PerformanceTag[] {
    const relevant = performanceTagsDb.filter(t =>
        t.positions.includes(position) || t.positions.includes('ALL')
    );
    const positive = relevant.filter(t => t.impact === 'positive');
    const negative = relevant.filter(t => t.impact === 'negative');

    const numPos = Math.ceil(count * 0.7);
    const numNeg = count - numPos;

    return shuffle([
        ...shuffle(positive).slice(0, numPos),
        ...shuffle(negative).slice(0, numNeg),
    ]).slice(0, count);
}

function generateGoalsForTeam(teamPlayers: Player[]): Record<string, { goals: number; assists: number }> {
    const stats: Record<string, { goals: number; assists: number }> = {};
    teamPlayers.forEach(p => stats[p.id] = { goals: 0, assists: 0 });

    const totalGoals = Math.floor(Math.random() * 4) + 2; // 2-5

    for (let i = 0; i < totalGoals; i++) {
        const attackers = teamPlayers.filter(p => p.position === 'DEL' || p.position === 'MED');
        const pool = attackers.length > 0 && Math.random() > 0.2 ? attackers : teamPlayers;
        const scorer = pool[Math.floor(Math.random() * pool.length)];
        if (!scorer) continue;
        stats[scorer.id].goals++;

        if (Math.random() > 0.4) {
            const assisters = teamPlayers.filter(p => p.id !== scorer.id && p.position !== 'POR');
            if (assisters.length > 0) {
                const a = assisters[Math.floor(Math.random() * assisters.length)];
                stats[a.id].assists++;
            }
        }
    }
    return stats;
}

// ── Main ───────────────────────────────────────────────────────────

async function completeEvaluations(matchId: string, dryRun: boolean) {
    const db = getFirestore();

    console.log('\n⚡ COMPLETE EVALUATIONS (Direct Write)');
    console.log('═'.repeat(60));
    console.log(`Match ID: ${matchId}`);
    if (dryRun) console.log('🔍 DRY RUN — no writes will be made');
    console.log('');

    // 1. Load match
    const matchDoc = await db.doc(`matches/${matchId}`).get();
    if (!matchDoc.exists) {
        console.log('❌ Match not found');
        return;
    }
    const match = { id: matchDoc.id, ...matchDoc.data() } as any;

    if (match.status !== 'completed') {
        console.log(`❌ Match status is "${match.status}", must be "completed"`);
        return;
    }

    console.log(`✅ Match: "${match.title}"`);
    console.log(`   Status: ${match.status}`);
    console.log(`   Players: ${match.playerUids?.length || 0}`);
    console.log(`   Teams: ${match.teams?.length || 0}`);

    // 2. Load assignments
    const assignmentsSnap = await db.collection(`matches/${matchId}/assignments`).get();
    const allAssignments: Assignment[] = assignmentsSnap.docs.map(d => ({
        id: d.id, ...d.data()
    } as Assignment));

    const pendingAssignments = allAssignments.filter(a => a.status === 'pending');
    const alreadyCompleted = allAssignments.filter(a => a.status === 'completed');

    console.log(`   Total assignments: ${allAssignments.length}`);
    console.log(`   Already completed: ${alreadyCompleted.length}`);
    console.log(`   Pending: ${pendingAssignments.length}`);

    if (pendingAssignments.length === 0) {
        console.log('\n✅ All assignments are already completed. Nothing to do.');
        return;
    }

    // 3. Load players
    const playerUids: string[] = match.playerUids || [];
    const playerDocs = await Promise.all(
        playerUids.map((uid: string) => db.doc(`players/${uid}`).get())
    );
    const players: Player[] = playerDocs
        .filter(d => d.exists)
        .map(d => ({ id: d.id, ...d.data() } as Player));

    const playersById = new Map(players.map(p => [p.id, p]));

    console.log(`\n👥 Players (${players.length}):`);
    players.forEach(p => console.log(`   ${p.name} (${p.position}) ${p.id === p.ownerUid ? '👤' : '🤖'}`));

    // 4. Generate goals/assists per team
    console.log('\n⚽ Generating match stats...');
    const allStats: Record<string, { goals: number; assists: number }> = {};
    players.forEach(p => allStats[p.id] = { goals: 0, assists: 0 });

    if (match.teams && match.teams.length >= 2) {
        for (const team of match.teams) {
            const teamPlayers = players.filter(p =>
                team.players.some((tp: any) => tp.uid === p.id)
            );
            if (teamPlayers.length === 0) continue;
            const teamStats = generateGoalsForTeam(teamPlayers);
            Object.assign(allStats, teamStats);
        }
    } else {
        // No teams — distribute randomly
        const totalGoals = Math.floor(Math.random() * 6) + 3;
        for (let i = 0; i < totalGoals; i++) {
            const p = players[Math.floor(Math.random() * players.length)];
            if (p) allStats[p.id].goals++;
        }
    }

    Object.entries(allStats).forEach(([pid, s]) => {
        if (s.goals > 0 || s.assists > 0) {
            const p = playersById.get(pid);
            console.log(`   ${p?.name}: ${s.goals}G ${s.assists}A`);
        }
    });

    // 5. Group pending assignments by evaluator
    const byEvaluator = new Map<string, Assignment[]>();
    for (const a of pendingAssignments) {
        const list = byEvaluator.get(a.evaluatorId) || [];
        list.push(a);
        byEvaluator.set(a.evaluatorId, list);
    }

    // 6. Track which evaluators already have selfEvaluations
    const existingSelfEvals = await db.collection(`matches/${matchId}/selfEvaluations`).get();
    const evaluatorsWithSelfEval = new Set(existingSelfEvals.docs.map(d => d.data().playerId));

    // 7. Process in batches (Firestore max 500 ops per batch)
    console.log('\n📝 Creating evaluations...');
    console.log('─'.repeat(50));

    let evalCount = 0;
    let selfEvalCount = 0;
    let assignmentUpdates = 0;
    const batches: FirebaseFirestore.WriteBatch[] = [];
    let currentBatch = db.batch();
    let opsInBatch = 0;

    const flushBatch = () => {
        if (opsInBatch > 0) {
            batches.push(currentBatch);
            currentBatch = db.batch();
            opsInBatch = 0;
        }
    };

    const addOp = () => {
        opsInBatch++;
        if (opsInBatch >= 450) flushBatch(); // Leave margin
    };

    for (const [evaluatorId, evalAssignments] of byEvaluator) {
        const evaluator = playersById.get(evaluatorId);
        const evalName = evaluator?.name || evaluatorId;
        const stats = allStats[evaluatorId] || { goals: 0, assists: 0 };

        // Create selfEvaluation if this evaluator doesn't have one yet

        // Simulate MVP vote (random or self-bias)
        // Vote for a random player who is not me (usually)
        const otherPlayers = players.filter(p => p.id !== evaluatorId);
        const randomVote = otherPlayers.length > 0
            ? otherPlayers[Math.floor(Math.random() * otherPlayers.length)].id
            : evaluatorId;

        // Generate Chronicle
        const winTemplates = [
            "¡Qué partido ganamos! Dejé el alma.",
            "Partido durísimo pero nos llevamos los 3 puntos.",
            "Jugué bien, aunque terminé muerto.",
            "Gran equipo, tocamos bien.",
            "Ganamos a lo Peñarol, sufriendo."
        ];
        const goalTemplates = [
            "¡Mojé! Qué lindo hacer goles.",
            "El arco se me abrió hoy, por suerte.",
            "Gol y victoria, noche redonda.",
            "La mandé a guardar."
        ];
        const genericTemplates = [
            "Partido parejo, se corrió mucho.",
            "Me faltó aire pero cumplí.",
            "Buen picado, divertido.",
            "Terminé con los gemelos cargados.",
            "Hay que mejorar la defensa."
        ];

        let chronicle = "";
        if (stats.goals > 0) {
            chronicle = goalTemplates[Math.floor(Math.random() * goalTemplates.length)];
        } else if (Math.random() > 0.5) {
            chronicle = winTemplates[Math.floor(Math.random() * winTemplates.length)];
        } else {
            chronicle = genericTemplates[Math.floor(Math.random() * genericTemplates.length)];
        }

        if (!evaluatorsWithSelfEval.has(evaluatorId)) {
            const stats = allStats[evaluatorId] || { goals: 0, assists: 0 };
            const selfEvalRef = db.collection(`matches/${matchId}/selfEvaluations`).doc();
            currentBatch.set(selfEvalRef, {
                playerId: evaluatorId,
                matchId,
                goals: stats.goals,
                assists: stats.assists,
                mvpVote: randomVote,
                personalChronicle: chronicle,
                reportedAt: new Date().toISOString(),
            });
            addOp();
            selfEvalCount++;
            evaluatorsWithSelfEval.add(evaluatorId);
        }

        // Create peer evaluations
        for (const assignment of evalAssignments) {
            const subject = playersById.get(assignment.subjectId);
            if (!subject) {
                console.log(`   ⚠️  Subject ${assignment.subjectId} not found, skipping`);
                continue;
            }

            // Randomly choose evaluation type: 50% points, 35% tags, 15% text
            const roll = Math.random();
            const evalRef = db.collection('evaluations').doc();
            const evalData: Record<string, any> = {
                assignmentId: assignment.id,
                playerId: assignment.subjectId,
                evaluatorId,
                matchId,
                goals: 0,
                evaluatedAt: new Date().toISOString(),
            };

            let evalTypeLabel: string;

            if (roll < 0.50) {
                // POINTS
                evalData.rating = generateRating();
                evalTypeLabel = `points(${evalData.rating})`;
            } else if (roll < 0.85) {
                // TAGS
                const tags = selectRandomTags(subject.position, 3);
                evalData.performanceTags = tags;
                evalTypeLabel = `tags(${tags.map(t => t.name).join(', ')})`;
            } else {
                // TEXT (simulated AI analysis)
                const descriptions = [
                    `${subject.name} tuvo un buen partido, se movió bien y participó en varias jugadas.`,
                    `Partido irregular de ${subject.name}, momentos buenos y malos.`,
                    `${subject.name} fue determinante en el mediocampo, siempre pidió la pelota.`,
                    `Cumplió su función sin destacar demasiado pero sin errores graves.`,
                    `Se lo vio muy activo, corrió mucho y generó espacios para los compañeros.`,
                ];
                evalData.textDescription = descriptions[Math.floor(Math.random() * descriptions.length)];
                evalData.aiSummary = `Rendimiento general correcto de ${subject.name}.`;

                // Simulated AI attribute changes
                const attrs: ('pac' | 'sho' | 'pas' | 'dri' | 'def' | 'phy')[] = ['pac', 'sho', 'pas', 'dri', 'def', 'phy'];
                const numChanges = Math.floor(Math.random() * 2) + 1;
                const selectedAttrs = shuffle(attrs).slice(0, numChanges);
                evalData.aiAttributeChanges = selectedAttrs.map(attr => ({
                    attribute: attr,
                    change: Math.random() > 0.3 ? Math.floor(Math.random() * 2) + 1 : -(Math.floor(Math.random() * 2) + 1),
                }));
                evalData.aiConfidence = Math.round((Math.random() * 0.3 + 0.6) * 100) / 100;
                evalTypeLabel = `text(AI)`;
            }

            currentBatch.set(evalRef, evalData);
            addOp();

            // Update assignment → completed
            const assignRef = db.doc(`matches/${matchId}/assignments/${assignment.id}`);
            currentBatch.update(assignRef, {
                status: 'completed',
                evaluationId: evalRef.id,
            });
            addOp();

            evalCount++;
            assignmentUpdates++;

            console.log(`   ${evalName} → ${subject.name}: ${evalTypeLabel}`);
        }
    }

    flushBatch(); // Flush remaining

    // 8. Commit
    console.log('\n─'.repeat(50));
    console.log(`📊 Summary:`);
    console.log(`   Evaluations created: ${evalCount}`);
    console.log(`   Self-evaluations created: ${selfEvalCount}`);
    console.log(`   Assignments updated: ${assignmentUpdates}`);
    console.log(`   Batches: ${batches.length}`);

    if (dryRun) {
        console.log('\n🔍 DRY RUN — skipping writes');
    } else {
        console.log('\n💾 Committing...');
        for (let i = 0; i < batches.length; i++) {
            await batches[i].commit();
            console.log(`   Batch ${i + 1}/${batches.length} committed`);
        }
    }

    console.log('\n═'.repeat(60));
    console.log(`✅ Done! ${evalCount} evaluations completed for match "${match.title}"`);
    console.log(`   The organizer can now finalize the evaluation to update OVRs.`);
    console.log('═'.repeat(60));
}

// ── CLI ────────────────────────────────────────────────────────────

const matchId = process.argv[2];
const dryRun = process.argv.includes('--dry-run');

if (!matchId) {
    console.error('Usage: npx tsx scripts/complete-evaluations.ts <matchId> [--dry-run]');
    process.exit(1);
}

completeEvaluations(matchId, dryRun).catch(err => {
    console.error('\n❌ Fatal error:', err);
    process.exit(1);
}).finally(() => process.exit(0));
