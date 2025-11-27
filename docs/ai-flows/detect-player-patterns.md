# detect-player-patterns

## Propósito

Analiza el historial completo de rendimiento de un jugador para detectar patrones significativos, identificar tendencias, especialidades, y proporcionar insights accionables basados en análisis de datos.

## Modelo AI

- **Modelo**: `googleai/gemini-2.5-flash`
- **Rol**: Analista de datos deportivos
- **Confianza Mínima**: 50% (requiere 3-4 partidos de evidencia)

## Input Schema

```typescript
{
  playerId: string;
  playerName: string;
  position: 'DEL' | 'MED' | 'DEF' | 'POR';
  currentOVR: number;
  
  stats: {
    matchesPlayed: number;
    goals: number;
    assists: number;
    averageRating: number;
  };
  
  recentEvaluations: Array<{
    matchDate: string;
    rating?: number;
    performanceTags: Array<{
      name: string;
      impact: 'positive' | 'negative' | 'neutral';
    }>;
    goals?: number;
  }>;
  
  ovrHistory?: Array<{
    date: string;
    oldOVR: number;
    newOVR: number;
    change: number;
  }>;
}
```

## Output Schema

```typescript
{
  patterns: Array<{
    type: 'trend' | 'consistency' | 'volatility' | 'improvement' | 'decline' | 'specialty';
    title: string;
    description: string;
    confidence: number;  // 0-100
    impact: 'positive' | 'negative' | 'neutral';
  }>;
  
  insights: {
    strongestAttribute: string;
    weakestAttribute: string;
    playingStyle: string;
    consistency: 'very_high' | 'high' | 'medium' | 'low' | 'very_low';
    trajectory: 'improving' | 'declining' | 'stable' | 'volatile';
  };
  
  recommendations: string[];
  
  standoutMoments?: Array<{
    matchDate: string;
    description: string;
  }>;
}
```

## Tipos de Patrones Detectados

### 1. **TREND** - Tendencias sostenidas
- Mejora constante en últimos 5+ partidos
- Declive progresivo
- Estabilidad a largo plazo

### 2. **CONSISTENCY** - Nivel de regularidad
- Siempre juega bien (alta consistencia)
- Muy irregular (baja consistencia)
- Dependiente del rival/contexto

### 3. **VOLATILITY** - Variación entre partidos
- Gran diferencia entre mejor y peor rendimiento
- Picos y valles frecuentes

### 4. **IMPROVEMENT** - Áreas de mejora
- Tags positivos recurrentes en área específica
- Incremento de OVR en atributo particular

### 5. **DECLINE** - Áreas de declive
- Tags negativos recurrentes
- Baja de rendimiento en atributo

### 6. **SPECIALTY** - Especialización
- Goleador nato (muchos goles)
- Asistidor (tags de pases)
- Defensivo sólido
- Físicamente dominante

## Ejemplos de Output

### Ejemplo 1: Delantero goleador consistente

```javascript
{
  patterns: [
    {
      type: "specialty",
      title: "Goleador Nato",
      description: "Has anotado en 7 de los últimos 10 partidos, con un promedio de 0.8 goles por partido. Tus tags más frecuentes son 'La Colgó del Ángulo' y 'Definición Letal'.",
      confidence: 95,
      impact: "positive"
    },
    {
      type: "consistency",
      title: "Rendimiento Estable",
      description: "Tu rating promedio se mantiene entre 7.5 y 8.5 en el 80% de los partidos. Muy poca variación.",
      confidence: 88,
      impact: "positive"
    },
    {
      type: "improvement",
      title: "Mejora en Movimiento",
      description: "Los tags 'Buen Movimiento' y 'Desmarque' aparecen con mayor frecuencia en los últimos 5 partidos comparado con los primeros 5.",
      confidence: 72,
      impact: "positive"
    }
  ],
  insights: {
    strongestAttribute: "Definición (SHO)",
    weakestAttribute: "Pase (PAS)",
    playingStyle: "Delantero clásico, orientado al gol, poco participativo en la creación",
    consistency: "very_high",
    trajectory: "improving"
  },
  recommendations: [
    "Seguí enfocándote en lo que hacés bien: moverte y definir. Tu olfato goleador es tu mejor arma.",
    "Para dar el próximo salto, trabajá en tu asociación con el mediocampo. Un par de asistencias te harían más completo.",
    "Tus números son excelentes. Mantené la hambre de gol pero no descuidés la presión defensiva."
  ],
  standoutMoments: [
    {
      matchDate: "2025-01-20",
      description: "Hat-trick + Rating 9.5. Mejor partido de la temporada."
    }
  ]
}
```

### Ejemplo 2: Mediocampista irregular

```javascript
{
  patterns: [
    {
      type: "volatility",
      title: "Gran Variabilidad de Rendimiento",
      description: "Tus ratings varían entre 5.0 y 8.5. En 3 de 10 partidos tuviste ratings excepcionales (8+), pero en 4 de 10 estuviste por debajo de 6.5.",
      confidence: 91,
      impact: "negative"
    },
    {
      type: "decline",
      title: "Pérdida de Efectividad en Pases",
      description: "El tag 'Pase al Rival' aparece en 6 de los últimos 10 partidos, incrementando en frecuencia. Tu precisión de pase ha bajado.",
      confidence: 78,
      impact: "negative"
    }
  ],
  insights: {
    strongestAttribute: "Físico (PHY)",
    weakestAttribute: "Pase (PAS)",
    playingStyle: "Mediocampista físico pero impreciso en la distribución",
    consistency: "low",
    trajectory: "declining"
  },
  recommendations: [
    "Tu problema principal es la inconsistencia. Necesitás encontrar tu nivel base y mantenerlo.",
    "Practicá pases bajo presión. Muchos de tus errores son por apurar la jugada.",
    "Aprovechá tu físico para recuperar, pero después tomáte un segundo extra para pensar el pase."
  ]
}
```

## Integración en la Aplicación

### Dónde se usa

1. **Player Insights Panel** (`player-insights-panel.tsx`)
   - Botón "Detectar Patrones"
   - Muestra resultados en secciones: Patrones, Insights, Recomendaciones

### Server Action

```typescript
export async function detectPlayerPatternsAction(
  playerId: string,
  groupId: string
) {
  // 1. Obtener jugador
  const player = await getPlayerData(playerId);
  
  // 2. Obtener evaluaciones recientes (últimos 10-15 partidos)
  const evaluations = await getRecentEvaluations(playerId, 15);
  
  // 3. Obtener historial de OVR
  const ovrHistory = await getPlayerOVRHistory(playerId);
  
  // 4. Llamar al AI flow
  const result = await detectPlayerPatterns({
    playerId: player.id,
    playerName: player.name,
    position: player.position,
    currentOVR: player.ovr,
    stats: player.stats,
    recentEvaluations: evaluations.map(e => ({
      matchDate: e.evaluatedAt,
      rating: e.rating,
      performanceTags: e.performanceTags.map(tag => ({
        name: tag,
        impact: getTagImpact(tag)
      })),
      goals: e.goals
    })),
    ovrHistory
  });
  
  return result;
}
```

## Manejo de Datos Insuficientes

Si el jugador tiene menos de 5 partidos:

```javascript
{
  patterns: [],
  insights: {
    strongestAttribute: "N/A",
    weakestAttribute: "N/A",
    playingStyle: "Datos insuficientes",
    consistency: "medium",
    trajectory: "stable"
  },
  recommendations: [
    "Necesitás jugar al menospartidos más para que pueda detectar patrones significativos.",
    "Por ahora, enfocate en sumar minutos y experiencia."
  ]
}
```

## Visualización en UI

Los patrones se muestran como tarjetas:

```tsx
{patterns.map(pattern => (
  <PatternCard
    key={pattern.title}
    type={pattern.type}
    title={pattern.title}
    description={pattern.description}
    confidence={pattern.confidence}
    impact={pattern.impact}
  />
))}
```

## Métricas

- **Tiempo de respuesta**: 2-3 segundos
- **Mínimo de datos**: 5 partidos recomendado
- **Confianza promedio**: 70-85%

## Mejoras Futuras

- [ ] Comparar patrones con jugadores similares
- [ ] Detectar patrones tácticos (juega mejor en casa, contra rivales débiles, etc.)
- [ ] Alertas proactivas cuando se detecta un patrón negativo
- [ ] Tracking de evolución de patrones a lo largo del tiempo
