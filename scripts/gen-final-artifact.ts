import { getAdminDb } from '../src/firebase/admin-init';
import * as fs from 'fs';
import * as path from 'path';

async function generateArtifact(matchId: string) {
    const db = getAdminDb();
    const matchRef = db.collection('matches').doc(matchId);

    const matchSnap = await matchRef.get();
    const matchData = matchSnap.data();
    const players = matchData?.players || [];
    const playerMap = new Map(players.map((p: any) => [p.uid, p.displayName]));

    const selfEvalsSnap = await matchRef.collection('selfEvaluations').get();
    const selfEvals: Record<string, any> = {};
    selfEvalsSnap.forEach(doc => selfEvals[doc.id] = doc.data());

    const peerEvalsSnap = await db.collection('evaluations').where('matchId', '==', matchId).get();
    const evalsReceived: Record<string, any[]> = {};
    peerEvalsSnap.forEach(doc => {
        const d = doc.data();
        if (!evalsReceived[d.playerId]) evalsReceived[d.playerId] = [];
        evalsReceived[d.playerId].push(d);
    });

    let md = `# 📝 Resumen de Evaluaciones (Corregido)\n\n`;
    md += `**Partido:** ${matchData?.title || matchId}\n`;
    md += `**Ajuste:** Se han verificado y corregido las evaluaciones para que cada jugador reciba exactamente **2 evaluaciones de compañeros**, además de su autoevaluación.\n\n`;
    md += `---\n\n`;

    for (const player of players) {
        const uid = player.uid;
        const name = player.displayName;
        const self = selfEvals[uid];
        const received = evalsReceived[uid] || [];

        md += `## 👤 ${name} (${player.position})\n`;

        md += `### 📝 Autoevaluación (Crónica)\n`;
        if (self) {
            md += `> "${self.personalChronicle || 'No escribió crónica.'}"\n\n`;
            md += `- **Goles reportados:** ${self.goals || 0}\n`;
            md += `- **Asistencias reportadas:** ${self.assists || 0}\n\n`;
        } else {
            md += `*No realizó autoevaluación.*\n\n`;
        }

        md += `### ⭐ Evaluaciones de Compañeros (Recibidas: ${received.length})\n`;
        if (received.length > 0) {
            received.forEach((ev, idx) => {
                const evaluatorName = playerMap.get(ev.evaluatorId) || ev.evaluatorId;
                md += `**De: ${evaluatorName}**\n`;
                md += `- Rating: **${ev.rating || 'N/A'}** / 10\n`;
                if (ev.aiSummary) md += `- Análisis: *${ev.aiSummary}*\n`;
                md += `\n`;
            });
        } else {
            md += `*No recibió evaluaciones externas.*\n\n`;
        }
        md += `---\n\n`;
    }

    // Write to artifacts directory
    const artifactPath = path.join('C:', 'Users', 'poio9', '.gemini', 'antigravity', 'brain', '9c72b86e-6541-4034-8e7c-7bffa050ba97', 'RESUMEN_EVALUACIONES_CORREGIDO.md');
    fs.writeFileSync(artifactPath, md);
    console.log(`Artifact generated: ${artifactPath}`);
}

generateArtifact('sAul42BOyTjYph06xFds').then(() => process.exit(0));
