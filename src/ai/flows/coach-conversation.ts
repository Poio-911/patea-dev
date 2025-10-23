
'use server';

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

// ── SCHEMA DE INPUT ──────────────────────────────────────────
const CoachConversationInputSchema = z.object({
  userMessage: z.string().describe('El mensaje del usuario al entrenador.'),

  conversationHistory: z.array(
    z.object({
      role: z.enum(['user', 'coach']).describe('El rol del mensaje (usuario o entrenador).'),
      content: z.string().describe('El contenido del mensaje.'),
      timestamp: z.string().optional().describe('La marca de tiempo del mensaje.'),
    })
  ).optional().describe('El historial de conversación previo para mantener el contexto.'),

  playerContext: z.object({
    playerId: z.string().describe('El ID del jugador.'),
    playerName: z.string().describe('El nombre del jugador.'),
    position: z.enum(['DEL', 'MED', 'DEF', 'POR']).describe('La posición del jugador.'),
    ovr: z.number().describe('El rating general del jugador (Overall).'),
    stats: z.object({
      matchesPlayed: z.number().describe('Número de partidos jugados.'),
      goals: z.number().describe('Número de goles marcados.'),
      assists: z.number().describe('Número de asistencias.'),
      averageRating: z.number().describe('Calificación promedio.'),
    }).describe('Estadísticas del jugador.'),
    recentTags: z.array(z.string()).optional().describe('Etiquetas de rendimiento recientes.'),
    strengths: z.array(z.string()).optional().describe('Fortalezas identificadas del jugador.'),
    weaknesses: z.array(z.string()).optional().describe('Debilidades identificadas del jugador.'),
  }).describe('El contexto completo del jugador para personalizar la conversación.'),
});

export type CoachConversationInput = z.infer<typeof CoachConversationInputSchema>;

// ── SCHEMA DE OUTPUT ─────────────────────────────────────────
const CoachConversationOutputSchema = z.object({
  response: z.string().describe('La respuesta del entrenador al jugador.'),
  suggestedActions: z.array(
    z.string().describe('Acciones sugeridas o ejercicios para el jugador.')
  ).optional().describe('Acciones específicas que el jugador puede tomar.'),
  mood: z.enum(['motivational', 'analytical', 'supportive', 'critical']).describe('El tono de la respuesta.'),
});

export type CoachConversationOutput = z.infer<typeof CoachConversationOutputSchema>;


const prompt = ai.definePrompt({
  name: 'coachConversationPrompt',
  input: {schema: CoachConversationInputSchema},
  output: {schema: CoachConversationOutputSchema},
  prompt: `Sos un DT de fútbol profesional que habla en español rioplatense. Tu estilo es directo, motivador y personal.
Estás conversando con {{playerContext.playerName}}, un jugador {{playerContext.position}} con OVR {{playerContext.ovr}}.

DATOS DEL JUGADOR:
- Posición: {{playerContext.position}}
- OVR: {{playerContext.ovr}}
- Partidos: {{playerContext.stats.matchesPlayed}}
- Goles: {{playerContext.stats.goals}}
- Asistencias: {{playerContext.stats.assists}}
- Rating Promedio: {{playerContext.stats.averageRating}}
{{#if playerContext.recentTags}}
- Etiquetas Recientes: {{playerContext.recentTags}}
{{/if}}
{{#if playerContext.strengths}}
- Fortalezas: {{playerContext.strengths}}
{{/if}}
{{#if playerContext.weaknesses}}
- Debilidades: {{playerContext.weaknesses}}
{{/if}}

HISTORIAL DE CONVERSACIÓN:
{{#if conversationHistory}}
{{#each conversationHistory}}
{{this.role}}: {{this.content}}
{{/each}}
{{/if}}

MENSAJE ACTUAL DEL JUGADOR:
{{userMessage}}

INSTRUCCIONES:
1. Responde de forma conversacional y personalizada basándote en el contexto del jugador
2. Si te pregunta sobre su rendimiento, analiza sus stats y etiquetas
3. Si pide consejos, da recomendaciones específicas según su posición
4. Si está desmotivado, motívalo usando sus logros
5. Si está muy confiado, mantén los pies en la tierra pero sin desanimarlo
6. Usa vocabulario futbolístico argentino (gambeta, pique, quite, etc.)
7. Mantén la coherencia con el historial de conversación
8. Sugiere acciones concretas cuando sea apropiado (ejercicios, áreas de mejora)

TONO:
- Motivacional: cuando el jugador necesita ánimo
- Analítico: cuando pide análisis de rendimiento
- Supportivo: cuando muestra frustración
- Critical: cuando necesita un empujón o está siendo complaciente (pero siempre constructivo)

Responde en JSON con tu mensaje, acciones sugeridas (si aplica), y el tono que usaste.
`,
});

const coachConversationFlow = ai.defineFlow(
  {
    name: 'coachConversationFlow',
    inputSchema: CoachConversationInputSchema,
    outputSchema: CoachConversationOutputSchema,
  },
  async input => {
    const {output} = await prompt(input, { model: 'googleai/gemini-2.5-flash' });
    return output!;
  }
);

export async function coachConversation(input: CoachConversationInput): Promise<CoachConversationOutput> {
  return coachConversationFlow(input);
}
