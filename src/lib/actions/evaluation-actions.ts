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
