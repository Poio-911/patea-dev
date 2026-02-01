# suggest-player-improvements

## Propósito

Analiza el rendimiento histórico de un jugador y genera 2-3 consejos concisos y accionables para mejorar su juego, basándose en estadísticas y evaluaciones recientes.

## Modelo AI

- **Modelo**: `googleai/gemini-2.5-flash`
- **Tono**: DT profesional, directo y motivador
- **Idioma**: Español rioplatense

## Input Schema

```typescript
{
  playerId: string;              // ID del jugador
  playerStats: {
    matchesPlayed: number;       // Total de partidos jugados
    goals: number;               // Total de goles
    assists: number;             // Total de asistencias
    averageRating: number;       // Calificación promedio (1-10)
  };
  evaluations: Array<{
    rating: number;              // Calificación del partido (1-10)
    performanceTags: string[];   // Tags recibidos (ej: "Gambeta Mortal")
    evaluatedBy: string;         // UID del evaluador
    evaluatedAt: string;         // ISO timestamp
    matchId: string;             // ID del partido
  }>;
}
```

## Output Schema

```typescript
{
  suggestions: string[];  // Array de 2-3 sugerencias concretas
}
```

## Estrategia de Prompt

**Enfoque**: Análisis basado en datos con recomendaciones accionables

1. **Análisis de Stats**: Identifica tendencias en estadísticas
2. **Análisis de Tags**: Busca patrones en evaluaciones
3. **Consejos Específicos**: No genéricos, sino basados en datos reales
4. **Validación de Datos**: Si hay menos de 2 evaluaciones, sugiere jugar más

### Lógica del Prompt

```
Si (evaluaciones < 2):
  → Sugerir jugar más partidos para mejor análisis

Si (muchos tags negativos recurrentes):
  → Enfocar en mejorar esa área específica

Si (stats bajas en posición específica):
  → Sugerir ejercicios posicionales
```

## Ejemplos de Uso

### Ejemplo 1: Jugador con pocos datos

**Input:**
```javascript
{
  playerId: "abc123",
  playerStats: {
    matchesPlayed: 1,
    goals: 0,
    assists: 0,
    averageRating: 6.5
  },
  evaluations: [
    {
      rating: 6.5,
      performanceTags: ["Buen Posicionamiento"],
      evaluatedBy: "user1",
      evaluatedAt: "2025-01-15T10:00:00Z",
      matchId: "match1"
    }
  ]
}
```

**Output:**
```javascript
{
  suggestions: [
    "Jugá más partidos para que pueda hacerte un análisis más completo de tu rendimiento.",
    "Tu posicionamiento es bueno, ahora enfocate en participar más en el ataque.",
    "Buscá oportunidades para generar asistencias, tu posición lo permite."
  ]
}
```

### Ejemplo 2: Delantero con problemas de definición

**Input:**
```javascript
{
  playerId: "def456",
  playerStats: {
    matchesPlayed: 8,
    goals: 2,
    assists: 3,
    averageRating: 7.2
  },
  evaluations: [
    { rating: 7, performanceTags: ["La Tiró al córner", "Buen Movimiento"] },
    { rating: 7, performanceTags: ["Le Erró al Arco", "Velocidad"] },
    { rating: 8, performanceTags: ["La Colgó del Ángulo"] },
    { rating: 6, performanceTags: ["La Tiró a las nubes"] },
    // ...más evaluaciones
  ]
}
```

**Output:**
```javascript
{
  suggestions: [
    "Tenés muy buen movimiento y velocidad, pero estás fallando muchas ocasiones claras. Practicá definición en entrenamientos.",
    "Cuando te llega la pelota en el área, tomáte un segundo más para acomodarla antes de tirar. Tenés la calidad, falta calma.",
    "Seguí buscando el arco. Ya demostraste que podés anotar, solo necesitás más confianza en el último toque."
  ]
}
```

## Integración en la Aplicación

### Dónde se usa

1. **Player Insights Panel** (`player-insights-panel.tsx`)
   - Sección "Sugerencias de Mejora"
   - Se carga automáticamente al abrir el panel

2. **AI Suggestion Dialog** (`ai-suggestion-dialog.tsx`)
   - Dialog dedicado a sugerencias de IA
   - Incluye botón de "Generar nuevas sugerencias"

3. **Player Profile View** (`player-profile-view.tsx`)
   - Tab de "Insights"

### Server Action

```typescript
// server-actions.ts
export async function getPlayerImprovementSuggestionsAction(
  playerId: string,
  groupId: string
) {
  // 1. Obtener stats del jugador
  const playerStats = await getPlayerStats(playerId);
  
  // 2. Obtener evaluaciones recientes (últimas 10)
  const evaluations = await getRecentEvaluations(playerId, 10);
  
  // 3. Llamar al AI flow
  const result = await suggestPlayerImprovements({
    playerId,
    playerStats,
    evaluations
  });
  
  return result.suggestions;
}
```

## Manejo de Errores

```typescript
try {
  const result = await suggestPlayerImprovements(input);
  return result;
} catch (error) {
  if (error.message.includes('rate limit')) {
    return { error: 'Demasiadas solicitudes. Intentá de nuevo en un minuto.' };
  }
  return { error: 'No pude generar sugerencias en este momento.' };
}
```

## Casos Especiales

### Jugador sin evaluaciones
```javascript
// Output especial
{
  suggestions: [
    "Necesito que juegues algunos partidos para poder analizarte bien.",
    "Una vez que tengas al menos 3-4 evaluaciones, voy a poder darte consejos más específicos."
  ]
}
```

### Jugador con rendimiento consistente
```javascript
{
  suggestions: [
    "Estás manteniendo un nivel muy parejo. Para seguir creciendo, enfocate en mejorar tu [atributo más bajo].",
    "Tu consistencia es tu fuerte. Ahora buscá momentos para destacarte y generar jugadas decisivas.",
    "Sos confiable, y eso es clave. El próximo paso es ampliar tu repertorio técnico."
  ]
}
```

## Métricas

- **Tiempo de respuesta**: 1-2 segundos
- **Tokens promedio**: ~500-800
- **Tasa de satisfacción**: Alta (feedback cualitativo)

## Consideraciones

- Las sugerencias son genéricas pero personalizadas
- No reemplazan evaluación humana profesional
- Útil como guía complementaria
- Funciona mejor con 5+ evaluaciones

## Mejoras Futuras

- [ ] Considerar posición del jugador para consejos más específicos
- [ ] Analizar evolución de OVR junto con evaluaciones
- [ ] Sugerir ejercicios específicos con videos/enlaces
- [ ] Comparar con jugadores similares
- [ ] Integrar datos de Google Fit si están disponibles
