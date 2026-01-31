'use server';

import { extractTagsFromText } from '@/ai/flows/extract-tags-from-text';
import { performanceTagsDb, PerformanceTag } from '@/lib/performance-tags';

export type AnalyzeEvaluationTextResult =
  | { tags: PerformanceTag[]; confidence: number; reasoning?: string; summary?: string }
  | { error: string };

export async function analyzeEvaluationTextAction(input: {
  text: string;
  playerPosition: 'DEL' | 'MED' | 'DEF' | 'POR';
  playerName: string;
}): Promise<AnalyzeEvaluationTextResult> {
  try {
    // Filter tags available for this position
    const availableTags = performanceTagsDb.filter(
      (tag) => tag.positions.includes('ALL') || tag.positions.includes(input.playerPosition)
    );

    // Prepare simplified tag info for the AI
    const simplifiedTags = availableTags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      description: tag.description,
      impact: tag.impact,
    }));

    const result = await extractTagsFromText({
      text: input.text,
      playerPosition: input.playerPosition,
      playerName: input.playerName,
      availableTags: simplifiedTags,
    });

    // Convert IDs to full PerformanceTag objects
    const extractedTags = result.extractedTagIds
      .map((id) => performanceTagsDb.find((t) => t.id === id))
      .filter((t): t is PerformanceTag => t !== undefined);

    if (extractedTags.length === 0) {
      return { error: 'No se pudieron identificar etiquetas relevantes en el texto.' };
    }

    return {
      tags: extractedTags,
      confidence: result.confidence,
      reasoning: result.reasoning,
      summary: result.summary,
    };
  } catch (error) {
    console.error('Error analyzing evaluation text:', error);
    return { error: 'No se pudo analizar el texto. Intenta describir el rendimiento de otra manera.' };
  }
}
