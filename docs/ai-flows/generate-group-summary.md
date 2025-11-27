# generate-group-summary

## Propósito
Genera un resumen descriptivo y atractivo de un grupo basado en sus jugadores, estadísticas y actividad.

## Modelo AI
- **Modelo**: `googleai/gemini-2.5-flash`

## Input Schema
```typescript
{
  groupName: string;
  memberCount: number;
  topPlayers: Array<{name, ovr, position}>;
  totalMatches: number;
  groupStats: {
    totalGoals: number;
    averageOVR: number;
  };
}
```

## Output Schema
```typescript
{
  summary: string;  // Párrafo descriptivo del grupo
}
```

## Usado En
- Group Detail View - Header description
- Dashboard - Descripción del grupo activo  
- `generateGroupSummaryAction(groupId)`

## Ejemplo
```javascript
{
  summary: "Un grupo competitivo con 24 miembros activos y un OVR promedio de 74. Destacan Juan (DEL, 82) y Pedro (MED, 79). Han jugado 45 partidos con más de 180 goles anotados. ¡Un grupo con mucha actividad y nivel parejo!"
}
```

## Actualización
- Se genera automáticamente al crear grupo
- Se puede regenerar manualmente
- Recomendado actualizar semanalmente
