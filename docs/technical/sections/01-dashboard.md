# Dashboard - Vista Principal

## Descripción General

El Dashboard es la página principal de la aplicación Pateá. Proporciona un resumen completo de la actividad del usuario, próximos partidos, estadísticas de jugadores, y acceso rápido a las funcionalidades principales.

## Ruta

`/dashboard` - Requiere autenticación

## Componentes Principales

### 1. **DashboardHeader**
- Saludo personalizado con nombre del usuario
- Selector de grupo activo (`GroupSwitcher`)
- Botones de acción rápida

### 2. **NextMatchCard** (`next-match-card.tsx`)
**Muestra el próximo partido programado**
- Fecha y hora del partido
- Ubicación con mapa
- Jugadores confirmados vs total
- Botón de acción (confirmar asistencia, ver detalles)

### 3. **PlayerStatsGrid**
**Resumen estadístico de jugadores destacados**
- Goleador del grupo
- Mejor asistidor
- Jugador con mejor OVR promedio
- Jugador más consistente

### 4. **RecentMatchesCarousel**
**Últimos 3-5 partidos del grupo**
- Resultado final
- MVP del partido
- Link a detalles y evaluaciones

### 5. **TeamAvailabilityPosts** (`my-teams-availability.tsx`)
**Posts de disponibilidad de equipos**
- Equipos buscando rivales
- Fecha y horario propuesto
- Botón para desafiar

### 6. **QuickActions Floating Menu**
- Crear nuevo partido
- Añadir jugador
- Ver calendario
- Acceder a competiciones

## Flujos de IA Integrados

### 1. generate-balanced-teams
**Usado en**: Creación rápida de partit desde dashboard
- Click en "Crear Partido Rápido"
- Selección automática de jugadores disponibles
- Generación de equipos con IA

### 2. coach-conversation
**Usado en**: Widget de "Consultar al DT"
- Chat contextual desde dashboard
- Análisis rápido del estado del grupo

### 3. generate-group-summary
**Usado en**: Sección de resumen del grupo
- Descripción generada automáticamente del grupo
- Actualizada semanalmente

## Server Actions Utilizados

```typescript
// Obtener próximo partido
getDashboardDataAction(userId: string, groupId: string)

// Estadísticas de jugadores destacados
getTopPlayersStatsAction(groupId: string)

// Partidos recientes
getRecentMatchesAction(groupId: string, limit: number)

// Posts de disponibilidad de equipos
getAvailableTeamPostsAction(groupId?: string)
```

## Modelos de Datos

### Dashboard Data (agregado)
```typescript
{
  nextMatch?: Match;
  topPlayers: {
    topScorer: Player & { goals: number };
    topAssister: Player & { assists: number };
    highestOVR: Player;
    mostConsistent: Player & { avgRating: number };
  };
  recentMatches: Match[];
  teamPosts: TeamAvailabilityPost[];
  groupSummary?: string;  // Generado por IA
}
```

## Características Especiales

### Modo Juego (Game Mode)
- Fondo temático de fútbol (`game-mode-background.tsx`)
- Paleta de colores verde cancha
- Animaciones sutiles

### Notificaciones en Tiempo Real
- Badge de notificaciones no leídas
- Invitaciones pendientes
- Partidos próximos (24h antes)

### Rendimiento
- Carga optimizada con Server Components
- Suspense boundaries para cada sección
- Skeleton loaders

## Navegación

### Desde Dashboard hacia:
- `/players` - Lista completa de jugadores
- `/matches` - Calendario de partidos
- `/matches/[id]` - Detalles de un partido específico
- `/competitions` - Ligas y copas
- `/groups/[id]` - Vista detallada del grupo
- `/profile` - Perfil del usuario

### Hacia Dashboard desde:
- Navbar principal (icono de casa)
- Al completar flujos importantes
- Redirect después de login

## Responsive Design

### Desktop (>1024px)
- Grid de 3 columnas
- Sidebar lateral con estadísticas
- Floating action menu bottom-right

### Tablet (768px - 1024px)
- Grid de 2 columnas
- Sidebar colapsable

### Mobile (<768px)
- Stack vertical
- Cards full-width
- Bottom navigation
- Floating action button

## Permisos y Roles

### Usuario Regular
- Ver dashboard de su grupo  
- Crear partidos
- Ver estadísticas

### Admin de Grupo
- Todo lo anterior +
- Editar información del grupo
- Gestionar jugadores del grupo
- Eliminar partidos

### Usuario sin Grupo
- Vista simplificada
- Opción destacada para "Crear tu primer grupo"
- Explorar grupos públicos

## Estados de Carga

```typescript
// Loading state
<DashboardSkeleton />

// Empty state (sin grupo)
<EmptyDashboard>
  <CreateGroupCTA />
</EmptyDashboard>

// Error state
<DashboardError 
  message="No pudimos cargar el dashboard"
  retry={() => window.location.reload()}
/>
```

## Optimizaciones

1. **Prefetching**: Next.js prefetch de rutas comunes
2. **Image Optimization**: Next/Image para fotos de jugadores
3. **Lazy Loading**: Componentes pesados con dynamic import
4. **Memoization**: React.memo en componentes de stats

## Tracking y Analytics

- Evento: `dashboard_viewed`
- Evento: `quick_action_clicked`
- Evento: `next_match_interacted`
- Evento: `team_post_challenged`

## Próximas Mejoras

- [ ] Widget de clima para próximo partido
- [ ] Gráfico de progresión del grupo
- [ ] Recomendaciones de jugadores para fichar
- [ ] Timeline social del grupo
- [ ] Integración con Google Calendar

## Dependencias Clave

```typescript
import { GroupSwitcher } from '@/components/group-switcher';
import { NextMatchCard } from '@/components/next-match- card';
import { StatCard } from '@/components/stat-card';
import { MatchCard } from '@/components/match-card';
import { TeamAvailabilityPosts } from '@/components/my-teams-availability';
import { FloatingActionMenu } from '@/components/floating-action-menu';
```

## Código Relevante

- Página: `src/app/dashboard/page.tsx`
- Server Actions: `src/lib/actions/server-actions.ts`
- Tipos: `src/lib/types.ts`
