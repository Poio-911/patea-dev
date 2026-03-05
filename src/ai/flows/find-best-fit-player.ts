
'use server';

/**
 * @fileOverview An AI flow to find the best available players to fit an incomplete match.
 *
 * - findBestFitPlayer - A function that returns the best players and reasons.
 * - FindBestFitPlayerInput - The input type for the findBestFitPlayer function.
 * - FindBestFitPlayerOutput - The return type for the findBestFitPlayer function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getCachedOrGenerate, generateCacheKey } from '@/lib/ai-cache';

const PlayerSchema = z.object({
  uid: z.string(),
  displayName: z.string(),
  ovr: z.number(),
  position: z.string(),
});

const MatchSchema = z.object({
  id: z.string(),
  title: z.string(),
  matchSize: z.number(),
  players: z.array(PlayerSchema),
});

const FindBestFitPlayerInputSchema = z.object({
  match: MatchSchema.describe("El partido que necesita jugadores."),
  availablePlayers: z.array(PlayerSchema).describe("La lista de jugadores disponibles para fichar."),
  spotsToFill: z.number().describe("El número de plazas a cubrir en el partido.")
});
export type FindBestFitPlayerInput = z.infer<typeof FindBestFitPlayerInputSchema>;

const RecommendedPlayerSchema = z.object({
  playerId: z.string().describe("El UID del jugador recomendado."),
  reason: z.string().describe("Una justificación corta, en español y en tono de 'manager', de por qué este jugador es un fichaje ideal."),
});

const FindBestFitPlayerOutputSchema = z.object({
  recommendations: z.array(RecommendedPlayerSchema).describe("Una lista de jugadores recomendados para completar el partido.")
});
export type FindBestFitPlayerOutput = z.infer<typeof FindBestFitPlayerOutputSchema>;


export async function findBestFitPlayer(input: Omit<FindBestFitPlayerInput, 'spotsToFill'>): Promise<FindBestFitPlayerOutput> {
  const spotsToFill = input.match.matchSize - input.match.players.length;
  const fullInput = { ...input, spotsToFill };
  return findBestFitPlayerFlow(fullInput);
}


const prompt = ai.definePrompt({
  name: 'findBestFitPlayerPrompt',
  input: { schema: FindBestFitPlayerInputSchema },
  output: { schema: FindBestFitPlayerOutputSchema },
  model: 'googleai/gemini-3.1-pro-preview',
  prompt: `
    Eres un DT experimentado del fútbol uruguayo/rioplatense. Tu ojo no falla.
    Analizá el partido y recomendá los mejores refuerzos de la lista.

    PARTIDO:
    - {{match.title}}
    - Faltan: {{spotsToFill}} jugadores.
    - Equipo actual: {{#each match.players}} {{this.displayName}} ({{this.position}}){{/each}}

    JUGADORES DISPONIBLES:
    {{#each availablePlayers}}
    - UID: {{this.uid}}, {{this.displayName}} ({{this.position}}, OVR {{this.ovr}})
    {{/each}}

    REGLAS:
    1. Recomendá hasta {{spotsToFill}} jugadores. 
    2. Priorizá posiciones que faltan (especialmente 'POR' si no hay golero).
    3. El texto de justificación ('reason') debe ser MUY CORTO y al pie (ej: "Te falta un golero y este es un muro", "Necesitás marca en el medio").
    4. Usá jerga futbolera rioplatense coherente pero breve.
    5. Si no hay nada que sirva, devolvé lista vacía.

    Importante: 'playerId' debe coincidir exacto.
  `,
});


const findBestFitPlayerFlow = ai.defineFlow(
  {
    name: 'findBestFitPlayerFlow',
    inputSchema: FindBestFitPlayerInputSchema,
    outputSchema: FindBestFitPlayerOutputSchema,
  },
  async (input) => {
    if (input.availablePlayers.length === 0 || input.spotsToFill <= 0) {
      return { recommendations: [] };
    }
    const cacheKey = generateCacheKey(input);
    const output = await getCachedOrGenerate(
      cacheKey,
      async () => {
        const { output } = await prompt(input, { model: 'googleai/gemini-3.1-pro-preview' });
        return output!;
      },
      { ttlHours: 1, category: 'player-matching' }
    );
    return output;
  }
);
