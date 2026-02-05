'use server';

import { analyzeTextPerformance } from '@/ai/flows/analyze-text-performance';

export type AttributeChange = {
  attribute: 'pac' | 'sho' | 'pas' | 'dri' | 'def' | 'phy';
  change: number;
  reason: string;
};

export type AnalyzeEvaluationTextResult =
  | { attributeChanges: AttributeChange[]; confidence: number; summary: string }
  | { error: string };

export async function analyzeEvaluationTextAction(input: {
  text: string;
  playerPosition: 'DEL' | 'MED' | 'DEF' | 'POR';
  playerName: string;
}): Promise<AnalyzeEvaluationTextResult> {
  try {
    const result = await analyzeTextPerformance({
      text: input.text,
      playerPosition: input.playerPosition,
      playerName: input.playerName,
    });

    return {
      attributeChanges: result.attributeChanges,
      confidence: result.confidence,
      summary: result.summary,
    };
  } catch (error) {
    console.error('Error analyzing evaluation text:', error);
    return { error: 'No se pudo analizar el texto. Intenta describir el rendimiento de otra manera.' };
  }
}

export async function requestIdentityRevelation(evaluationId: string, requestingUserId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { getAdminDb } = await import('@/firebase/admin-init');
    const { createError, ErrorCodes } = await import('../errors');

    // 1. Get Evaluation
    const evalRef = getAdminDb().collection('evaluations').doc(evaluationId);
    const evalSnap = await evalRef.get();

    if (!evalSnap.exists) {
      throw createError(ErrorCodes.DATA_NOT_FOUND, { evaluationId });
    }

    const evaluation = evalSnap.data() as any; // Using any to avoid type check loop if types not fully loaded, or import Evaluation

    // Verify requester is the subject
    if (evaluation.playerId !== requestingUserId) {
      return { success: false, error: 'No tienes permiso para solicitar esta identidad.' };
    }

    if (evaluation.identityRequestStatus === 'pending' || evaluation.identityRequestStatus === 'accepted') {
      return { success: true }; // Already processing
    }

    // 2. Update Status
    await evalRef.update({
      identityRequestStatus: 'pending',
      identityRequestDate: new Date().toISOString()
    });

    // 3. TODO: Send Notification to Evaluator (evaluation.evaluatorId)
    // We would insert into 'notifications' collection here.

    return { success: true };
  } catch (error: any) {
    console.error('Error requesting identity revelation:', error);
    return { success: false, error: error.message || 'Error al procesar la solicitud.' };
  }
}
