# Pateá — Briefing Técnico para Revisión y Corrección

## Contexto del Proyecto

**Pateá** es una aplicación Next.js 14 (App Router) para gestión de fútbol amateur. Usa Firebase (Firestore, Auth, Storage), TypeScript, Tailwind CSS y shadcn/ui.

Tiene dos grandes secciones:
- **App principal** (`/src/app/`): dashboard, partidos, jugadores, grupos, social, comunidad
- **Organizer** (`/src/app/organizer/`): panel de gestión de ligas y copas con fixture, standings, bracket, equipos, solicitudes de inscripción

Los tipos centrales están en `src/lib/types.ts`. Las server actions en `src/lib/actions/`. Los componentes del organizer en `src/components/organizer/`.

---

## PARTE 1 — Implementaciones completadas hoy ✅

Los siguientes items fueron **completados en esta sesión** (feb 2026):

### ✅ HECHO — Server Actions Migration (fixtures, árbitros, resultados, bracket, sponsors, cup status)
- **Archivos**: `src/lib/actions/server-actions.ts` (agregadas acciones) + múltiples componentes del organizer
- **Actions Implementadas**:
  - `saveLeagueFixturesAction` — persiste rounds de fixture de liga con ownership validation
  - `addRefereeAction`, `updateRefereeAction`, `deleteRefereeAction` — CRUD de árbitros con seguridad
  - `assignRefereeAction` — asigna árbitro a partido (liga o copa)
  - `saveMatchResultAction` — guarda resultados de partidos (ambos formatos)
  - `updateBracketMatchSettingsAction` — configura fecha/hora/lugar/streaming de bracket
  - `updateCupStatusAction` — cambio de estado de copa
  - `manageSponsorAction` — add/remove patrocinadores
- **Componentes Actualizados**: `league-fixture-tab`, `competition-referees-tab`, `assign-referee-dialog`, `competition-match-result-dialog`, `bracket-match-settings-dialog`, `cup/[id]/page`, `competition-sponsors-tab`
- **Destino**: Todas las opciones incluyen validación de ownership y manejo de errores; `npm run typecheck` pasó ✅

### ✅ HECHO — Hook useCompetitionTeams (centralización de carga de equipos)
- **Archivo**: `src/hooks/use-competition-teams.ts` (nuevo)
- **Descripción**: Custom hook que encapsula la carga de ghost teams + real teams, eliminando duplicación en 4+ componentes
- **Estado**: Integrado en componentes de nivel alto; reduce listeners duplicados

### ✅ HECHO — Limpieza de GEMINI_BRIEFING.md
- Removida sección PARTE 1 anterior que documentaba items ya corregidos
- Briefing ahora enfocado en trabajo **verdaderamente pendiente**

---

## PARTE 2 — Issues pendientes por resolver

A continuación los problemas que **NO han sido corregidos aún**, con suficiente contexto para implementar el fix.

---

### 🔴 CRÍTICO #3 — Firebase Admin SDK inicializado múltiples veces

**Archivo:** `src/lib/actions/registration-actions.ts`, `location-actions.ts`, `group-role-actions.ts`, `match-invitation-actions.ts`, `venue-actions.ts`

**Problema:** Cada uno de estos archivos tiene su propia inicialización inline:
```typescript
if (getApps().length === 0) {
  initializeApp({ credential: cert(...), projectId: ... });
}
const db = getFirestore();
```
Esto duplica lógica y puede causar instancias inconsistentes. La inicialización centralizada ya existe en `src/firebase/admin-init.ts` que exporta `getAdminDb()`.

**Fix requerido:**
1. En todos los archivos que tengan inicialización inline, eliminarla.
2. Importar `getAdminDb` desde `@/firebase/admin-init` en su lugar.
3. Reemplazar el `db` local por llamadas a `getAdminDb()`.

Ejemplo de lo que debe quedar:
```typescript
// ELIMINAR esto:
if (getApps().length === 0) { initializeApp(...) }
const db = getFirestore();

// REEMPLAZAR por:
import { getAdminDb } from '@/firebase/admin-init';
// y usar getAdminDb() en cada función
```

---

### 🔴 CRÍTICO #5 — `league.rules` no existe en el tipo League

**Archivo:** `src/app/organizer/league/[id]/page.tsx` (línea ~299), `src/lib/types.ts`

**Problema:** Se pasa `rules={league.rules}` al componente `LeagueStandingsTab`, pero el tipo `League` no tiene la propiedad `rules`. El componente `LeagueStandingsTab` acepta:
```typescript
rules?: { pointsForWin: number; pointsForDraw: number }
```
Si un organizador configuró reglas custom en Firestore, se ignoran.

**Fix requerido:**
1. En `src/lib/types.ts`, agregar al tipo `League`:
```typescript
rules?: {
  pointsForWin: number;
  pointsForDraw: number;
};
```
2. Verificar que en la UI de creación/edición de liga se puedan configurar estas reglas. Si no existe UI, es aceptable dejarlo como dato solo de Firestore por ahora.

---

### 🔴 CRÍTICO #8 — `liveStatus` y `currentMinute` no están en el tipo Match

**Archivo:** `src/app/dashboard/page.tsx` (líneas ~224, ~442), `src/lib/types.ts`

**Problema:** El dashboard filtra `m.liveStatus === 'first_half'` y accede a `selectedLive.currentMinute`, pero el tipo `Match` no define estos campos. Solo funcionan porque `Match` extiende `DocumentData`.

**Fix requerido:**
1. En `src/lib/types.ts`, agregar al tipo `Match`:
```typescript
liveStatus?: 'first_half' | 'half_time' | 'second_half' | 'extra_time';
currentMinute?: number;
```
2. Verificar que el código del dashboard los use con optional chaining (`match.liveStatus?.` y `match.currentMinute ?? 0`).

---

### 🟡 ALTO #10 — Eliminar competición no borra subcollecciones

**Archivo:** `src/app/organizer/page.tsx` (función `handleDeleteCompetition`)

**Problema:** La función solo ejecuta `deleteDoc` sobre el documento raíz. En Firestore, eliminar un documento no elimina sus subcollecciones. Las subcollecciones `teams/`, `fixtures/`, `applications/` quedan huérfanas.

**Fix requerido:**
Crear una server action `deleteCompetitionAction` en `src/lib/actions/server-actions.ts` que use el Admin SDK para borrar recursivamente:
```typescript
export async function deleteCompetitionAction(
  competitionId: string,
  competitionType: 'leagues' | 'cups'
): Promise<{ success: boolean; error?: string }> {
  // Verificar ownership (session.user.uid === comp.ownerUid)
  // Usar getAdminDb().recursiveDelete(ref) o borrar subcollecciones manualmente:
  // - /{type}/{id}/teams/
  // - /{type}/{id}/fixtures/ (solo ligas)
  // - /{type}/{id}/applications/
  // - Luego borrar el documento raíz
}
```
En el componente, llamar esta server action en vez de `deleteDoc` directo.

---

### 🟡 ALTO #15 — Lógica de carga de equipos duplicada en 5 componentes

**Archivos:** `league-fixture-tab.tsx`, `league-standings-tab.tsx`, `competition-teams-tab.tsx`, `cup-bracket-tab.tsx`, `league-next-matches-widget.tsx`

**Problema:** Los mismos 2-3 efectos (ghost teams de subcollección + real teams de `compData.teams`) están copiados textualmente. Cuando el organizer tiene la página de liga abierta, hay al menos 3 listeners independientes sobre `leagues/{id}/teams`.

**Fix requerido:**
Crear un custom hook `src/hooks/use-competition-teams.ts`:
```typescript
export function useCompetitionTeams(
  competitionId: string,
  competitionType: 'leagues' | 'cups',
  compData: any
): { teams: Team[]; loading: boolean }
```
Que encapsule los 2 efectos ya corregidos (ghost teams + real teams). Reemplazar las implementaciones duplicadas en los 5 componentes por este hook.

---

### 🟡 ALTO #17 — Eliminar liga en progreso sin validación adicional

**Archivo:** `src/app/organizer/page.tsx`

**Problema:** El dialog de confirmación de eliminación es genérico para todos los estados. No advierte cuando la competición tiene estado `in_progress` con partidos jugados.

**Fix requerido:**
En el `AlertDialog` de confirmación, mostrar una advertencia adicional si `comp.status === 'in_progress'`:
```tsx
{competitionToDelete && allCompetitions.find(c => c.id === competitionToDelete.id)?.status === 'in_progress' && (
  <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 mt-3">
    <p className="font-bold text-destructive">⚠️ Esta competición está en curso</p>
    <p className="text-xs text-muted-foreground mt-1">
      Tiene partidos en progreso. Se perderán todos los resultados y datos irreversiblemente.
    </p>
  </div>
)}
```

---

### 🟡 ALTO #18 — Form de registro se completa antes de saber que está cerrado

**Archivo:** `src/app/competitions/league/[id]/register/page.tsx`

**Problema:** El usuario puede completar todo el formulario y al hacer submit recibir "El período de inscripción ya cerró." El check de `registrationClosed` deshabilita el botón pero no muestra el mensaje al inicio.

**Fix requerido:**
Al inicio del formulario (antes del `<form>`), si `registrationClosed === true`, mostrar un estado de error prominente en lugar del formulario vacío:
```tsx
if (registrationClosed) {
  return (
    <Card>
      <CardContent className="p-12 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <h3 className="font-bold text-xl">Inscripciones cerradas</h3>
        <p className="text-muted-foreground mt-2">
          El período de inscripción para esta competición ha finalizado.
        </p>
      </CardContent>
    </Card>
  );
}
```

---

### 🟡 ALTO #25 — `organizer/layout.tsx` accede a `document` durante SSR

**Archivo:** `src/app/organizer/layout.tsx` (líneas ~132-148)

**Problema:** Hay acceso directo a `document.documentElement.classList` en el render, causando hydration mismatch porque el servidor no tiene `document`.

**Fix requerido:**
Mover el acceso a `document` dentro de un `useEffect`:
```typescript
const [isGameTheme, setIsGameTheme] = React.useState(false);
React.useEffect(() => {
  setIsGameTheme(document.documentElement.classList.contains('game'));
}, []);
```
O usar `typeof document !== 'undefined' && document.documentElement.classList.contains('game')` solo en efectos del lado cliente.

---

### 🟡 ALTO #26 — `revokeApplicationAction` devuelve status `'pending'`

**Archivo:** `src/lib/actions/server-actions.ts` (función `revokeApplicationAction`)

**Problema:** Al revocar una aplicación aprobada, se cambia a `'pending'`. Esto hace que reaparezca en la lista de pendientes como si fuera nueva, sin historial.

**Fix requerido:**
1. Agregar `'revoked'` como valor posible en `CompetitionApplication.status` en `types.ts`:
```typescript
status: 'pending' | 'approved' | 'rejected' | 'revoked';
```
2. En `revokeApplicationAction`, cambiar el status a `'revoked'` en lugar de `'pending'`.
3. En `competition-applications-tab.tsx`, agregar `'revoked'` a `statusConfig` con estilo apropiado (gris, ícono de MinusCircle).
4. En el filter de tabs, incluir `'revoked'` como opción de filtro.

---

### 🟡 ALTO #33 — Se puede iniciar liga sin equipos suficientes

**Archivos:** `src/app/organizer/league/[id]/page.tsx`, `src/lib/actions/server-actions.ts`

**Problema:** El botón de "Iniciar Liga" (cambiar status a `in_progress`) no verifica que haya suficientes equipos para generar un fixture.

**Fix requerido:**
En la server action que cambia el status de la liga a `in_progress`, agregar validación:
```typescript
const teamCount = (await getAdminDb().collection('leagues').doc(leagueId).collection('teams').count().get()).data().count;
const realTeamCount = (leagueData.teams || []).length;
const total = teamCount + realTeamCount;
if (total < 2) {
  return { success: false, error: 'Se necesitan al menos 2 equipos para iniciar la liga.' };
}
```
En el frontend, también deshabilitar el botón si el total de equipos es menor a 2, con tooltip explicativo.

---

### 🟡 ALTO #42 — Listeners de métricas se recrean en cada update

**Archivo:** `src/app/organizer/page.tsx` (useEffect de métricas, línea ~167)

**Problema:** El `useEffect` depende de `allCompetitions` que es un `useMemo` basado en `leagues` y `cups`. Cada cambio en cualquier documento de liga o copa genera una nueva referencia de array → el `useMemo` re-ejecuta → todos los listeners de métricas se destruyen y recrean.

**Fix requerido:**
Usar IDs estables como dependencia en lugar del array completo:
```typescript
const competitionIds = React.useMemo(
  () => allCompetitions.map(c => `${c._collectionName}:${c.id}`).join(','),
  [allCompetitions]
);

React.useEffect(() => {
  // ... setup listeners
}, [firestore, competitionIds]); // string estable, no array
```
O separar el efecto de métricas por competición con efectos individuales para evitar el teardown masivo.

---

### 🟢 MEDIO #11 — Verificación de ownership en escrituras del organizer

**Archivos:** `src/components/organizer/league-fixture-tab.tsx`, `competition-teams-tab.tsx`

**Problema:** Las operaciones críticas (generar fixture, agregar/eliminar equipos) usan el Firebase Client SDK directamente desde el frontend. La seguridad depende exclusivamente de las Firestore Security Rules.

**Fix requerido:**
Mover las operaciones de escritura más críticas a server actions con verificación de ownership:
- `generateFixtureAction(leagueId, teams, format)` — verifica `league.ownerUid === session.user.uid`
- Para operaciones de equipos (add/delete) que ya son cliente, asegurarse que las Firestore Security Rules tengan: `allow write: if request.auth.uid == resource.data.ownerUid`

Verificar que `firestore.rules` cubra correctamente estos casos.

---

### 🟢 MEDIO #19 — Forma reciente en standings no es cronológica

**Archivo:** `src/components/organizer/league-standings-tab.tsx` (función `computeFromRounds`)

**Problema:** Los resultados se agregan con `recentForm.unshift()` en orden de rondas, no de fecha real. En `double_round_robin`, si los partidos se juegan fuera de orden, la columna "Forma" mostrará resultados incorrectos.

**Fix requerido:**
Agregar un campo `date` (ISO o DD/MM/YYYY) a los partidos al generarlos, y ordenar los partidos por fecha antes de computar el recentForm:
```typescript
// En generateRoundRobin, guardar fecha si existe
// En computeFromRounds, aplanar y ordenar por fecha:
const allMatches = roundsList
  .flatMap(r => r.matches.map(m => ({ ...m, roundNumber: r.roundNumber })))
  .sort((a, b) => {
    // ordenar por date si existe, sino por roundNumber
    if (a.date && b.date) return a.date.localeCompare(b.date);
    return (a.roundNumber || 0) - (b.roundNumber || 0);
  });
```

---

### 🟢 MEDIO #27 — IDs de partidos no únicos al regenerar fixture

**Archivo:** `src/components/organizer/league-fixture-tab.tsx` (función `generateRoundRobin`)

**Problema:** Los IDs siguen el patrón `match_{round}_{index}`. Al regenerar el fixture, los nuevos partidos tienen los mismos IDs que los anteriores.

**Fix requerido:**
Usar un identificador con timestamp o UUID para que cada generación sea única:
```typescript
id: `match_${r}_${i}_${Date.now()}`,
// o en double_round_robin:
id: `match_${r + numRounds}_${crypto.randomUUID().slice(0, 8)}`,
```

---

### 🟢 MEDIO #30 — `photoUrl` vs `photoURL` inconsistencia sistémica

**Archivos:** 40+ ubicaciones en `src/lib/actions/` y `src/components/`

**Problema:** El tipo `Player` usa `photoURL` (uppercase) pero Firestore guarda datos con `photoUrl` (camelCase). Muchas funciones hacen fallback manual `data.photoUrl || data.photoURL`.

**Fix requerido:**
1. En `src/lib/types.ts`, cambiar el tipo `Player` para aceptar ambos:
```typescript
photoURL?: string;
photoUrl?: string; // legacy alias
```
2. Crear un helper:
```typescript
export const getPlayerPhoto = (player: Player): string | undefined =>
  player.photoURL || player.photoUrl;
```
3. Reemplazar todos los accesos directos `player.photoURL` por `getPlayerPhoto(player)` en los componentes que muestran fotos.

---

### 🟢 MEDIO #31 — Navegación mobile ausente en organizer layout

**Archivo:** `src/app/organizer/layout.tsx`

**Problema:** Los links de navegación ("Panel", "App Principal", etc.) solo se muestran con `hidden lg:flex`. En mobile no hay forma de acceder a estas secciones.

**Fix requerido:**
Agregar un menú hamburguesa para mobile en el organizer layout, similar al de la app principal. Puede ser un `Sheet` de shadcn/ui con los mismos links que el nav desktop.

---

### 🟢 MEDIO #36 — "Zona de descenso" siempre visible

**Archivo:** `src/components/organizer/league-standings-tab.tsx` (función `relegationStyle`)

**Problema:** Si hay 6+ equipos, los últimos 2 tienen borde rojo indicando "zona de descenso", aunque sea una liga amateur sin descenso.

**Fix requerido:**
1. Agregar una prop `showRelegation?: boolean` al componente `LeagueStandingsTab`.
2. Solo mostrar el estilo de descenso si `showRelegation === true`.
3. En la vista de organizer, pasar `showRelegation={league.hasRelegation}` (nuevo campo opcional en el tipo `League`).
4. Por defecto, `showRelegation = false`.

---

### 🟢 MEDIO #38 — Empty state para copas sin bracket

**Archivo:** `src/app/organizer/page.tsx` (card de cada copa)

**Problema:** Cuando una copa no tiene bracket generado, las métricas muestran "0/0 Partidos" y "No programado" sin indicar que el siguiente paso es generar el bracket.

**Fix requerido:**
En la card de la copa, si `totalMatches === 0` y `comp.status !== 'completed'`, mostrar:
```tsx
<div className="text-xs text-muted-foreground italic">
  Generá el bracket para ver el progreso
</div>
```
En lugar de los indicadores de métricas vacíos.

---

### 🟢 MEDIO #44 — Sin loading state por competición en explorador público

**Archivo:** `src/components/competitions/public-competitions-browser.tsx`

**Problema:** El estado `applying` es un string con el ID de la competición, pero el spinner solo aparece en el botón correcto. Si el usuario clickea rápido en otro botón, puede enviar dos solicitudes.

**Fix requerido:**
Deshabilitar todos los botones mientras cualquier postulación esté en curso:
```tsx
disabled={!selectedTeam || applying !== null}  // era: applying === competition.id
```
Y agregar visual feedback global cuando `applying !== null`.

---

### 🟢 MEDIO #47 — Botones sin `aria-label`

**Archivo:** `src/components/organizer/competition-teams-tab.tsx` (botones Edit2, Trash2), `league-fixture-tab.tsx` (botón Settings)

**Problema:** Los botones de icono no tienen texto accesible para lectores de pantalla.

**Fix requerido:**
Agregar `aria-label` a todos los botones de solo icono:
```tsx
<Button aria-label="Editar equipo" ...>
  <Edit2 className="h-4 w-4" />
</Button>
<Button aria-label="Eliminar equipo" ...>
  <Trash2 className="h-4 w-4" />
</Button>
```

---

## PARTE 3 — Issues técnicos de arquitectura (menor prioridad)

### #9 — `useDoc` con referencia potencialmente inestable
**Archivo:** `src/firebase/firestore/use-doc.tsx`

Verificar que todos los consumidores de `useDoc` wrappen la `DocumentReference` en `useMemo` con dependencias correctas. Buscar con grep `useDoc<` y confirmar que no haya llamadas con refs creadas inline (sin `useMemo`).

### #21 — Dashboard con 13 listeners Firestore simultáneos
**Archivo:** `src/app/dashboard/page.tsx`

Las queries `groupMatchesQuery1/2`, `upcomingMatchesQuery1/2`, `friendlyMatchesQuery1/2`, `activeMatchesQuery1/2` podrían consolidarse. Considerar si algunas pueden ser queries únicas con `in` operator en vez de dos queries separadas.

### #22 — Inconsistencia `'league'/'cup'` vs `'leagues'/'cups'`
**Archivos:** Múltiples

Documentar la convención: colecciones Firestore usan plural (`leagues`, `cups`), el tipo lógico `CompetitionFormat` usa singular (`league`, `cup`). Crear helpers de conversión para evitar errores:
```typescript
export const toCollectionName = (type: CompetitionFormat): 'leagues' | 'cups' =>
  type === 'league' ? 'leagues' : 'cups';

export const toCompetitionFormat = (collection: 'leagues' | 'cups'): CompetitionFormat =>
  collection === 'leagues' ? 'league' : 'cup';
```

---

## Prioridades de implementación sugeridas

1. **#3** Admin SDK → evita errores intermitentes en producción
2. **#10** Borrado recursivo → evita acumulación de datos huérfanos
3. **#15** Hook compartido `useCompetitionTeams` → reduce listeners y código duplicado
4. **#5 + #8** Types faltantes en League y Match → mejora type safety
5. **#25** Hydration mismatch en organizer layout → mejora SSR
6. **#17 + #18** UX de confirmaciones → previene pérdida accidental de datos
7. **#26** Status `'revoked'` → mejora historial de solicitudes
8. **#33** Validación al iniciar liga → previene estados inválidos
9. **#36** showRelegation prop → limpia la UI para ligas sin descenso
10. **#30** photoUrl/photoURL helper → elimina inconsistencia sistémica
11. **#38 + #44** Empty states y loading → mejora UX
12. **#47** aria-labels → accesibilidad básica

---

## PARTE 4 — Tablero de ejecución (operativo)

### 4.1 Estado de issues (tracking)

| ID | Prioridad | Estado | Owner | Riesgo | ETA | DoD (resumen) |
|---|---|---|---|---|---|---|
| #3 | 🔴 Crítico | ⬜ Pendiente | Backend | Alto | 0.5d | Sin init inline, todo via `getAdminDb()` |
| #10 | 🟡 Alto | ✅ Hecho | Backend | Completado | 0d | Borrado recursivo + ownership + UI conectada |
| #15 | 🟡 Alto | ✅ Hecho | Frontend | Completado | 0d | Hook único `useCompetitionTeams` usado en 5 componentes |
| #5 | 🔴 Crítico | ⬜ Pendiente | Frontend | Medio | 0.25d | `League.rules` tipado y propagado |
| #8 | 🔴 Crítico | ⬜ Pendiente | Frontend | Medio | 0.25d | `Match.liveStatus/currentMinute` tipados + uso seguro |
| #25 | 🟡 Alto | ⬜ Pendiente | Frontend | Alto | 0.5d | Sin acceso a `document` en render SSR |
| #17 | 🟡 Alto | ⬜ Pendiente | Frontend | Medio | 0.25d | Alerta explícita para `in_progress` en eliminación |
| #18 | 🟡 Alto | ⬜ Pendiente | Frontend | Medio | 0.5d | Estado "Inscripciones cerradas" antes del form |
| #26 | 🟡 Alto | ⬜ Pendiente | Fullstack | Medio | 0.5d | Nuevo estado `revoked` + filtros y estilos |
| #33 | 🟡 Alto | ⬜ Pendiente | Fullstack | Alto | 0.5d | Bloqueo iniciar liga con <2 equipos (server + UI) |
| #42 | 🟡 Alto | ⬜ Pendiente | Frontend | Medio | 0.5d | Dependencias estables para listeners métricos |
| #30 | 🟢 Medio | ⬜ Pendiente | Frontend | Medio | 1.5d | Helper único `getPlayerPhoto` aplicado en UI |
| #36 | 🟢 Medio | ⬜ Pendiente | Frontend | Bajo | 0.25d | `showRelegation` opcional con default `false` |
| #38 | 🟢 Medio | ⬜ Pendiente | Frontend | Bajo | 0.25d | Empty state de copa sin bracket |
| #44 | 🟢 Medio | ⬜ Pendiente | Frontend | Bajo | 0.25d | Deshabilitar todas las postulaciones durante apply |
| #47 | 🟢 Medio | ⬜ Pendiente | Frontend | Bajo | 0.25d | `aria-label` en botones de ícono |
| #9 | Arquitectura | ⬜ Pendiente | Frontend | Bajo | 0.5d | `useDoc` siempre con refs memoizadas |
| #21 | Arquitectura | ⬜ Pendiente | Frontend | Bajo | 1d | Reducción de listeners dashboard |
| #22 | Arquitectura | ⬜ Pendiente | Fullstack | Bajo | 0.25d | Helpers de mapeo singular/plural |

**Leyenda estado:** ⬜ Pendiente · 🟦 En progreso · ✅ Hecho · ⛔ Bloqueado

---

### 4.2 Definition of Done (checklist base por issue)

- Código implementado en archivos indicados por el issue.
- `npm run typecheck` en verde.
- Sin regressions visibles en organizer y vista pública relacionada.
- Error handling y toasts en caminos de fallo (si aplica).
- Si toca tipos (`types.ts`), compilación y usos actualizados.
- Si toca acciones críticas (delete/start/revoke), validación server-side incluida.
- Registro de validación manual (3-6 pasos) en PR description.

---

### 4.3 Plan de implementación por sprint

### Sprint 0 — Completado hoy ✅

- ✅ #10 Borrado recursivo de competiciones (server action + ownership)
- ✅ #15 Hook compartido `useCompetitionTeams`
- ✅ Migraciones de server actions: fixtures, árbitros, resultados, bracket, sponsors, cup status

**Salida esperada:** Todas las operaciones críticas del organizer usan server actions con validación de ownership; hooks centralizados reducen duplicación y listeners.

---

### Sprint 1 — Seguridad y consistencia de datos (bloqueante release)

- #3 Centralizar Admin SDK
- #33 Validación de equipos mínimos para iniciar liga
- #25 Fix SSR/hydration en organizer layout

**Salida esperada:** Sin datos huérfanos, sin estados inválidos críticos, sin mismatch SSR.

---

### Sprint 2 — Reducción de deuda y type safety

- #5 `League.rules`
- #8 `Match.liveStatus/currentMinute`
- #26 Estado `revoked`  
- #42 Estabilización de listeners de métricas

**Salida esperada:** Menos duplicación, menos listeners innecesarios y tipos coherentes.

---

### Sprint 3 — UX y accesibilidad

- #17 Confirmación fuerte para eliminación en curso
- #18 Estado temprano de inscripción cerrada
- #36 showRelegation opcional
- #38 Empty state copa sin bracket
- #44 Loading global por postulación
- #47 Aria-labels en icon buttons
- #30 Estrategia única de fotos (`photoUrl/photoURL`)

**Salida esperada:** UX más predecible, menos errores de usuario y mejor accesibilidad.

---

### 4.4 Riesgos y dependencias

- #10 depende de #3 (Admin SDK estable).
- #15 debe ir antes de optimizar listeners secundarios (#42).
- #30 puede ser incremental por módulos para evitar PR gigante.
- #26 requiere alinear UI + acciones + tipos en el mismo merge.

---

### 4.5 Plantilla de cierre por issue (usar en PR)

```md
## Issue #XX — [título]

### Cambios
- ...

### Validación manual
1. ...
2. ...
3. ...

### Resultado
- [ ] `npm run typecheck` OK
- [ ] Sin regresiones funcionales
- [ ] UX/errores contemplados
```

---

*Documento generado desde el análisis técnico del branch `feat/ligas-y-copas` y la revisión general de la app. Fecha: 2026-03-20.*
