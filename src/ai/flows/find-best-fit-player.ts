
'use server';

/**
 * @fileOverview An AI flow to find the best available player to fit an incomplete match.
 *
 * - findBestFitPlayer - A function that returns the best player and a reason.
 * - FindBestFitPlayerInput - The input type for the findBestFitPlayer function.
 * - FindBestFitPlayerOutput - The return type for the findBestFitPlayer function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type { Match, AvailablePlayer } from '@/lib/types';

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
  availablePlayers: z.array(PlayerSchema).describe("La lista de jugadores disponibles en el mercado.")
});
export type FindBestFitPlayerInput = z.infer<typeof FindBestFitPlayerInputSchema>;

const FindBestFitPlayerOutputSchema = z.object({
  playerId: z.string().describe("El UID del jugador recomendado."),
  reason: z.string().describe("Una justificación corta, en español y en tono de 'manager', de por qué este jugador es el fichaje ideal."),
});
export type FindBestFitPlayerOutput = z.infer<typeof FindBestFitPlayerOutputSchema>;


export async function findBestFitPlayer(input: FindBestFitPlayerInput): Promise<FindBestFitPlayerOutput> {
  return findBestFitPlayerFlow(input);
}


const prompt = ai.definePrompt({
  name: 'findBestFitPlayerPrompt',
  input: { schema: FindBestFitPlayerInputSchema },
  output: { schema: FindBestFitPlayerOutputSchema },
  prompt: `
    Eres un director deportivo experto en fútbol amateur del Río de la Plata, con un ojo clínico para fichajes.
    Tu tarea es analizar un partido incompleto y una lista de jugadores libres para recomendar el mejor fichaje posible.

    DATOS DEL PARTIDO INCOMPLETO:
    - Título: {{{match.title}}}
    - Jugadores necesarios: {{{match.matchSize}}}
    - Jugadores actuales: {{#each match.players}} {{this.displayName}} ({{this.position}}, OVR {{this.ovr}}){{/each}}

    JUGADORES DISPONIBLES EN EL MERCADO:
    {{#each availablePlayers}}
    - UID: {{this.uid}}, Nombre: {{this.displayName}}, Posición: {{this.position}}, OVR: {{this.ovr}}
    {{/each}}

    Basado en esto, tu objetivo es elegir UN solo jugador de la lista de disponibles.
    Tu criterio principal debe ser:
    1.  **Cubrir Posiciones Faltantes:** Si al equipo le falta un defensa, un delantero, o sobre todo un portero ('POR'), prioriza fichar a un jugador en esa posición.
    2.  **Equilibrio de OVR:** El jugador elegido debe mejorar al equipo pero sin desbalancear drásticamente el OVR promedio. Evita recomendar un jugador con un OVR muy por encima o muy por debajo del promedio del equipo actual.
    3.  **No recomendar si no hay opciones:** Si ninguno de los jugadores disponibles mejora la situación o si no hay jugadores, responde con un error.

    Devuelve el UID del jugador recomendado y una razón corta, ingeniosa y en tono de manager, explicando por qué es la elección correcta.
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
    if (input.availablePlayers.length === 0) {
      throw new Error("No hay jugadores disponibles en el mercado para recomendar.");
    }
    const { output } = await prompt(input);
    return output!;
  }
);
