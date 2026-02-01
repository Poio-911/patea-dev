# Rediseño de la Sección Competiciones

> Última actualización: 2025-11-12
>
> Este documento resume el estado actual del rediseño de la sección **Competiciones**, los flujos implementados, diferencias con el modelo anterior, riesgos, brechas y mejoras propuestas.

---
## 1. Objetivo del Rediseño
Migrar desde un flujo lineal complejo (publicar → reclamar → negociar → confirmar) hacia un **dashboard modular** que centraliza:
- Estado de equipos y sus postulaciones para jugar.
- Desafíos recibidos entre equipos.
- Búsqueda futura de partidos disponibles.
- Historial y métricas básicas.

Se busca simplificar la experiencia del usuario dueño de equipos y preparar la base para escalar (paginación, historiales, ligas y copas).

---
## 2. Flujo Actual (Nuevo Modelo)
### Entidades Nuevas o Reutilizadas
- `teamAvailabilityPosts`: Postulaciones creadas por el dueño de un equipo para ofrecer disputar un amistoso.
- `teams/{teamId}/invitations` (type `team_challenge`): Invitaciones creadas cuando otro equipo desafía una postulación.
- `matches`: Se crea inmediatamente al aceptar un desafío (status inicial `upcoming`).

### Secuencia
1. Dueño del equipo publica un **post** de disponibilidad.
2. Otro equipo lo desafía → se genera una **invitación** (pending) en el equipo desafiado.
3. El dueño del equipo desafiado acepta → se crea el **match** directamente (sin negociación intermedia).
4. El partido se visualiza como amistoso (ya en estado `upcoming`).

### Estado Eliminado
Se eliminaron los estados `proposed` y `negotiating` del flujo previo.

---
## 3. Diferencias vs Flujo Anterior
| Aspecto | Flujo Anterior | Flujo Nuevo |
|---------|----------------|-------------|
| Publicación | `createProposedMatch` crea partido en Firestore | `createTeamAvailabilityPostAction` crea post; aún no existe partido |
| Reclamo / Challenge | `claimMatch` cambia estado a negotiating | `challengeTeamPostAction` crea invitación en subcolección |
| Confirmación | `confirmMatch` produce partido `upcoming` | `acceptTeamChallengeAction` crea partido directo |
| Cancelación | `cancelMatch` sobre match `proposed/negotiating` | Eliminar post / rechazar invitación; partido ya no se crea si rechazo |
| Negociación | Existía explícitamente | Implícita (no hay iteraciones) |
| Normalización temporal | `startTimestamp`, `participantTeamIds` añadidos antes | No aplicados aún en matches creados por aceptación |
| Complejidad UI | Varias listas y estados | Dashboard con métricas y navegación |

---
## 4. Server Actions Clave
### Posts
- `createTeamAvailabilityPostAction(teamId, userId, { date, time, location, description? })`
- `getUserTeamPostsAction(userId)`
- `getAvailableTeamPostsAction(userId)` (usa filtros y excluye posts propios)
- `deleteTeamAvailabilityPostAction(postId, userId)`

### Desafíos
- `challengeTeamPostAction(postId, challengingTeamId, challengerUserId)` → crea invitación en `teams/{post.teamId}/invitations`.
- `acceptTeamChallengeAction(invitationId, teamId, userId)` → crea partido.
- `rejectTeamChallengeAction(invitationId, teamId, userId)` → marca invitación como `declined` y notifica.

### Observaciones Técnicas
- Falta validación de ownership (que el `userId` que acepta/rechaza sea realmente el dueño del equipo `teamId`).
- No se marca el post como consumido (`matched` / `inactive`) al aceptar.
- El match creado no añade campos normalizados (`startTimestamp`, `participantTeamIds`, `createdAt`, `finalScore`).

---
## 5. Modelo de Match (Brecha Actual)
Matches creados por `acceptTeamChallengeAction` incluyen:
- `title`, `date`, `time`, `location`, `type`, `matchSize`, `players`, `playerUids`, `teams[]`, `status`, `ownerUid`, `groupId`, `isPublic`.

Campos faltantes según evolución previa:
- `startTimestamp` (ISO para ordenar/paginación eficiente).
- `participantTeamIds` (array de IDs involucradas para búsquedas rápidas).
- `createdAt` (para auditoría y orden secundario).
- `finalScore` / `finalizedAt` (para cerrar el ciclo y mostrar historial con resultados).

---
## 6. Riesgos Identificados
1. **Índices Firestore**: Consultas con combinaciones `where('createdBy','!=', userId)` + orderBy requieren índices compuestos; pueden fallar si no se crean.
2. **Race Conditions**: Dos aceptaciones simultáneas sobre el mismo post → doble partido.
3. **Ownership Incompleto**: Falta verificación de `team.createdBy === userId` en aceptación/rechazo invitaciones.
4. **Escalabilidad de Invitaciones**: Múltiples queries por equipo (N equipos → N subconsultas). Costo elevado con muchos equipos.
5. **Historial Limitado**: Contador de partidos muestra sólo aquellos donde el usuario figura en `playerUids`; puede perder partidos de equipos que no cargan jugadores.
6. **MatchSize Fijo**: Hardcode a `22` (11v11) ignora necesidades de fútbol 5 o 7.
7. **Post Reutilizable**: Sin estado `matched` se puede seguir desafiando el mismo post indefinidamente.
8. **Fecha/Hora Vencidas**: No se valida vigencia de la postulación al aceptar (fecha pasada o dentro de ventana demasiado corta).

---
## 7. Edge Cases
- Jugador aparece en ambos equipos (overlap raro) → duplicado en arrays.
- Equipo sin jugadores cargados → OVR promedio produce división por 0 (revisar cálculos).
- Invitaciones antiguas permanecen pending sin purga automática.
- Posts con hora inválida o formato distinto provocan partidas incoherentes.

---
## 8. Mejoras Propuestas (Prioridad)
1. Añadir en `acceptTeamChallengeAction` los campos: `startTimestamp`, `participantTeamIds`, `createdAt`, `finalScore: null`.
2. Validar ownership en aceptación/rechazo de invitaciones.
3. Marcar `teamAvailabilityPost` como `status: 'matched'` (o eliminarlo) tras aceptar para evitar múltiples partidos.
4. Incluir `matchSize` en el post y trasladarlo al match creado (5 / 7 / 11).
5. Añadir control de fecha futura (>= 30 min) al aceptar desafío; si no, rechazar automáticamente.
6. Crear acción consolidada para listar invitaciones de todos los equipos del usuario (evita múltiples queries en cliente).
7. Añadir resultado y mostrarlo en `FriendlyMatchCard` para `status === 'completed'`.
8. Implementar paginación basada en `startTimestamp` (cursor + `orderBy`).
9. Documentar índices requeridos en un nuevo archivo (ver sección 9).
10. Añadir limpieza automática de invitaciones expiradas (cron / Cloud Function futura).

---
## 9. Índices Firestore Recomendados
| Colección / Grupo | Campos / Orden | Propósito |
|-------------------|---------------|-----------|
| `teamAvailabilityPosts` | `createdBy !=` + `date >=` + orderBy(`date`,`createdBy`) | Listar posts de otros equipos futuros |
| `teamAvailabilityPosts` | `createdBy ==` + orderBy(`date`) | Posts propios ordenados |
| `teams/{teamId}/invitations` | `type ==` + `status ==` | Filtrar desafíos pendientes |
| `matches` | `type ==` + `playerUids array-contains` | Listar amistosos del jugador |
| `matches` | `status ==` + `startTimestamp` | Paginación futura por estado |
| `matches` | `participantTeamIds array-contains` + `startTimestamp` | Historial por equipo |

> Nota: Comprobar límites de Firestore para combinaciones y uso de `!=`. Donde sea problemático, mover lógica de filtrado al servidor con menos where y más filtrado en memoria.

---
## 10. Métricas del Dashboard (Actual vs Deseado)
| Métrica | Actual | Ideal |
|---------|--------|-------|
| Desafíos Pendientes | Conteo de invitaciones pending | Conteo + agrupación por equipo + orden por fecha objetivo |
| Postulaciones Activas | Posts propios sin estado matched | Posts activos futuros + estado (matched / expirado) |
| Partidos Jugados | Count de matches donde el usuario aparece como jugador | Segmentado por estado (upcoming/active/completed) + últimos N |
| Mis Equipos | Equipos del grupo creados por el usuario | Total equipos del grupo + rol (dueño / miembro) |

---
## 11. Roadmap Sugerido
1. Normalizar creación de partido (campos faltantes y ownership).  ✅ (Pendiente de implementación técnica)
2. Estado de post consumido/matched.  🔜
3. Paginación de partidos y desafíos con cursores (startTimestamp). 🔜
4. Refactor de invitaciones: colección agrupada + acción única. 🔜
5. Historial con filtros por rango de fechas y resultado. 🔜
6. Integración de finalización y evaluación post-partido (cierre de ciclo). 🔜
7. Virtualización de listas grandes (react-virtual) para rendimiento. 🔜

---
## 12. Recomendaciones Técnicas
- Centralizar la lógica de validaciones (fechas, ownership, duplicados) en server actions para evitar inconsistencias cliente.
- Usar `collectionGroup` cuando la cardinalidad de equipos del usuario crezca; si no, caché en server y retornar combinado.
- Introducir tipo `TeamAvailabilityPostStatus` (`active`, `matched`, `expired`) para facilitar la UI.
- Añadir pruebas mínimas de integración sobre aceptación de desafío (crear post → desafiar → aceptar → verificar match payload).
- Monitorear necesidad de índices y crear un script o doc automatizable (`docs/FIRESTORE_INDEXES.md`).

---
## 13. Checklist de Implementación Inmediata
- [ ] Actualizar `acceptTeamChallengeAction` con campos normalizados y validaciones.
- [ ] Añadir actualización de estado del post (`matched`).
- [ ] Agregar propiedad `matchSize` opcional en post y trasladarla al partido.
- [ ] Validar fecha/hora futura al aceptar.
- [ ] Añadir ownership check sobre invitaciones.

---
## 14. Ejemplo de Payload Ideal (Match creado por desafío)
```json
{
  "id": "<auto>",
  "title": "Equipo A vs Equipo B",
  "date": "2025-11-20",
  "time": "19:30",
  "location": { "name": "Cancha Central", "address": "Av. Siempre Viva 123", "lat": -34.6, "lng": -58.4, "placeId": "xyz" },
  "type": "intergroup_friendly",
  "matchSize": 11,
  "players": [ { "uid": "player123", "displayName": "Juan", "position": "MF", "ovr": 72, "photoUrl": "" } ],
  "playerUids": ["player123"],
  "teams": [ { "id": "teamA", "name": "Equipo A", "jersey": { "type": "classic", "primaryColor": "#11AAFF" }, "players": [...] }, { "id": "teamB", "name": "Equipo B", "jersey": { "type": "classic", "primaryColor": "#FFAA11" }, "players": [...] } ],
  "status": "upcoming",
  "ownerUid": "ownerTeamA",
  "groupId": "group123",
  "isPublic": false,
  "createdAt": "2025-11-12T14:23:00.000Z",
  "startTimestamp": "2025-11-20T19:30:00.000Z",
  "participantTeamIds": ["teamA", "teamB"],
  "finalScore": null,
  "finalizedAt": null
}
```

---
## 15. Conclusión
El rediseño simplifica la experiencia y reduce fricción para crear partidos, pero aún necesita normalización total del modelo de match, control de estados de post y robustez en ownership/índices para escalar. Aplicando las mejoras propuestas se consolida una base sólida para futuras funciones (ligas, copas, historial avanzado, evaluación post-partido).

> Para implementar el siguiente paso (normalización en `acceptTeamChallengeAction`), iniciar una rama de hotfix y aplicar la checklist de la sección 13.
