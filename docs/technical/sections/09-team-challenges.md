# Team Challenges - Sistema de Desafíos entre Equipos

## Descripción General

Sistema completo para que equipos persistentes del grupo se desafíen mutuamente a partidos. Permite crear publicaciones de disponibilidad y aceptar/enviar desafíos para organizar partidos competitivos.

## Rutas

- `/competitions/challenges` - Feed de desafíos y equipos disponibles
- `/competitions/challenge-team/[postId]` - Detalle del post y formulario de desafío
- `/competitions/find-opponent/[teamId]` - Buscar equipo rival para desafiar
- `/competitions/my-teams/page.tsx` - Gestión de mis equipos y posts

## Concepto

A diferencia de los partidos tradicionales donde el organizador selecciona jugadores, los Team Challenges permiten:

1. Un equipo publica su disponibilidad para jugar
2. Otros equipos ven el post y pueden desafiar
3. El equipo original acepta o rechaza el desafío
4. Si se acepta, se crea automáticamente un partido "By Teams"

## Componentes Principales

### team-challenge-card.tsx

Tarjeta que muestra un post de disponibilidad de equipo.

**Contenido:**
- Nombre del equipo con jersey preview
- Fecha/hora propuesta
- Ubicación (venue o texto libre)
- Descripción/mensaje
- OVR promedio del equipo
- Roster (jugadores titulares y suplentes)
- Botón "Desafiar" si eres otro equipo
- Estado: Open, Challenged, Accepted

**Variantes:**
- Compacta: Para feed/lista
- Expandida: Para vista detallada

### team-availability-dialog.tsx

Dialog para que un equipo publique su disponibilidad.

**Campos:**
- Seleccionar equipo (dropdown con mis equipos)
- Fecha/hora preferida (puede ser flexible)
- Ubicación (venue selector o texto libre)
- Mensaje/descripción (opcional)
- Tipo de partido (amistoso, práctica, competitivo)
- Preferencias de rival (rango de OVR, ubicación cercana)

**Validación:**
- Al menos 5 jugadores en roster del equipo
- Fecha en el futuro
- Ubicación válida

### Challenge Opponent Flow

Cuando un equipo ve un post y quiere desafiar:

1. **Find Opponent View** (`/competitions/find-opponent/[teamId]`):
   - Muestra posts de disponibilidad de otros equipos
   - Filtros: fecha, ubicación, OVR range
   - Ordenamiento: más recientes, mejor match de OVR

2. **Challenge Dialog**:
   - Confirmar equipo desafiante
   - Mensaje al rival (opcional)
   - Proponer modificación de fecha/hora si no coincide
   - Seleccionar venue específico si el post no tenía

3. **Notification**:
   - Push notification al capitán del equipo desafiado
   - In-app notification badge

## Server Actions

### createTeamAvailabilityPostAction

```typescript
createTeamAvailabilityPostAction(data: {
  teamId: string;
  date: string;
  time: string;
  venue?: string;
  venueId?: string;
  message?: string;
  matchType: 'friendly' | 'practice' | 'competitive';
  preferredOvrRange?: { min: number; max: number };
  flexible: boolean;  // Fecha flexible
})
```

Crea un post de disponibilidad en `/teamAvailabilityPosts/`.

**Validaciones:**
- Usuario es miembro del equipo
- Equipo tiene al menos 5 jugadores
- No hay otro post activo del mismo equipo para la misma fecha

### challengeTeamPostAction

```typescript
challengeTeamPostAction(data: {
  postId: string;
  challengerTeamId: string;
  message?: string;
  proposedDate?: string;
  proposedTime?: string;
  venueId?: string;
})
```

Crea un challenge contra un post existente.

**Efecto:**
- Crea documento en `/challenges/`
- Actualiza post status a "challenged"
- Envía notificación al equipo original
- Crea entrada en activity feed

### acceptTeamChallengeAction

```typescript
acceptTeamChallengeAction(challengeId: string)
```

Acepta un desafío recibido.

**Efecto:**
- Crea partido tipo "By Teams"
- Ambos equipos ya están asignados
- Fecha/hora/venue del challenge
- Marca challenge como "accepted"
- Marca post como "fulfilled"
- Notificación a ambos equipos

### rejectTeamChallengeAction

```typescript
rejectTeamChallengeAction(challengeId: string, reason?: string)
```

Rechaza un desafío.

**Efecto:**
- Marca challenge como "rejected"
- Post vuelve a estado "open"
- Notificación al equipo desafiante
- Opcional: mensaje de razón del rechazo

### sendTeamChallengeAction

```typescript
sendTeamChallengeAction(data: {
  challengerTeamId: string;
  targetTeamId: string;
  proposedDate: string;
  proposedTime: string;
  venue?: string;
  message?: string;
})
```

Envía desafío directo sin post (challenge directo).

**Uso:**
- Para rivalidades conocidas
- No requiere post de disponibilidad
- Notificación directa al capitán del equipo rival

### getUserTeamPostsAction

```typescript
getUserTeamPostsAction(userId: string)
```

Obtiene todos los posts de disponibilidad de equipos donde el usuario es miembro.

### getAvailableTeamPostsAction

```typescript
getAvailableTeamPostsAction(filters?: {
  dateRange?: { start: string; end: string };
  ovrRange?: { min: number; max: number };
  location?: { lat: number; lng: number; radiusKm: number };
  matchType?: string;
})
```

Obtiene posts públicos de disponibilidad con filtros opcionales.

### deleteTeamAvailabilityPostAction

```typescript
deleteTeamAvailabilityPostAction(postId: string)
```

Elimina un post de disponibilidad (solo creador).

## Modelo de Datos

### TeamAvailabilityPost

```typescript
// /teamAvailabilityPosts/{postId}
{
  id: string;
  teamId: string;
  teamName: string;
  teamJersey: JerseyData;
  teamAvgOvr: number;
  createdBy: string;  // userId del capitán
  createdAt: Timestamp;

  // Detalles del partido propuesto
  date: string;  // ISO date
  time: string;  // HH:MM
  flexible: boolean;
  venue?: string;
  venueId?: string;
  location?: { lat: number; lng: number; address: string };

  // Metadata
  message?: string;
  matchType: 'friendly' | 'practice' | 'competitive';
  preferredOvrRange?: { min: number; max: number };

  // Estado
  status: 'open' | 'challenged' | 'accepted' | 'expired' | 'cancelled';
  challengeId?: string;  // Si status === 'challenged'
  matchId?: string;  // Si status === 'accepted'

  // Roster snapshot
  rosterCount: number;
}
```

### Challenge

```typescript
// /challenges/{challengeId}
{
  id: string;
  postId: string;  // Referencia al post original

  // Equipos
  challengedTeamId: string;
  challengedTeamName: string;
  challengerTeamId: string;
  challengerTeamName: string;

  // Usuario que envió el challenge
  challengedBy: string;  // userId
  challengedAt: Timestamp;

  // Propuesta
  proposedDate?: string;
  proposedTime?: string;
  proposedVenue?: string;
  message?: string;

  // Estado
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  respondedAt?: Timestamp;
  rejectionReason?: string;

  // Match creado si aceptado
  matchId?: string;
}
```

## Flujo Completo

### Flujo A: Post → Challenge → Accept

1. **Equipo A publica disponibilidad**:
   - Selecciona su equipo "Los Cracks"
   - Fecha: Sábado 15:00
   - Venue: "Cancha Municipal Norte"
   - Mensaje: "Buscamos partido amistoso"
   - Post creado con status "open"

2. **Equipo B ve el post y desafía**:
   - Navega a `/competitions/challenges`
   - Ve post de "Los Cracks"
   - Click "Desafiar"
   - Selecciona su equipo "FC Amigos"
   - Mensaje: "Aceptamos el desafío!"
   - Challenge creado, post status → "challenged"

3. **Equipo A recibe notificación**:
   - Push notification: "FC Amigos te desafió!"
   - Ve detalle del challenge
   - Revisa roster de FC Amigos
   - Decide aceptar

4. **Match automático creado**:
   - Partido tipo "By Teams"
   - Equipos: Los Cracks vs FC Amigos
   - Fecha/hora/venue confirmados
   - Ambos equipos notificados
   - Post status → "accepted"
   - Challenge status → "accepted"

### Flujo B: Direct Challenge (sin post)

1. **Equipo A quiere desafiar a Equipo B directamente**:
   - Va a `/competitions/my-teams`
   - Selecciona "Los Cracks"
   - Click "Desafiar a otro equipo"
   - Busca "FC Amigos"
   - Propone fecha/hora/venue
   - Envía challenge directo

2. **Equipo B recibe desafío**:
   - Notificación de challenge directo
   - Acepta o rechaza
   - Si acepta → match creado

## UI/UX Patterns

### Feed de Challenges

Lista estilo redes sociales con:
- Tarjetas de posts activos
- Filtros laterales (fecha, ubicación, OVR)
- Ordenamiento (relevancia, fecha, cercanía)
- Empty state: "No hay equipos buscando rival"

### Post Detail View

Vista expandida con:
- Información completa del equipo
- Roster completo con fotos
- Mapa de ubicación
- Historial de partidos del equipo
- Botón CTA: "Desafiar a este equipo"

### Mis Equipos & Posts

Dashboard personal con:
- Tabs: "Mis Equipos" | "Mis Posts" | "Challenges Recibidos" | "Challenges Enviados"
- Acción rápida: "Publicar Disponibilidad"
- Estados visuales claros (badges)

### Notificaciones

- **Challenge Recibido**: "⚽ [Equipo] te desafió para el [fecha]"
- **Challenge Aceptado**: "✅ [Equipo] aceptó tu desafío!"
- **Challenge Rechazado**: "❌ [Equipo] rechazó tu desafío"
- **Match Creado**: "🎮 Partido confirmado vs [Equipo]"

## Permisos y Roles

### Capitán del Equipo

- Crear posts de disponibilidad
- Aceptar/rechazar challenges
- Enviar challenges a otros equipos
- Cancelar posts propios
- Gestionar roster

### Miembro del Equipo

- Ver posts del equipo
- Recibir notificaciones de challenges
- Ver challenges activos
- Sugerir equipos rivales (comentario)

### Organizador del Grupo

- Ver todos los posts
- Moderar challenges inapropiados
- Crear matches entre equipos

## Responsive Design

### Mobile
- Cards en stack vertical
- Botón FAB para "Crear Post"
- Swipe para ver detalles
- Bottom sheet para filtros

### Tablet
- Grid 2 columnas
- Sidebar con filtros permanente
- Preview de roster inline

### Desktop
- Grid 3 columnas
- Filtros laterales expandidos
- Hover para preview rápido
- Múltiples ventanas (post + challenge)

## Integraciones

### Con Matches
- Challenge aceptado → Match "By Teams" creado
- Match existente puede mostrar origen (challenge)
- Resultados del match afectan estadísticas de challenges

### Con Grupos
- Posts solo visibles dentro del mismo grupo
- Opción futura: challenges inter-grupos

### Con Notifications
- Push notifications para challenges
- Email digest semanal de posts activos
- Recordatorio si post sin respuesta por 48h

### Con Social Feed
- Publicar en feed cuando se acepta challenge
- Compartir post en feed del grupo
- Celebrar partidos competitivos

## Métricas y Analytics

**Tracking:**
- Posts creados vs posts con challenge
- Tasa de aceptación de challenges
- Tiempo promedio entre post y challenge
- Equipos más activos
- Horarios/venues más populares

**Insights:**
- Sugerir equipos rivales basado en OVR similar
- Notificar cuando hay post compatible
- Ranking de equipos por challenges ganados

## Optimizaciones

- Cache de posts activos (5 min TTL)
- Prefetch de rosters al cargar feed
- Lazy load de challenges antiguos
- Compression de jersey images
- Debounce en filtros de búsqueda

## Limitaciones Actuales

- Posts limitados a mismo grupo
- No hay sistema de ranking
- No tracking de historial challenge vs match result
- Un equipo solo puede tener 1 post activo a la vez

## Próximas Mejoras

- [ ] Challenges inter-grupos (con aprobación de admin)
- [ ] Sistema de ranking ELO para equipos
- [ ] Torneos automáticos basados en challenges
- [ ] Histórico de challenges ganados/perdidos
- [ ] Badges y achievements por challenges
- [ ] Streaming/invitación de espectadores
- [ ] Apuestas amistosas (puntos virtuales)
- [ ] Rivalidades automáticas (re-matches sugeridos)

---

**Nota**: Este sistema convierte la organización de partidos en una experiencia más competitiva y social, ideal para grupos con múltiples equipos establecidos que quieren jugar entre sí regularmente.
