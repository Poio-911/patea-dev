# Fase 2 — Rivales guardados ("equipos para volver a jugar")

> Estado: **implementado el 19/11/2026.** Ver [cierre de implementación](FASE_2_RIVALES_IMPLEMENTACION_2026-11-19.md) para decisiones finales, pruebas y despliegue.
> La especificación original se conserva como referencia; el cierre documenta los ajustes. Continúa lo hecho en las fases 0 y 1
> (commit `9f252316`). Este documento es la especificación completa: decisiones,
> modelo de datos, backend, app, pruebas, migración y orden de despliegue.

---

## 1. Objetivo

Cuando dos equipos de **distintos grupos** juegan entre sí, cada uno tiene que
quedar con el otro **guardado como rival**, para poder:

1. Verlo después en una lista propia ("Tus rivales") sin tener que buscarlo.
2. **Volver a desafiarlo con un toque** (revancha).
3. Ver el **historial entre ambos**: cuántas veces jugaron, quién ganó, el último
   resultado.
4. Marcar favoritos y olvidar a los que no interesan.

El buscador de la fase 1 sigue siendo la única forma de descubrir equipos nuevos
y **no lista nada sin escribir**. La lista de rivales guardados es otra cosa: son
sólo equipos con los que ya hubo trato.

### Fuera de alcance (a propósito)

- Partidos entre dos equipos del **mismo grupo** (`by_teams`): ya se arman desde
  "Enfrentar dos equipos". No generan rivales en esta fase.
- Ligas y copas: tienen su propio flujo de inscripciones y tablas.
- Publicaciones de disponibilidad de equipos (`teamAvailabilityPosts`, existen
  en la web): son la fase 3.
- Chat entre capitanes antes de aceptar el desafío.

---

## 2. Punto de partida

Ya existe (fases 0 y 1):

| Pieza | Dónde |
|---|---|
| Buscador por prefijo de nombre | `functions/src/callable/team-challenges.ts` → `searchTeams` |
| Enviar / responder / listar desafíos | mismo archivo → `challengeTeam`, `respondTeamChallenge`, `getMyTeamChallenges` |
| Partido `intergroup_friendly` con `participantTeamIds`, `participantGroupIds`, `captains` | `respondTeamChallenge` |
| Índice `searchTokens` y trigger que lo mantiene | `triggers/on-team-write.ts` |
| "Recibir desafíos" (opt-out) | `setTeamChallengeOptOut` + `GroupTeamModel.challengeOptOut` |
| Pantallas "Buscar rival" y "Desafíos recibidos" | `lib/features/matches/challenge_team_screen.dart`, `team_challenges_screen.dart` |
| Tarjeta "Rivales" en la ficha del equipo | `lib/features/groups/team_detail_screen.dart` (`_RivalsCard`) |

**Falta** (lo que cubre esta fase): ningún registro de contra quién jugó cada
equipo; no hay lista de rivales, ni revancha, ni historial, ni estadísticas.

Cómo se guarda el resultado hoy: `recordLiveEventCore`
(`functions/src/callable/match-lifecycle.ts`) suma 1 a `teams[i].score` por cada
gol. `finishMatch` pasa el partido a `completed`; `finalizeMatchEvaluation`
(evaluaciones) lo pasa después a `evaluated`. La web también cierra partidos con
sus propias *server actions*, así que el cálculo del resultado **no puede vivir
sólo en `finishMatch`**.

---

## 3. Decisiones de diseño

### D1. El rival se guarda **al aceptar** el desafío, y las estadísticas al **terminar** el partido

Así "ese equipo ya queda como equipo para volver a jugar" desde el momento en que
hay trato, aunque el partido todavía no se haya jugado. Las estadísticas
(`played`, `wins`…) arrancan en 0 y sólo cambian con partidos terminados.

### D2. Colección propia `teamRivals`, **cerrada a los clientes**

`teams/{id}/<subcolección>` hoy es legible por **cualquier usuario autenticado**
(`firestore.rules`). Poner los rivales ahí los expondría. Por eso:

- Colección de primer nivel `teamRivals`.
- Reglas: `allow read, write: if false;`
- Todo acceso pasa por callables, que validan permisos en el servidor.

### D3. Un documento **por lado** y por par de equipos

El rival de A es B, y el de B es A, pero cada lado tiene sus propios favoritos,
su propia decisión de olvidar y su propia fecha de último desafío. Entonces se
guardan dos documentos que se escriben **juntos en una transacción**:

```
teamRivals/{ownTeamId}__{rivalTeamId}
teamRivals/{rivalTeamId}__{ownTeamId}
```

El id es determinista (`ownTeamId__rivalTeamId`, con doble guion bajo): no hay
duplicados posibles y se puede leer por id sin consultar.

### D4. Resultado calculado por un **trigger** sobre `matches`, no en `finishMatch`

Un `onDocumentUpdated('matches/{id}')` que detecta el paso a `completed` /
`evaluated` cubre `finishMatch`, `finalizePendingMatches` **y** los cierres desde
la web, con un único código. Es idempotente (ver §5.3).

### D5. Los datos del rival se leen **en vivo** de `teams/`, con snapshot de respaldo

Nombre y camiseta cambian. Si se copiaran y se actualizaran en cascada habría que
reescribir cientos de documentos. En su lugar `getTeamRivals` lee los equipos
actuales (`getAll`, máximo 100) y usa el snapshot guardado **sólo si el equipo ya
no existe**.

### D6. Quién ve y quién gestiona

| Acción | Quién |
|---|---|
| Ver los rivales de un equipo | cualquier miembro del grupo del equipo (`teams.view`) |
| Guardar a mano, favorito, olvidar, desafiar | quien administra el equipo (`teams.edit`: su creador o admin/moderador del grupo) — el mismo criterio de la fase 1 |

### D7. Sólo cuentan los partidos `intergroup_friendly`

Es lo que ya crea el flujo de desafíos y la web. Dejar `by_teams` afuera evita
llenar la lista de equipos del propio grupo.

---

## 4. Modelo de datos

### 4.1 `teamRivals/{ownTeamId}__{rivalTeamId}`

| Campo | Tipo | Descripción |
|---|---|---|
| `ownTeamId` | string | Equipo dueño de este registro. |
| `rivalTeamId` | string | El rival. |
| `ownGroupId` / `rivalGroupId` | string | Para limpiar y validar sin leer `teams/`. |
| `rivalSnapshot` | `{name, jersey, groupName}` | **Sólo respaldo** (D5). Se refresca en cada lectura exitosa. |
| `origin` | `'challenge' \| 'manual'` | Cómo entró a la lista. |
| `favorite` | bool | Estrella. Los favoritos van primero. |
| `hidden` | bool | "Olvidado": no aparece en la lista, pero **conserva las estadísticas**. Un partido nuevo lo vuelve a mostrar. |
| `played`, `wins`, `draws`, `losses` | int | Desde el punto de vista de `ownTeamId`. |
| `goalsFor`, `goalsAgainst` | int | Ídem. |
| `lastMatchId`, `lastPlayedAt` | string, ISO | Último partido **terminado**. |
| `recent` | lista de hasta 5 `{matchId, date, scoreFor, scoreAgainst}` | Historial sin consultas extra. |
| `countedMatchIds` | lista de hasta 50 ids | Idempotencia (§5.3). Se recorta al llegar al tope. |
| `lastChallengeAt` | string, ISO | Último desafío enviado a este rival (para límites y para mostrar "desafiado hace…"). |
| `createdAt`, `updatedAt` | string, ISO | |

Tamaño máximo por documento: unos 3 KB.

### 4.2 `matches/{id}` — campos nuevos

| Campo | Descripción |
|---|---|
| `rivalsRecordedAt` | ISO. Marca que ya se contó este partido. Lo escribe el trigger. |

### 4.3 Reglas e índices

```
match /teamRivals/{id} { allow read, write: if false; }
```

Índices: **ninguno compuesto**. Las consultas son de igualdad sobre un campo
(`ownTeamId == x`, `rivalTeamId == x`), que Firestore resuelve con el índice
simple automático. El orden (favoritos, último partido) se hace en memoria sobre
un máximo de 100 documentos.

Para el tope de desafíos (§5.5) se necesita un índice de **grupo de colecciones**
sobre `invitations.fromTeamId` (single-field, ámbito `COLLECTION_GROUP`).

---

## 5. Backend

Todo en `functions/`. Archivos nuevos entre paréntesis.

### 5.1 Lógica pura (`src/lib/team-rivals.ts`, nuevo) — la parte que más se prueba

```ts
rivalDocId(ownTeamId, rivalTeamId): string          // "a__b"
outcomeFor(match, ownTeamId): { result: 'win'|'draw'|'loss', scoreFor, scoreAgainst } | null
applyResult(rival, outcome, match): RivalDoc         // suma estadísticas, recent, countedMatchIds
isCountableMatch(match): boolean                     // intergroup_friendly + 2 equipos + status terminado
sortRivals(list): list                               // favoritos, luego lastPlayedAt desc, luego nombre
```

Reglas de `outcomeFor`:

- Los equipos del partido están en `teams[0]` y `teams[1]`; a cuál corresponde
  cada `participantTeamId` se resuelve **por nombre de equipo guardado en el
  partido** y, si hay duda, por pertenencia de jugadores
  (`teams[i].players[].uid` ∈ miembros del equipo). `respondTeamChallenge` ya arma
  `teams` en el orden `[equipo desafiado, equipo que desafía]` y
  `participantTeamIds` en el mismo orden: se **usa ese orden** como fuente
  principal y se agrega un test que lo fija.
- Resultado: `score` mayor gana; igual = empate. Si ambos `score` son 0/ausentes
  y no hay eventos, igual cuenta como **empate 0-0** (un partido jugado sin
  goles).
- Si falta algún dato imprescindible, devuelve `null` y el partido **no cuenta**
  (se registra en el log, no rompe nada).

### 5.2 Guardar el rival al aceptar (`team-challenges.ts` → `respondTeamChallenge`)

Dentro de la transacción que ya crea el partido, y sólo cuando `accepted`:

1. Leer los dos documentos `teamRivals` (pueden no existir).
2. Crear/actualizar **ambos**: `origin: 'challenge'`, `hidden: false`,
   `lastChallengeAt` (en el del equipo que desafió), `rivalSnapshot`,
   `updatedAt`. Si ya existían, **no** pisar estadísticas ni `favorite`.
3. Rechazar el desafío **no** guarda nada.

Límite: máximo **100 rivales por equipo**. Si se supera, el desafío se acepta
igual y el rival más viejo sin partidos (`played == 0`, no favorito) se descarta.

### 5.3 Contar el resultado (`src/triggers/on-team-match-result.ts`, nuevo)

```ts
onDocumentUpdated('matches/{matchId}')
```

1. Salir si el estado no pasó de otro a `completed` o `evaluated`.
2. Salir si `rivalsRecordedAt` ya existe (idempotencia).
3. `isCountableMatch(after)`; si no, salir.
4. Transacción: releer el partido (`rivalsRecordedAt` otra vez), leer los dos
   `teamRivals`, aplicar `applyResult` a cada lado con su punto de vista, y
   escribir ambos **más** `matches/{id}.rivalsRecordedAt`.
5. `hidden` pasa a `false` en ambos (un partido nuevo revive al rival olvidado).
6. Si algo falla, se loguea y se deja `rivalsRecordedAt` sin marcar para que el
   **backfill** (§8) lo repare. No se reintenta en bucle.

Por qué un trigger y no `finishMatch`: ver D4. Costo: una invocación por cada
cambio de un partido, que sale en la primera línea sin leer nada más (el filtro de
estado usa sólo `before`/`after` del evento).

### 5.4 Callables nuevos (`src/callable/team-rivals.ts`, nuevo)

| Callable | Entrada | Permiso | Resultado |
|---|---|---|---|
| `getTeamRivals` | `{ownTeamId}` | miembro del grupo del equipo | Lista ordenada (D5/§5.1): `{rivalTeamId, name, jersey, groupName, favorite, played, wins, draws, losses, goalsFor, goalsAgainst, lastPlayedAt, recent[], canChallenge, pendingChallenge, hasUpcomingMatch}` |
| `setTeamRival` | `{ownTeamId, rivalTeamId, favorite?, hidden?, save?}` | `teams.edit` | Marca favorito, olvida, o **guarda a mano** (`save: true`, `origin: 'manual'`) a un equipo encontrado en el buscador. |

Detalles de `getTeamRivals`:

- `canChallenge`: el rival existe, no tiene `challengeOptOut`, tiene jugadores y
  no es del mismo grupo hoy.
- `pendingChallenge`: hay una invitación pendiente de este equipo a ese rival
  (consulta por `fromTeamId` + `status` en `teams/{rival}/invitations`).
- `hasUpcomingMatch`: existe un partido `planning`/`upcoming` entre ambos
  (consulta `participantTeamIds array-contains` y filtro en memoria). Sirve para
  **no ofrecer "Desafiar" de nuevo** si ya hay uno acordado.
- Excluye `hidden: true` salvo que se pida `includeHidden`.
- Lee los equipos con `db.getAll` en un solo viaje; los inexistentes se muestran
  con el snapshot y `canChallenge: false`.

`setTeamRival` con `save: true`:

- Valida que el rival exista, **no** sea del mismo grupo y no tenga
  `challengeOptOut`.
- Crea **sólo el documento del lado propio** (guardar a un equipo no avisa ni
  crea nada del lado de ellos).

### 5.5 Endurecer los desafíos (cierra un hueco de la fase 1)

En `challengeTeam`:

- Máximo **10 desafíos pendientes** enviados por equipo y **20 en 24 h** (consulta
  de grupo de colecciones sobre `invitations`, índice de §4.3). Error claro:
  "Tu equipo ya tiene demasiados desafíos pendientes".
- No desafiar si ya hay un partido `planning`/`upcoming` entre los dos
  (`hasUpcomingMatch`): "Ya tienen un partido acordado".
- Actualizar `lastChallengeAt` en el `teamRivals` del lado propio.
- Mensaje por defecto de **revancha** cuando existe historial (el cliente lo
  propone; el servidor no lo exige).

### 5.6 Planteles vivos hasta que arranca el partido (cierra otro hueco)

Hoy `respondTeamChallenge` **congela** los planteles al aceptar. Si alguien se
suma a un equipo después, no figura en `playerUids` y no puede subir clips ni
ver el partido como jugador.

En `onTeamWrite` (ya existe): si cambió `members` y existe algún partido
`planning`/`upcoming` con ese equipo en `participantTeamIds`:

1. Rearmar `teams[i].players` y `playerUids` desde los planteles actuales
   (reutilizando `buildChallengeTeams`).
2. Si el plantel quedó vacío o un jugador aparece en los dos equipos, **no
   escribir** y avisar a los capitanes.
3. Notificar al capitán rival: "X cambió su plantel".
4. **Congelar** cuando el partido pasa a `active`: nada se rearma durante o
   después del partido.

> Es la pieza más riesgosa de la fase: toca partidos en curso de planificación.
> Va **al final** y detrás de un test de emulador propio. Si el tiempo aprieta,
> puede salir en una entrega separada sin afectar el resto.

### 5.7 Mantenimiento

- `deleteTeam` (`group-management.ts`): borrar los `teamRivals` con
  `ownTeamId == teamId` y marcar `rivalDeleted: true` en los de
  `rivalTeamId == teamId` (consultas por igualdad, sin índice).
- Cambio de grupo del equipo: no existe hoy; si apareciera, `ownGroupId` /
  `rivalGroupId` deben actualizarse (anotado como riesgo).

---

## 6. App móvil

Todo en `patea_mobile/lib/`. Archivos nuevos entre paréntesis.

### 6.1 Modelos y servicio

- `core/models/team_rival_model.dart` (nuevo): `TeamRival` con el record
  (`record` → "2-1-0"), `hasHistory`, `lastPlayedLabel`, y `RecentMatch`.
- `core/services/team_challenge_service.dart`: agregar `getTeamRivals`,
  `setTeamRival`.
- Provider `teamRivalsProvider(ownTeamId)` (`FutureProvider.autoDispose.family`);
  se invalida después de desafiar, guardar o terminar un partido.
- Si el callable todavía no está desplegado, la pantalla muestra el estado vacío
  con "Reintentar" (no un error técnico).

### 6.2 "Buscar rival" (`challenge_team_screen.dart`)

- **Sin texto escrito**: además de la guía actual, aparece la sección **"Tus
  rivales"** del equipo elegido: tarjetas con camiseta, nombre, grupo, **récord**
  ("2G 1E 0P"), "Último: hace 3 semanas" y los botones **Revancha** (abre la hoja
  de desafío con el mensaje "¿Revancha?") y ⭐.
  - Esto **no rompe** la regla de "no listar todo": sólo muestra equipos con los
    que ya hubo trato.
  - Estados: cargando, vacío ("Todavía no jugaste contra nadie. Buscá un rival
    arriba."), error con reintento.
  - Los rivales con `pendingChallenge` muestran "Enviado" deshabilitado; los que
    tienen `hasUpcomingMatch` muestran "Partido acordado" y abren ese partido; los
    que tienen `canChallenge: false` muestran el motivo.
- **Con texto**: los resultados que ya son rivales llevan un chip "Ya jugaron N
  veces" / "Rival guardado", y todos los resultados tienen **⭐ Guardar** (sin
  desafiar), que llama a `setTeamRival(save: true)`.

### 6.2.1 Cambio de equipo propio

Al cambiar el equipo con el que se desafía (chips existentes), la lista de rivales
se recarga para ese equipo.

### 6.3 Ficha del equipo (`team_detail_screen.dart`)

- La tarjeta "Rivales" (`_RivalsCard`) suma una **vista previa de hasta 3
  rivales** (favoritos y último jugado) con el récord, y el enlace **"Ver todos"**.
- Visible para miembros del grupo (sólo lectura) y para quien administra el equipo
  (con acciones).

### 6.4 Pantalla "Rivales" (`features/groups/team_rivals_screen.dart`, nueva)

Ruta `/groups/teams/:id/rivals`.

- Lista completa ordenada (favoritos primero).
- Por rival: récord, goles a favor/en contra, últimos 5 resultados como fichas
  verde/gris/rojo, acciones **Revancha**, ⭐ y **Olvidar** (con confirmación y
  "Deshacer").
- Un interruptor "Mostrar olvidados" para recuperarlos.
- Toque en un resultado reciente abre el partido (`/matches/:id`).
- Sólo quien administra ve ⭐, Olvidar y Revancha.

### 6.5 Detalle del partido entre equipos (`match_detail_screen.dart`)

- Partido `intergroup_friendly` terminado: línea **"Serie contra X: 1G 0E 1P"** y
  "Rival guardado".
- Si es de un equipo que no administro, no se muestra nada de gestión.

### 6.6 Crear partido (`create_match_screen.dart`)

- La opción "Desafiar a otro equipo" ya abre `/challenge`; se le suma, bajo la
  descripción, el texto "Tus rivales guardados aparecen ahí".

### 6.7 Notificaciones

- Nuevo tipo `team_rematch` (desafío con `isRematch`): mismo destino `/challenges`.
- El aviso de "Desafío aceptado" lleva a `/matches/:id` (ya existe).

### 6.8 Calidad visual y de uso

- Tema claro y oscuro, 320 px y texto al 130 %: sin desbordes (se agrega a los
  tests que ya hacen esa pasada).
- Etiquetas de accesibilidad en ⭐ ("Marcar como favorito"), Revancha y Olvidar.
- Los íconos nuevos usan los del tema existente; sin colores fijos fuera del
  tema (el *ratchet* de colores no debe subir).

---

## 7. Compatibilidad con la web

- La web **no conoce** `teamRivals`: no la lee ni la escribe. Cero impacto.
- Los partidos que acepta la web (`acceptTeamChallengeAction`) **también** se
  cuentan, porque el trigger (D4) mira el partido y no quién lo creó. Lo que **no**
  hace la web es guardar el rival al aceptar; para esos partidos el par se crea
  recién cuando el partido termina (el trigger crea los dos documentos si faltan,
  con `origin: 'challenge'`).
- Portar la lista de rivales a la web queda como mejora posterior.

---

## 8. Migración (backfill)

`scripts/backfill-team-rivals.ts` (nuevo), con el mismo formato que
`backfill-geohash.ts` / `backfill-team-search.ts`:

1. Recorrer los partidos `intergroup_friendly` terminados (`completed`/`evaluated`).
2. Agrupar por par de equipos y **recalcular desde cero** las estadísticas de cada
   par (no incrementar): así es seguro volver a correrlo.
3. Escribir los dos documentos de cada par y marcar `rivalsRecordedAt` en cada
   partido procesado.
4. Modo simulación por defecto; `--apply` para escribir. Informa cuántos pares,
   cuántos partidos y cuántos se omiten por datos incompletos.

Sirve también como **reparación** si el trigger falla en algún partido.

---

## 9. Pruebas

### 9.1 Funciones (`functions/test/`)

`team-rivals.test.cjs` — lógica pura, corre sin emulador:

- `rivalDocId` es simétrico por lado y determinista.
- `outcomeFor`: victoria, empate, derrota, 0-0, orden de equipos invertido,
  datos faltantes → `null`.
- `applyResult`: suma correcta, `recent` se recorta a 5 y queda ordenado,
  `countedMatchIds` evita contar dos veces el mismo partido, tope de 50.
- `isCountableMatch`: sólo `intergroup_friendly` terminado con dos equipos.
- `sortRivals`: favoritos primero, luego más reciente, luego nombre.
- Que el orden de `participantTeamIds`/`teams` de `respondTeamChallenge` coincide
  con lo que asume `outcomeFor` (test que fija el contrato).

`team-rivals.emulator.test.cjs` — con emulador (se saltea sin él):

- Aceptar un desafío crea los dos documentos; rechazar no crea nada.
- Terminar el partido actualiza ambos lados una sola vez, aunque el trigger se
  dispare dos veces.
- `getTeamRivals` oculta los olvidados y marca `canChallenge`,
  `pendingChallenge`, `hasUpcomingMatch`.
- `setTeamRival` rechaza a quien no administra el equipo y a rivales del mismo
  grupo u ocultos.
- Tope de desafíos pendientes y de 24 h.
- Reglas: `teamRivals` no se puede leer ni escribir desde el cliente.
- (5.6) Cambiar el plantel antes de empezar actualiza `playerUids`; después de
  empezar no.

### 9.2 Flutter (`patea_mobile/test/`)

- Modelo: récord, "hace N semanas", orden.
- "Buscar rival": sin texto aparecen **sólo** los rivales guardados (nunca la
  lista de equipos); con texto aparecen los resultados con chip y ⭐; **Revancha**
  abre la hoja con el mensaje; "Enviado" y "Partido acordado" deshabilitan.
- Pantalla "Rivales": orden, favorito, olvidar con deshacer, "mostrar olvidados",
  sólo lectura para quien no administra.
- Detalle del partido: "Serie contra X".
- 320 px / 130 % / claro y oscuro sin desbordes.
- Goldens: regenerar sólo `equipo_detalle` y los que cambien por esta fase;
  revisar las imágenes antes de aceptarlas.

### 9.3 Criterios de aceptación

1. Dos equipos de grupos distintos aceptan un desafío → **ambos** aparecen en la
   lista de rivales del otro, con récord 0-0-0.
2. Terminan el partido con resultado → los dos récords se actualizan **una sola
   vez**, con los goles correctos y el signo invertido en cada lado.
3. "Revancha" desde la lista desafía de nuevo con un toque y no permite un
   segundo desafío mientras haya uno pendiente o un partido acordado.
4. Olvidar oculta al rival sin perder el historial; un partido nuevo lo recupera.
5. Ninguna pantalla lista equipos sin que se escriba, salvo "Tus rivales".
6. Un cliente no puede leer ni escribir `teamRivals` directo.
7. `flutter analyze` sin errores ni avisos nuevos, tests verdes, *ratchet* de
   colores sin subir.

---

## 10. Orden de implementación

Cada paso se puede commitear y probar solo.

| # | Tarea | Depende de | Riesgo |
|---|---|---|---|
| 1 | `lib/team-rivals.ts` + `team-rivals.test.cjs` (lógica pura) | — | bajo |
| 2 | Regla `teamRivals` cerrada + nota en reglas | — | bajo |
| 3 | `respondTeamChallenge` guarda los dos lados | 1 | medio |
| 4 | Trigger `onTeamMatchResult` (cuenta el resultado) | 1 | medio |
| 5 | Callables `getTeamRivals` / `setTeamRival` | 1, 2 | bajo |
| 6 | Modelo + servicio + provider en la app | 5 | bajo |
| 7 | "Tus rivales" y ⭐ en "Buscar rival" + Revancha | 6 | medio |
| 8 | Vista previa en la ficha + pantalla "Rivales" | 6 | medio |
| 9 | "Serie contra X" en el detalle del partido | 6 | bajo |
| 10 | Tope de desafíos y "partido ya acordado" (§5.5) | 5 | medio |
| 11 | `deleteTeam` limpia rivales (§5.7) | 2 | bajo |
| 12 | Backfill + corrida en simulación | 1, 4 | bajo |
| 13 | Planteles vivos (§5.6) — **opcional, entrega aparte** | 3 | **alto** |
| 14 | Tests de emulador, goldens, pasada 320 px / 130 % | todos | — |

---

## 11. Despliegue

Orden que evita estados rotos:

1. **Funciones**: nuevos callables, trigger `onTeamMatchResult`. El código nuevo no
   cambia el comportamiento de partidos existentes.
2. **Reglas** (`teamRivals` cerrada) e **índices** (grupo de colecciones de
   `invitations`). Esperar a que el índice esté listo antes de seguir.
3. **Backfill** en simulación; revisar el resumen; recién entonces `--apply`.
4. **App**: publicar la versión que usa los callables. Si sale antes que las
   funciones, la sección de rivales muestra el estado vacío con "Reintentar" y el
   resto de la app funciona igual.

Marcha atrás: la colección es nueva y sólo la usan estos callables; quitar la
sección en la app y desactivar el trigger deja todo como antes. No hay migración de
datos existentes que revertir.

---

## 12. Riesgos y decisiones abiertas

| Tema | Riesgo | Respuesta propuesta |
|---|---|---|
| Orden de equipos en el partido | Contar el resultado al revés | Contrato fijado por test (§9.1); el trigger no corre si no puede resolver los lados |
| Partidos cerrados desde la web | No se contarían | El trigger mira el partido, no quién lo cierra (D4) |
| Trigger invocado dos veces | Doble conteo | `rivalsRecordedAt` + `countedMatchIds` |
| Partidos terminados antes de esta fase | Sin historial | Backfill idempotente (§8) |
| Planteles vivos (§5.6) | Reescribir partidos en planificación | Entrega aparte, con test de emulador, congelado al empezar |
| Spam de desafíos | Molestar a otros equipos | Topes por equipo (§5.5) y opt-out ya existente |
| Equipo eliminado | Rivales huérfanos | Limpieza en `deleteTeam` + snapshot de respaldo |

**A confirmar** (con la propuesta por defecto entre paréntesis):

1. ¿Cuentan también los partidos `by_teams` del mismo grupo? (**no**, D7)
2. ¿Los miembros del equipo ven la lista o sólo quienes administran? (**ven**, sólo
   lectura, D6)
3. ¿Un rival olvidado reaparece al jugar un partido nuevo? (**sí**)
4. ¿Se entrega §5.6 (planteles vivos) con esta fase o aparte? (**aparte**)
5. ¿Tope de rivales por equipo? (**100**)

---

## 13. Archivos que se tocan

**Funciones**
- `functions/src/lib/team-rivals.ts` — nuevo
- `functions/src/callable/team-rivals.ts` — nuevo
- `functions/src/triggers/on-team-match-result.ts` — nuevo
- `functions/src/callable/team-challenges.ts` — guardar al aceptar, topes, `hasUpcomingMatch`
- `functions/src/callable/group-management.ts` — `deleteTeam` limpia rivales
- `functions/src/triggers/on-team-write.ts` — sólo si se hace §5.6
- `functions/src/index.ts` — exports
- `functions/test/team-rivals.test.cjs`, `team-rivals.emulator.test.cjs` — nuevos
- `firestore.rules`, `firestore.indexes.json`
- `scripts/backfill-team-rivals.ts` — nuevo

**App**
- `lib/core/models/team_rival_model.dart` — nuevo
- `lib/core/services/team_challenge_service.dart`
- `lib/features/matches/challenge_team_screen.dart`
- `lib/features/groups/team_detail_screen.dart`
- `lib/features/groups/team_rivals_screen.dart` — nuevo
- `lib/features/matches/match_detail_screen.dart`
- `lib/features/matches/create_match_screen.dart`
- `lib/core/router/app_router.dart` — ruta `/groups/teams/:id/rivals`
- `test/team_rivals_test.dart` — nuevo; goldens que cambien
