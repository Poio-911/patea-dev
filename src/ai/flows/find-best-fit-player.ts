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
  input: {schema: FindBestFitPlayerInputSchema},
  output: {schema: FindBestFitPlayerOutputSchema},
  prompt: `
    Eres un director deportivo experto en fútbol amateur del Río de la Plata, con un ojo clínico para fichajes.
    Tu tarea es analizar un partido incompleto y una lista de jugadores libres para recomendar los mejores fichajes posibles.

    DATOS DEL PARTIDO INCOMPLETO:
    - Título: {{match.title}}
    - Jugadores necesarios: {{match.matchSize}}
    - Jugadores actuales: {{match.players.length}}
    - Plazas a cubrir: {{spotsToFill}}
    - Plantilla actual: {{#each match.players}} {{this.displayName}} ({{this.position}}, OVR {{this.ovr}}){{/each}}

    JUGADORES LIBRES PARA FICHAR:
    {{#each availablePlayers}}
    - UID: {{this.uid}}, Nombre: {{this.displayName}}, Posición: {{this.position}}, OVR: {{this.ovr}}
    {{/each}}

    Basado en esto, tu objetivo es elegir hasta {{spotsToFill}} jugadores de la lista de disponibles para recomendar.
    Tus criterios principales deben ser:
    1.  **Cubrir Posiciones Faltantes:** Si al equipo le falta un defensa, un delantero, o sobre todo un portero ('POR'), prioriza fichar jugadores en esas posiciones.
    2.  **Equilibrio de OVR:** Los jugadores elegidos deben mejorar al equipo pero sin desbalancear drásticamente el OVR promedio del equipo actual. Evita recomendar jugadores con un OVR muy por encima o muy por debajo del promedio del equipo actual.
    3.  **Calidad sobre Cantidad:** Es mejor recomendar menos jugadores pero que sean los correctos, a rellenar por rellenar.
    4.  **Si no hay jugadores disponibles o ninguno encaja, devuelve una lista de recomendaciones vacía.**

    Para cada jugador que recomiendes, devuelve su UID y una razón corta, ingeniosa y en tono de manager, explicando por qué es la elección correcta.
    Ejemplo de razón: "Necesitábamos garra en el medio y este jugador es un tractorcito. Va a equilibrar el mediocampo."
    Otro ejemplo: "Es un delantero rápido que nos puede dar la chispa que falta arriba sin romper la armonía del equipo."

    Asegúrate de que la respuesta sea un JSON válido y que el 'playerId' corresponda a uno de los UIDs de la lista de disponibles.
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
    const { output } = await prompt(input, { model: 'googleai/gemini-2.5-flash' });
    return output!;
  }
);
