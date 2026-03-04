/**
 * FULL DATABASE CLEANUP SCRIPT
 * ============================
 * Borra todos los partidos, equipos, competiciones y datos relacionados.
 * Mantiene: players, groups, users.
 * Resetea OVR a 50 y todas las stats a 0.
 *
 * Uso: npx ts-node -r tsconfig-paths/register scripts/full-cleanup.ts
 */

import { initializeApp, cert, getApps, ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

function initAdmin() {
    if (getApps().length > 0) return;
    delete process.env.FIRESTORE_EMULATOR_HOST;
    delete process.env.FIREBASE_AUTH_EMULATOR_HOST;

    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!raw) { console.error('❌ FIREBASE_SERVICE_ACCOUNT_KEY no encontrada'); process.exit(1); }

    const sa = JSON.parse(raw);
    initializeApp({ credential: cert(sa as ServiceAccount), projectId: sa.project_id });
    console.log(`✅ Firebase Admin listo. Proyecto: ${sa.project_id}\n`);
}

initAdmin();
const db = getFirestore();
const BATCH_SIZE = 400;

// ─── HELPERS ────────────────────────────────────────────────────────────────

async function deleteCollection(path: string): Promise<number> {
    let total = 0;
    while (true) {
        const snap = await db.collection(path).limit(BATCH_SIZE).get();
        if (snap.empty) break;
        const batch = db.batch();
        snap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
        total += snap.size;
    }
    return total;
}

async function deleteSubcollectionsOf(parentPath: string, subcols: string[]): Promise<number> {
    const snap = await db.collection(parentPath).get();
    let total = 0;
    for (const doc of snap.docs) {
        for (const sub of subcols) {
            total += await deleteCollection(`${parentPath}/${doc.id}/${sub}`);
        }
    }
    return total;
}

// ─── STEPS ──────────────────────────────────────────────────────────────────

async function run() {
    console.log('╔══════════════════════════════════════════╗');
    console.log('║       LIMPIEZA COMPLETA DE BASE DE DATOS ║');
    console.log('╚══════════════════════════════════════════╝\n');

    const counts: Record<string, number> = {};

    // 1. Subcolecciones de matches
    console.log('🗑  [1/12] Subcolecciones de matches...');
    counts.matchSubs = await deleteSubcollectionsOf('matches', [
        'assignments', 'selfEvaluations', 'processedSubmissions', 'invitations', 'dateProposals',
    ]);
    console.log(`   → ${counts.matchSubs} docs\n`);

    // 2. matches
    console.log('🗑  [2/12] Colección matches...');
    counts.matches = await deleteCollection('matches');
    console.log(`   → ${counts.matches} docs\n`);

    // 3. teams (con subcolecciones)
    console.log('🗑  [3/12] Subcolecciones de teams...');
    counts.teamSubs = await deleteSubcollectionsOf('teams', ['invitations', 'members']);
    console.log(`   → ${counts.teamSubs} docs\n`);

    console.log('🗑  [4/12] Colección teams...');
    counts.teams = await deleteCollection('teams');
    console.log(`   → ${counts.teams} docs\n`);

    // 5. leagues (competiciones)
    console.log('🗑  [5/12] Colección leagues...');
    counts.leagues = await deleteCollection('leagues');
    console.log(`   → ${counts.leagues} docs\n`);

    // 6. cups
    console.log('🗑  [6/12] Colección cups...');
    counts.cups = await deleteCollection('cups');
    console.log(`   → ${counts.cups} docs\n`);

    // 7. competitions (genérica si existe)
    console.log('🗑  [7/12] Colección competitions...');
    counts.competitions = await deleteCollection('competitions');
    console.log(`   → ${counts.competitions} docs\n`);

    // 8. evaluations
    console.log('🗑  [8/12] Colección evaluations...');
    counts.evaluations = await deleteCollection('evaluations');
    console.log(`   → ${counts.evaluations} docs\n`);

    // 9. evaluationSubmissions
    console.log('🗑  [9/12] Colección evaluationSubmissions...');
    counts.evalSubs = await deleteCollection('evaluationSubmissions');
    console.log(`   → ${counts.evalSubs} docs\n`);

    // 10. socialActivities
    console.log('🗑  [10/12] Colección socialActivities...');
    counts.socialActivities = await deleteCollection('socialActivities');
    console.log(`   → ${counts.socialActivities} docs\n`);

    // 11. Notificaciones de usuarios
    console.log('🗑  [11/12] Notificaciones de usuarios...');
    counts.notifications = await deleteSubcollectionsOf('users', ['notifications']);
    console.log(`   → ${counts.notifications} docs\n`);

    // 12. OVR history + reset jugadores a OVR 50
    console.log('🔄 [12/12] Reseteando jugadores: OVR → 50, stats → 0...');
    const playersSnap = await db.collection('players').get();
    let playersUpdated = 0;

    // Borrar ovrHistory de cada jugador
    for (const doc of playersSnap.docs) {
        await deleteCollection(`players/${doc.id}/ovrHistory`);
    }

    // Resetear OVR y stats en batches
    const defaultAttributes = {
        pace: 50, shooting: 50, passing: 50,
        dribbling: 50, defending: 50, physical: 50,
    };

    for (let i = 0; i < playersSnap.docs.length; i += BATCH_SIZE) {
        const batch = db.batch();
        const chunk = playersSnap.docs.slice(i, i + BATCH_SIZE);
        for (const doc of chunk) {
            batch.update(doc.ref, {
                ovr: 50,
                attributes: defaultAttributes,
                'stats.matchesPlayed': 0,
                'stats.goals': 0,
                'stats.assists': 0,
                'stats.wins': 0,
                'stats.draws': 0,
                'stats.losses': 0,
                'stats.averageRating': 0,
                'stats.yellowCards': 0,
                'stats.redCards': 0,
            });
            playersUpdated++;
        }
        await batch.commit();
        console.log(`   Actualizados ${Math.min(i + BATCH_SIZE, playersSnap.docs.length)}/${playersSnap.docs.length} jugadores...`);
    }
    counts.playersReset = playersUpdated;
    console.log(`   → ${playersUpdated} jugadores reseteados\n`);

    // ─── RESUMEN ──────────────────────────────────────────────────────────────
    const totalDeleted = Object.entries(counts)
        .filter(([k]) => k !== 'playersReset')
        .reduce((s, [, v]) => s + v, 0);

    console.log('╔══════════════════════════════════════════╗');
    console.log('║                  RESUMEN                 ║');
    console.log('╚══════════════════════════════════════════╝');
    console.log(`  Matches borrados:           ${counts.matches}`);
    console.log(`  Subcolecciones de matches:  ${counts.matchSubs}`);
    console.log(`  Teams borrados:             ${counts.teams}`);
    console.log(`  Subcolecciones de teams:    ${counts.teamSubs}`);
    console.log(`  Leagues borradas:           ${counts.leagues}`);
    console.log(`  Cups borradas:              ${counts.cups}`);
    console.log(`  Competitions borradas:      ${counts.competitions}`);
    console.log(`  Evaluations borradas:       ${counts.evaluations}`);
    console.log(`  EvalSubmissions borradas:   ${counts.evalSubs}`);
    console.log(`  Social activities borradas: ${counts.socialActivities}`);
    console.log(`  Notificaciones borradas:    ${counts.notifications}`);
    console.log(`  Jugadores reseteados:       ${counts.playersReset}`);
    console.log('──────────────────────────────────────────');
    console.log(`  TOTAL DOCS BORRADOS:        ${totalDeleted}`);
    console.log('');

    // Verificación final
    const [usersCount, groupsCount, playersCount, matchesCount, teamsCount] = await Promise.all([
        db.collection('users').count().get().then(s => s.data().count),
        db.collection('groups').count().get().then(s => s.data().count),
        db.collection('players').count().get().then(s => s.data().count),
        db.collection('matches').count().get().then(s => s.data().count),
        db.collection('teams').count().get().then(s => s.data().count),
    ]);

    console.log('✅ VERIFICACIÓN FINAL:');
    console.log(`  👤 Usuarios:   ${usersCount}  (conservados)`);
    console.log(`  👥 Grupos:     ${groupsCount}  (conservados)`);
    console.log(`  ⚽ Jugadores:  ${playersCount}  (OVR=50, conservados)`);
    console.log(`  🏟  Partidos:   ${matchesCount}  (debería ser 0)`);
    console.log(`  👕 Equipos:    ${teamsCount}  (debería ser 0)`);

    if (matchesCount === 0 && teamsCount === 0) {
        console.log('\n🎉 Base de datos limpia correctamente!');
    } else {
        console.log('\n⚠️  Atención: quedan documentos inesperados. Verificar manualmente.');
    }
}

run()
    .then(() => { console.log('\n✅ Script completado.'); process.exit(0); })
    .catch(e => { console.error('\n❌ Error:', e); process.exit(1); });
