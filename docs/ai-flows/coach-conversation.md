# coach-conversation

## Propósito

Proporciona un chat conversacional con un "DT virtual" que da consejos personalizados sobre rendimiento, estrategia y mejoras basándose en el contexto completo del jugador.

##Modelo AI

- **Modelo**: `googleai/gemini-2.5-flash`
- **Tono**: DT profesional, directo, motivador, personal
- **Idioma**: Español rioplatense
- **Contexto**: Mantiene historial de conversación

## Input Schema

```typescript
{
  userMessage: string;  // Mensaje/pregunta del usuario
  
  conversationHistory?: Array<{
    role: 'user' | 'coach';
    content: string;
    timestamp?: string;
  }>;
  
  playerContext: {
    playerId: string;
    playerName: string;
    position: 'DEL' | 'MED' | 'DEF' | 'POR';
    ovr: number;
    stats: {
      matchesPlayed: number;
      goals: number;
      assists: number;
      averageRating: number;
    };
    recentTags?: string[];      // Tags de rendimiento recientes
    strengths?: string[];        // Fortalezas identificadas
    weaknesses?: string[];       // Debilidades identificadas
  };
}
```

## Output Schema

```typescript
{
  response: string;  // Respuesta del DT
  
  suggestedActions?: string[];  // Acciones sugeridas (opcional)
  
  mood: 'motivational' | 'analytical' | 'supportive' | 'critical';
}
```

## Estrategia de Prompt

El prompt configura al modelo como un DT que:

1. **Conoce al Jugador**: Tiene acceso a stats, tags, force/debilidades
2. **Mantiene Contexto**: Usa historial de conversación
3. **Adapta Tono**: Según la necesidad (motivar, analizar, apoyar, exigir)
4. **Da Consejos Específicos**: Basados en posición y datos reales
5. **Usa Jerga Local**: Gambeta, pique, quite, etc.

### Lógica Contextual

```
Si (userMessage contiene "rendimiento" o "cómo voy"):
  → Modo: analytical
  → Analizar stats y tags
  → Comparar con promedio de la posición

Si (userMessage contiene "mejorar" o "entrenar"):
  → Modo: supportive
  → Sugerir ejercicios específicos por posición
  → Dar acciones concretas

Si (tags recientes son negativos):
  → Modo: motivational o critical (según contexto)
  → Levantar ánimo o dar empujón constructivo

Si (stats son buenas):
  → Modo: motivational
  → Felicitar y mantener humildad
```

## Ejemplos de Uso

### Ejemplo 1: Jugador pide análisis

**Input:**
```javascript
{
  userMessage: "¿Cómo vengo jugando últimamente?",
  conversationHistory: [],
  playerContext: {
    playerId: "abc123",
    playerName: "Juan",
    position: "DEL",
    ovr: 76,
    stats: {
      matchesPlayed: 12,
      goals: 8,
      assists: 3,
      averageRating: 7.5
    },
    recentTags: ["La Colgó del Ángulo", "Buen Movimiento", "La Tiró al córner"],
    strengths: ["Velocidad", "Definición"],
    weaknesses: ["Pase"]
  }
}
```

**Output:**
```javascript
{
  response: "Juan, estás teniendo una muy buena racha. 8 goles en 12 partidos es un promedio excelente para un delantero, y tu rating de 7.5 lo confirma. \n\nVeo que tenés buena definición ('La Colgó del Ángulo'), pero también estás fallando algunas claras ('La Tiró al córner'). Tu velocidad y movimiento son tus puntos fuertes, usálos para generar espacios. \n\nLo único que te falta pulir es la distribución cuando te toca participar en la creación. Seguí así.",
  suggestedActions: [
    "Practicá pases cortos después de recibir para mejorar tu asociación con el mediocampo",
    "Seguí buscando el arco, tu instinto goleador es tu mejor arma"
  ],
  mood: "analytical"
}
```

### Ejemplo 2: Jugador busca motivación

**Input:**
```javascript
{
  userMessage: "Estoy jugando mal, no sé qué hacer",
  conversationHistory: [],
  playerContext: {
    playerName: "Pedro",
    position: "MED",
    ovr: 72,
    stats: {
      matchesPlayed: 5,
      goals: 0,
      assists: 1,
      averageRating: 6.2
    },
    recentTags: ["Pase al Rival", "Se Cansó", "Participó poco"],
    weaknesses: ["Resistencia", "Precisión de pase"]
  }
}
```

**Output:**
```javascript
{
  response: "Pedro, calma. Estás en un bajón pero no es el fin del mundo. Todos pasamos por rachas flojas. \n\nVeo que tu mayor problema ahora es la resistencia ('Se Cansó') y la precisión ('Pase al Rival'). Como mediocampista, son cosas que podés mejorar rápido con trabajo. \n\nNo te desanimes. Tenés solo 5 partidos, necesitás más rodaje para entrar en ritmo. Enfocateen  llegar bien físicamente a los partidos y en tomar mejores decisiones con la pelota. El resto va a venir solo.",
  suggestedActions: [
    "Trabajá tu cardio entre partidos para aguantar los 90 minutos",
    "Antes de pasar, mirá dos veces. No apures la jugada."
  ],
  mood: "supportive"
}
```

### Ejemplo 3: Conversación con historial

**Input:**
```javascript
{
  userMessage: "¿Y qué ejercicios me recomendás para mejorar el físico?",
  conversationHistory: [
    { role: "user", content: "Estoy jugando mal, no sé qué hacer" },
    { role: "coach", content: "Pedro, calma. Estás en un bajón pero..." }
  ],
  playerContext: { /* ... */ }
}
```

**Output:**
```javascript
{
  response: "Para mejorar tu resistencia como mediocampista, probá con esto:\n\n1. Trotar 20-30 minutos, 3 veces por semana a ritmo constante.\n2. Hacer cambios de ritmo (sprints cortos + trote) para simular el partido.\n3. Si tenés Google Fit conectado, andá subiendo de a poco la distancia semanal. \n\nNo hace falta matarte, pero la constancia es clave. En 2-3 semanas vas a notar la diferencia.",
  suggestedActions: [
    "Empezá con 20 minutos de trote continuo",
    "Hacé 10 sprints de 50m con descanso de 1 minuto entre cada uno"
  ],
  mood: "supportive"
}
```

## Integración en la Aplicación

### Dónde se usa

1. **Coach Chat View** (`coach-chat-view.tsx`)
   - Vista dedicada al chat con el DT virtual
   - Accesible desde perfil del jugador o dashboard
   - Historial de conversación persistente en Firestore

### Flujo de Usuario

1. Usuario navega a "Hablar con el DT"
2. Se carga historial de conversación previo
3. Usuario escribe mensaje
4. Click "Enviar"
5. Server action llama al flow con contexto del jugador
6. Se muestra respuesta del DT
7. Se guarda en historial

### Server Action

```typescript
export async function coachConversationAction(
  userId: string,
  playerId: string,
  userMessage: string,
  conversationHistory?: ConversationMessage[]
): Promise<CoachConversationOutput> {
  
  // 1. Obtener datos del jugador
  const player = await getPlayerData(playerId);
  const stats = player.stats;
  
  // 2. Obtener tags recientes (últimos 3 partidos)
  const recentEvals = await getRecentEvaluations(playerId, 3);
  const recentTags = recentEvals.flatMap(e => e.performanceTags);
  
  // 3. Obtener fortalezas/debilidades (de análisis previo si existe)
  const patterns = await getPlayerPatterns(playerId);
  const strengths = patterns?.strengths || [];
  const weaknesses = patterns?.weaknesses || [];
  
  // 4. Llamar al AI flow
  const result = await coachConversation({
    userMessage,
    conversationHistory: conversationHistory || [],
    playerContext: {
      playerId: player.id,
      playerName: player.name,
      position: player.position,
      ovr: player.ovr,
      stats,
      recentTags,
      strengths,
      weaknesses
    }
  });
  
  // 5. Guardar en historial
  await saveConversationMessage(userId, playerId, {
    role: 'user',
    content: userMessage,
    timestamp: new Date().toISOString()
  });
  
  await saveConversationMessage(userId, playerId, {
    role: 'coach',
    content: result.response,
    timestamp: new Date().toISOString()
  });
  
  return result;
}
```

## Manejo de Errores

```typescript
try {
  const result = await coachConversation(input);
  return result;
} catch (error) {
  // Fallback response si falla la IA
  return {
    response: "Disculpá, tuve un problema técnico. Intentá de nuevo en un momento.",
    mood: "supportive"
  };
}
```

## Persistencia del Historial

### Firestore Structure
```
users/{userId}/coachConversations/{playerId}/messages/{messageId}
{
  role: 'user' | 'coach',
  content: string,
  timestamp: string,
  mood?: string  // Solo para mensajes del coach
}
```

### Límite de Historial
- Se mandan los últimos 10 mensajes al prompt
- Historial completo se guarda en Firestore
- Usuario puede "limpiar conversación" (borrar historial)

## Características Especiales

### Mood Adaptativo
El "mood" del coach cambia según:
- Contenido del mensaje del usuario
- Stats recientes del jugador
- Tags de rendimiento
- Tono de mensajes previos

### Acciones Sugeridas
El coach puede sugerir acciones concretas como:
- Ejercicios específicos
- Áreas de enfoque
- Cambios tácticos
- Mentalidad a adoptar

### Vocabulario Futbolístico
El prompt incluye jerga argentina:
- Gambeta, pique, quite, marca
- "Colgar del ángulo", "tirarla a las nubes"
- "Tractorcito", "muralla"

## Métricas

- **Tiempo de respuesta**: 2-4 segundos (más largo por contexto)
- **Tokens promedio**: 800-1200
- **Satisfacción**: Alta (feedback cualitativo)

## Casos de Uso Comunes

1. **Análisis de Rendimiento**: "¿Cómo vengo jugando?"
2. **Consejos Tácticos**: "¿Qué hago cuandoestoy marcado?"
3. **Motivación**: "Estoy en un bajón"
4. **Ejercicios**: "¿Cómo mejoro mi [atributo]?"
5. **Comparación**: "¿Soy bueno para mi posición?"

## Limitaciones

- No reemplaza coaching personalizado real
- Basado en datos limitados (stats + tags)
- No puede ver videos ni analizar jugadas específicas
- Consejos genéricos adaptados al contexto

## Mejoras Futuras

- [ ] Integrar análisis de video (si hay grabaciones)
- [ ] Comparar con jugadores profesionales de misma posición
- [ ] Sugerir ejercicios con links/videos
- [ ] Modo "Plan de Entrenamiento" (4 semanas)
- [ ] Integrar datos de Google Fit si están disponibles
- [ ] Voice input/output (speech-to-text)
