import { getAdminDb } from '../src/firebase/admin-init';
import * as fs from 'fs';
import * as path from 'path';

async function generateEvaluationDoc(matchId: string) {
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

    let md = `# Resumen de Evaluaciones - Partido ${matchData?.title || matchId}\n\n`;
    md += `**Fecha:** ${matchData?.date} | **Hora:** ${matchData?.time}\n`;
    md += `**Estado:** ${matchData?.status}\n\n`;
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

        md += `### ⭐️ Evaluaciones de la IA / Compañeros\n`;
        if (received.length > 0) {
            received.forEach((ev, idx) => {
                const evaluatorName = playerMap.get(ev.evaluatorId) || ev.evaluatorId;
                md += `#### De: ${evaluatorName}\n`;
                md += `- **Rating:** ${ev.rating || 'N/A'}\n`;
                if (ev.aiSummary) md += `- **IA Summary:** ${ev.aiSummary}\n`;
                if (ev.aiAttributeChanges && ev.aiAttributeChanges.length > 0) {
                    md += `- **Cambios sugeridos:** ${ev.aiAttributeChanges.map((c: any) => `${c.attribute.toUpperCase()} ${c.change > 0 ? '+' : ''}${c.change}`).join(', ')}\n`;
                }
                md += `\n`;
            });
        } else {
            md += `*No recibió evaluaciones externas aún.*\n\n`;
        }
        md += `---\n\n`;
    }

    const artifactPath = path.join('C:', 'Users', 'poio9', '.gemini', 'antigravity', 'brain', '9c72b86e-6541-4034-8e7c-7bffa050ba97', 'RESUMEN_EVALUACIONES_PARTIDO.md');
    fs.writeFileSync(artifactPath, md);
    console.log(`Documento generado en: ${artifactPath}`);
}

generateEvaluationDoc('sAul42BOyTjYph06xFds').then(() => process.exit(0));
