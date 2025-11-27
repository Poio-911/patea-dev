# Jugadores - Sistema de Gestión de Plantel

## Descripción General

El sistema de jugadores es el corazón de Pateá. Permite gestionar perfiles de jugadores con un sistema completo de atributos, evaluaciones, estadísticas y progresión. Cada jugador tiene atributos tipo FIFA (PAC, SHO, PAS, DRI, DEF, PHY) que evolucionan basados en evaluaciones de partidos.

## Rutas

- `/players` - Lista de jugadores del grupo activo
- `/players/[id]` - Perfil detallado del jugador
- `/players/[id]/analysis` - Análisis de IA del jugador
- `/players/[id]/progression` - Vista de progresión histórica

## Componentes Principales

### 1. **PlayerCard** (`player-card.tsx`)
**Tarjeta compacta estilo FIFA para mostrar en grid**
- Foto del jugador (cropped)
- Nombre y posición
- OVR destacado
- 6 atributos con valores
- Efectos hover con elevation
- Click para ir a perfil detallado

### 2. **PlayerDetailCard** (`player-detail-card.tsx`)
**Vista expandida con toda la información**
- Header con foto, nombre, posición
- Stats principales (partidos, goles, asistencias, rating promedio)
- Gráfico de atributos (radar chart)
- Tabs: Estadísticas / Evaluaciones / Progresión / Insights

### 3. **AddPlayerDialog** (`add-player-dialog.tsx`)
**Dialog para crear jugador manual**
- Input nombre
- Selector de posición
- Sliders para cada atributo (50-99)
- Crop y upload de foto
- Botón "Crear Jugador"

### 4. **EditPlayerDialog** (`edit-player-dialog.tsx`)
**Dialog para editar jugador existente**
- Mismos campos que Add
- Botón "Guardar Cambios"
- Botón "Eliminar Jugador" (con confirmación)

### 5. **PlayerProfileView** (`player-profile-view.tsx`)
**Vista completa del perfil**
- PlayerDetailCard
- Tabs con contenido:
  - **Estadísticas**: Stats detalladas
  - **Evaluaciones**: Lista de evaluaciones recientes
  - **Progresión**: PlayerProgressionView
  - **Insights**: PlayerInsightsPanel (con IA)

### 6. **PlayerProgressionView** (`player-progression-view.tsx`)
**Análisis de progresión temporal**
- Gráfico de línea de OVR a lo largo del tiempo
- Lista de cambios de OVR con detalles
- Botón "Analizar Progresión con IA"
- Output del AI flow `analyze-player-progression`

### 7. **PlayerInsightsPanel** (`player-insights-panel.tsx`)
**Panel de insights con IA**
- Botón "Detectar Patrones"
- Botón "Obtener Sugerencias de Mejora"
- Output de AI flows:
  - `detect-player-patterns`
  - `suggest-player-improvements`

### 8. **PlayerRecentActivity** (`player-recent-activity.tsx`)
**Actividad reciente del jugador**
- Últimos 5 partidos jugados
- Evaluaciones recibidas
- Cambios de OVR

## Flujos de IA Integrados

### 1. **suggest-player-improvements**
**Usado en**: PlayerInsightsPanel, AI Suggestion Dialog
- Input: Stats + evaluaciones recientes
- Output: 2-3 consejos accionables
- Trigger: Click "Obtener Sugerencias"

### 2. **analyze-player-progression**
**Usado en**: PlayerProgressionView
- Input: Historial de OVR + evaluaciones
- Output: Resumen, tendencias positivas, áreas de mejora
- Trigger: Click "Analizar Progresión"

### 3. **detect-player-patterns**
**Usado en**: PlayerInsightsPanel
- Input: Stats, evaluaciones, OVR history, tags
- Output: Patrones detectados, insights, recomendaciones
- Trigger: Click "Detectar Patrones"

### 4. **generate-player-card-image**
**Usado en**: PlayerProfileView
- Input: Datos del jugador
- Output: Imagen de tarjeta estilo FIFA
- Trigger: Click "Generar Tarjeta"
- Límite: 3 generaciones por día (créditos)

## Server Actions Utilizados

```typescript
// CRUD de jugadores
addPlayerAction(groupId: string, playerData: Partial<Player>)
updatePlayerAction(playerId: string, updates: Partial<Player>)
deletePlayerAction(playerId: string)

// Estadísticas
getPlayerStatsAction(playerId: string)
getTopPlayersStatsAction(groupId: string)

// Evaluaciones
getPlayerEvaluationsAction(playerId: string, limit?: number)

// OVR History
getPlayerOVRHistoryAction(playerId: string)

// IA
getPlayerImprovementSuggestionsAction(playerId: string, groupId: string)
analyzePlayerProgressionAction(playerId: string, groupId: string)
detectPlayerPatternsAction(playerId: string, groupId: string)

// Imagen de tarjeta
generatePlayerCardImageAction(playerId: string)
```

## Modelos de Datos

### Player (Firestore: `/players/{playerId}`)
```typescript
{
  id: string;
  name: string;
  position: 'DEL' | 'MED' | 'DEF' | 'POR';
  ovr: number;  // Calculado automáticamente
  
  // Atributos (50-99)
  pac: number;  // Pace (Velocidad)
  sho: number;  // Shooting (Tiro)
  pas: number;  // Passing (Pase)
  dri: number;  // Dribbling (Gambeta)
  def: number;  // Defending (Defensa)
  phy: number;  // Physical (Físico)
  
  // Metadata
  photoUrl?: string;
  cropPosition?: { x: number; y: number };
  cropZoom?: number;
  
  // Ownership
  ownerUid: string;    // Usuario que creó al jugador
  groupId: string | null;
  
  // Generación de tarjetas (sistema de créditos)
  cardGenerationCredits?: number;  // Default: 3
  lastCreditReset?: string;        // ISO timestamp
  
  // Estadísticas
  stats: {
    matchesPlayed: number;
    goals: number;
    assists: number;
    averageRating: number;
    yellowCards?: number;
    redCards?: number;
  };
}
```

### OVR Calculation
```typescript
// Cálculo automático del OVR
ovr = Math.round((pac + sho + pas + dri + def + phy) / 6)
```

### Evaluation (Firestore: `/matches/{matchId}/evaluations/{playerId}`)
```typescript
{
  playerId: string;
  playerName: string;
  rating: number;  // 1-10
  performanceTags: string[];  // ["Gambeta Mortal", "Pase Quirúrgico"]
  evaluatedBy: string;  // UID del evaluador
  evaluatedAt: string;  // ISO timestamp
  matchId: string;
}
```

### OvrHistory (Firestore: `/players/{playerId}/ovrHistory/{historyId}`)
```typescript
{
  id: string;
  date: string;
  oldOVR: number;
  newOVR: number;
  change: number;  // +2, -1, etc.
  matchId: string;
  attributeChanges?: {
    pac?: number;
    sho?: number;
    pas?: number;
    dri?: number;
    def?: number;
    phy?: number;
  };
}
```

## Sistema de Atributos

### Significado de cada atributo

- **PAC (Pace)**: Velocidad, aceleración, explosividad
- **SHO (Shooting)**: Definición, potencia de tiro, precisión
- **PAS (Passing)**: Pases cortos, largos, visión de juego
- **DRI (Dribbling)**: Control de pelota, gambetas, agilidad
- **DEF (Defending)**: Marcación, anticipo, tackles
- **PHY (Physical)**: Fuerza, resistencia, aguante

### Cómo evolucionan los atributos

1. **Post-Match**: Después de cada partido evaluado
2. **Tags de Rendimiento**: Afectan atributos específicos
   - "Gambeta Mortal" → +1 DRI
   - "La Colgó del Ángulo" → +1 SHO
   - "Pase al Rival" → -1 PAS
3. **Rating General**: Afecta todos los atributos ligeramente
4. **Límites**: Atributos no bajan de 50 ni suben de 99

## Sistema de Evaluación

### Performance Tags
Los tags están categorizados por tipo:

**Positivos** (impacto verde):
- Ofensivos: "La Colgó del Ángulo", "Asistencia de Lujo"
- Técnicos: "Gambeta Mortal", "Pase Quirúrgico"
- Defensivos: "Muralla Infranqueable", "Quite Limpio"
- Físicos: "Incansable", "Fuerza Bruta"

**Negativos** (impacto rojo):
- "La Tiró a las Nubes", "Pase al Rival"
- "Se Cansó", "Lo Pasaron como Cono"

**Neutros** (impacto gris):
- "Participó poco", "Jugada Peligrosa"

### Flujo de Evaluación
1. Partido finaliza
2. Se navega a `/matches/[id]/evaluate`
3. Se evalúa cada jugador (rating + tags)
4. Al guardar, se recalculan atributos y OVR
5. Se crea entrada en OvrHistory si hubo cambio

## Características Especiales

### Sistema de Créditos para Tarjetas
- Cada jugador tiene 3 créditos por día
- Se resetea diariamente
- Necesario para generar imagen de tarjeta con IA
- Previene abuso del servicio

### Crop y Upload de Fotos
- Dialog de ImageCropperDialog
- Crop circular para foto del jugador
- Zoom in/out
- Posición ajustable
- Se guarda como Firebase Storage blob

### Búsqueda y Filtrado
- Ordenamiento por OVR (default)
- Filtro por posición
- Búsqueda por nombre

### Follow System
- Usuarios pueden seguir a otros usuarios
- Botón "Seguir" en perfil de jugador
- Si el jugador es de otro usuario

## Navegación

### Desde Players hacia:
- `/players/[id]` - Ver perfil
- `/players/[id]/progression` - Ver progresión
- `/players/[id]/analysis` - Análisis de IA

### Hacia Players desde:
- Dashboard (tarjetas de top players)
- Navbar principal
- Después de crear jugador

## Responsive Design

### Desktop
- Grid de 4 columnas
- Sidebar con filtros

### Tablet
- Grid de 3 columnas

### Mobile
- Grid de 2 columnas
- Filtros en bottom sheet

## Permisos y Roles

### Jugador Propio
- Ver, editar, eliminar
- Generar tarjeta (sujeto a créditos)
- Acceder a todos los insights

### Jugador de Otro Usuario en Mismo Grupo
- Ver perfil
- Ver stats públicas
- NO puede editar ni eliminar

### Jugador de Otro Grupo
- Ver solo si el grupo es público

## Estados Especiales

### Sin Grupo Activo
```tsx
<Alert>
  No hay grupo activo. Creá o unite a un grupo.
</Alert>
```

### Sin Jugadores
```tsx
<Alert>
  No hay jugadores en este grupo. ¡Empezá por sumar al primero!
</Alert>
```

## Optimizaciones

1. **Lazy Loading**: Tarjetas con Intersection Observer
2. **Image Optimization**: Next/Image para fotos
3. **Memoization**: UseMemo para sorting y filtering
4. **Virtualization**: Para listas muy largas (>100 jugadores)

## Próximas Mejoras

- [ ] Comparador de jugadores (vs)
- [ ] Historial de partidos jugados juntos
- [ ] Química entre jugadores
- [ ] Exportar stats a CSV
- [ ] Badges y logros
- [ ] XP system para gamificación

## Código Relevante

- Páginas:
  - `src/app/players/page.tsx`
  - `src/app/players/[id]/page.tsx`
  - `src/app/players/[id]/analysis/page.tsx`
  - `src/app/players/[id]/progression/page.tsx`
- Componentes:
  - `src/components/player-card.tsx`
  - `src/components/player-detail-card.tsx`
  - `src/components/add-player-dialog.tsx`
  - `src/components/edit-player-dialog.tsx`
  - `src/components/player-profile-view.tsx`
  - `src/components/player-progression-view.tsx`
  - `src/components/player-insights-panel.tsx`
- Actions: `src/lib/actions/server-actions.ts`
- Types: `src/lib/types.ts` (Player, PlayerStats, OvrHistory)
