# Firebase Studio

## Social Feed & Follow System (Beta)

Se agregó un sistema social inspirado en Instagram/Facebook:

### Colecciones
- `follows`: documentos `{ followerId, followingId, createdAt }`.
- `socialActivities`: actividades para el feed `{ type, userId, timestamp, playerId?, metadata? }`.

### Tipos de actividad soportados (inicial)
- `new_follower`
- `match_played` (planeado publicar al finalizar partido)
- `ovr_increased` / `ovr_decreased` (publicar tras actualización de OVR)
- `goal_scored` (agregado futuro, usar totales por jugador)
- `player_created` (futuro)

### Server Actions nuevas
- `followUserAction(followerId, followingId)`: crea follow + actividad + notificación.
- `unfollowUserAction(followerId, followingId)`: elimina relación.
- `publishActivityAction(activity)`: helper genérico.
- Helpers para futuras expansiones: `publishMatchPlayedActivity`, `publishOvrChangeActivity`.

Archivo: `src/lib/actions/social-actions.ts`.

### Página Feed
- Ruta: `/feed` (`src/app/feed/page.tsx`).
- Lógica: obtiene hasta 10 IDs seguidos y consulta `socialActivities` con `where('userId','in',[...])` y `orderBy('timestamp','desc')`.
- Si no sigues a nadie, muestra tus propias actividades.

### Componente UI
- `ActivityCard`: estilo feed compacto (avatar, icono, verbo, tiempo relativo).
	Archivo: `src/components/social/activity-card.tsx`.

### Perfil Jugador
- Botón Seguir / Dejar de Seguir añadido en `src/app/players/[id]/page.tsx` (según dueño del jugador).

### Índices recomendados Firestore
Crear índices compuestos para rendimiento:
1. Colección `socialActivities`: Campos `userId` ASC, `timestamp` DESC.
2. Colección `follows`: Campo único `followerId` y si es necesario `followingId`.

### Próximos pasos sugeridos
1. Publicar actividades de partido / goles dentro de transacción de evaluación.
2. Fan-out a `userFeeds/{userId}/items` para >10 seguidos.
3. Añadir paginación (cursor `startAfter`).
4. Unificar avatar de usuario vs avatar de jugador (decidir fuente).
5. Añadir filtros (solo OVR, solo partidos, etc.).

### Advertencias
- Firestore limita `where('in')` a 10 IDs. Ahora sólo se usan primeros 10 seguidos.
- Actividades todavía no se generan automáticamente en todos los eventos (solo follow ahora).
- Asegurar reglas si se endurece seguridad (validar followerId == auth.uid en `follows`).

Para explorar la app principal sigue usando `src/app/page.tsx`.
