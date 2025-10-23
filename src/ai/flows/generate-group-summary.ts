'use server';

/**
 * @fileOverview Player performance pattern detection AI agent.
 *
 * - detectPlayerPatterns - A function that identifies patterns in player performance over time.
 * - DetectPlayerPatternsInput - The input type for the detectPlayerPatterns function.
 * - DetectPlayerPatternsOutput - The return type for the detectPlayerPatterns function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DetectPlayerPatternsInputSchema = z.object({
  playerId: z.string().describe('El ID del jugador'),
  playerName: z.string().describe('El nombre del jugador'),
  position: z.enum(['DEL', 'MED', 'DEF', 'POR']).describe('La posición del jugador'),
  currentOVR: z.number().describe('El OVR actual del jugador'),
  stats: z.object({
    matchesPlayed: z.number().describe('Total de partidos jugados'),
    goals: z.number().describe('Total de goles'),
    assists: z.number().describe('Total de asistencias'),
    averageRating: z.number().describe('Calificación promedio'),
  }).describe('Estadísticas generales del jugador'),
  recentEvaluations: z.array(
    z.object({
      matchDate: z.string().describe('Fecha del partido'),
      rating: z.number().optional().describe('Calificación recibida (1-10)'),
      performanceTags: z.array(
        z.object({
          name: z.string().describe('Nombre del tag de rendimiento'),
          impact: z.enum(['positive', 'negative', 'neutral']).describe('Impacto del tag'),
        })
      ).describe('Tags de rendimiento recibidos'),
      goals: z.number().optional().describe('Goles en ese partido'),
    })
  ).describe('Evaluaciones recientes del jugador (últimos 10-15 partidos)'),
  ovrHistory: z.array(
    z.object({
      date: z.string().describe('Fecha del cambio'),
      oldOVR: z.number().describe('OVR anterior'),
      newOVR: z.number().describe('OVR nuevo'),
      change: z.number().describe('Cambio en el OVR'),
    })
  ).optional().describe('Historial de cambios en el OVR'),
});
export type DetectPlayerPatternsInput = z.infer<typeof DetectPlayerPatternsInputSchema>;

const DetectPlayerPatternsOutputSchema = z.object({
  patterns: z.array(
    z.object({
      type: z.enum(['trend', 'consistency', 'volatility', 'improvement', 'decline', 'specialty']).describe('Tipo de patrón detectado'),
      title: z.string().describe('Título del patrón'),
      description: z.string().describe('Descripción detallada del patrón'),
      confidence: z.number().min(0).max(100).describe('Nivel de confianza (0-100)'),
      impact: z.enum(['positive', 'negative', 'neutral']).describe('Impacto del patrón'),
    })
  ).describe('Lista de patrones detectados'),
  insights: z.object({
    strongestAttribute: z.string().describe('El atributo más fuerte del jugador'),
    weakestAttribute: z.string().describe('El atributo más débil del jugador'),
    playingStyle: z.string().describe('Estilo de juego característico'),
    consistency: z.enum(['very_high', 'high', 'medium', 'low', 'very_low']).describe('Nivel de consistencia'),
    trajectory: z.enum(['improving', 'declining', 'stable', 'volatile']).describe('Trayectoria del rendimiento'),
  }).describe('Insights generales del jugador'),
  recommendations: z.array(z.string()).describe('Recomendaciones basadas en los patrones detectados'),
  standoutMoments: z.array(
    z.object({
      matchDate: z.string().describe('Fecha del partido destacado'),
      description: z.string().describe('Qué hizo destacado en ese partido'),
    })
  ).optional().describe('Momentos destacados del jugador'),
});
export type DetectPlayerPatternsOutput = z.infer<typeof DetectPlayerPatternsOutputSchema>;

export async function detectPlayerPatterns(input: DetectPlayerPatternsInput): Promise<DetectPlayerPatternsOutput> {
  return detectPlayerPatternsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'detectPlayerPatternsPrompt',
  input: {schema: DetectPlayerPatternsInputSchema},
  output: {schema: DetectPlayerPatternsOutputSchema},
  prompt: `Sos un analista de datos de fútbol experto. Habla en español rioplatense.
Analiza el rendimiento histórico de {{playerName}} y detecta patrones significativos.

DATOS DEL JUGADOR:
- Nombre: {{playerName}}
- Posición: {{position}}
- OVR Actual: {{currentOVR}}
- Partidos Jugados: {{stats.matchesPlayed}}
- Goles: {{stats.goals}}
- Asistencias: {{stats.assists}}
- Rating Promedio: {{stats.averageRating}}

{{#if ovrHistory}}
HISTORIAL DE OVR:
{{#each ovrHistory}}
- {{this.date}}: {{this.oldOVR}} → {{this.newOVR}} (cambio: {{this.change}})
{{/each}}
{{/if}}

EVALUACIONES RECIENTES ({{recentEvaluations.length}} partidos):
{{#each recentEvaluations}}
Partido {{@index}} ({{this.matchDate}}):
  {{#if this.rating}}- Rating: {{this.rating}}/10{{/if}}
  {{#if this.goals}}- Goles: {{this.goals}}{{/if}}
  - Tags: {{#each this.performanceTags}}{{this.name}} ({{this.impact}}){{#unless @last}}, {{/unless}}{{/each}}
{{/each}}

INSTRUCCIONES DE ANÁLISIS:
1. Detecta PATRONES significativos:
   - TREND: Tendencias sostenidas (ej: mejora constante en últimos 5 partidos)
   - CONSISTENCY: Nivel de regularidad (siempre juega bien/mal o es irregular)
   - VOLATILITY: Gran variación entre partidos
   - IMPROVEMENT: Áreas donde está mejorando
   - DECLINE: Áreas donde está bajando
   - SPECIALTY: Especialización (ej: siempre anota, siempre asiste, defensivo)

2. Analiza tags de rendimiento:
   - Busca tags que se repiten frecuentemente
   - Identifica si son mayormente positivos o negativos
   - Detecta combinaciones de tags (ej: siempre "gambeta" + "pase quirúrgico" juntos)

3. Evalúa la TRAYECTORIA:
   - Si el OVR sube/baja constantemente
   - Si los ratings mejoran/empeoran con el tiempo
   - Si hay estancamiento

4. Identifica ESPECIALIDADES:
   - ¿Es goleador nato? (muchos goles)
   - ¿Es asistidor? (tags de pases)
   - ¿Es defensivo sólido? (tags defensivos)
   - ¿Es inconsistente? (ratings muy variables)

5. Encuentra MOMENTOS DESTACADOS:
   - Partidos con ratings muy altos
   - Partidos con muchos tags positivos
   - Partidos donde anotó múltiples goles

6. Da RECOMENDACIONES específicas:
   - Basadas en los patrones encontrados
   - Accionables y concretas
   - Enfocadas en maximizar fortalezas o mejorar debilidades

IMPORTANTE:
- Solo reporta patrones con confianza >50% (mínimo 3-4 partidos de evidencia)
- Sé específico y usa datos cuantitativos cuando sea posible
- Prioriza insights accionables sobre descripciones genéricas
- Si no hay suficientes datos (< 5 partidos), indica que se necesita más historial

Responde en JSON con los patrones detectados, insights, y recomendaciones.
`,
});

const detectPlayerPatternsFlow = ai.defineFlow(
  {
    name: 'detectPlayerPatternsFlow',
    inputSchema: DetectPlayerPatternsInputSchema,
    outputSchema: DetectPlayerPatternsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input, { model: 'googleai/gemini-2.5-flash' });
    return output!;
  }
);
