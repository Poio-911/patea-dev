# Partidos - Gestión de Matches

## Descripción General
Sistema completo de creación, gestión y evaluación de partidos de fútbol amateur con 3 tipos: Manual, Colaborativo y Por Equipos.

## Rutas
- `/matches` - Calendario de partidos
- `/matches/[id]` - Detalles del partido
- `/matches/[id]/evaluate` - Evaluación post-partido

## Tipos de Partido

### 1. Manual
- Organizador selecciona todos los jugadores  
- AI genera equipos equilibrados
- Ideal para picados cerrados

### 2. Colaborativo
- Organizador crea evento
- Jugadores del grupo se suman
- Puede ser público (acepta externos)
- AI balancea cuando está completo

### 3. Por Equipos (By Teams)
- Match entre 2 equipos persistentes del grupo
- Roster predefinido
- Ideal para rivalidades/torneos

## Componentes Principales

### AddMatchDialog
- Formulario de creación
- Selector de tipo de partido
- Maps para ubicación
- Fecha/hora picker
- Selector de jugadores (según tipo)
- Pronóstico del clima (AI)

### MatchCard
- Vista compacta para lista
- Fecha, hora, ubicación
- Jugadores confirmados
- Clima (si upcoming)
- Status badge

### MatchDetailView
- Header con info completa
- Tabs: Detalles / Equipos / Evaluaciones / Crónica
- Mapa de ubicación
- Lista de jugadores
- Botones de acción (editar, finalizar, evaluar)

### PerformEvaluationView
- Interfaz de evaluación post-partido
- Rating 1-10 por jugador
- Selector de performance tags
- MVP selection
- Progreso de evaluaciones

### MatchChronicleCard
- Muestra crónica generada por IA
- Solo visible post-finalización

## Flujos de IA Integrados

### generate-balanced-teams
- Al finalizar selección de jugadores
- Genera 2 equipos balanceados

### get-match-day-forecast
- Al crear partido
- Muestra clima esperado

### generate-match-chronicle
- Después de finalizar evaluaciones
- Genera crónica periodística

## Server Actions

```typescript
createMatchAction(matchData)
updateMatchAction(matchId, updates)
deleteMatchAction(matchId)
finalizeMatchAction(matchId, finalScore)
joinMatchAction(matchId, userId)
leaveMatchAction(matchId, userId)
assignEvaluationsAction(matchId)
submitEvaluationAction(matchId, evaluations)
finalizeEvaluationsAction(matchId)  // Actualiza OVRs
```

## Modelo de Datos

### Match (Firestore: `/matches/{matchId}`)
```typescript
{
  id: string;
  title: string;
  date: string;  // ISO
  time: string;  // HH:MM
  location: MatchLocation;
  type: 'manual' | 'collaborative' | 'by_teams';
  matchSize: 10 | 14 | 22;
  players: Player[];
  teams: Team[];  // Generados por IA
  status: 'upcoming' | 'active' | 'completed' | 'evaluated';
  ownerUid: string;
  groupId: string;
  isPublic?: boolean;
  weather?: WeatherForecast;
  chronicle?: string;
  finalScore?: {team1: number, team2: number};
  goalScorers?: MatchGoalScorer[];
  cards?: MatchCard[];
}
```

## Flujo de Vida de un Partido

1. **Creación**: Organizador crea partido
2. **Llenado**: Jugadores se suman o son añadidos
3. **Balanceo**: AI genera equipos cuando está completo
4. **Juego**: Partido se marca como "active"
5. **Finalización**: Organizador ingresa resultado final
6. **Evaluación**: Jugadores evalúan compañeros
7. **Cierre**: Organizador finaliza → OVRs actualizados
8. **Crónica**: IA genera relato del partido

## Evaluación Post-Partido

### Asignación de Evaluaciones
- Cada jugador evalúa ~2 compañeros de equipo  
- Asignación aleatoria y equitativa
- No se evalúa a sí mismo

### Performance Tags
150+ tags categorizados:
- Ofensivos: "La Colgó del Ángulo", "Asistencia de Lujo"
- Defensivos: "Muralla", "Quite Limpio"  
- Técnicos: "Gambeta Mortal", "Pase Quirúrgico"
- Negativos: "La Tiró a las Nubes", "Pase al Rival"

### Impacto en Atributos
```typescript
"La Colgó del Ángulo" → +1 SHO
"Gambeta Mortal" → +1 DRI
"Pase al Rival" → -1 PAS
"Se Cansó" → -1 PHY
```

## Características Especiales

### Calendario
- Vista mensual con partidos
- Filtros por grupo/tipo
- Exportar a Google Calendar (futuro)

### Mapa de Ubicación
- Google Maps integration
- Places autocomplete
- Dirección almacenada

### Weather Forecast
- Pronóstico al crear
- Actualizado 24h antes
- Iconos weather conditions

## Navegación
- Desde Dashboard → Próximo partido
- Desde Navbar → Lista completa
- Desde Evaluations → Partidos a evaluar

## Estados

### Upcoming
- Partido no jugado aún
- Se puede editar/cancelar
- Jugadores pueden unirse/salir

### Active
- Partido en curso
- No editable
- Visible para seguimiento

### Completed
- Resultado final ingresado
- Esperando evaluaciones
- Organizador puede ver progreso

### Evaluated
- Todas las evaluaciones completadas
- OVRs actualizados
- Crónica generada
- Read-only

## Permisos

### Organizador
- Editar, eliminar
- Finalizar partido
- Finalizar evaluaciones
- Ver todas las evaluaciones

### Participante
- Ver detalles
- Evaluar compañeros asignados
- Salir si upcoming

### Espectador (grupo)
- Ver detalles si no es privado

## Optimizaciones
- Prefetch de calendario
- Lazy load de evaluaciones
- Cache de weather forecast

## Próximas Mejoras
- [ ] Live score tracking
- [ ] Video highlights upload
- [ ] Statistics dashboard
- [ ] League/Cup integration
