import { getAdminDb } from '../src/firebase/admin-init';
import * as fs from 'fs';
import * as path from 'path';

async function seedMatchFull(matchId: string) {
    const db = getAdminDb();
    const matchRef = db.collection('matches').doc(matchId);

    console.log(`[seed-full] Starting full seed for match ${matchId}...`);

    const matchSnap = await matchRef.get();
    if (!matchSnap.exists) {
        console.error('Match not found');
        return;
    }
    const matchData = matchSnap.data() as any;
    const players = matchData.players || [];
    const organizerId = matchData.ownerUid;

    // Get organizer's group
    const organizerSnap = await db.collection('players').doc(organizerId).get();
    const organizerGroup = organizerSnap.data()?.groupId || 'poio-911';

    // 1. Cleanup existing for this match
    const evalsSnap = await db.collection('evaluations').where('matchId', '==', matchId).get();
    const cleanupBatch = db.batch();
    evalsSnap.docs.forEach(doc => cleanupBatch.delete(doc.ref));

    const selfEvalsSnap = await matchRef.collection('selfEvaluations').get();
    selfEvalsSnap.docs.forEach(doc => cleanupBatch.delete(doc.ref));

    const assignmentsSnap = await matchRef.collection('assignments').get();
    assignmentsSnap.docs.forEach(doc => cleanupBatch.delete(doc.ref));

    await cleanupBatch.commit();
    console.log(`[seed-full] Cleanup complete.`);

    // 2. Sync players to group
    for (const p of players) {
        await db.collection('players').doc(p.uid).update({
            groupId: organizerGroup,
            ownerUid: p.uid
        }).catch(() => { });
    }

    // 3. Seed Balanced
    const chronicles = [
        "Un partido muy intenso, me gustó cómo presionamos arriba.",
        "Me sentí bien físicamente, aunque fallé un par de pases fáciles.",
        "Muy sólido en defensa hoy, no dejamos pasar ni una.",
        "Lindos goles hoy, el equipo jugó para adelante.",
        "Me cansé un poco en el segundo tiempo, pero dejé todo.",
        "Buena conexión con mis compañeros, fluimos bien.",
        "Hoy me tocó remarla de atrás, pero el equipo respondió.",
        "Feliz por el rendimiento colectivo más que el individual.",
        "Traté de ordenar un poco el medio y salió bien.",
        "Dura derrota, pero a nivel personal me voy conforme."
    ];

    const aiSummaries = [
        "Control de juego soberbio, dictó el tempo del partido.",
        "Interceptó balones clave y mantuvo la estructura defensiva.",
        "Explosividad en ataque y gran capacidad de definición.",
        "Sacrificio defensivo y despliegue por toda la banda.",
        "Creatividad pura, habilitó a sus compañeros con maestría."
    ];

    const seedBatch = db.batch();
    for (let i = 0; i < players.length; i++) {
        const evaluator = players[i];

        // Peer Evals (2)
        for (let j = 1; j <= 2; j++) {
            const subject = players[(i + j) % players.length];
            const assignmentId = `asgn_${matchId}_${evaluator.uid}_${subject.uid}`;
            const evaluationId = `eval_${matchId}_${evaluator.uid}_${subject.uid}`;

            const evalRef = db.collection('evaluations').doc(evaluationId);
            seedBatch.set(evalRef, {
                id: evaluationId,
                assignmentId,
                playerId: subject.uid,
                evaluatorId: evaluator.uid,
                matchId: matchId,
                rating: 7 + (Math.random() > 0.5 ? 2 : 1), // 8 or 9
                aiSummary: aiSummaries[Math.floor(Math.random() * aiSummaries.length)],
                evaluatedAt: new Date().toISOString(),
                status: 'completed'
            });

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

        // Self Eval
        const selfEvalRef = matchRef.collection('selfEvaluations').doc(evaluator.uid);
        seedBatch.set(selfEvalRef, {
            playerId: evaluator.uid,
            matchId: matchId,
            goals: Math.floor(Math.random() * 2),
            assists: Math.floor(Math.random() * 2),
            personalChronicle: chronicles[i % chronicles.length],
            reportedAt: new Date().toISOString()
        });
    }

    await seedBatch.commit();
    console.log(`[seed-full] Seeding complete.`);

    // 4. Generate Summary Doc
    const playerMap = new Map(players.map((p: any) => [p.uid, p.displayName]));
    const finalPeerEvalsSnap = await db.collection('evaluations').where('matchId', '==', matchId).get();
    const finalSelfEvalsSnap = await matchRef.collection('selfEvaluations').get();

    const selfEvals: any = {};
    finalSelfEvalsSnap.forEach(d => selfEvals[d.id] = d.data());

    const peerEvals: any = {};
    finalPeerEvalsSnap.forEach(d => {
        const data = d.data();
        if (!peerEvals[data.playerId]) peerEvals[data.playerId] = [];
        peerEvals[data.playerId].push(data);
    });

    let md = `# 📊 Resumen de Evaluaciones - Partido ${matchData.title || matchId}\n\n`;
    md += `**Ajuste:** Cada jugador cuenta con **2 evaluaciones recibidas** y **1 autoevaluación**.\n\n`;
    md += `---\n\n`;

    for (const player of players) {
        const uid = player.uid;
        const self = selfEvals[uid];
        const received = peerEvals[uid] || [];

        md += `## 👤 ${player.displayName}\n`;
        md += `### 📝 Autoevaluación\n`;
        if (self) {
            md += `> "${self.personalChronicle}"\n\n`;
            md += `- Goles: ${self.goals} | Asistencias: ${self.assists}\n\n`;
        }

        md += `### ⭐ Evaluaciones de Compañeros\n`;
        received.forEach((ev: any) => {
            const evName = playerMap.get(ev.evaluatorId) || 'Compañero';
            md += `**De: ${evName}**\n`;
            md += `- Rating: **${ev.rating}** / 10\n`;
            md += `- Análisis IA: *${ev.aiSummary}*\n\n`;
        });
        md += `---\n\n`;
    }

    const artifactPath = path.join('C:', 'Users', 'poio9', '.gemini', 'antigravity', 'brain', '9c72b86e-6541-4034-8e7c-7bffa050ba97', `RESUMEN_EVALUACIONES_${matchId}.md`);
    fs.writeFileSync(artifactPath, md);
    console.log(`[seed-full] Artifact generated: ${artifactPath}`);
}

seedMatchFull('SXONApSnP1il2G3zGnJa').then(() => process.exit(0));
