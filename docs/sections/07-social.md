# Social - Feed y Seguimientos

## Descripción General
Red social integrada con feed de actividad, sistema de follows, y notificaciones en tiempo real.

## Rutas
- `/social` - Feed principal
- `/feed` - Alias a social
- `/profile` - Perfil público

## Componentes

### SocialFeed
- Stream de actividades
- Infinite scroll
- Filtros por tipo

### ActivityCard
- Renderiza diferentes tipos de actividad
- Likes, comentarios (futuro)
- Timestamp relativo

### FollowButton
- Estado: Seguido / No seguido
- Loading state
- Optimistic updates

### UserProfile (público)
- Stats del jugador
- Actividad reciente
- Botón Follow

## Tipos de Actividad

### match_completed
- Usuario completó un partido
- Muestra resultado final
- Link al partido

### player_ovr_increased
- OVR del jugador subió
- Muestra cambio (+X)
- Celebración visual

### new_achievement
- Jugador logró hito (futuro)
- Badge earned
- Descripción del logro

### team_created
- Equipo nuevo creado
- Nombre y jersey
- Link al team

## Server Actions (social-actions.ts)

```typescript
followUserAction(followerId, followingId)
unfollowUserAction(followerId, followingId)
getSocialFeedAction(userId, limit)
createSocialActivityAction(activityData)
```

## Modelos de Datos

### Follow (Firestore: `/follows/{followId}`)
```typescript
{
  id: string;
  followerId: string;  // Quien sigue
  followingId: string;  // A quien sigue
  createdAt: string;
}
```

### SocialActivity (Firestore: `/socialActivities/{activityId}`)
```typescript
{
  id: string;
  type: 'match_completed' | 'player_ovr_increased' | 'team_created' | ...;
  userId: string;  // Usuario que genera la actividad
  data: any;  // Datos específicos por tipo
  createdAt: string;
  visibility: 'public' | 'followers' | 'group';
}
```

## Generación de Actividades

### Automática
- Partido completado → `match_completed`
- OVR aumenta → `player_ovr_increased`
- Team creado → `team_created`

### Manual
- Usuario puede postear status (futuro)
- Compartir logros

## Feed Algorithm

### Orden
1. Ordenado por `createdAt` desc (más reciente primero)
2. Sin algoritmo de "relevancia" (por ahora)

### Filtrado
- Solo actividades de usuarios seguidos
- + Propias actividades
- + Actividades del grupo activo (opcional)

### Paginación
- 20 actividades por página
- Infinite scroll

## Privacidad

### Visibility Levels
- **public**: Todos pueden ver
- **followers**: Solo seguidores
- **group**: Solo miembros del grupo

### Control
- Usuario puede ocultar ciertas actividades
- Configurar qué genera actividad automática

## Notificaciones

### Tipos
- Nuevo seguidor
- Match invite
- Evaluación pendiente
- Grupo te invitó

### NotificationBell
- Badge con contador
- Dropdown con lista
- Mark as read

## Sin AI Flows
El feed social usa lógica de queries estándar, no requiere IA.

## Características

### Real-time Updates
- Firestore realtime listeners
- Nuevas actividades aparecen automáticamente

### Optimistic UI
- Follow/Unfollow optimista
- Rollback si falla

### Lazy Loading
- Imágenes lazy loaded
- Infinite scroll eficiente

## Próximas Mejoras
- [ ] Likes y comentarios
- [ ] Compartir actividades
- [ ] Stories (24h ephemeral)
- [ ] DMs entre usuarios
- [ ] Hashtags
- [ ] Búsqueda de usuarios
