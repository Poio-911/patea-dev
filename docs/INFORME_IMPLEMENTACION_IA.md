# INFORME EXHAUSTIVO: IMPLEMENTACIÓN DE IA EN AMATEUR FOOTBALL MANAGER

**Fecha:** 23 de Octubre de 2025
**Proyecto:** Amateur Football Manager (AFM)
**Objetivo:** Documentar la implementación completa de las funcionalidades de IA para replicación con Gemini en Firestudio

---

## ÍNDICE

1. [Visión General](#1-visión-general)
2. [Tecnologías y Dependencias](#2-tecnologías-y-dependencias)
3. [Arquitectura de IA](#3-arquitectura-de-ia)
4. [Coach Chat - Implementación Completa](#4-coach-chat---implementación-completa)
5. [Player Insights - Implementación Completa](#5-player-insights---implementación-completa)
6. [Server Actions](#6-server-actions)
7. [Integración Frontend](#7-integración-frontend)
8. [Guía de Replicación para Gemini](#8-guía-de-replicación-para-gemini)
9. [Testing y Debugging](#9-testing-y-debugging)
10. [Optimizaciones y Mejores Prácticas](#10-optimizaciones-y-mejores-prácticas)

---

## 1. VISIÓN GENERAL

### 1.1. Funcionalidades de IA Implementadas

Amateur Football Manager utiliza **Google Genkit** para implementar dos funcionalidades principales de IA:

1. **Coach Chat** (Chat con el DT Virtual)
   - Chat conversacional personalizado
   - Contexto completo del jugador
   - Historial de conversación
   - Tono adaptativo (motivacional, analítico, comprensivo, crítico)
   - Acciones sugeridas

2. **Player Insights** (Análisis de Rendimiento)
   - Detección de patrones en el rendimiento
   - Análisis de consistencia y trayectoria
   - Identificación de fortalezas y debilidades
   - Recomendaciones personalizadas
   - Momentos destacados

### 1.2. ¿Por qué Genkit?

**Genkit** es el framework oficial de Google para desarrollar aplicaciones con IA. Ventajas:

- ✅ Integración nativa con Google AI (Gemini)
- ✅ Type-safe con TypeScript y Zod
- ✅ UI de desarrollo para testing
- ✅ Prompts estructurados con variables
- ✅ Validación automática de inputs/outputs
- ✅ Streaming support
- ✅ Fácil migración entre modelos

---

## 2. TECNOLOGÍAS Y DEPENDENCIAS

### 2.1. Package.json - Dependencias de Genkit

```json
{
  "dependencies": {
    "@genkit-ai/google-genai": "1.21.0",
    "@genkit-ai/next": "1.21.0",
    "genkit": "1.21.0"
  },
  "devDependencies": {
    "genkit-cli": "1.21.0"
  },
  "scripts": {
    "genkit:dev": "genkit start -- tsx src/ai/dev.ts",
    "genkit:watch": "genkit start -- tsx --watch src/ai/dev.ts"
  }
}
```

### 2.2. Instalación

```bash
npm install genkit @genkit-ai/google-genai @genkit-ai/next
npm install -D genkit-cli
```

### 2.3. Variables de Entorno

Crear `.env.local`:

```bash
GOOGLE_GENAI_API_KEY=your-api-key-here
```

**Cómo obtener la API Key:**
1. Ir a [Google AI Studio](https://aistudio.google.com/)
2. Crear nuevo proyecto o usar existente
3. Ir a "Get API key"
4. Copiar la key

---

## 3. ARQUITECTURA DE IA

### 3.1. Estructura de Archivos

```
src/
├── ai/
│   ├── genkit.ts                          # Configuración de Genkit
│   ├── dev.ts                             # Punto de entrada para Genkit UI
│   └── flows/
│       ├── coach-conversation.ts          # Flow del chat con el DT
│       ├── detect-player-patterns.ts      # Flow de análisis de rendimiento
│       ├── generate-balanced-teams.ts     # Flow de balanceo de equipos
│       ├── suggest-player-improvements.ts # Flow de sugerencias
│       ├── get-match-day-forecast.ts      # Flow de pronóstico del clima
│       └── ... (otros flows)
│
├── lib/
│   └── actions.ts                         # Server Actions que llaman a flows
│
└── components/
    ├── coach-chat-dialog.tsx              # UI del chat
    └── player-insights-panel.tsx          # UI de insights
```

### 3.2. Flujo de Datos

```
┌────────────────────────────────────────────────────────────────┐
│                      ARQUITECTURA DE IA                        │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Frontend (React)                                              │
│  ┌────────────────────────────────────────────────┐           │
│  │  CoachChatDialog / PlayerInsightsPanel         │           │
│  │  - Estado local (messages, insights)           │           │
│  │  - UI con loading states                       │           │
│  └────────────────┬───────────────────────────────┘           │
│                   │                                            │
│                   │ llama a Server Action                      │
│                   ▼                                            │
│  ┌────────────────────────────────────────────────┐           │
│  │  Server Action (actions.ts)                    │           │
│  │  - coachConversationAction()                   │           │
│  │  - detectPlayerPatternsAction()                │           │
│  │  - Fetch datos de Firestore (Admin SDK)        │           │
│  │  - Prepara input para flow                     │           │
│  └────────────────┬───────────────────────────────┘           │
│                   │                                            │
│                   │ llama a Genkit Flow                        │
│                   ▼                                            │
│  ┌────────────────────────────────────────────────┐           │
│  │  Genkit Flow (flows/*.ts)                      │           │
│  │  - coachConversationFlow                       │           │
│  │  - detectPlayerPatternsFlow                    │           │
│  │  - Define prompt con variables                 │           │
│  │  - Define schemas con Zod                      │           │
│  └────────────────┬───────────────────────────────┘           │
│                   │                                            │
│                   │ llama a Google AI                          │
│                   ▼                                            │
│  ┌────────────────────────────────────────────────┐           │
│  │  Google AI (Gemini 2.5 Flash)                  │           │
│  │  - Procesa el prompt                           │           │
│  │  - Genera respuesta estructurada               │           │
│  │  - Valida contra output schema                 │           │
│  └────────────────┬───────────────────────────────┘           │
│                   │                                            │
│                   │ retorna                                    │
│                   ▼                                            │
│  Frontend recibe resultado y actualiza UI                     │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## 4. COACH CHAT - IMPLEMENTACIÓN COMPLETA

### 4.1. Configuración Inicial (genkit.ts)

**Ubicación:** `src/ai/genkit.ts`

```typescript
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

// ⚙️ Configuración de Genkit
export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: process.env.GOOGLE_GENAI_API_KEY!, // tu API key de Google AI Studio
    }),
  ],
});
```

**Explicación:**
- Importamos `genkit` y el plugin de Google AI
- Inicializamos con la API key del `.env`
- Exportamos `ai` para usarlo en todos los flows

---

### 4.2. Flow del Coach Chat (coach-conversation.ts)

**Ubicación:** `src/ai/flows/coach-conversation.ts`

#### 4.2.1. Schemas de Input y Output

```typescript
'use server';

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

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
```

**Explicación de schemas:**
- **Input**: Requiere el mensaje del usuario, opcionalmente el historial, y SIEMPRE el contexto del jugador
- **Output**: Devuelve la respuesta, acciones sugeridas opcionales, y el mood/tono usado
- Todos los campos tienen `.describe()` para que la IA entienda qué es cada campo

#### 4.2.2. Prompt Template

```typescript
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
```

**Explicación del prompt:**

1. **System Message**: Define el rol del modelo (DT profesional, español rioplatense)
2. **Variables Handlebars**:
   - `{{playerContext.playerName}}`: Se reemplaza con el nombre real
   - `{{#if ...}}`: Condicionales para mostrar datos opcionales
   - `{{#each ...}}`: Itera sobre el historial de conversación
3. **Contexto del Jugador**: Toda la info relevante (stats, tags, fortalezas/debilidades)
4. **Historial**: Mantiene contexto de mensajes anteriores
5. **Instrucciones Claras**: 8 reglas específicas sobre cómo responder
6. **Tono Adaptativo**: Define cuándo usar cada mood

#### 4.2.3. Flow Definition

```typescript
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
```

**Explicación:**
- `ai.defineFlow()`: Define un flow reutilizable
- `inputSchema` y `outputSchema`: Validación automática
- `prompt(input, {model: ...})`: Ejecuta el prompt con el modelo especificado
- `gemini-2.5-flash`: Modelo rápido y económico (también hay `gemini-2.5-pro`)

---

### 4.3. Server Action del Coach Chat

**Ubicación:** `src/lib/actions.ts` (líneas 241-285)

```typescript
'use server';

import { adminDb } from '@/firebase/admin';
import { coachConversation, type CoachConversationInput } from '@/ai/flows/coach-conversation';
import type { Player, Evaluation } from '@/lib/types';

export async function coachConversationAction(
  playerId: string,
  groupId: string,
  userMessage: string,
  conversationHistory?: CoachConversationInput['conversationHistory']
) {
  try {
    // 1. Obtener datos del jugador desde Firestore
    const playerDocRef = adminDb.doc(`players/${playerId}`);
    const playerDocSnap = await playerDocRef.get();

    if (!playerDocSnap.exists) {
      return { error: 'No se pudo encontrar al jugador.' };
    }

    const player = playerDocSnap.data() as Player;

    // 2. Obtener evaluaciones del jugador
    const evaluations = await getPlayerEvaluationsAction(playerId, groupId);

    // 3. Extraer tags recientes (últimos 10)
    const recentTags = evaluations
      .flatMap(e => e.performanceTags?.map(t => t.name) || [])
      .slice(0, 10);

    // 4. Identificar fortalezas (tags con efectos positivos)
    const positiveTags = evaluations
      .flatMap(e => e.performanceTags?.filter(t => t.effects.some(ef => ef.change > 0)).map(t => t.name) || []);

    // 5. Identificar debilidades (tags con efectos negativos)
    const negativeTags = evaluations
      .flatMap(e => e.performanceTags?.filter(t => t.effects.some(ef => ef.change < 0)).map(t => t.name) || []);

    // 6. Construir input para el flow
    const input: CoachConversationInput = {
      userMessage,
      conversationHistory: conversationHistory || [],
      playerContext: {
        playerId: playerId,
        playerName: player.name,
        position: player.position,
        ovr: player.ovr,
        stats: {
          matchesPlayed: player.stats.matchesPlayed,
          goals: player.stats.goals,
          assists: player.stats.assists,
          averageRating: player.stats.averageRating,
        },
        recentTags: recentTags.length > 0 ? recentTags : undefined,
        strengths: positiveTags.length > 0 ? positiveTags : undefined,
        weaknesses: negativeTags.length > 0 ? negativeTags : undefined,
      },
    };

    // 7. Llamar al flow de IA
    const result = await coachConversation(input);

    return result;
  } catch (error: any) {
    console.error('Error in coach conversation:', error);
    return { error: error.message || 'Error al generar la respuesta del entrenador.' };
  }
}
```

**Flujo de la Server Action:**

1. **Fetch Player Data**: Usa Firebase Admin SDK para obtener el jugador
2. **Fetch Evaluations**: Obtiene todas las evaluaciones del jugador
3. **Extract Tags**: Filtra tags recientes, positivos y negativos
4. **Build Input**: Construye el objeto de input con toda la info
5. **Call Flow**: Llama al flow de IA
6. **Return Result**: Devuelve la respuesta estructurada

---

### 4.4. Frontend - CoachChatDialog Component

**Ubicación:** `src/components/coach-chat-dialog.tsx`

#### 4.4.1. Tipos y Estado

```typescript
'use client';

import { useState, useRef, useEffect } from 'react';
import { coachConversationAction } from '@/lib/actions';
import type { CoachConversationInput } from '@/ai/flows/coach-conversation';

type Message = {
  role: 'user' | 'coach';
  content: string;
  timestamp: string;
  mood?: 'motivational' | 'analytical' | 'supportive' | 'critical';
  suggestedActions?: string[];
};

export function CoachChatDialog({ playerId, groupId }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ... resto del componente
}
```

#### 4.4.2. Mensaje de Bienvenida

```typescript
useEffect(() => {
  if (open && messages.length === 0) {
    // Welcome message cuando se abre el chat
    const welcomeMessage: Message = {
      role: 'coach',
      content: '¡Hola! Soy tu DT virtual. ¿En qué puedo ayudarte hoy? Podés preguntarme sobre tu rendimiento, pedir consejos tácticos, o charlar sobre cómo mejorar tu juego.',
      timestamp: new Date().toISOString(),
      mood: 'supportive',
    };
    setMessages([welcomeMessage]);
  }
}, [open]);
```

#### 4.4.3. Handler para Enviar Mensajes

```typescript
const handleSend = async () => {
  if (!input.trim() || !playerId || !groupId) return;

  // 1. Agregar mensaje del usuario al estado
  const userMessage: Message = {
    role: 'user',
    content: input,
    timestamp: new Date().toISOString(),
  };
  setMessages(prev => [...prev, userMessage]);
  setInput('');
  setIsLoading(true);

  try {
    // 2. Construir historial para contexto
    const conversationHistory: CoachConversationInput['conversationHistory'] =
      messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
      }));

    // 3. Llamar a la server action
    const result = await coachConversationAction(
      playerId,
      groupId,
      input,
      conversationHistory
    );

    // 4. Manejar error
    if ('error' in result) {
      throw new Error(result.error);
    }

    // 5. Agregar respuesta del coach al estado
    const coachMessage: Message = {
      role: 'coach',
      content: result.response,
      timestamp: new Date().toISOString(),
      mood: result.mood,
      suggestedActions: result.suggestedActions,
    };
    setMessages(prev => [...prev, coachMessage]);

  } catch (error: any) {
    // 6. Mostrar error en el chat
    const errorMessage: Message = {
      role: 'coach',
      content: `Disculpá, tuve un problema procesando tu mensaje. ${error.message}`,
      timestamp: new Date().toISOString(),
      mood: 'supportive',
    };
    setMessages(prev => [...prev, errorMessage]);
  } finally {
    setIsLoading(false);
  }
};
```

#### 4.4.4. UI del Chat

```typescript
return (
  <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild>
      <Button>
        <MessageCircle /> Hablar con el DT
      </Button>
    </DialogTrigger>

    <DialogContent className="h-[600px] flex flex-col">
      <DialogHeader>
        <DialogTitle>Tu Entrenador Virtual</DialogTitle>
      </DialogHeader>

      {/* Área de mensajes */}
      <ScrollArea ref={scrollRef}>
        {messages.map((message, index) => (
          <div key={index} className={message.role === 'user' ? 'justify-end' : 'justify-start'}>
            {message.role === 'coach' && <Avatar>DT</Avatar>}

            <div className={message.role === 'user' ? 'bg-primary' : 'bg-muted'}>
              <p>{message.content}</p>

              {/* Badge del mood */}
              {message.mood && (
                <Badge>{moodLabels[message.mood]}</Badge>
              )}

              {/* Acciones sugeridas */}
              {message.suggestedActions && message.suggestedActions.length > 0 && (
                <div>
                  <p>Acciones sugeridas:</p>
                  <ul>
                    {message.suggestedActions.map((action, i) => (
                      <li key={i}>• {action}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {message.role === 'user' && <Avatar>U</Avatar>}
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div><Loader2 className="animate-spin" /></div>
        )}
      </ScrollArea>

      {/* Input de mensaje */}
      <div className="border-t p-4">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Escribí tu mensaje..."
        />
        <Button onClick={handleSend} disabled={isLoading || !input.trim()}>
          <Send />
        </Button>
      </div>
    </DialogContent>
  </Dialog>
);
```

---

## 5. PLAYER INSIGHTS - IMPLEMENTACIÓN COMPLETA

### 5.1. Flow de Detección de Patrones (detect-player-patterns.ts)

**Ubicación:** `src/ai/flows/detect-player-patterns.ts`

#### 5.1.1. Schemas

```typescript
'use server';

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// ── SCHEMA DE INPUT ──────────────────────────────────────────
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

// ── SCHEMA DE OUTPUT ─────────────────────────────────────────
const DetectPlayerPatternsOutputSchema = z.object({
  patterns: z.array(
    z.object({
      type: z.enum(['trend', 'consistency', 'volatility', 'improvement', 'decline', 'specialty'])
        .describe('Tipo de patrón detectado'),
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
```

#### 5.1.2. Prompt del Análisis

```typescript
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

export async function detectPlayerPatterns(input: DetectPlayerPatternsInput): Promise<DetectPlayerPatternsOutput> {
  return detectPlayerPatternsFlow(input);
}
```

---

### 5.2. Server Action de Player Insights

**Ubicación:** `src/lib/actions.ts` (líneas 347-400)

```typescript
'use server';

import { detectPlayerPatterns, type DetectPlayerPatternsInput } from '@/ai/flows/detect-player-patterns';

export async function detectPlayerPatternsAction(playerId: string, groupId: string) {
  try {
    // 1. Obtener datos del jugador
    const playerDocRef = adminDb.doc(`players/${playerId}`);
    const playerDocSnap = await playerDocRef.get();

    if (!playerDocSnap.exists) {
      return { error: 'No se pudo encontrar al jugador.' };
    }

    const player = playerDocSnap.data() as Player;

    // 2. Obtener evaluaciones
    const evaluations = await getPlayerEvaluationsAction(playerId, groupId);

    // 3. Obtener historial de OVR (últimas 20 entradas)
    const ovrHistorySnapshot = await adminDb
      .collection(`players/${playerId}/ovrHistory`)
      .orderBy('date', 'desc')
      .limit(20)
      .get();

    const ovrHistory = ovrHistorySnapshot.docs.map(doc => ({
      date: doc.data().date,
      oldOVR: doc.data().oldOVR,
      newOVR: doc.data().newOVR,
      change: doc.data().change,
    }));

    // 4. Preparar evaluaciones recientes (últimas 15)
    const recentEvaluations = evaluations.slice(0, 15).map(e => ({
      matchDate: e.evaluatedAt || '',
      rating: e.rating,
      performanceTags: (e.performanceTags || []).map(t => ({
        name: t.name,
        impact: t.effects.some(ef => ef.change > 0) ? 'positive' as const :
               t.effects.some(ef => ef.change < 0) ? 'negative' as const :
               'neutral' as const,
      })),
      goals: 0, // Se podría obtener de selfEvaluations
    }));

    // 5. Construir input para el flow
    const input: DetectPlayerPatternsInput = {
      playerId,
      playerName: player.name,
      position: player.position,
      currentOVR: player.ovr,
      stats: {
        matchesPlayed: player.stats.matchesPlayed,
        goals: player.stats.goals,
        assists: player.stats.assists,
        averageRating: player.stats.averageRating,
      },
      recentEvaluations,
      ovrHistory: ovrHistory.length > 0 ? ovrHistory : undefined,
    };

    // 6. Llamar al flow de IA
    const result = await detectPlayerPatterns(input);

    return result;
  } catch (error: any) {
    console.error('Error detecting player patterns:', error);
    return { error: error.message || 'No se pudo analizar el rendimiento del jugador.' };
  }
}
```

---

### 5.3. Frontend - PlayerInsightsPanel Component

**Ubicación:** `src/components/player-insights-panel.tsx` (ya lo leímos antes)

#### 5.3.1. Lógica Principal

```typescript
export function PlayerInsightsPanel({ playerId, playerName, groupId }: Props) {
  const [insights, setInsights] = useState<DetectPlayerPatternsOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await detectPlayerPatternsAction(playerId, groupId);

      if ('error' in result) {
        setError(result.error);
      } else {
        setInsights(result);
      }
    } catch (err: any) {
      setError(err.message || 'Error al analizar el rendimiento');
    } finally {
      setIsLoading(false);
    }
  };

  // ... UI rendering
}
```

---

## 6. SERVER ACTIONS

### 6.1. Directiva 'use server'

**IMPORTANTE:** Todos los Server Actions DEBEN tener `'use server'` al inicio del archivo.

```typescript
'use server';

import { adminDb } from '@/firebase/admin';
// ... imports
```

### 6.2. Helper: getPlayerEvaluationsAction

```typescript
async function getPlayerEvaluationsAction(playerId: string, groupId: string): Promise<Evaluation[]> {
  const evaluationsSnapshot = await adminDb
    .collection('evaluations')
    .where('playerId', '==', playerId)
    .orderBy('evaluatedAt', 'desc')
    .get();

  return evaluationsSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as Evaluation));
}
```

---

## 7. INTEGRACIÓN FRONTEND

### 7.1. Dónde Usar el Coach Chat

**Ubicación:** `src/app/players/[id]/page.tsx` o `src/components/player-profile-view.tsx`

```typescript
import { CoachChatDialog } from '@/components/coach-chat-dialog';

export default function PlayerProfile({ playerId }) {
  const { user } = useUser();

  return (
    <div>
      {/* Botón flotante */}
      {user?.uid === playerId && (
        <div className="fixed bottom-6 right-6 z-30">
          <CoachChatDialog
            playerId={playerId}
            groupId={user.activeGroupId}
          />
        </div>
      )}
    </div>
  );
}
```

### 7.2. Dónde Usar Player Insights

```typescript
import { PlayerInsightsPanel } from '@/components/player-insights-panel';

export default function PlayerProfile({ playerId, playerName }) {
  const { user } = useUser();

  return (
    <div>
      {user?.uid === playerId && (
        <PlayerInsightsPanel
          playerId={playerId}
          playerName={playerName}
          groupId={user.activeGroupId}
        />
      )}
    </div>
  );
}
```

---

## 8. GUÍA DE REPLICACIÓN PARA GEMINI

### 8.1. Paso a Paso para Implementar en Firestudio

#### Paso 1: Instalar Dependencias

```bash
npm install genkit @genkit-ai/google-genai
npm install -D genkit-cli
```

#### Paso 2: Configurar Genkit

Crear `src/ai/genkit.ts`:

```typescript
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: process.env.GOOGLE_GENAI_API_KEY!,
    }),
  ],
});
```

#### Paso 3: Crear el Flow del Coach Chat

Crear `src/ai/flows/coach-conversation.ts` con el código completo de la sección 4.2.

#### Paso 4: Crear la Server Action

En `src/lib/actions.ts`, agregar:

```typescript
'use server';

import { coachConversation, type CoachConversationInput } from '@/ai/flows/coach-conversation';

export async function coachConversationAction(...) {
  // Código completo de la sección 4.3
}
```

#### Paso 5: Crear el Componente Frontend

Crear `src/components/coach-chat-dialog.tsx` con el código de la sección 4.4.

#### Paso 6: Testing con Genkit UI

```bash
npm run genkit:dev
```

Abrir http://localhost:4000 para probar el flow directamente.

---

### 8.2. Diferencias con Gemini en Firestudio

Si estás usando **Gemini en Firestudio** en lugar de Genkit:

#### Opción A: API Directa de Gemini

```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENAI_API_KEY);

export async function coachConversationAction(...) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `Sos un DT de fútbol profesional...

  JUGADOR: ${player.name}
  OVR: ${player.ovr}
  ...

  MENSAJE: ${userMessage}
  `;

  const result = await model.generateContent(prompt);
  const response = result.response.text();

  // Parse JSON response
  return JSON.parse(response);
}
```

**Pros:**
- Menos dependencias
- Más control directo

**Cons:**
- Sin validación automática de schemas
- Sin UI de desarrollo
- Más código boilerplate

#### Opción B: Usar Genkit (Recomendado)

Mantener la arquitectura actual con Genkit es mejor porque:
- ✅ Type-safe
- ✅ Validación automática
- ✅ UI de testing
- ✅ Fácil migración de modelos
- ✅ Mejor debugging

---

## 9. TESTING Y DEBUGGING

### 9.1. Genkit UI

Iniciar el servidor de desarrollo:

```bash
npm run genkit:dev
```

Abrir http://localhost:4000

**UI Features:**
- Lista de flows disponibles
- Input editor con validación de schema
- Ejecutar flows manualmente
- Ver output estructurado
- Historial de ejecuciones

### 9.2. Testing del Coach Chat

1. Ir a http://localhost:4000
2. Seleccionar "coachConversationFlow"
3. Pegar JSON de ejemplo:

```json
{
  "userMessage": "¿Cómo puedo mejorar mi definición?",
  "conversationHistory": [],
  "playerContext": {
    "playerId": "test123",
    "playerName": "Juan Pérez",
    "position": "DEL",
    "ovr": 75,
    "stats": {
      "matchesPlayed": 10,
      "goals": 8,
      "assists": 3,
      "averageRating": 7.5
    },
    "recentTags": ["Goleador Nato", "Buena Definición"],
    "strengths": ["Definición", "Posicionamiento"],
    "weaknesses": ["Pase largo", "Juego aéreo"]
  }
}
```

4. Click en "Run"
5. Ver output:

```json
{
  "response": "Mirá Juan, tenés muy buen promedio goleador (8 goles en 10 partidos es un golazo). Para seguir mejorando tu definición, te recomiendo:\n\n1. Practicá finalizaciones desde distintos ángulos\n2. Trabajá la definición con ambas piernas\n3. Ejercicios de velocidad mental (tomar decisiones rápidas frente al arco)",
  "suggestedActions": [
    "Hacer 50 tiros al arco por día, alternando piernas",
    "Ver videos de Haaland finalizando en distintas posiciones",
    "Practicar definiciones con presión defensiva"
  ],
  "mood": "motivational"
}
```

### 9.3. Debugging Common Issues

#### Error: "GOOGLE_GENAI_API_KEY is not defined"

**Solución:**
- Verificar que `.env.local` existe
- Verificar que la key está correcta
- Reiniciar el servidor de desarrollo

#### Error: "Schema validation failed"

**Solución:**
- Revisar que el output del modelo matchea el schema
- Agregar más detalles en el prompt sobre el formato JSON esperado
- Usar `z.optional()` para campos que pueden no existir

#### Error: "Model rate limit exceeded"

**Solución:**
- Esperar 1 minuto
- Usar `gemini-2.5-flash` en lugar de `gemini-2.5-pro` (más económico)
- Implementar retry logic:

```typescript
async function retryWithBackoff<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries === 0) throw error;
    await new Promise(resolve => setTimeout(resolve, 1000 * (4 - retries)));
    return retryWithBackoff(fn, retries - 1);
  }
}
```

---

## 10. OPTIMIZACIONES Y MEJORES PRÁCTICAS

### 10.1. Caching de Contexto

Evitar fetch repetidos del mismo jugador:

```typescript
// En el componente frontend
const [playerContext, setPlayerContext] = useState<PlayerContext | null>(null);

useEffect(() => {
  async function fetchContext() {
    // Fetch solo una vez
    const context = await getPlayerContextAction(playerId);
    setPlayerContext(context);
  }
  fetchContext();
}, [playerId]);

// Luego usar playerContext en lugar de fetch en cada mensaje
```

### 10.2. Streaming Responses

Para respuestas largas, usar streaming:

```typescript
// En el flow
const coachConversationStreamingFlow = ai.defineStreamingFlow(
  {
    name: 'coachConversationStreamingFlow',
    inputSchema: CoachConversationInputSchema,
    outputSchema: CoachConversationOutputSchema,
    streamSchema: z.string(),
  },
  async (input, streamingCallback) => {
    const chunks = [];

    // Llamar al modelo con streaming
    const result = await prompt(input, {
      model: 'googleai/gemini-2.5-flash',
      streamingCallback: (chunk) => {
        streamingCallback(chunk.text);
        chunks.push(chunk.text);
      }
    });

    return result.output!;
  }
);

// En el frontend
const handleSendStreaming = async () => {
  const stream = await coachConversationStreamingAction(...);

  for await (const chunk of stream) {
    setCurrentMessage(prev => prev + chunk);
  }
};
```

### 10.3. Rate Limiting

Implementar rate limiting para evitar abuso:

```typescript
// En server action
const userMessageCounts = new Map<string, { count: number; resetAt: number }>();

export async function coachConversationAction(playerId: string, ...) {
  const now = Date.now();
  const userLimit = userMessageCounts.get(playerId);

  if (userLimit) {
    if (now < userLimit.resetAt) {
      if (userLimit.count >= 20) {
        return { error: 'Has alcanzado el límite de 20 mensajes por hora.' };
      }
      userLimit.count++;
    } else {
      userMessageCounts.set(playerId, { count: 1, resetAt: now + 3600000 });
    }
  } else {
    userMessageCounts.set(playerId, { count: 1, resetAt: now + 3600000 });
  }

  // ... resto del código
}
```

### 10.4. Prompts Optimizados

**DO:**
- ✅ Ser específico sobre el formato de output
- ✅ Proveer ejemplos en el prompt
- ✅ Usar condicionales para datos opcionales
- ✅ Limitar el tamaño de los inputs (últimos 15 partidos, no todos)

**DON'T:**
- ❌ Prompts muy largos (> 8000 tokens)
- ❌ Datos redundantes
- ❌ Instrucciones contradictorias

### 10.5. Monitoreo y Analytics

Agregar logging para tracking:

```typescript
export async function coachConversationAction(...) {
  const startTime = Date.now();

  try {
    const result = await coachConversation(input);

    // Log success
    console.log('[AI] Coach conversation success', {
      playerId,
      responseTime: Date.now() - startTime,
      mood: result.mood,
    });

    return result;
  } catch (error) {
    // Log error
    console.error('[AI] Coach conversation failed', {
      playerId,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    throw error;
  }
}
```

---

## RESUMEN EJECUTIVO

### Componentes Clave

| Componente | Ubicación | Propósito |
|------------|-----------|-----------|
| `genkit.ts` | `src/ai/genkit.ts` | Configuración de Genkit |
| `coach-conversation.ts` | `src/ai/flows/` | Flow del chat |
| `detect-player-patterns.ts` | `src/ai/flows/` | Flow de insights |
| `actions.ts` | `src/lib/actions.ts` | Server actions |
| `CoachChatDialog` | `src/components/` | UI del chat |
| `PlayerInsightsPanel` | `src/components/` | UI de insights |

### Flujo Completo

```
Usuario escribe mensaje
    ↓
CoachChatDialog (Frontend)
    ↓
coachConversationAction (Server Action)
    ↓
Fetch player data (Firestore Admin)
    ↓
coachConversationFlow (Genkit Flow)
    ↓
Gemini 2.5 Flash (Google AI)
    ↓
Respuesta estructurada (JSON)
    ↓
UI actualizada
```

### Métricas de Rendimiento

- **Latencia promedio**: 1-3 segundos
- **Cost por mensaje**: ~$0.0001 (Gemini Flash)
- **Rate limit**: 20 mensajes/hora por usuario
- **Tamaño del contexto**: ~2000 tokens por mensaje

---

**Documento generado automáticamente por Claude Code**
**Fecha:** 23 de Octubre de 2025
