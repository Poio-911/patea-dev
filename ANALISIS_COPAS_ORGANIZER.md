# Análisis del Sistema de Copas - Vista Organizer

**Fecha:** 18 de marzo, 2026
**Branch:** `feat/ligas-y-copas`

---

## Problema Identificado

Actualmente, el sistema de Copas (eliminación directa) **NO tiene una interfaz dedicada en el modo Organizer** similar a la que existe para Ligas.

### Estado Actual

✅ **Sistema de Copas - Implementación Backend Completa:**
- ✅ Tipo de datos `Cup` definido en `src/lib/types.ts`
- ✅ Sistema de brackets (llaves) implementado en `src/lib/utils/cup-bracket.ts`
- ✅ Componente de visualización `CupBracket` en `src/components/competitions/cup-bracket.tsx`
- ✅ Vista de partido de copa `CupMatchView` en `src/components/cup/CupMatchView.tsx`
- ✅ Lógica de avance automático de ganadores
- ✅ Generación de brackets con 2, 4, 8, 16 o 32 equipos
- ✅ Dos modos de sorteo: random y por OVR

❌ **Lo que FALTA - Interfaz Organizer para Copas:**
- ❌ No existe página `/organizer/cup/[id]/page.tsx` (solo existe `/organizer/league/[id]/page.tsx`)
- ❌ No hay tabs específicos para copas en el organizer
- ❌ El dashboard muestra copas en la lista, pero al hacer click redirige a una página que no existe
- ❌ No hay UI para generar/regenerar brackets desde el organizer
- ❌ No hay UI para crear partidos del bracket manualmente
- ❌ No hay integración con el `match-result-dialog` para copas

---

## Arquitectura del Sistema de Brackets

### Estructura de Datos: BracketMatch

```typescript
export type BracketMatch = {
  id: string;                    // "match-1", "match-2", etc.
  round: CupRound;               // 'round_of_32' | 'round_of_16' | 'round_of_8' | 'semifinals' | 'final'
  matchNumber: number;           // Posición en la ronda (1, 2, 3, 4...)
  team1Id?: string;              // undefined hasta ser determinado
  team2Id?: string;
  team1Name?: string;
  team2Name?: string;
  team1Jersey?: Jersey;
  team2Jersey?: Jersey;
  winnerId?: string;             // ID del equipo ganador
  matchId?: string;              // Referencia al documento Match de Firestore cuando se juega
  nextMatchNumber?: number;      // A qué partido avanza el ganador
  finalScore?: { team1: number; team2: number }; // Resultado del partido
};
```

### Rondas Soportadas

```typescript
export type CupRound = 'round_of_32' | 'round_of_16' | 'round_of_8' | 'semifinals' | 'final';
```

**Mapeo a nombres:**
- `round_of_32` → "Ronda de 32"
- `round_of_16` → "Octavos de Final"
- `round_of_8` → "Cuartos de Final"
- `semifinals` → "Semifinales"
- `final` → "Final"

### Funciones Clave del Sistema

#### 1. Generación de Bracket

```typescript
// src/lib/utils/cup-bracket.ts
generateBracket(
  teams: (GroupTeam & { ovr?: number })[],
  seedingType: 'random' | 'ovr_based' = 'random'
): BracketMatch[]
```

**¿Qué hace?**
- Valida que haya 2, 4, 8, 16 o 32 equipos
- Determina la ronda inicial según cantidad de equipos
- Sortea equipos (random o por OVR usando seeding estándar)
- Genera **todas las rondas** del torneo de una vez
- Calcula referencias `nextMatchNumber` para avance automático
- Primera ronda tiene equipos asignados, resto están vacíos

**Ejemplo con 8 equipos:**
```
Cuartos (4 partidos) → Semis (2 partidos) → Final (1 partido)
Total: 7 partidos generados
```

#### 2. Avance de Ganador

```typescript
advanceWinner(
  bracket: BracketMatch[],
  completedMatchId: string,
  winnerId: string,
  winnerName: string,
  winnerJersey: Jersey,
  finalScore?: { team1: number; team2: number }
): BracketMatch[]
```

**¿Qué hace?**
- Marca el ganador en el partido completado
- Guarda el score final
- Encuentra el siguiente partido usando `nextMatchNumber`
- Coloca al ganador en `team1` o `team2` según lógica de bracket
  - Partidos impares (1, 3, 5...) → avanzan a `team1`
  - Partidos pares (2, 4, 6...) → avanzan a `team2`
- Si es la final, solo marca ganador y no avanza

#### 3. Helpers de Estado

```typescript
isRoundComplete(bracket: BracketMatch[], round: CupRound): boolean
isTournamentComplete(bracket: BracketMatch[]): boolean
getCurrentRound(bracket: BracketMatch[]): CupRound | null
getChampion(bracket: BracketMatch[]): { teamId: string; teamName: string } | null
getRunnerUp(bracket: BracketMatch[]): { teamId: string; teamName: string } | null
```

---

## Componente CupBracket - Visualización

### Ubicación
`src/components/competitions/cup-bracket.tsx` (369 líneas)

### Características Visuales

#### Layout Horizontal con Scroll
- Cada ronda es una columna
- Los partidos se posicionan verticalmente usando matemática de bracket
- Scroll horizontal para brackets grandes
- Background con patrón de puntos sutiles

#### Conectores Animados con SVG
- Curvas Bezier conectan cada partido con el siguiente
- Animación de `pathLength` con framer-motion
- Degradados de color según estado:
  - **Completado:** Degradado amber (`url(#grad-winner)`)
  - **Usuario avanza:** Degradado amarillo brillante (`url(#grad-user)`)
  - **Pendiente:** Línea punteada gris
- Efecto de glow en partidos completados

#### Tarjetas de Partido (BracketMatchCard)
- **Dimensiones:** 260px × 112px
- **Elementos:**
  - 2 filas (team1, team2)
  - Jersey preview en miniatura
  - Nombre del equipo
  - Score (cuando aplica)
  - Pill de estado en el footer
- **Estados Visuales:**
  - **Ganador:** Borde izquierdo amber, fondo amber/12, nombre en amber
  - **Perdedor:** Opacity 45%, grayscale
  - **Usuario (sin ganar):** Borde primary/60
  - **Final:** Ring amber, shadow especial, línea decorativa superior

#### Headers de Ronda
- Badge en la parte superior de cada columna
- Ronda actual: Fondo amber, punto pulsante
- Otras rondas: Fondo muted

#### Status Pills
- **Campeón:** Trophy icon, fondo amber (solo final ganada)
- **Finalizado:** Sin icon, texto muted
- **Jugar:** Punto pulsante primary
- **Generar:** Clock icon, texto amber (cuando puede crearse)
- **Pendiente:** Texto muted

### Animaciones

```typescript
// Cards: Fade + scale + slide
initial={{ opacity: 0, scale: 0.92, y: 8 }}
animate={{ opacity: 1, scale: 1, y: 0 }}
transition={{ duration: 0.4, delay: roundIndex * 0.12 + (matchIndex % 8) * 0.04 }}

// Connectors: Path drawing
initial={{ pathLength: 0, opacity: 0 }}
animate={{ pathLength: 1, opacity: 1 }}
transition={{ duration: 1.2, ease: "easeInOut", delay }}
```

---

## Flujo Ideal en Organizer

### 1. Dashboard (`/organizer`)
- [x] Muestra copas en la lista de torneos
- [x] Badge indica "Copa • Eliminación"
- [ ] Al hacer click debe redirigir a `/organizer/cup/[id]` (actualmente redirige a `/league/[id]`)

### 2. Vista de Copa (`/organizer/cup/[id]`)

**Tabs propuestos:**

#### Tab 1: **Bracket** (Vista Principal)
**Objetivo:** Mostrar el bracket completo con visualización profesional

**Componentes:**
- `CupBracket` component (ya existe)
- Botón "Generar Bracket" (si no existe)
- Botón "Regenerar Bracket" con confirmación (si ya hay partidos)
- Dropdown de ronda actual
- Contador de partidos completados

**Features:**
- Click en partido abre diálogo para:
  - **Si no tiene matchId:** Crear partido en Firestore
  - **Si tiene matchId pero no está completo:** Ir a vista de partido
  - **Si está completo:** Ver resultado en readonly

#### Tab 2: **Equipos**
**Objetivo:** Gestionar equipos participantes

**Reutilizar:** `LeagueTeamsTab` con adaptaciones
- Límite de equipos: 2, 4, 8, 16 o 32
- Validación: No permitir cambios si bracket ya generado
- Mostrar advertencia si se intenta modificar con partidos jugados

#### Tab 3: **Partidos**
**Objetivo:** Vista lista de todos los partidos por ronda

**Componentes:**
- Accordion con una sección por ronda
- Lista de partidos con:
  - Equipos enfrentados
  - Resultado (si aplica)
  - Estado (pendiente/jugado)
  - Botón "Jugar" o "Ver Resultado"

#### Tab 4: **Estadísticas**
**Objetivo:** Goleadores y jugadores destacados de la copa

**Reutilizar:** `LeagueStatsTab` con adaptaciones
- Top goleadores de la copa
- Top asistencias
- MVPs por ronda
- Tarjetas acumuladas

---

## Propuesta de Implementación

### Fase 1: Routing y Layout Base

#### Archivos a crear:

1. **`src/app/organizer/cup/[id]/page.tsx`**
   - Similar a `league/[id]/page.tsx`
   - Hero header con logo de la copa
   - Tabs: Bracket, Equipos, Partidos, Estadísticas
   - Badge "COPA" en lugar de "LIGA"

2. **Layout básico:**
```typescript
'use client';

import { useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { Cup } from '@/lib/types';
import { Tabs } from '@/components/ui/tabs';
import { CupBracketTab } from '@/components/organizer/cup-bracket-tab';
import { CupTeamsTab } from '@/components/organizer/cup-teams-tab';
// ... imports

export default function CupDetailPage({ params }: { params: { id: string } }) {
  const cupRef = doc(firestore, 'cups', params.id);
  const { data: cup } = useDoc<Cup>(cupRef);

  return (
    <div className="space-y-8 pb-10">
      {/* Hero Header similar a League */}

      <Tabs defaultValue="bracket">
        <TabsList>
          <TabsTrigger value="bracket">Bracket</TabsTrigger>
          <TabsTrigger value="teams">Equipos</TabsTrigger>
          <TabsTrigger value="matches">Partidos</TabsTrigger>
          <TabsTrigger value="stats">Estadísticas</TabsTrigger>
        </TabsList>

        <TabsContent value="bracket">
          <CupBracketTab cupId={params.id} />
        </TabsContent>
        {/* ... resto de tabs */}
      </Tabs>
    </div>
  );
}
```

---

### Fase 2: Tab de Bracket (Principal)

#### Archivo: `src/components/organizer/cup-bracket-tab.tsx`

**Responsabilidades:**
1. Cargar documento `cups/[id]` desde Firestore
2. Leer array `bracket: BracketMatch[]` del documento
3. Mostrar `CupBracket` component
4. Botón para generar/regenerar bracket
5. Manejo de clicks en partidos

**Estructura:**

```typescript
'use client';

import { useState } from 'react';
import { useDoc } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { CupBracket } from '@/components/competitions/cup-bracket';
import { generateBracket } from '@/lib/utils/cup-bracket';
import { Button } from '@/components/ui/button';
import { AlertDialog } from '@/components/ui/alert-dialog';
import type { Cup, BracketMatch } from '@/lib/types';

interface CupBracketTabProps {
  cupId: string;
}

export function CupBracketTab({ cupId }: CupBracketTabProps) {
  const cupRef = doc(firestore, 'cups', cupId);
  const { data: cup } = useDoc<Cup>(cupRef);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);

  const handleGenerateBracket = async () => {
    if (!cup?.teams) return;

    // Validar número de equipos (2, 4, 8, 16, 32)
    const validSizes = [2, 4, 8, 16, 32];
    if (!validSizes.includes(cup.teams.length)) {
      toast({
        variant: 'destructive',
        title: 'Cantidad Inválida',
        description: `Necesitás 2, 4, 8, 16 o 32 equipos. Actualmente hay ${cup.teams.length}.`
      });
      return;
    }

    // Generar bracket
    const bracket = generateBracket(cup.teams, cup.seedingType || 'random');

    // Guardar en Firestore
    await updateDoc(cupRef, {
      bracket,
      status: 'in_progress',
      currentRound: bracket[0].round, // Primera ronda
    });

    toast({ title: 'Bracket Generado', description: 'Las llaves han sido sorteadas.' });
  };

  const handleMatchClick = (match: BracketMatch) => {
    // Si no tiene equipos, no hacer nada
    if (!match.team1Id || !match.team2Id) {
      toast({ title: 'Partido No Disponible', description: 'Los equipos aún no están definidos.' });
      return;
    }

    // Si ya está completo, mostrar resultado en readonly
    if (match.winnerId) {
      // Abrir diálogo con resultado
      // TODO: Implementar
      return;
    }

    // Si tiene matchId, ir a página del partido
    if (match.matchId) {
      router.push(`/matches/${match.matchId}`);
      return;
    }

    // Si no tiene matchId, abrir diálogo para crear partido
    // TODO: Implementar
  };

  const completedMatches = cup?.bracket?.filter(m => m.winnerId).length || 0;

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Bracket de Eliminación</h2>
          <p className="text-sm text-muted-foreground">
            {completedMatches} / {cup?.bracket?.length || 0} partidos completados
          </p>
        </div>

        {!cup?.bracket || cup.bracket.length === 0 ? (
          <Button onClick={handleGenerateBracket} size="lg">
            <Trophy className="mr-2 h-5 w-5" />
            Generar Bracket
          </Button>
        ) : (
          <Button variant="outline" onClick={() => setShowRegenerateConfirm(true)}>
            Regenerar Bracket
          </Button>
        )}
      </div>

      {/* Bracket Visualization */}
      {cup?.bracket && cup.bracket.length > 0 ? (
        <CupBracket
          bracket={cup.bracket}
          onMatchClick={handleMatchClick}
          currentRound={cup.currentRound}
          canCreate={true}
        />
      ) : (
        <EmptyBracketState teamsCount={cup?.teams?.length || 0} />
      )}

      {/* Regenerate Confirmation Dialog */}
      <AlertDialog open={showRegenerateConfirm} onOpenChange={setShowRegenerateConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ Regenerar Bracket</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará el bracket actual y generará uno nuevo.
              {completedMatches > 0 && (
                <strong className="block mt-2 text-destructive">
                  Se perderán {completedMatches} partidos ya jugados.
                </strong>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleGenerateBracket}
              className="bg-destructive text-destructive-foreground"
            >
              Regenerar de todos modos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
```

---

### Fase 3: Creación de Partidos desde Bracket

#### Problema:
Cuando un partido está listo para jugarse (ambos equipos definidos), necesitamos crear el documento `Match` en Firestore.

#### Solución: Server Action

**Archivo:** `src/lib/actions/cup-actions.ts` (nuevo)

```typescript
'use server';

import { db } from '@/firebase/admin-init';
import { FieldValue } from 'firebase-admin/firestore';
import type { Match, BracketMatch } from '@/lib/types';

export async function createCupMatchAction(
  cupId: string,
  bracketMatchId: string,
  userId: string
) {
  try {
    const cupRef = db.collection('cups').doc(cupId);
    const cupSnap = await cupRef.get();

    if (!cupSnap.exists) {
      return { success: false, error: 'Copa no encontrada' };
    }

    const cup = cupSnap.data();

    // Validar ownership
    if (cup.ownerUid !== userId) {
      return { success: false, error: 'No autorizado' };
    }

    // Encontrar bracket match
    const bracket: BracketMatch[] = cup.bracket || [];
    const bracketMatch = bracket.find(m => m.id === bracketMatchId);

    if (!bracketMatch || !bracketMatch.team1Id || !bracketMatch.team2Id) {
      return { success: false, error: 'Partido no válido' };
    }

    // Buscar datos de equipos
    const team1Doc = await db.collection('leagues').doc(cupId).collection('teams').doc(bracketMatch.team1Id).get();
    const team2Doc = await db.collection('leagues').doc(cupId).collection('teams').doc(bracketMatch.team2Id).get();

    const team1 = team1Doc.data();
    const team2 = team2Doc.data();

    if (!team1 || !team2) {
      return { success: false, error: 'Equipos no encontrados' };
    }

    // Crear Match document
    const matchData: Partial<Match> = {
      type: 'cup',
      status: 'upcoming',
      title: `${team1.name} vs ${team2.name} - ${getRoundName(bracketMatch.round)}`,
      ownerUid: userId,
      groupId: cup.groupId,
      cupId: cupId,
      cupRound: bracketMatch.round,
      bracketMatchId: bracketMatch.id,
      teams: [
        {
          id: bracketMatch.team1Id,
          name: team1.name,
          jersey: team1.jersey,
          players: [], // Cargar de la colección de teams
        },
        {
          id: bracketMatch.team2Id,
          name: team2.name,
          jersey: team2.jersey,
          players: [],
        }
      ],
      createdAt: FieldValue.serverTimestamp(),
    };

    const matchRef = await db.collection('matches').add(matchData);

    // Actualizar bracket con matchId
    const updatedBracket = bracket.map(m =>
      m.id === bracketMatchId ? { ...m, matchId: matchRef.id } : m
    );

    await cupRef.update({ bracket: updatedBracket });

    return { success: true, matchId: matchRef.id };
  } catch (error: any) {
    console.error('[createCupMatchAction] Error:', error);
    return { success: false, error: error.message };
  }
}
```

---

### Fase 4: Integración con match-result-dialog

#### Problema:
El `match-result-dialog.tsx` ya maneja tarjetas, MVP y W.O., pero necesita lógica especial para copas:

1. **No permitir empates** (ya implementado en `CupMatchView`)
2. **Actualizar bracket al finalizar** (avanzar ganador)

#### Solución:

Modificar `updateMatchFinalScoreAction` en `server-actions.ts` para detectar `match.type === 'cup'`:

```typescript
// En server-actions.ts
export async function updateMatchFinalScoreAction(
  matchId: string,
  team1Score: number,
  team2Score: number,
  userId: string
) {
  // ... validaciones existentes

  // Si es partido de copa
  if (match.type === 'cup' && match.cupId && match.bracketMatchId) {
    // No permitir empates
    if (team1Score === team2Score) {
      return { success: false, error: 'En copas no puede haber empate' };
    }

    const winnerId = team1Score > team2Score ? match.teams[0].id : match.teams[1].id;
    const winnerName = team1Score > team2Score ? match.teams[0].name : match.teams[1].name;
    const winnerJersey = team1Score > team2Score ? match.teams[0].jersey : match.teams[1].jersey;

    // Actualizar bracket
    const cupRef = db.collection('cups').doc(match.cupId);
    const cupSnap = await cupRef.get();
    const cup = cupSnap.data();

    const updatedBracket = advanceWinner(
      cup.bracket,
      match.bracketMatchId,
      winnerId,
      winnerName,
      winnerJersey,
      { team1: team1Score, team2: team2Score }
    );

    await cupRef.update({ bracket: updatedBracket });

    // Si es la final, marcar copa como completada
    if (match.cupRound === 'final') {
      await cupRef.update({
        status: 'completed',
        champion: {
          teamId: winnerId,
          teamName: winnerName,
        }
      });
    }
  }

  // ... resto de lógica existente
}
```

---

### Fase 5: Tab de Equipos para Copas

#### Archivo: `src/components/organizer/cup-teams-tab.tsx`

**Diferencias con LeagueTeamsTab:**

1. **Límite de equipos:** Dropdown con opciones [2, 4, 8, 16, 32]
2. **Validación:** No permitir agregar/eliminar si bracket ya generado
3. **Advertencia:** "⚠️ Si cambias los equipos, deberás regenerar el bracket"

**Componente:**

```typescript
'use client';

import { useState } from 'react';
import { useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select } from '@/components/ui/select';
import type { Cup } from '@/lib/types';

export function CupTeamsTab({ cupId }: { cupId: string }) {
  const cupRef = doc(firestore, 'cups', cupId);
  const { data: cup } = useDoc<Cup>(cupRef);

  const [targetSize, setTargetSize] = useState<number>(8);

  const hasBracket = cup?.bracket && cup.bracket.length > 0;
  const canModify = !hasBracket;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Equipos Participantes</h2>
          <p className="text-sm text-muted-foreground">
            {cup?.teams?.length || 0} equipos inscriptos
          </p>
        </div>

        <Select value={targetSize.toString()} onValueChange={(v) => setTargetSize(Number(v))}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="2">2 equipos</SelectItem>
            <SelectItem value="4">4 equipos</SelectItem>
            <SelectItem value="8">8 equipos</SelectItem>
            <SelectItem value="16">16 equipos</SelectItem>
            <SelectItem value="32">32 equipos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Warning */}
      {hasBracket && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            El bracket ya fue generado. Si agregás o eliminás equipos, deberás regenerar el bracket
            desde la pestaña Bracket, lo que eliminará todos los partidos jugados.
          </AlertDescription>
        </Alert>
      )}

      {/* Team List - Reutilizar componente de LeagueTeamsTab */}
      {/* ... */}

      {/* Add Team Button */}
      <Button disabled={!canModify || (cup?.teams?.length || 0) >= targetSize}>
        Agregar Equipo
      </Button>
    </div>
  );
}
```

---

## Resumen de Archivos a Crear

### ✅ Ya existen (reutilizar):
- `src/lib/types.ts` (tipos Cup, BracketMatch, CupRound)
- `src/lib/utils/cup-bracket.ts` (lógica de brackets)
- `src/components/competitions/cup-bracket.tsx` (visualización)
- `src/components/cup/CupMatchView.tsx` (vista de partido)
- `src/components/organizer/match-result-dialog.tsx` (con mejoras de Fase 1-4)

### ❌ Archivos nuevos necesarios:

1. **`src/app/organizer/cup/[id]/page.tsx`**
   - Página principal de copa en organizer
   - Hero header + Tabs

2. **`src/components/organizer/cup-bracket-tab.tsx`**
   - Tab principal con visualización de bracket
   - Botones de generar/regenerar
   - Manejo de clicks en partidos

3. **`src/components/organizer/cup-teams-tab.tsx`**
   - Gestión de equipos con límites
   - Validación de cantidad
   - Warnings si bracket ya existe

4. **`src/components/organizer/cup-matches-tab.tsx`**
   - Vista lista de partidos por ronda
   - Accordion por ronda
   - Acceso rápido a cada partido

5. **`src/components/organizer/cup-stats-tab.tsx`**
   - Estadísticas de la copa
   - Goleadores, asistencias, tarjetas
   - MVP por ronda

6. **`src/lib/actions/cup-actions.ts`**
   - Server actions para copas
   - `createCupMatchAction()`
   - `finalizeCupMatchAction()`
   - `regenerateBracketAction()`

### 🔧 Archivos a modificar:

1. **`src/app/organizer/page.tsx`**
   - Línea 101: Cambiar routing según tipo
   ```typescript
   onClick={() => {
     const path = league.competitionType === 'cup'
       ? `/organizer/cup/${league.id}`
       : `/organizer/league/${league.id}`;
     router.push(path);
   }}
   ```

2. **`src/lib/actions/server-actions.ts`**
   - `updateMatchFinalScoreAction()`: Agregar lógica de avance en bracket
   - Detectar `match.type === 'cup'`
   - Llamar a `advanceWinner()`
   - Actualizar `cups/[id]/bracket`

3. **`src/components/organizer/match-result-dialog.tsx`**
   - Ya tiene las mejoras de Fase 1-4
   - Agregar validación: "No empates en copas" (ya existe en CupMatchView)

---

## Flujo Completo - Caso de Uso

### Escenario: Organizador crea copa de 8 equipos

#### Paso 1: Crear Copa
1. Dashboard → "Nueva Competición"
2. Tipo: Copa
3. Formato: Eliminación Simple
4. Seeding: Por OVR
5. Guarda en Firestore: `cups/[id]` con `bracket: []` vacío

#### Paso 2: Agregar Equipos
1. `/organizer/cup/[id]` → Tab "Equipos"
2. Agrega 8 equipos con nombres y jerseys
3. Cada equipo se guarda en `cups/[id]/teams/[teamId]`

#### Paso 3: Generar Bracket
1. Tab "Bracket" → Botón "Generar Bracket"
2. Frontend valida que hay exactamente 8 equipos
3. Llama a `generateBracket(teams, 'ovr_based')`
4. Genera 7 BracketMatch:
   - 4 de cuartos (round_of_8)
   - 2 de semis
   - 1 final
5. Actualiza Firestore:
   ```typescript
   await updateDoc(cupRef, {
     bracket: [...],
     status: 'in_progress',
     currentRound: 'round_of_8'
   });
   ```
6. UI muestra bracket completo con conectores

#### Paso 4: Crear Primer Partido
1. Click en "Partido 1" de cuartos
2. Abre diálogo: "Crear partido entre Equipo A vs Equipo B"
3. Confirma → llama `createCupMatchAction()`
4. Se crea documento en `matches/[matchId]` con:
   - `type: 'cup'`
   - `cupId: [id]`
   - `bracketMatchId: 'match-1'`
   - `cupRound: 'round_of_8'`
5. Se actualiza bracket:
   ```typescript
   bracket[0].matchId = 'xxx'
   ```

#### Paso 5: Jugar Partido
1. Redirect a `/matches/[matchId]` o abre visualizer
2. Organizador registra resultado: 3-1
3. Marca tarjetas, MVP, etc.
4. Click "Finalizar Partido"
5. Llama `updateMatchFinalScoreAction()`

#### Paso 6: Avance Automático
1. Server detecta `match.type === 'cup'`
2. Determina ganador: Equipo A
3. Llama `advanceWinner(bracket, 'match-1', 'teamA', ...)`
4. Actualiza bracket:
   ```typescript
   bracket[0].winnerId = 'teamA'
   bracket[0].finalScore = { team1: 3, team2: 1 }
   bracket[4].team1Id = 'teamA'  // Semifinal 1, slot team1
   bracket[4].team1Name = 'Equipo A'
   bracket[4].team1Jersey = {...}
   ```
5. Guarda en Firestore
6. UI se actualiza automáticamente (useDoc)

#### Paso 7: Continuar Torneo
1. Organizador repite Pasos 4-6 para resto de cuartos
2. Cuando terminan los 4 cuartos, semis tienen equipos
3. Juega semis
4. Juega final
5. Al finalizar final:
   - `cup.status = 'completed'`
   - `cup.champion = { teamId, teamName }`
6. Badge "Campeón" aparece en bracket

---

## Comparación: Liga vs Copa

| Aspecto | Liga | Copa |
|---------|------|------|
| **Formato** | round_robin / double_round_robin | single_elimination |
| **Fixture** | Todos juegan contra todos | Bracket de eliminación |
| **Empates** | Permitidos (suma 1 punto) | NO permitidos |
| **Standings** | Tabla de posiciones con puntos | No aplica |
| **Avance** | No aplica | Ganador avanza, perdedor eliminado |
| **Final** | Puede haber final si se define | Siempre hay final |
| **Visualización** | Lista de fechas/rondas | Bracket horizontal con conectores |
| **Regenerar** | Elimina partidos jugados | Elimina bracket completo |
| **Tabs Organizer** | Overview, Equipos, Fixture, Goleadores, Sanciones | Bracket, Equipos, Partidos, Estadísticas |

---

## Próximos Pasos Recomendados

### Fase A: Routing Básico (2 horas)
- [x] Crear `/app/organizer/cup/[id]/page.tsx`
- [x] Copiar estructura de `/league/[id]/page.tsx`
- [x] Adaptar hero header para copas
- [x] Crear tabs básicos vacíos

### Fase B: Bracket Tab (4 horas)
- [x] Crear `cup-bracket-tab.tsx`
- [x] Integrar componente `CupBracket`
- [x] Implementar botón "Generar Bracket"
- [x] Implementar confirmación de regeneración
- [x] Manejar clicks en partidos

### Fase C: Server Actions (3 horas)
- [x] Crear `cup-actions.ts`
- [x] Implementar `createCupMatchAction()`
- [x] Modificar `updateMatchFinalScoreAction()` para avance automático
- [x] Testing de avance de ganadores

### Fase D: Teams Tab (2 horas)
- [x] Crear `cup-teams-tab.tsx`
- [x] Reutilizar lógica de `league-teams-tab`
- [x] Agregar validaciones de cantidad
- [x] Warnings si bracket existe

### Fase E: Matches Tab (2 horas)
- [x] Crear `cup-matches-tab.tsx`
- [x] Accordion por ronda
- [x] Lista de partidos con estado
- [x] Botones de acción

### Fase F: Stats Tab (1 hora)
- [x] Reutilizar `league-stats-tab.tsx`
- [x] Filtrar por cupId
- [x] Agregar sección "MVP por Ronda"

---

## Conclusión

El sistema de Copas tiene toda la **lógica backend y visualización** implementada, pero falta la **interfaz de gestión en el modo Organizer**.

La implementación propuesta reutiliza componentes existentes (`CupBracket`, `match-result-dialog`, `LeagueStatsTab`) y agrega:
- Routing específico para copas
- Tab de bracket con generación/regeneración
- Server actions para crear partidos y avanzar ganadores
- Validaciones específicas de copas (no empates, límite de equipos)

**Estimación total:** 14 horas de desarrollo
**Archivos nuevos:** 6
**Archivos a modificar:** 3

---

**Documentado por:** Claude Sonnet 4.5
**Proyecto:** Pateá - Sistema de Gestión de Fútbol Amateur
**Branch:** feat/ligas-y-copas
