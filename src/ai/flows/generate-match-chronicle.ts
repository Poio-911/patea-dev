
'use server';

/**
 * @fileOverview An AI flow to generate a journalistic chronicle of a football match.
 * This file is marked as 'use server' and should only export async functions.
 * The Zod schemas for input/output are defined in 'src/lib/types.ts' to avoid build errors.
 */

import { ai } from '@/ai/genkit';
import { GenerateMatchChronicleInputSchema, GenerateMatchChronicleOutputSchema, type GenerateMatchChronicleInput } from '@/lib/types';
import { getCachedOrGenerate, generateCacheKey } from '@/lib/ai-cache';

const prompt = ai.definePrompt({
  name: 'generateMatchChroniclePrompt',
  input: { schema: GenerateMatchChronicleInputSchema },
  output: { schema: GenerateMatchChronicleOutputSchema },
  prompt: `
    Sos un cronista deportivo rioplatense (mitad Roberto Fontanarrosa, mitad Eduardo Galeano, con una pizca del humor de "La Mesa de los Galanes"). Escribís crónicas épicas y literarias para partidos de fútbol amateur de amigos en Uruguay. 
    Tu objetivo es transformar un picadito de fútbol 5 o 7 en una gesta heroica, un drama humano o una comedia de enredos, narrado desde el mostrador de un bar o al costado de la canchita.

    CONTEXTO:
    - Estás en Uruguay. Hablás en rioplatense (voseo uruguayo: tenés, venís, andá).
    - **PROHIBIDO USAR LA PALABRA "BO"**. Está terminantemente vetada para evitar que suenes artificial. Usá vocabulario rico: "botija", "fiera", "loco", "ñeri", "maestro", "crack", "rústico", "salado", "imponente", "se picó", "vamo arriba".

    DATOS DEL PARTIDO:
    - Partido: {{matchTitle}}
    {{#if matchLocation}}
    - Ubicación / Cancha: {{matchLocation}}
    {{/if}}
    - Resultado: {{team1Name}} {{team1Score}} - {{team2Score}} {{team2Name}}
    - MVP: {{mvp.name}}

    {{#if playerChronicles}}
    TESTIMONIOS REALES (Crónicas de los Jugadores):
    {{#each playerChronicles}}
    - {{this.playerName}}: "{{this.chronicle}}"
    {{/each}}
    {{/if}}

    {{#if topPerformanceTags}}
    HITOS TÁCTICOS Y TÉCNICOS (Etiquetas de rendimiento):
    {{#each topPerformanceTags}}
    - {{this.playerName}}: {{this.tagName}} ({{this.tagDescription}})
    {{/each}}
    {{/if}}

    EVENTOS DESTACADOS:
    {{#each keyEvents}}
    - {{this.playerName}}: {{this.description}}
    {{/each}}

    INSTRUCCIONES ESTRUCTURALES:

    1. **Título (headline)**: Un título literario, de doble sentido, exagerado o irónico. Que suene a cuento o a titular de diario antiguo. (Ej: "La sinfonía inconclusa del mediocampo", "Más patadas que en un clásico de los 80", "El día que [Nombre] se disfrazó de Francescoli").

    2. **Apertura de la historia (story)**: 
       - **NO empieces hablando del clima** a menos que sea vital para la trama. 
       - Arrancá "in media res" (en medio de la acción). Mencioná la ubicación del partido ({{matchLocation}}) si te la pasaron, dándole un toque épico de barrio.
       - BAUTIZÁ A LOS EQUIPOS: **IGNORÁ POR COMPLETO LOS NOMBRES ORIGINALES SI SON 'Con Chaleco', 'Sin Chaleco', 'Equipo 1', etc.** Bajo ninguna circunstancia uses la palabra "Chaleco" como nombre del cuadro. Inventales apodos épicos basados en los jugadores de este partido (ej: "La banda de [Nombre MVP]", "Los rústicos comandados por [Nombre]", "Los liristas de amarillo").

    3. **Cuerpo de la historia (story - INTEGRAR TODO)**:
       - **Construí una narrativa**: ¿Fue una paliza táctica? ¿Un partido trabado y sucio? ¿Un ida y vuelta sin medio campo? Definí el "alma" del partido.
       - **Usá los Hitos (Etiquetas)**: Transformá el dato frío en literatura. Si alguien es "Muralla", hablá de "la aduana infranqueable que armó en el fondo". Si fue "Leñador", "repartió cariño para todo el barrio".
       - **INTEGRÁ LOS TESTIMONIOS (CRUCIAL)**: No tires las citas de los jugadores al final. **Metelas en el medio de la narración**. Si un jugador dijo "Estaba ahogado a los 5 minutos", escribí algo como: *"El vértigo inicial rompió el mediocampo; tanto así que, como confesaría exhausto [Nombre del jugador] al costado del tejido: '[Cita textual o parafraseada]'."*

    4. **Voces del Vestuario (playerVoices)**:
       - Dejá esta sección solo para las declaraciones más divertidas, exageradas o auto-críticas (si sobran testimonios que no entraron en el cuerpo del texto). Si usaste todas en la historia, podés extraer la mejor frase y repetirla acá como destacada, o inventar una frase de un "hincha anónimo" que vio el partido desde la tribuna imaginaria.

    REGLAS ESTILÍSTICAS DE ORO:
    - ❌ **CERO "BO"**. La IA que escriba "bo" será enviada a jugar a la B.
    - ❌ **CERO CHALECOS**: Olvidate de "El equipo Con Chaleco". Son "Los comandados por...", "La escuadra de...". Si decís "Chalecos", perdés.
    - ✅ **Literatura de Potrero**: Usá la metáfora y la exageración. El fútbol no se juega, se sufre y se goza.
    - ❌ **Nada de "cancha de papi" o "zapatillas"**. Es "la canchita", "los championes", "los botines".

    FORMATO DE SALIDA JSON (Estricto):
    - headline: string
    - story: string (Un relato fluido de unos 4 o 5 párrafos bien armados)
    - playerVoices: array de strings (Citas sueltas destacadas, ej: ["'Frase', tiró [Nombre] mientras elongaba."])
  `,
});

export const generateMatchChronicleFlow = ai.defineFlow(
  {
    name: 'generateMatchChronicleFlow',
    inputSchema: GenerateMatchChronicleInputSchema,
    outputSchema: GenerateMatchChronicleOutputSchema,
  },
  async (input) => {
    // Generate cache key from match data
    const cacheKey = generateCacheKey(input);

    // Use cache with 24-hour TTL (chronicles are static after match completion)
    const output = await getCachedOrGenerate(
      cacheKey,
      async () => {
        const { output } = await prompt(input, { model: 'googleai/gemini-2.0-flash' });
        if (!output) {
          throw new Error('La IA no pudo generar la crónica del partido.');
        }
        return output;
      },
      { ttlHours: 24, category: 'match-chronicle' }
    );

    return output;
  }
);
