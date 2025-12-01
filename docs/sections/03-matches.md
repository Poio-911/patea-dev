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

## Features Adicionales

### Match Chat System

Sistema de chat en tiempo real integrado en cada partido para coordinación y comunicación entre participantes.

**Componentes:**
- **`match-chat-view.tsx`**: Vista completa del chat con historial de mensajes
- **`match-chat-sheet.tsx`**: Bottom sheet para chat rápido desde match details

**Características:**
- Chat en tiempo real con Firestore realtime listeners
- Notificaciones de nuevos mensajes
- Historial completo del partido
- Markdown support para formateo
- Menciones con @ para notificar jugadores
- Solo visible para participantes del partido

**Data Model:**
```typescript
// /matches/{matchId}/messages/{messageId}
{
  id: string;
  userId: string;
  userName: string;
  userPhoto: string;
  message: string;
  timestamp: Timestamp;
  mentions?: string[];  // Array de userIds mencionados
}
```

**Uso:**
- Coordinar horarios
- Compartir ubicación exacta
- Confirmar asistencia
- Post-partido comentarios

### Match Cost Split

Calculadora integrada para dividir costos del partido (alquiler de cancha, pelotas, etc.) equitativamente entre participantes.

**Componente:**
- **`match-cost-split.tsx`**: Calculadora con UI interactiva

**Características:**
- Input de costo total del partido
- División automática entre jugadores confirmados
- Opción de excluir organizador del pago
- Cálculo con redondeo inteligente
- Compartir resultado por WhatsApp
- Historial de costos por partido

**Cálculo:**
```typescript
const costPerPlayer = Math.ceil(totalCost / confirmedPlayers);
// Redondeo hacia arriba para evitar fracciones
```

**Data Model:**
```typescript
// Dentro de Match document
{
  cost?: {
    total: number;
    perPlayer: number;
    paidBy: string[];  // Array de userIds que pagaron
    organiz erPays: boolean;
  }
}
```

**Integración:**
- Botón "Dividir Costos" en match details
- Visible solo después de confirmar jugadores
- Organizador puede marcar quién pagó

### Match Date Voting

Sistema de votación para encontrar la mejor fecha/hora cuando no todos pueden en el horario propuesto.

**Componente:**
- **`match-date-voting.tsx`**: UI de votación con múltiples opciones de fecha

**Características:**
- Organizador propone 3-5 opciones de fecha/hora
- Participantes votan sus disponibilidades
- Visualización de votos en tiempo real
- Auto-selección de fecha con más votos
- Notificaciones cuando se define fecha final

**Data Model:**
```typescript
// Dentro de Match document
{
  dateVoting?: {
    options: Array<{
      date: string;
      time: string;
      votes: string[];  // Array de userIds
    }>;
    status: 'open' | 'closed';
    finalDate?: string;
  }
}
```

**Flujo:**
1. Organizador crea partido sin fecha definitiva
2. Propone opciones de fecha
3. Participantes votan
4. Cuando se alcanza quórum (>50%) o deadline, se cierra votación
5. Fecha ganadora se establece como oficial
6. Notificación a todos los participantes

**Server Actions:**
```typescript
createDateVotingAction(matchId, options)
voteForDateAction(matchId, optionIndex, userId)
finalizeDateVotingAction(matchId)
```

### Match Invitations (RSVP System)

Sistema de invitaciones con confirmación de asistencia para partidos colaborativos.

**Archivo de Actions:**
- **`lib/actions/match-invitation-actions.ts`**: `respondToMatchInvitationAction`

**Características:**
- Invitaciones push notification
- Estados: Pending, Accepted, Declined, Maybe
- Deadline para confirmar
- Auto-recordatorio 24h antes
- Penalización por no-shows repetidos

**Data Model:**
```typescript
// /matches/{matchId}/invitations/{invitationId}
{
  id: string;
  userId: string;
  status: 'pending' | 'accepted' | 'declined' | 'maybe';
  invitedAt: Timestamp;
  respondedAt?: Timestamp;
  notificationSent: boolean;
}
```

**Flujo:**
1. Organizador crea partido colaborativo
2. Sistema envía invitaciones a miembros del grupo
3. Notificación push + in-app
4. Usuarios responden RSVP
5. Match se actualiza con jugadores confirmados
6. Recordatorio automático si pending

**Server Actions:**
```typescript
sendMatchInvitationsAction(matchId, userIds)
respondToMatchInvitationAction(matchId, userId, response)
sendInvitationRemindersAction(matchId)
```

**Integración:**
- Visible en match details
- Contador de confirmados/pendientes/declinados
- Lista de invitados con status
- Organizador puede re-enviar invitaciones

## Próximas Mejoras
- [ ] Live score tracking
- [ ] Video highlights upload
- [ ] Statistics dashboard
- [ ] League/Cup integration
- [ ] Payment integration para cost split
- [ ] Video chat durante partido
- [ ] Live commentary feed
