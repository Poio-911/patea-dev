# analyze-player-progression

## Propósito
Analiza el historial de OVR y evaluaciones de un jugador para generar un informe completo de su trayectoria, identificando tendencias positivas y áreas de mejora.

## Modelo AI
- **Modelo**: `googleai/gemini-2.5-flash`
- **Rol**: Analista de datos deportivos profesional

## Input Schema
```typescript
{
  playerName: string;
  ovrHistory: Array<{
    date: string;
    newOVR: number;
    change: number;
  }>;
  recentEvaluations: Array<{
    matchDate: string;
    rating?: number;
    performanceTags?: string[];
  }>;
}
```

## Output Schema
```typescript
{
  summary: string;  // Resumen general de la trayectoria
  positiveTrends: string[];  // 2-3 patrones positivos
  areasForImprovement: string[];  // 2-3 áreas de mejora
}
```

## Usado En
- PlayerProgressionView - Botón "Analizar Progresión"
- `analyzePlayerProgressionAction(playerId, groupId)`

## Ejemplo
**Input**: Jugador con OVR subiendo de 72 a 76 en 10 partidos
**Output**:
```javascript
{
  summary: "Juan está en clara tendencia ascendente, pasando de 72 a 76 en sus últimos 10 partidos.",
  positiveTrends: [
    "Mejora notable en definición (+4 puntos en SHO)",
    "Consistencia en ratings (7.5-8.5 en últimos 5 partidos)"
  ],
  areasForImprovement: [
    "Trabajar resistencia física (tags 'Se Cansó' en 3 partidos)",
    "Mejorar precisión de pase bajo presión"
  ]
}
```
