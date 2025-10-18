'use server';

/**
 * @fileOverview A flow to generate dynamic, contextual performance tags for player evaluations.
 *
 * - generateEvaluationTags - A function that returns a list of performance tags.
 * - GenerateEvaluationTagsInput - The input type for the generateEvaluationTags function.
 * - GenerateEvaluationTagsOutput - The return type for the generateEvaluationTags function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateEvaluationTagsInputSchema = z.object({
  position: z.enum(['DEL', 'MED', 'DEF', 'POR']).describe('La posición del jugador a evaluar.'),
});
export type GenerateEvaluationTagsInput = z.infer<typeof GenerateEvaluationTagsInputSchema>;

const TagEffectSchema = z.object({
    attribute: z.enum(['pac', 'sho', 'pas', 'dri', 'def', 'phy']).describe("El atributo que se modifica (ej: 'sho' para tiro)."),
    change: z.number().describe('El cambio numérico a aplicar (ej: 2 para +2, -1 para -1).')
});

const PerformanceTagSchema = z.object({
    id: z.string().describe("Un ID corto y único para la etiqueta (ej: 'goleador_nato')."),
    name: z.string().describe('El nombre coloquial y "rioplatense" de la etiqueta.'),
    description: z.string().describe('Una descripción breve y en tono futbolero de la acción.'),
    effects: z.array(TagEffectSchema).describe('El impacto directo en los atributos del jugador.')
});

const GenerateEvaluationTagsOutputSchema = z.object({
  tags: z.array(PerformanceTagSchema).length(7).describe('Una lista de 7 etiquetas de rendimiento únicas y variadas.'),
});
export type GenerateEvaluationTagsOutput = z.infer<typeof GenerateEvaluationTagsOutputSchema>;

export async function generateEvaluationTags(input: GenerateEvaluationTagsInput): Promise<GenerateEvaluationTagsOutput> {
  return generateEvaluationTagsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateEvaluationTagsPrompt',
  input: { schema: GenerateEvaluationTagsInputSchema },
  output: { schema: GenerateEvaluationTagsOutputSchema },
  prompt: `
    Eres un director técnico de fútbol del Río de la Plata, veterano y con mucho vocabulario de la jerga futbolera.
    Tu tarea es generar 7 etiquetas de rendimiento para evaluar a un jugador amateur después de un partido.
    Las etiquetas deben ser creativas, variadas (incluyendo positivas, neutras y alguna negativa) y específicas para la posición del jugador.

    La posición a evaluar es: {{{position}}}

    Para cada etiqueta, debes proporcionar:
    1.  **id**: Un identificador único en formato "snake_case".
    2.  **name**: Un nombre corto, ingenioso y muy "rioplatense". Ej: "Un tractorcito", "La colgó de un ángulo", "Se comió los mocos".
    3.  **description**: Una explicación breve de la jugada o actitud.
    4.  **effects**: El impacto numérico que esta acción tiene sobre los 6 atributos del jugador (pac, sho, pas, dri, def, phy). El cambio total sumando los atributos no debería ser mayor a 4 puntos. Las etiquetas positivas suben atributos, las negativas los bajan.

    EJEMPLOS PARA INSPIRARTE:
    - Para un DELANTERO:
        - Name: "Definió como los dioses", Description: "Le quedó una y la mandó a guardar. Impecable.", Effects: [{ attribute: 'sho', change: 3 }, { attribute: 'dri', change: 1 }]
        - Name: "Más solo que el 1", Description: "No se movió para buscar la pelota, esperó todo el partido arriba.", Effects: [{ attribute: 'pac', change: -1 }, { attribute: 'pas', change: -1 }]
    - Para un MEDIOCAMPISTA:
        - Name: "Metió un pase quirúrgico", Description: "Pase filtrado que dejó a un compañero solo frente al arco.", Effects: [{ attribute: 'pas', change: 3 }, { attribute: 'dri', change: 1 }]
        - Name: "Correcaminos", Description: "Corrió por toda la cancha, ayudó en defensa y ataque sin parar.", Effects: [{ attribute: 'pac', change: 1 }, { attribute: 'phy', change: 2 }]
    - Para un DEFENSA:
        - Name: "Impune por arriba", Description: "Ganó todas las pelotas de cabeza, tanto en defensa como en ataque.", Effects: [{ attribute: 'def', change: 2 }, { attribute: 'phy', change: 1 }]
        - Name: "Salió a cortar con el diario", Description: "Midió mal el cruce y quedó pagando en una jugada clave.", Effects: [{ attribute: 'def', change: -2 }, { attribute: 'pac', change: -1 }]

    Ahora, genera un set de 7 etiquetas nuevas y originales para la posición indicada, siguiendo estrictamente el formato JSON de salida.
  `,
});

const generateEvaluationTagsFlow = ai.defineFlow(
  {
    name: 'generateEvaluationTagsFlow',
    inputSchema: GenerateEvaluationTagsInputSchema,
    outputSchema: GenerateEvaluationTagsOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
