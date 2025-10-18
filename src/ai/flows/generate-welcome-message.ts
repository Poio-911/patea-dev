
'use server';

/**
 * @fileOverview A flow to generate a friendly welcome and onboarding message for new users.
 *
 * - generateOnboardingMessage - A function that returns a structured welcome message.
 * - OnboardingMessageOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const OnboardingMessageSchema = z.object({
  title: z.string().describe('Un título de bienvenida cálido y enérgico.'),
  introduction: z.string().describe('Un párrafo corto introductorio que le da la bienvenida al usuario a la app.'),
  sections: z.array(
    z.object({
      header: z.string().describe('El título de una sección que explica una característica clave.'),
      content: z.string().describe('La explicación detallada pero concisa de esa característica.'),
      icon: z.enum(['groups', 'players', 'matches', 'evaluations', 'find']).describe('Un ícono representativo para la sección.'),
    })
  ).length(5).describe('Una lista de 5 secciones, cada una explicando una funcionalidad principal de la app.'),
  conclusion: z.string().describe('Un párrafo final que anima al usuario a empezar a explorar.'),
});

export type OnboardingMessageOutput = z.infer<typeof OnboardingMessageSchema>;

export async function generateOnboardingMessage(): Promise<OnboardingMessageOutput> {
  return generateOnboardingMessageFlow();
}

const prompt = ai.definePrompt({
  name: 'generateOnboardingMessagePrompt',
  output: { schema: OnboardingMessageSchema },
  prompt: `
    Eres un guía experto y amigable para una aplicación de gestión de fútbol amateur llamada "Amateur Football Manager".
    Tu tarea es generar un mensaje de bienvenida completo y estructurado para un nuevo usuario que acaba de registrarse.
    El tono debe ser entusiasta, claro y motivador. El idioma es español.

    El mensaje debe estructurarse de la siguiente manera:
    1.  **title**: Un título de bienvenida potente, como "¡Bienvenido a la cancha, crack!".
    2.  **introduction**: Un breve párrafo de bienvenida que explique el propósito de la app.
    3.  **sections**: Exactamente 5 secciones, cada una explicando una de las siguientes características clave:
        -   **Grupos**: La base social de la app, donde creas o te unes a equipos de amigos.
        -   **Jugadores**: Cómo añadir y gestionar la plantilla de tu grupo.
        -   **Partidos**: La diferencia entre partidos "manuales" (privados) y "colaborativos" (abiertos para que la gente se apunte).
        -   **Evaluaciones**: El sistema para calificar el rendimiento y ver la evolución de los jugadores.
        -   **Buscar Oportunidades**: El "mercado de fichajes" para encontrar partidos públicos o jugadores libres.
    4.  **conclusion**: Un mensaje final que invite al usuario a explorar y empezar a organizar su primer partido.

    Para cada sección, asigna un ícono de la siguiente lista: 'groups', 'players', 'matches', 'evaluations', 'find'.

    Asegúrate de que la explicación de cada característica sea fácil de entender para alguien que nunca ha usado la aplicación.
    El resultado debe ser un JSON válido que siga estrictamente el esquema de salida.
  `,
});

const generateOnboardingMessageFlow = ai.defineFlow(
  {
    name: 'generateOnboardingMessageFlow',
    outputSchema: OnboardingMessageSchema,
  },
  async () => {
    const { output } = await prompt();
    return output!;
  }
);
