'use server';

import { getAdminDb } from '@/firebase/admin-init';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';

const InteractionSchema = z.object({
    campaignId: z.string().min(1),
    interactionType: z.enum(['impression', 'click']),
});

/**
 * Registra una interacción (impresión o click) para una campaña específica.
 * Incrementa atómicamente el contador en Firestore.
 */
export async function recordCampaignInteraction(
    campaignId: string,
    interactionType: 'impression' | 'click'
) {
    try {
        // Validar parámetros
        const parsed = InteractionSchema.safeParse({ campaignId, interactionType });
        if (!parsed.success) {
            return { success: false, error: 'Invalid parameters' };
        }

        const { campaignId: id, interactionType: type } = parsed.data;

        const db = await getAdminDb();
        const campaignRef = db.collection('campaigns').doc(id);

        // Incrementar atómicamente el campo correspondiente
        await campaignRef.update({
            [`stats.${type}s`]: FieldValue.increment(1),
            lastActiveAt: FieldValue.serverTimestamp(),
        });

        return { success: true };
    } catch (error: any) {
        // Si el doc no existe o falla por otra razón, retornamos silenciando el error 
        // al cliente para no frenar la UI, pero lo loggueamos
        console.warn(`[Ad Action Err] Failed to track ${interactionType} for ${campaignId}:`, error.message);
        return { success: false, error: 'Failed to record interaction' };
    }
}
