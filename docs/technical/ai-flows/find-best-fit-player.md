# find-best-fit-player

## Propósito
Encuentra y recomienda los mejores jugadores disponibles para completar un partido incompleto, considerando posiciones faltantes y balance de OVR.

## Modelo AI
- **Modelo**: `googleai/gemini-2.5-flash`
- **Rol**: Director deportivo experto en fichajes

## Input Schema
```typescript
{
  match: {
    id: string;
    title: string;
    matchSize: number;
    players: Array<{uid, displayName, ovr, position}>;
  };
  availablePlayers: Array<{uid, displayName, ovr, position}>;
  spotsToFill: number;  // Calculado automáticamente
}
```

## Output Schema
```typescript
{
  recommendations: Array<{
    playerId: string;
    reason: string;  // Justificación en tono de manager
  }>;
}
```

## Estrategia
1. Priorizar posiciones faltantes (especialmente POR)
2. Equilibrar OVR sin desbalancear el equipo
3. Calidad sobre cantidad

## Usado En
- FindBestFitDialog - Búsqueda de jugadores para partido
- `findBestFitPlayerAction(matchId, availablePlayers)`

## Ejemplo
```javascript
// Input: Partido de 10, faltan 2 jugadores, no hay portero
// Output:
{
  recommendations: [
    {
      playerId: "abc123",
      reason: "Necesitábamos un portero urgente y este tiene buen OVR (74) sin romper el balance."
    },
    {
      playerId: "def456",
      reason: "Mediocampista sólido que va a equilibrar el medio sin desbalancear."
    }
  ]
}
```
