'use server';

/**
 * @fileOverview Generates balanced teams based on player ratings and positions.
 *
 * - generateBalancedTeams - A function that generates balanced teams.
 * - GenerateBalancedTeamsInput - The input type for the generateBalancedTeams function.
 * - GenerateBalancedTeamsOutput - The return type for the generateBalancedTeams function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

const GenerateBalancedTeamsInputSchema = z.object({
  players: z
    .array(
      z.object({
        uid: z.string().describe('The unique identifier of the player.'),
        displayName: z.string().describe('The display name of the player.'),
        position: z.string().describe('The position of the player (DEL, MED, DEF, POR).'),
        ovr: z.number().describe('The overall rating of the player.'),
      })
    )
    .describe('An array of player objects to balance into teams.'),
  teamCount: z
    .number()
    .describe('The number of teams to generate. Must be at least 2.')
    .default(2),
});

export type GenerateBalancedTeamsInput = z.infer<typeof GenerateBalancedTeamsInputSchema>;

const GenerateBalancedTeamsOutputSchema = z.object({
  teams: z.array(
    z.object({
      name: z.string().describe('A placeholder name for the team (e.g., "Equipo 1", "Equipo 2").'),
      players: z.array(
        z.object({
          uid: z.string().describe('The unique identifier of the player.'),
          displayName: z.string().describe('The display name of the player.'),
          position: z.string().describe('The position of the player (DEL, MED, DEF, POR).'),
          ovr: z.number().describe('The overall rating of the player.'),
        })
      ),
      totalOVR: z.number().describe('The sum of all player OVRs.'),
      averageOVR: z.number().describe('The average team strength.'),
      suggestedFormation: z.string().describe('A suggested tactical formation (e.g., 1-2-1 for 5-a-side).'),
      tags: z.array(z.string()).describe('2-3 tactical tags describing the team (e.g., "Ataque Veloz", "Defensa Sólida", "Sin Portero Fijo").'),
    })
  ),
  balanceMetrics: z
    .object({
      ovrDifference: z
        .number()
                .describe('The absolute difference in average OVR between the strongest and weakest teams.'),
      fairnessPercentage: z
        .number()
        .describe('A percentage from 0 to 100 indicating how fair the team balance is. 100 is perfectly balanced.'),
    })
    .describe("Metrics describing how balanced the teams are."),
});


export type GenerateBalancedTeamsOutput = z.infer<typeof GenerateBalancedTeamsOutputSchema>;

export async function generateBalancedTeams(
  input: GenerateBalancedTeamsInput
): Promise<GenerateBalancedTeamsOutput> {
  return generateBalancedTeamsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateBalancedTeamsPrompt',
  input: {schema: GenerateBalancedTeamsInputSchema},
  output: {schema: GenerateBalancedTeamsOutputSchema},
  prompt: `Sos un DT experto en fútbol amateur del Río de la Plata, de esos que saben armar los equipos para el picado de los sábados.

Con esta lista de jugadores, con sus puestos y valoraciones (OVR), tu laburo es armar {{teamCount}} equipos que queden lo más parejos posible. Simplemente nombrálos "Equipo 1" y "Equipo 2".

La lista de jugadores es esta:

{{#each players}}
- Nombre: {{this.displayName}}, Puesto: {{this.position}}, OVR: {{this.ovr}}
{{/each}}

Para cada equipo que armes, tenés que:
1.  **Asignarle un nombre simple como "Equipo 1" o "Equipo 2".**
2.  **Sugerir una formación táctica** según la cantidad de jugadores (ej: para un fútbol 5, un "1-2-1" o "2-1-1").
3.  **Tirar 2 o 3 etiquetas tácticas** que describan al equipo (ej: "Ataque Rápido", "Defensa de Hierro", "Control del Mediocampo", "Sin Golero Fijo" si no hay un 'POR').
4.  Intentá que la diferencia de OVR total entre el equipo más fuerte y el más débil sea la menor posible.
5.  Calculá el OVR total y el promedio para cada equipo.
6.  Calculá las métricas de equilibrio: la diferencia absoluta en el OVR promedio y un porcentaje de "justicia" (100% es un partido totalmente parejo).

Asegurate de que la respuesta sea un JSON válido y que siga estrictamente el esquema de salida.
`,
});

const generateBalancedTeamsFlow = ai.defineFlow(
  {
    name: 'generateBalancedTeamsFlow',
    inputSchema: GenerateBalancedTeamsInputSchema,
    outputSchema: GenerateBalancedTeamsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input, {model: 'googleai/gemini-2.5-flash'});
    if (!output || !output.teams || output.teams.length < 2) {
      throw new Error('La IA no pudo generar los equipos correctamente.');
    }

    // Asignar aleatoriamente "Con chaleco" y "Sin chaleco"
    const teamNames = ["Con chaleco", "Sin chaleco"];
    const shuffledNames = teamNames.sort(() => 0.5 - Math.random());

    output.teams[0].name = shuffledNames[0];
    output.teams[1].name = shuffledNames[1];

    return output;
  }
);
