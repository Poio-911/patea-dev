# INFORME EXHAUSTIVO: VISUALIZACIÓN DE INFORMACIÓN HISTÓRICA

**Fecha:** 23 de Octubre de 2025
**Proyecto:** Amateur Football Manager (AFM)
**Objetivo:** Análisis completo del sistema de visualización de datos históricos (evaluaciones, goles, partidos, atributos, OVR)

---

## ÍNDICE

1. [Arquitectura de Visualización](#1-arquitectura-de-visualización)
2. [Estructura de Datos](#2-estructura-de-datos)
3. [Componentes de Visualización](#3-componentes-de-visualización)
4. [Flujo de Datos](#4-flujo-de-datos)
5. [Errores Identificados](#5-errores-identificados)
6. [Problemas de UX](#6-problemas-de-ux)
7. [Mejoras Sugeridas](#7-mejoras-sugeridas)
8. [Plan de Implementación](#8-plan-de-implementación)

---

## 1. ARQUITECTURA DE VISUALIZACIÓN

### 1.1. Componentes Principales

```
┌─────────────────────────────────────────────────────────────┐
│                    VISUALIZACIÓN DE DATOS                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌────────────────────┐      ┌─────────────────────────┐  │
│  │  Dashboard         │      │  Player Profile         │  │
│  │  (dashboard/page)  │      │  (player-profile-view)  │  │
│  ├────────────────────┤      ├─────────────────────────┤  │
│  │ - Next Match       │      │ - OVR Chart             │  │
│  │ - Recent Matches   │      │ - Evaluation History    │  │
│  │ - Top 5 Players    │      │ - Created Matches       │  │
│  │ - Availability     │      │ - Created Players       │  │
│  │ - Stats Summary    │      │ - Player Insights (AI)  │  │
│  └────────────────────┘      └─────────────────────────┘  │
│                                                             │
│  ┌────────────────────┐      ┌─────────────────────────┐  │
│  │  Matches List      │      │  Match Card             │  │
│  │  (matches/page)    │      │  (match-card)           │  │
│  ├────────────────────┤      ├─────────────────────────┤  │
│  │ - Upcoming Tab     │      │ - Date & Location       │  │
│  │ - History Tab      │      │ - Players Count         │  │
│  │ - Match Cards      │      │ - Weather Info          │  │
│  │                    │      │ - Teams (if generated)  │  │
│  └────────────────────┘      └─────────────────────────┘  │
│                                                             │
│  ┌────────────────────┐      ┌─────────────────────────┐  │
│  │  Insights Panel    │      │  Match Teams Dialog     │  │
│  │  (player-insights) │      │  (match-teams-dialog)   │  │
│  ├────────────────────┤      ├─────────────────────────┤  │
│  │ - AI Patterns      │      │ - Team A / Team B       │  │
│  │ - Trajectory       │      │ - Formation             │  │
│  │ - Consistency      │      │ - Balance Metrics       │  │
│  │ - Recommendations  │      │ - OVR Comparison        │  │
│  └────────────────────┘      └─────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 1.2. Bibliotecas de Visualización

- **Recharts**: Gráficos de línea para progresión de OVR
  - `LineChart`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, `Legend`
  - Ubicación: `player-profile-view.tsx` líneas 327-364

- **Shadcn/ui Components**:
  - `Table`: Historial de evaluaciones, partidos creados, jugadores
  - `Card`: Contenedores de información
  - `Badge`: Estados, ratings, posiciones
  - `Avatar`: Fotos de jugadores
  - `Tabs`: Organización de información (Evaluations, Created Matches, Created Players)
  - `Progress`: Barra de consistencia en insights

- **Framer Motion**: Animaciones en match cards
  - `whileHover`, `whileTap`, `transition`

---

## 2. ESTRUCTURA DE DATOS

### 2.1. Colecciones Firestore

#### `/players/{playerId}`
```typescript
{
  id: string;
  name: string;
  position: 'DEL' | 'MED' | 'DEF' | 'POR';
  ovr: number;
  pac: number;  // Ritmo
  sho: number;  // Tiro
  pas: number;  // Pase
  dri: number;  // Regate
  def: number;  // Defensa
  phy: number;  // Físico
  photoUrl?: string;
  stats: {
    matchesPlayed: number;
    goals: number;
    assists: number;
    averageRating: number;
  };
  ownerUid: string;
  groupId: string;
  cardGenerationCredits?: number;
}
```

#### `/players/{playerId}/ovrHistory/{historyId}`
```typescript
{
  id: string;
  date: string;               // ISO 8601
  oldOVR: number;
  newOVR: number;
  change: number;
  matchId: string;
  attributeChanges?: {        // ❗ OPCIONAL, a veces no existe
    pac?: number;
    sho?: number;
    pas?: number;
    dri?: number;
    def?: number;
    phy?: number;
  };
}
```

**PROBLEMA #1**: `attributeChanges` es opcional y NO siempre se crea cuando se actualiza el OVR.

#### `/evaluations/{evaluationId}`
```typescript
{
  id: string;
  assignmentId: string;
  playerId: string;           // Jugador evaluado
  evaluatorId: string;        // Evaluador
  matchId: string;
  rating?: number;            // ❗ Puede ser undefined si fue evaluación por tags
  goals: number;
  performanceTags?: Array<{   // ❗ Estructura inconsistente
    id: string;
    name: string;
    description: string;
    effects: Array<{
      attribute: string;
      change: number;
    }>;
  }>;
  evaluatedAt: string;
}
```

**PROBLEMA #2**: `performanceTags` puede ser:
- `undefined` (no hay tags)
- Array de strings (IDs de tags)
- Array de objetos completos (con effects)

Esto causa problemas en la visualización.

#### `/matches/{matchId}`
```typescript
{
  id: string;
  title: string;
  date: string;
  time: string;
  location: {
    name: string;
    address: string;
    lat: number;
    lng: number;
    placeId: string;
  };
  type: 'manual' | 'collaborative';
  matchSize: 10 | 14 | 22;
  players: Array<{
    uid: string;
    displayName: string;
    ovr: number;
    position: string;
    photoUrl: string;
  }>;
  playerUids: string[];
  teams: Array<{              // ❗ Se crea al finalizar partido
    name: string;
    players: Array<{
      uid: string;
      displayName: string;
      position: string;
      ovr: number;
    }>;
    totalOVR: number;
    averageOVR: number;
    suggestedFormation: string;
    tags: string[];
  }>;
  status: 'upcoming' | 'active' | 'completed' | 'evaluated';
  ownerUid: string;
  groupId: string;
  isPublic?: boolean;
  weather?: {
    description: string;
    icon: string;
    temperature: number;
  };
}
```

### 2.2. Flujo de Datos para Visualización

```
┌──────────────────────────────────────────────────────────┐
│                  FLUJO DE DATOS                          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  1. Usuario visita /players/[id]                        │
│     │                                                    │
│     ├─> useDoc(players/{id})                           │
│     │   └─> player data                                │
│     │                                                    │
│     ├─> useCollection(players/{id}/ovrHistory)         │
│     │   └─> ovrHistory[] → chartData                   │
│     │                                                    │
│     ├─> getDocs(evaluations where playerId == id)      │
│     │   └─> evaluations[] → filteredEvaluationsByMatch │
│     │                                                    │
│     └─> getDocs(matches where matchId in [...])        │
│         └─> matches[] → merge con evaluations          │
│                                                          │
│  2. chartData se pasa a Recharts LineChart             │
│     {                                                    │
│       name: 'P. 1',                                     │
│       OVR: 75,                                          │
│       Fecha: '01/10'                                    │
│     }                                                    │
│                                                          │
│  3. filteredEvaluationsByMatch se renderiza en Table   │
│     - Por partido: avgRating, goals, individualEvals   │
│     - Expansible: evaluador, rating, tags              │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## 3. COMPONENTES DE VISUALIZACIÓN

### 3.1. Player Profile View (`player-profile-view.tsx`)

**Ubicación:** `src/components/player-profile-view.tsx`

**Responsabilidades:**
- Mostrar card de jugador con foto, nombre, OVR, posición, atributos
- Gráfico de progresión de OVR (Recharts LineChart)
- Tabla de historial de evaluaciones (expandible)
- Tabs para: Mi Historial, Partidos Creados, Jugadores Creados
- Panel de insights con IA (si es perfil propio)

#### 3.1.1. Gráfico de OVR (líneas 327-365)

```typescript
<ResponsiveContainer width="100%" height={300}>
  <LineChart data={chartData}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="name" />
    <YAxis domain={['dataMin - 2', 'dataMax + 2']} />
    <Tooltip content={...} />
    <Legend />
    <Line
      type="monotone"
      dataKey="OVR"
      stroke="hsl(var(--primary))"
      strokeWidth={2}
      dot={{ r: 4 }}
      activeDot={{ r: 8 }}
    />
  </LineChart>
</ResponsiveContainer>
```

**chartData se genera en líneas 179-189:**
```typescript
const chartData = useMemo(() => {
  if (!ovrHistory) return [];
  if (ovrHistory.length === 0 && player) {
    return [{name: 'Inicial', OVR: player.ovr}]
  }
  return ovrHistory.map((entry, index) => ({
    name: `P. ${index + 1}`,    // "P. 1", "P. 2", ...
    OVR: entry.newOVR,
    Fecha: format(new Date(entry.date), 'dd/MM'),
  }));
}, [ovrHistory, player]);
```

**PROBLEMA #3**: El dominio `['dataMin - 2', 'dataMax + 2']` causa que cambios pequeños parezcan muy grandes.
- Si OVR va de 75 → 77, el eje Y va de 73 a 79
- Visualmente parece un salto enorme cuando es solo +2

**PROBLEMA #4**: No se muestran los `attributeChanges` del historial de OVR
- `ovrHistory` tiene un campo `attributeChanges?: {...}`
- Pero NUNCA se visualiza en el UI
- El usuario no sabe qué atributos cambiaron

#### 3.1.2. Tabla de Evaluaciones (líneas 394-483)

```typescript
<Table>
  <TableHeader>
    <TableRow>
      <TableHead className='w-12'></TableHead>
      <TableHead>Partido</TableHead>
      <TableHead>Fecha</TableHead>
      <TableHead className="text-center">Rating Prom.</TableHead>
      <TableHead className="text-center">Goles</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {filteredEvaluationsByMatch.map(({ match, avgRating, goals, individualEvaluations }) => {
      const isOpen = openAccordion === match.id;
      return (
        <React.Fragment key={match.id}>
          <TableRow onClick={() => setOpenAccordion(isOpen ? null : match.id)}>
            <TableCell><ChevronDown /></TableCell>
            <TableCell>{match.title}</TableCell>
            <TableCell>{format(new Date(match.date), 'dd MMM, yyyy')}</TableCell>
            <TableCell>
              <Badge variant={avgRating >= 7 ? 'default' : avgRating >= 5 ? 'secondary' : 'destructive'}>
                <Star /> {avgRating.toFixed(2)}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge variant="outline"><Goal /> {goals}</Badge>
            </TableCell>
          </TableRow>
          {isOpen && (
            <TableRow>
              <TableCell colSpan={5}>
                {/* Detalle de evaluaciones individuales */}
                {individualEvaluations.map(ev => (
                  <TableRow key={ev.id}>
                    <TableCell>{/* Evaluador avatar + nombre */}</TableCell>
                    <TableCell><Badge>{ev.rating}</Badge></TableCell>
                    <TableCell>
                      {/* Performance Tags */}
                      {ev.performanceTags?.map(tag => <Badge>{tag.name}</Badge>)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableCell>
            </TableRow>
          )}
        </React.Fragment>
      )
    })}
  </TableBody>
</Table>
```

**filteredEvaluationsByMatch se calcula en líneas 144-177:**
```typescript
const filteredEvaluationsByMatch = useMemo((): MatchEvaluationSummary[] => {
  if (isLoading || evaluations.length === 0) return [];

  const evalsByMatch: Record<string, { match: Match; evaluations: DetailedEvaluation[] }> = {};

  evaluations.forEach(ev => {
    const matchForEval = matches.find(m => m.id === ev.matchId);
    if (matchForEval) {
      if (!evalsByMatch[ev.matchId]) {
        evalsByMatch[ev.matchId] = { match: matchForEval, evaluations: [] };
      }
      const detailedEval: DetailedEvaluation = {
        ...ev,
        evaluatorName: evaluatorProfiles[ev.evaluatorId]?.displayName || 'Cargando...',
        evaluatorPhoto: evaluatorProfiles[ev.evaluatorId]?.photoURL || '',
      };
      evalsByMatch[ev.matchId].evaluations.push(detailedEval);
    }
  });

  return Object.values(evalsByMatch).map(summary => {
    const ratings = summary.evaluations.map(ev => ev.rating).filter((r): r is number => typeof r === 'number' && !isNaN(r));
    const goals = summary.evaluations.reduce((sum, ev) => sum + (ev.goals || 0), 0);
    const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;

    return {
      match: summary.match,
      avgRating,
      goals,
      individualEvaluations: summary.evaluations
    };
  }).sort((a,b) => new Date(b.match.date).getTime() - new Date(a.match.date).getTime());

}, [evaluations, matches, evaluatorProfiles, isLoading]);
```

**PROBLEMA #5**: `avgRating` puede ser `0` si solo hubo evaluaciones por tags (sin rating numérico)
- Filtro: `.filter((r): r is number => typeof r === 'number' && !isNaN(r))`
- Si `ratings.length === 0`, entonces `avgRating = 0`
- Pero `0` es ambiguo: ¿es que no hubo ratings o que el rating fue malo?

**PROBLEMA #6**: No se muestra en qué equipo jugó el jugador
- La tabla muestra partido, rating, goles
- Pero NO muestra si jugó en "Equipo A" o "Equipo B"
- Esta información está en `match.teams` pero no se correlaciona

**PROBLEMA #7**: `ev.performanceTags` puede ser undefined o tener estructura incorrecta
- Línea 459: `{ev.performanceTags && ev.performanceTags.length > 0 ? ...}`
- Pero no se valida la estructura interna
- Si `performanceTags` es array de strings en lugar de objetos, `tag.name` falla

#### 3.1.3. Tabs de Perfil (líneas 381-560)

```typescript
<Tabs defaultValue="evaluations">
  <TabsList className="grid w-full grid-cols-3">
    <TabsTrigger value="evaluations">Mi Historial</TabsTrigger>
    <TabsTrigger value="created-matches">Partidos Creados</TabsTrigger>
    <TabsTrigger value="created-players">Jugadores Creados</TabsTrigger>
  </TabsList>

  <TabsContent value="evaluations">
    {/* Tabla de evaluaciones */}
  </TabsContent>

  <TabsContent value="created-matches">
    <Table>
      {/* Lista de partidos creados por el usuario */}
    </Table>
  </TabsContent>

  <TabsContent value="created-players">
    <Table>
      {/* Lista de jugadores manuales creados */}
    </Table>
  </TabsContent>
</Tabs>
```

**PROBLEMA #8**: Partidos y jugadores creados no tienen filtros ni ordenamiento
- No se puede filtrar por estado (upcoming, completed, evaluated)
- No se puede ordenar por fecha
- No hay paginación si hay muchos elementos

---

### 3.2. Dashboard (`dashboard/page.tsx`)

**Ubicación:** `src/app/dashboard/page.tsx`

**Responsabilidades:**
- Mostrar próximo partido (NextMatchCard)
- Mostrar partidos recientes (últimos 2)
- Top 5 jugadores por OVR
- Toggle de disponibilidad pública
- Cantidad de jugadores en el grupo

#### 3.2.1. Top 5 Jugadores (líneas 317-343)

```typescript
const top5Players = useMemo(() => {
  if (!players) return [];
  return [...players].sort((a, b) => b.ovr - a.ovr).slice(0, 5);
}, [players]);

// Render:
<Card>
  <CardHeader>
    <CardTitle>
      <Star /> Los Cracks del Grupo
    </CardTitle>
    <CardDescription>El Top 5 de jugadores por OVR.</CardDescription>
  </CardHeader>
  <CardContent>
    {top5Players.map((player, index) => (
      <div key={player.id}>
        <div className="text-muted-foreground">{index + 1}.</div>
        <Avatar>{player.name.charAt(0)}</Avatar>
        <div>
          <p>{player.name}</p>
          <p>{player.position}</p>
        </div>
        <div className="text-primary">{player.ovr}</div>
      </div>
    ))}
  </CardContent>
</Card>
```

**PROBLEMA #9**: No hay distinción entre jugadores reales y manuales
- Los jugadores creados manualmente aparecen en el Top 5
- No hay badge o indicador visual
- Puede confundir a los usuarios

#### 3.2.2. Partidos Recientes (líneas 266-313)

```typescript
const { nextMatch, recentMatches } = useMemo(() => {
  if (!matches) return { nextMatch: null, recentMatches: [] };

  const upcoming = matches
    .filter(m => m.status === 'upcoming')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const recent = matches.filter(m => m.status !== 'upcoming').slice(0, 2);

  return {
    nextMatch: upcoming[0] || null,
    recentMatches: recent,
  };
}, [matches]);
```

**PROBLEMA #10**: No se muestran estadísticas resumidas de los partidos recientes
- Solo título, fecha, organizador, estado
- No muestra resultado, goles, MVP, etc.

---

### 3.3. Match Card (`match-card.tsx`)

**Ubicación:** `src/components/match-card.tsx`

**Responsabilidades:**
- Mostrar información del partido (fecha, hora, lugar, jugadores)
- Permitir unirse/salir del partido (si es collaborative)
- Finalizar partido (si eres owner)
- Ver equipos generados
- Ver chat del partido
- Supervisar evaluaciones (si eres owner y está completed)

#### 3.3.1. Información del Partido (líneas 364-404)

```typescript
<CardContent className="space-y-4">
  <div className="grid grid-cols-2 gap-4">
    <div className="flex items-center gap-3">
      <Calendar />
      <div>
        <p className="text-xs text-muted-foreground">Fecha</p>
        <p className="font-bold text-sm">{format(new Date(match.date), "EEEE, d 'de' MMMM")}</p>
      </div>
    </div>
    <div className="flex items-center gap-3">
      <Clock />
      <div>
        <p className="text-xs text-muted-foreground">Hora</p>
        <p className="font-bold text-sm">{match.time} hs</p>
      </div>
    </div>
  </div>

  <div className="flex items-start gap-3">
    <MapPin />
    <div>
      <p className="text-xs text-muted-foreground">Lugar</p>
      <p className="font-bold text-sm">{match.location.name || match.location.address}</p>
    </div>
  </div>

  {WeatherIcon && match.weather && (
    <div className="flex items-center gap-2">
      <WeatherIcon className="h-4 w-4 text-blue-400" />
      <span>{match.weather.description} ({match.weather.temperature}°C)</span>
    </div>
  )}

  <div className="flex items-center gap-2">
    <Users />
    <span className="text-xl font-bold">{match.players.length} / {match.matchSize}</span>
    <span className="text-sm">Jugadores</span>
  </div>
</CardContent>
```

**Visualización correcta**, sin problemas evidentes.

---

### 3.4. Player Insights Panel (`player-insights-panel.tsx`)

**Ubicación:** `src/components/player-insights-panel.tsx`

**Responsabilidades:**
- Analizar patrones de rendimiento con IA
- Mostrar trayectoria (improving, declining, stable, volatile)
- Mostrar consistencia (very_high, high, medium, low, very_low)
- Mostrar atributo más fuerte y más débil
- Mostrar estilo de juego
- Mostrar patrones detectados
- Mostrar recomendaciones
- Mostrar momentos destacados

#### 3.4.1. Visualización de Insights (líneas 132-265)

```typescript
<Card>
  <CardHeader>
    <CardTitle><Sparkles /> Insights de Rendimiento - {playerName}</CardTitle>
  </CardHeader>
  <CardContent className="space-y-6">
    {/* Key Insights */}
    <div className="grid grid-cols-2 gap-4">
      <div>
        <Target />
        <h4>Atributo Más Fuerte</h4>
        <p>{insights.insights.strongestAttribute}</p>
      </div>
      <div>
        <AlertCircle />
        <h4>Área a Mejorar</h4>
        <p>{insights.insights.weakestAttribute}</p>
      </div>
      <div>
        <TrajectoryIcon />
        <h4>Trayectoria</h4>
        <p>{trajectoryInfo.label}</p>
      </div>
      <div>
        <Activity />
        <h4>Consistencia</h4>
        <p>{consistencyInfo.label}</p>
        <Progress value={consistencyInfo.value} />
      </div>
    </div>

    <div>
      <Zap />
      <h4>Estilo de Juego</h4>
      <p>{insights.insights.playingStyle}</p>
    </div>

    {/* Patterns */}
    <div>
      <h4>Patrones Detectados ({insights.patterns.length})</h4>
      {insights.patterns.map((pattern, i) => (
        <div key={i} className={impactColors[pattern.impact]}>
          <Icon />
          <h5>{pattern.title}</h5>
          <Badge>{pattern.confidence}% confianza</Badge>
          <p>{pattern.description}</p>
        </div>
      ))}
    </div>

    {/* Recommendations */}
    <div>
      <h4>Recomendaciones</h4>
      {insights.recommendations.map((rec, i) => (
        <div key={i}>
          <span>{i + 1}.</span>
          <p>{rec}</p>
        </div>
      ))}
    </div>

    {/* Standout Moments */}
    {insights.standoutMoments?.map((moment, i) => (
      <div key={i}>
        <p>{moment.matchDate}</p>
        <p>{moment.description}</p>
      </div>
    ))}
  </CardContent>
</Card>
```

**Visualización correcta**, bien estructurada.

---

### 3.5. Matches Page (`matches/page.tsx`)

**Ubicación:** `src/app/matches/page.tsx`

**Responsabilidades:**
- Mostrar lista de partidos (próximos e historial)
- Tabs para separar upcoming y past matches
- Botón para crear nuevo partido
- Sheet de invitaciones

#### 3.5.1. Tabs de Partidos (líneas 126-169)

```typescript
<Tabs defaultValue="upcoming">
  <TabsList className="grid w-full grid-cols-2">
    <TabsTrigger value="upcoming">Próximos</TabsTrigger>
    <TabsTrigger value="history">Historial</TabsTrigger>
  </TabsList>

  <TabsContent value="upcoming">
    {upcomingMatches.length > 0 ? (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {upcomingMatches.map(match => (
          <MatchCard key={match.id} match={match} allPlayers={sortedPlayers} />
        ))}
      </div>
    ) : (
      <div>
        <Calendar />
        <h2>No hay partidos programados</h2>
      </div>
    )}
  </TabsContent>

  <TabsContent value="history">
    {pastMatches.length > 0 ? (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {pastMatches.map(match => (
          <MatchCard key={match.id} match={match} allPlayers={sortedPlayers} />
        ))}
      </div>
    ) : (
      <div>
        <Calendar />
        <h2>Sin Historial de Partidos</h2>
      </div>
    )}
  </TabsContent>
</Tabs>
```

**Visualización correcta**, sin problemas evidentes.

---

## 4. FLUJO DE DATOS

### 4.1. Flujo de Actualización de OVR

```
┌────────────────────────────────────────────────────────────────┐
│            FLUJO DE ACTUALIZACIÓN DE OVR                       │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  1. Usuario completa evaluaciones de un partido               │
│     ├─> evaluations/{id} creados con rating y/o tags         │
│     └─> assignments/{id} marcados como completed              │
│                                                                │
│  2. Organizador revisa y procesa evaluaciones                 │
│     (/matches/[id]/evaluate/page.tsx)                         │
│     ├─> Calcula avgRating por jugador                        │
│     ├─> Agrupa tags por jugador                              │
│     ├─> Calcula attributeChanges con calculateAttributeChanges│
│     └─> Actualiza player.ovr, player.stats                   │
│                                                                │
│  3. Se crea entrada en ovrHistory                             │
│     /players/{id}/ovrHistory/{historyId}                      │
│     {                                                          │
│       date: ISO string,                                       │
│       oldOVR: number,                                         │
│       newOVR: number,                                         │
│       change: number,                                         │
│       matchId: string,                                        │
│       attributeChanges?: {  // ❗ A VECES NO SE CREA          │
│         pac: number,                                          │
│         sho: number,                                          │
│         ...                                                   │
│       }                                                       │
│     }                                                          │
│                                                                │
│  4. Usuario ve el cambio en el perfil                        │
│     ├─> Gráfico de OVR actualizado (Recharts)                │
│     ├─> Tabla de evaluaciones con nuevo partido              │
│     └─> ❌ NO ve los attributeChanges                        │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

**PROBLEMA #11**: `attributeChanges` no siempre se crea en `ovrHistory`
- Revisar `src/app/matches/[id]/evaluate/page.tsx` líneas 228-260
- El objeto `attributeChanges` se calcula pero no siempre se guarda
- Depende de si hubo tags o no

**PROBLEMA #12**: No hay forma de ver el detalle de cambios de atributos
- Aunque `attributeChanges` exista en Firestore
- No se visualiza en el UI

### 4.2. Flujo de Visualización de Evaluaciones

```
┌────────────────────────────────────────────────────────────────┐
│          FLUJO DE VISUALIZACIÓN DE EVALUACIONES                │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  1. Usuario entra a /players/[id]                             │
│                                                                │
│  2. useEffect fetch en player-profile-view.tsx (línea 101)   │
│     ├─> getDocs(evaluations where playerId == id)            │
│     ├─> Extrae matchIds únicos                               │
│     ├─> getDocs(matches where __name__ in matchIds)          │
│     ├─> Extrae evaluatorIds únicos                           │
│     └─> getDocs(users where __name__ in evaluatorIds)        │
│                                                                │
│  3. useMemo calcula filteredEvaluationsByMatch (línea 144)   │
│     ├─> Agrupa evaluations por matchId                       │
│     ├─> Calcula avgRating (❗ puede ser 0 o NaN)             │
│     ├─> Suma goals de todas las evaluaciones                 │
│     └─> Ordena por fecha descendente                         │
│                                                                │
│  4. Render de tabla (línea 394)                              │
│     ├─> TableRow principal: partido, fecha, avgRating, goals │
│     └─> TableRow expandible: evaluaciones individuales       │
│         ├─> Evaluador (avatar + nombre)                      │
│         ├─> Rating (badge)                                   │
│         └─> Tags (❗ puede fallar si estructura incorrecta)  │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## 5. ERRORES IDENTIFICADOS

### ERROR #1: Cambios de atributos NO se visualizan ⚠️ **MEDIO**

**Ubicación:** `player-profile-view.tsx` líneas 179-189

**Descripción:**
- El historial de OVR (`/players/{id}/ovrHistory/`) contiene un campo opcional `attributeChanges`
- Este campo registra cómo cambiaron pac, sho, pas, dri, def, phy
- Pero NO se muestra en ninguna parte del UI
- El gráfico solo muestra el OVR total

**Impacto:**
- Los usuarios no saben qué atributos mejoraron o empeoraron
- Pierden contexto sobre su progresión
- No pueden identificar áreas de mejora específicas

**Ejemplo:**
```typescript
// Firestore: /players/abc123/ovrHistory/xyz789
{
  date: "2025-10-15T10:00:00Z",
  oldOVR: 75,
  newOVR: 77,
  change: 2,
  matchId: "match123",
  attributeChanges: {   // ❗ Existe pero no se muestra
    sho: 2,   // Tiro mejoró +2
    pac: 1,   // Ritmo mejoró +1
    def: -1   // Defensa bajó -1
  }
}
```

**Solución propuesta:**
1. Agregar tooltip en el gráfico que muestre attributeChanges al hacer hover
2. O agregar una tabla debajo del gráfico con cambios por atributo
3. Usar colores para diferenciar aumentos (+) y disminuciones (-)

**Código sugerido:**
```typescript
// En chartData
const chartData = useMemo(() => {
  if (!ovrHistory) return [];
  return ovrHistory.map((entry, index) => ({
    name: `P. ${index + 1}`,
    OVR: entry.newOVR,
    Fecha: format(new Date(entry.date), 'dd/MM'),
    // Agregar attributeChanges para tooltip
    pac: entry.attributeChanges?.pac,
    sho: entry.attributeChanges?.sho,
    pas: entry.attributeChanges?.pas,
    dri: entry.attributeChanges?.dri,
    def: entry.attributeChanges?.def,
    phy: entry.attributeChanges?.phy,
  }));
}, [ovrHistory]);

// En Tooltip
<Tooltip
  content={({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-lg border bg-background p-3">
          <p className="font-bold">OVR: {data.OVR}</p>
          <p className="text-xs text-muted-foreground">{data.Fecha}</p>
          {data.pac !== undefined && (
            <div className="mt-2 space-y-1 text-xs">
              <p className={data.pac > 0 ? 'text-green-600' : 'text-red-600'}>
                RIT: {data.pac > 0 ? '+' : ''}{data.pac}
              </p>
              <p className={data.sho > 0 ? 'text-green-600' : 'text-red-600'}>
                TIR: {data.sho > 0 ? '+' : ''}{data.sho}
              </p>
              {/* ... otros atributos ... */}
            </div>
          )}
        </div>
      );
    }
    return null;
  }}
/>
```

---

### ERROR #2: Estructura inconsistente de `performanceTags` ⚠️ **ALTO**

**Ubicación:** `player-profile-view.tsx` líneas 459-461

**Descripción:**
- `performanceTags` en `Evaluation` puede tener diferentes estructuras:
  1. `undefined` (sin tags)
  2. `string[]` (array de IDs de tags)
  3. `Array<{id, name, description, effects}>` (objetos completos)

**Código problemático:**
```typescript
{ev.performanceTags && ev.performanceTags.length > 0 ? ev.performanceTags.map(tag => (
  <Badge key={tag.id} variant="outline">{tag.name}</Badge>
)) : <span className="text-muted-foreground text-xs">Sin etiquetas</span>}
```

**Problema:**
- Si `performanceTags` es `string[]`, entonces `tag.id` y `tag.name` son `undefined`
- Causa renderizado de badges vacíos

**Solución propuesta:**
1. Normalizar la estructura en el backend al crear evaluaciones
2. Siempre guardar objetos completos, no solo IDs
3. Agregar validación en el frontend

**Código sugerido:**
```typescript
{ev.performanceTags && ev.performanceTags.length > 0 ? ev.performanceTags.map((tag, idx) => {
  // Validar estructura
  if (typeof tag === 'string') {
    // Es solo un ID, no se puede mostrar
    return <Badge key={idx} variant="outline">Tag {idx + 1}</Badge>;
  }
  if (tag && typeof tag === 'object' && 'name' in tag) {
    return <Badge key={tag.id || idx} variant="outline">{tag.name}</Badge>;
  }
  return null;
}).filter(Boolean) : <span className="text-muted-foreground text-xs">Sin etiquetas</span>}
```

---

### ERROR #3: No se muestra en qué equipo jugó el jugador ⚠️ **BAJO**

**Ubicación:** `player-profile-view.tsx` línea 416 (tabla de evaluaciones)

**Descripción:**
- La tabla de evaluaciones muestra:
  - Partido
  - Fecha
  - Rating promedio
  - Goles
- Pero NO muestra en qué equipo jugó el jugador ("Equipo A" o "Equipo B")

**Impacto:**
- Pérdida de contexto
- El usuario no puede recordar con quién jugó
- Dificulta analizar rendimiento por compañeros de equipo

**Solución propuesta:**
- Agregar columna "Equipo" en la tabla principal
- Buscar en `match.teams` el equipo que contiene al jugador
- Mostrar nombre del equipo con badge

**Código sugerido:**
```typescript
// En filteredEvaluationsByMatch
const teamName = match.teams.find(t =>
  t.players.some(p => p.uid === playerId)
)?.name || 'Desconocido';

// En render
<TableHead>Equipo</TableHead>
// ...
<TableCell>
  <Badge variant="outline">{teamName}</Badge>
</TableCell>
```

---

### ERROR #4: avgRating puede ser 0 o NaN ⚠️ **ALTO**

**Ubicación:** `player-profile-view.tsx` líneas 165-167

**Descripción:**
- Si un jugador solo recibió evaluaciones por tags (sin rating numérico):
  - `ratings = []`
  - `avgRating = ratings.length > 0 ? ... : 0`
  - Se muestra "0.00" en el badge
- Si hay evaluaciones con rating `undefined` o `NaN`:
  - Después del filtro, si `ratings.length === 0`
  - `avgRating = 0`

**Código problemático:**
```typescript
const ratings = summary.evaluations.map(ev => ev.rating).filter((r): r is number => typeof r === 'number' && !isNaN(r));
const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
```

**Problema:**
- `avgRating: 0.00` es ambiguo:
  - ¿El jugador jugó mal?
  - ¿O simplemente no hubo evaluaciones numéricas?

**Solución propuesta:**
- Mostrar "N/A" o "Sin Rating" si `ratings.length === 0`
- Usar un badge diferente (outline en vez de default)

**Código sugerido:**
```typescript
<TableCell className="text-center">
  {avgRating > 0 ? (
    <Badge variant={avgRating >= 7 ? 'default' : avgRating >= 5 ? 'secondary' : 'destructive'}>
      <Star /> {avgRating.toFixed(2)}
    </Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">
      N/A
    </Badge>
  )}
</TableCell>
```

---

### ERROR #5: Dominio del gráfico de OVR demasiado estrecho ⚠️ **BAJO**

**Ubicación:** `player-profile-view.tsx` línea 331

**Descripción:**
- `domain={['dataMin - 2', 'dataMax + 2']}`
- Si un jugador mejora de 75 a 77:
  - Eje Y va de 73 a 79
  - Visualmente parece un salto enorme
  - Cuando en realidad es solo +2

**Impacto:**
- Distorsiona la percepción del progreso
- Cambios pequeños parecen muy grandes

**Solución propuesta:**
1. Usar un dominio fijo más amplio (ej. `[0, 100]`)
2. O usar un dominio dinámico pero con un rango mínimo (ej. `[dataMin - 10, dataMax + 10]`)

**Código sugerido:**
```typescript
// Opción 1: Dominio fijo
<YAxis domain={[0, 100]} />

// Opción 2: Dominio dinámico con rango mínimo
<YAxis domain={[
  (dataMin) => Math.max(0, dataMin - 10),
  (dataMax) => Math.min(100, dataMax + 10)
]} />
```

---

### ERROR #6: No se muestran efectos de los tags ⚠️ **MEDIO**

**Ubicación:** `player-profile-view.tsx` línea 459

**Descripción:**
- Los performance tags se muestran solo con su nombre
- Pero NO se muestran sus efectos
- Ejemplo: "Goleador Nato" NO dice que dio +2 SHO

**Impacto:**
- El usuario no sabe qué impacto tuvieron los tags
- No puede entender por qué subió o bajó su OVR

**Solución propuesta:**
- Agregar tooltip o popover en cada tag
- Mostrar efectos con formato "+2 TIR, +1 RIT"

**Código sugerido:**
```typescript
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

{ev.performanceTags?.map((tag, idx) => (
  <TooltipProvider key={tag.id || idx}>
    <Tooltip>
      <TooltipTrigger>
        <Badge variant="outline">{tag.name}</Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-semibold mb-1">{tag.description}</p>
        {tag.effects && tag.effects.length > 0 && (
          <div className="text-xs space-y-0.5">
            {tag.effects.map((effect, i) => (
              <p key={i} className={effect.change > 0 ? 'text-green-600' : 'text-red-600'}>
                {effect.attribute.toUpperCase()}: {effect.change > 0 ? '+' : ''}{effect.change}
              </p>
            ))}
          </div>
        )}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
))}
```

---

### ERROR #7: `matchesPlayed` puede estar desincronizado ⚠️ **MEDIO**

**Ubicación:** `src/app/matches/[id]/evaluate/page.tsx` línea 249

**Descripción:**
- `player.stats.matchesPlayed` se actualiza manualmente con `increment(1)`
- Si hay errores en el proceso de evaluación, puede quedar desincronizado
- No hay validación ni recálculo automático

**Código problemático:**
```typescript
batch.update(playerRef, {
  'stats.matchesPlayed': increment(1),
  // ...
});
```

**Problema:**
- Si el proceso falla después de incrementar `matchesPlayed` pero antes de commit
- O si se procesa dos veces por error
- El contador queda incorrecto

**Solución propuesta:**
- Calcular `matchesPlayed` dinámicamente desde las evaluaciones
- O agregar validación para no incrementar si ya existe evaluación para ese matchId

**Código sugerido:**
```typescript
// Validar antes de incrementar
const existingEvals = await getDocs(
  query(collection(firestore, 'evaluations'),
    where('playerId', '==', player.id),
    where('matchId', '==', matchId)
  )
);

if (existingEvals.docs.length === 0) {
  batch.update(playerRef, {
    'stats.matchesPlayed': increment(1),
  });
}
```

---

### ERROR #8: Jugadores manuales sin distinción visual ⚠️ **BAJO**

**Ubicación:** `dashboard/page.tsx` líneas 327-340

**Descripción:**
- Los jugadores manuales (creados por organizadores, sin cuenta de usuario) aparecen en el Top 5
- No hay badge ni indicador visual que los diferencie
- Puede confundir a los usuarios

**Impacto:**
- Confusión sobre quiénes son jugadores reales
- Dificultad para entender la composición del grupo

**Solución propuesta:**
- Agregar badge "Manual" o ícono de usuario con símbolo de edición
- Usar color diferente para el avatar

**Código sugerido:**
```typescript
{top5Players.map((player, index) => (
  <div key={player.id}>
    <div>{index + 1}.</div>
    <Avatar className={player.id !== player.ownerUid ? 'border-2 border-dashed border-muted-foreground' : ''}>
      {player.name.charAt(0)}
    </Avatar>
    <div>
      <div className="flex items-center gap-2">
        <p>{player.name}</p>
        {player.id !== player.ownerUid && <Badge variant="outline" className="text-xs">Manual</Badge>}
      </div>
      <p>{player.position}</p>
    </div>
    <div>{player.ovr}</div>
  </div>
))}
```

---

### ERROR #9: Top 5 sin indicador de criterio de ordenamiento ⚠️ **BAJO**

**Ubicación:** `dashboard/page.tsx` línea 321

**Descripción:**
- El card dice "Los Cracks del Grupo"
- El CardDescription dice "El Top 5 de jugadores por OVR"
- Pero el CardTitle NO incluye esta info

**Impacto:**
- Puede no ser obvio para usuarios nuevos

**Solución propuesta:**
- Agregar badge o texto pequeño en el CardTitle

**Código sugerido:**
```typescript
<CardTitle className="flex items-center gap-2">
  <Star />
  Los Cracks del Grupo
  <Badge variant="outline" className="text-xs font-normal">Por OVR</Badge>
</CardTitle>
```

---

### ERROR #10: Estadísticas de partidos recientes sin contexto ⚠️ **MEDIO**

**Ubicación:** `dashboard/page.tsx` líneas 274-300

**Descripción:**
- Los partidos recientes solo muestran:
  - Título
  - Fecha
  - Organizador
  - Estado
- No muestran:
  - Resultado (si hubo)
  - Goles totales
  - MVP
  - Tu rendimiento (si participaste)

**Impacto:**
- Poca utilidad de la sección "Partidos Anteriores"
- No hay resumen rápido del rendimiento

**Solución propuesta:**
- Agregar badge con "Tu Rating: 8.5" si participaste
- Mostrar resultado "Equipo A 5 - 3 Equipo B"

**Código sugerido:**
```typescript
// Calcular resultado
const teams = match.teams;
const teamAGoals = teams[0]?.players.reduce((sum, p) => sum + (goals[p.uid] || 0), 0);
const teamBGoals = teams[1]?.players.reduce((sum, p) => sum + (goals[p.uid] || 0), 0);

// Render
<div className="flex justify-between">
  <div>
    <p className="font-semibold">{match.title}</p>
    <p className="text-sm text-muted-foreground">{format(...)}</p>
    {teams && teams.length === 2 && (
      <p className="text-xs text-muted-foreground mt-1">
        {teams[0].name} {teamAGoals} - {teamBGoals} {teams[1].name}
      </p>
    )}
  </div>
  <Badge>{statusInfo.label}</Badge>
</div>
```

---

## 6. PROBLEMAS DE UX

### UX #1: No hay paginación ni filtros en tablas largas ⚠️ **MEDIO**

**Ubicación:**
- `player-profile-view.tsx` líneas 486-515 (Partidos Creados)
- `player-profile-view.tsx` líneas 518-556 (Jugadores Creados)

**Descripción:**
- Si un usuario ha creado muchos partidos o jugadores
- La tabla se vuelve muy larga
- No hay paginación, búsqueda, ni filtros

**Solución propuesta:**
- Agregar paginación (ej. 10 items por página)
- Agregar input de búsqueda
- Agregar filtros (por estado para partidos, por posición para jugadores)

---

### UX #2: Gráfico de OVR no interactivo ⚠️ **BAJO**

**Ubicación:** `player-profile-view.tsx` líneas 327-364

**Descripción:**
- El gráfico muestra la progresión de OVR
- Pero no permite:
  - Hacer clic en un punto para ver detalles del partido
  - Ver qué tags se aplicaron en ese partido
  - Navegar al partido

**Solución propuesta:**
- Hacer los puntos del gráfico clicables
- Al hacer clic, mostrar un popover con:
  - Nombre del partido
  - Fecha
  - Rating recibido
  - Tags aplicados
  - Link al partido

---

### UX #3: No hay modo oscuro optimizado para gráficos ⚠️ **BAJO**

**Descripción:**
- Los gráficos de Recharts no ajustan colores según el tema
- En modo oscuro pueden verse mal

**Solución propuesta:**
- Usar variables CSS de Tailwind para los colores
- `stroke="hsl(var(--primary))"`
- `fill="hsl(var(--background))"`

---

### UX #4: Tabla de evaluaciones no tiene resumen total ⚠️ **BAJO**

**Ubicación:** `player-profile-view.tsx` líneas 394-483

**Descripción:**
- La tabla muestra evaluaciones partido por partido
- Pero no hay resumen total:
  - Rating promedio de todos los partidos
  - Total de goles
  - Total de partidos evaluados

**Solución propuesta:**
- Agregar fila de resumen al final de la tabla
- O agregar cards arriba de la tabla con estos totales

---

### UX #5: No se puede comparar con otros jugadores ⚠️ **MEDIO**

**Descripción:**
- No hay forma de comparar tu progresión con la de otros jugadores
- No hay ranking ni percentiles

**Solución propuesta:**
- Agregar badge "Top 15% del grupo" en el perfil
- Agregar gráfico comparativo (opcional)

---

## 7. MEJORAS SUGERIDAS

### MEJORA #1: Dashboard de estadísticas avanzadas

**Descripción:**
- Crear nueva página `/stats` con visualizaciones avanzadas:
  - Gráfico de radar con todos los atributos
  - Comparación con promedio del grupo
  - Heatmap de rendimiento por posición
  - Evolución de consistencia

**Esfuerzo estimado:** 8 horas

---

### MEJORA #2: Timeline de progresión

**Descripción:**
- En lugar de solo gráfico de línea
- Mostrar timeline con eventos:
  - "10 Oct: Partido vs Amigos - Rating 8.5, +2 OVR"
  - "15 Oct: Tag 'Goleador Nato' aplicado - +2 TIR"
  - "20 Oct: Nuevo récord personal: OVR 77"

**Esfuerzo estimado:** 6 horas

---

### MEJORA #3: Exportar estadísticas

**Descripción:**
- Botón para descargar PDF o CSV con:
  - Resumen de estadísticas
  - Gráfico de progresión
  - Historial de evaluaciones

**Esfuerzo estimado:** 4 horas

---

### MEJORA #4: Notificaciones en tiempo real de cambios

**Descripción:**
- Toast notification cuando:
  - Tu OVR sube o baja
  - Recibes una nueva evaluación
  - Un partido que jugaste fue evaluado

**Esfuerzo estimado:** 3 horas

---

### MEJORA #5: Compartir progreso en redes sociales

**Descripción:**
- Botón "Compartir" que genera imagen con:
  - Tu OVR actual
  - Gráfico de progresión
  - Mejores tags recibidos

**Esfuerzo estimado:** 5 horas

---

## 8. PLAN DE IMPLEMENTACIÓN

### Fase 1: Corrección de Errores Críticos (Prioridad ALTA)

**Duración estimada:** 12 horas

1. **ERROR #2**: Normalizar estructura de `performanceTags` (3 horas)
   - Modificar backend para siempre guardar objetos completos
   - Agregar migración de datos existentes
   - Actualizar frontend con validación

2. **ERROR #4**: Corregir manejo de `avgRating` NaN (2 horas)
   - Actualizar cálculo para distinguir "sin ratings" de "rating 0"
   - Modificar UI para mostrar "N/A" cuando corresponda

3. **ERROR #7**: Sincronizar `matchesPlayed` (3 horas)
   - Agregar validación antes de incrementar
   - Crear script de recálculo para datos existentes

4. **ERROR #10**: Mejorar visualización de partidos recientes (4 horas)
   - Agregar cálculo de resultados
   - Mostrar tu rating si participaste
   - Agregar badges informativos

---

### Fase 2: Mejoras de Visualización (Prioridad MEDIA)

**Duración estimada:** 15 horas

1. **ERROR #1**: Mostrar cambios de atributos (4 horas)
   - Modificar tooltip del gráfico
   - Agregar tabla de cambios por atributo

2. **ERROR #6**: Mostrar efectos de tags (3 horas)
   - Agregar tooltips con efectos
   - Usar colores para diferenciar positivos/negativos

3. **ERROR #3**: Mostrar equipo en evaluaciones (2 horas)
   - Agregar columna "Equipo" en tabla
   - Buscar en `match.teams`

4. **ERROR #5**: Ajustar dominio del gráfico (1 hora)
   - Usar dominio fijo o con rango mínimo

5. **UX #1**: Agregar paginación y filtros (5 horas)
   - Implementar paginación en tablas largas
   - Agregar búsqueda y filtros

---

### Fase 3: Mejoras de UX (Prioridad BAJA)

**Duración estimada:** 10 horas

1. **ERROR #8**: Distinguir jugadores manuales (2 horas)
   - Agregar badges y estilos

2. **ERROR #9**: Clarificar criterio de Top 5 (1 hora)
   - Agregar badge en CardTitle

3. **UX #2**: Hacer gráfico interactivo (4 horas)
   - Puntos clicables
   - Popover con detalles del partido

4. **UX #4**: Agregar resumen total en tabla (3 horas)
   - Fila de totales
   - Cards de resumen

---

### Fase 4: Funcionalidades Avanzadas (Opcional)

**Duración estimada:** 26 horas

1. **MEJORA #1**: Dashboard de estadísticas avanzadas (8 horas)
2. **MEJORA #2**: Timeline de progresión (6 horas)
3. **MEJORA #3**: Exportar estadísticas (4 horas)
4. **MEJORA #4**: Notificaciones en tiempo real (3 horas)
5. **MEJORA #5**: Compartir en redes sociales (5 horas)

---

## RESUMEN EJECUTIVO

### Errores Identificados: 10

| ID | Descripción | Prioridad | Esfuerzo |
|----|-------------|-----------|----------|
| #1 | Cambios de atributos NO se visualizan | MEDIO | 4h |
| #2 | Estructura inconsistente de performanceTags | ALTO | 3h |
| #3 | No se muestra en qué equipo jugó | BAJO | 2h |
| #4 | avgRating puede ser NaN | ALTO | 2h |
| #5 | Dominio del gráfico demasiado estrecho | BAJO | 1h |
| #6 | No se muestran efectos de tags | MEDIO | 3h |
| #7 | matchesPlayed desincronizado | MEDIO | 3h |
| #8 | Jugadores manuales sin distinción | BAJO | 2h |
| #9 | Top 5 sin criterio claro | BAJO | 1h |
| #10 | Partidos recientes sin contexto | MEDIO | 4h |

### Problemas de UX Identificados: 5

| ID | Descripción | Prioridad | Esfuerzo |
|----|-------------|-----------|----------|
| UX#1 | No hay paginación ni filtros | MEDIO | 5h |
| UX#2 | Gráfico no interactivo | BAJO | 4h |
| UX#3 | Modo oscuro no optimizado | BAJO | 2h |
| UX#4 | Tabla sin resumen total | BAJO | 3h |
| UX#5 | No se puede comparar con otros | MEDIO | 6h |

### Mejoras Sugeridas: 5

| ID | Descripción | Esfuerzo |
|----|-------------|----------|
| #1 | Dashboard de estadísticas avanzadas | 8h |
| #2 | Timeline de progresión | 6h |
| #3 | Exportar estadísticas | 4h |
| #4 | Notificaciones en tiempo real | 3h |
| #5 | Compartir en redes sociales | 5h |

### Esfuerzo Total Estimado

- **Fase 1 (Crítico):** 12 horas
- **Fase 2 (Medio):** 15 horas
- **Fase 3 (Bajo):** 10 horas
- **Fase 4 (Opcional):** 26 horas

**TOTAL:** 63 horas

---

## CONCLUSIÓN

El sistema de visualización de datos históricos en Amateur Football Manager es **funcional pero mejorable**. Los principales problemas son:

1. **Falta de detalle en la visualización de cambios de atributos** - Los usuarios no pueden ver qué atributos mejoraron específicamente
2. **Inconsistencias en la estructura de datos** - `performanceTags` tiene múltiples formatos posibles
3. **Falta de contexto en varias visualizaciones** - Partidos sin resultados, evaluaciones sin equipo, etc.

Las correcciones de **Fase 1 y Fase 2** (27 horas) son altamente recomendadas para mejorar significativamente la experiencia del usuario.

---

**Documento generado automáticamente por Claude Code**
**Fecha:** 23 de Octubre de 2025
