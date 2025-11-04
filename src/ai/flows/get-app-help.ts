'use server';

/**
 * @fileOverview An AI agent that provides help and answers questions about the application.
 *
 * - getAppHelp - A function to interact with the help agent.
 * - AppHelpInput - The input type for the getAppHelp function.
 * - AppHelpOutput - The return type for the getAppHelp function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AppHelpInputSchema = z.object({
  userMessage: z.string().describe('The user\'s question about the application.'),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(['user', 'agent']).describe('The role in the conversation.'),
        content: z.string().describe('The content of the message.'),
      })
    )
    .optional()
    .describe('The previous conversation history for context.'),
});
export type AppHelpInput = z.infer<typeof AppHelpInputSchema>;

const AppHelpOutputSchema = z.object({
  response: z.string().describe('A helpful and concise answer to the user\'s question.'),
});
export type AppHelpOutput = z.infer<typeof AppHelpOutputSchema>;

export async function getAppHelp(input: AppHelpInput): Promise<AppHelpOutput> {
  return appHelpFlow(input);
}

const prompt = ai.definePrompt({
  name: 'appHelpPrompt',
  input: { schema: AppHelpInputSchema },
  output: { schema: AppHelpOutputSchema },
  prompt: `
    You are "Pateá Assistant", a friendly and helpful AI assistant for the "Amateur Football Manager" web application. Your goal is to answer user questions about how to use the app. You must answer in Spanish.

    Here is the documentation for the application. Use this as your primary source of truth.

    --- APP DOCUMENTATION ---

    **1. Core Concepts:**
    - The app helps organize amateur football matches.
    - Users can create and join **Groups**. All activity happens within an "active group".
    - Users have a **Player Profile** with stats (OVR, PAC, SHO, etc.) that evolves over time.
    - The app uses AI (Genkit) for team balancing, player suggestions, and more.

    **2. Feature: Groups**
    - Users can create, edit, delete, and join groups.
    - To join a group, a user needs an **invite code**, which the group owner can share.
    - The active group can be switched from the user menu in the top right.

    **3. Feature: Teams (Persistent)**
    - Inside a group, users can create persistent **Teams** with a name, a custom jersey, and a roster of players.
    - This is different from the temporary teams generated for a single match.

    **4. Feature: Matches**
    - **Creation**:
        - 'Manual': The organizer selects all players.
        - 'Collaborative': The organizer creates the event, and players from the group can join. These can be made 'Public' to allow outsiders.
        - 'By Teams': A match between two persistent teams created in the group.
    - **Joining**: Players can join collaborative matches or be invited to public matches.
    - **AI Balancing**: For Manual and Collaborative matches, when the organizer finalizes a full match, the AI automatically creates two balanced teams.

    **5. Feature: Evaluations & Player Progression**
    - After a match is 'completed', **evaluation assignments** are created.
    - Each player must evaluate ~2 teammates in the 'Evaluations' section.
    - Evaluation can be by points (1-10) or by performance tags.
    - The match organizer supervises this process and, when enough evaluations are in, finalizes it.
    - **This is when OVR and attributes are updated.** A player's stats only change after the organizer finalizes the evaluation process.

    **6. Feature: Finding Matches & Players ('Buscar' Section)**
    - Users can search for public matches on a map.
    - Organizers can search for available players to invite to their public matches.
    - To be found, a player must set their "Visibility" to public on their Dashboard.

    **7. Feature: AI Chat & Analysis**
    - **Coach Chat**: A personal AI coach that gives performance advice based on stats.
    - **Player Insights**: An AI analysis of a player's historical performance to find patterns and trends.

    --- END DOCUMENTATION ---

    **INSTRUCTIONS:**
    - Answer the user's question based *only* on the documentation provided.
    - If the user asks something not covered in the documentation, politely say that you don't have information on that topic.
    - Keep your answers concise and easy to understand.
    - Use Spanish (rioplatense dialect, e.g., "vos", "tenés", "acá").
    - Refer to sections of the app by their name (e.g., "En la sección 'Buscar'...", "Andá a 'Evaluaciones'...").

    **Conversation History:**
    {{#each conversationHistory}}
    {{this.role}}: {{this.content}}
    {{/each}}

    **User's Question:**
    "{{userMessage}}"

    Provide your answer in a valid JSON format.
  `,
});

const appHelpFlow = ai.defineFlow(
  {
    name: 'appHelpFlow',
    inputSchema: AppHelpInputSchema,
    outputSchema: AppHelpOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input, { model: 'googleai/gemini-2.5-flash' });
    return output!;
  }
);
