'use server';

import { getAdminDb } from '@/firebase/admin-init';
import type { AppHelpInput } from '@/ai/flows/get-app-help';
import type { Player } from '@/lib/types';
import { logger } from '@/lib/logger';

/**
 * Get AI help response for user questions about the app
 */
export async function getAppHelpAction(input: AppHelpInput): Promise<{ response?: string; error?: string }> {
  try {
    const { getAppHelp } = await import('@/ai/flows/get-app-help');
    const result = await getAppHelp(input);
    return { response: result.response };
  } catch (error: any) {
    logger.error('Error getting app help', error);
    return { error: 'No se pudo obtener ayuda. Intentá de nuevo.' };
  }
}

/**
 * Generate AI summary for a group
 */
export async function generateGroupSummaryAction(groupId: string): Promise<{ summary?: string; error?: string }> {
  try {
    const db = getAdminDb();

    // Get group data
    const groupDoc = await db.collection('groups').doc(groupId).get();
    if (!groupDoc.exists) {
      return { error: 'Grupo no encontrado' };
    }
    const group = groupDoc.data()!;

    // Get players in the group
    const playersSnapshot = await db
      .collection('players')
      .where('groupId', '==', groupId)
      .orderBy('ovr', 'desc')
      .limit(5)
      .get();

    const players = playersSnapshot.docs.map(doc => doc.data() as Player);

    // Get matches count
    const matchesSnapshot = await db
      .collection('matches')
      .where('groupId', '==', groupId)
      .count()
      .get();
    const totalMatches = matchesSnapshot.data().count;

    // Calculate group stats
    let totalGoals = 0;
    let totalOvr = 0;
    players.forEach(p => {
      totalGoals += p.stats?.goals || 0;
      totalOvr += p.ovr || 0;
    });
    const averageOVR = players.length > 0 ? Math.round(totalOvr / players.length) : 0;

    // Build input for AI
    const input = {
      groupName: group.name || 'Sin nombre',
      memberCount: group.members?.length || 0,
      topPlayers: players.slice(0, 3).map(p => ({
        name: p.name,
        ovr: p.ovr,
        position: p.position,
      })),
      totalMatches,
      groupStats: {
        totalGoals,
        averageOVR,
      },
    };

    const { generateGroupSummary } = await import('@/ai/flows/generate-group-summary');
    const result = await generateGroupSummary(input);

    return { summary: result.summary };
  } catch (error: any) {
    logger.error('Error generating group summary', error, { groupId });
    return { error: 'No se pudo generar el resumen del grupo.' };
  }
}
