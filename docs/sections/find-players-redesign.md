# Rediseno /find-players — Mapa Fullscreen + Carrusel con Flip 3D

## Resumen

Se rediseno completamente la pagina `/find-players` siguiendo el patron **Map + Bottom Card Carousel** (estilo Airbnb/Google Maps Explore). El layout anterior con split mobile/desktop, Drawer y lista de cards fue reemplazado por un unico layout fullscreen con mapa, carrusel horizontal de cards con animacion flip 3D, y filtros superpuestos con efecto glassmorphism.

---

## Arquitectura

```
+-------------------------------+
|  [Filtros overlaid]     top   |
|                               |
|                               |
|      MAPA FULLSCREEN          |
|      (100dvh)                 |
|                               |
|                               |
|  [Carrusel de cards]  bottom  |
+-------------------------------+
```

- **Un solo layout** para mobile y desktop (sin `useIsMobile`)
- Mapa ocupa toda la pantalla (`absolute inset-0`)
- Filtros flotan arriba del mapa (`absolute top-3 z-20`)
- Carrusel anclado abajo (`absolute bottom-0 z-10`)
- Padding inferior: `pb-20` en mobile (nav bar), `pb-6` en desktop

---

## Archivos

| Archivo | Estado | Descripcion |
|---------|--------|-------------|
| `src/components/find-players/player-flip-card.tsx` | Nuevo | Card con flip 3D (front + back) |
| `src/components/find-players/player-map-carousel.tsx` | Nuevo | Carrusel Embla con sync bidireccional |
| `src/components/find-players/map-overlay-filters.tsx` | Nuevo | Filtros colapsables sobre el mapa |
| `src/app/find-players/page.tsx` | Reescrito | Layout unico fullscreen |
| `src/components/find-players/map-player-info-card.tsx` | Eliminado | Reemplazado por flip card |
| `src/components/find-players/player-search-card.tsx` | Sin cambios | Se mantiene por `formatAvailability` |
| `src/components/maps/players-map.tsx` | Sin cambios | Ya tenia panTo al jugador activo |

---

## Componentes

### 1. PlayerFlipCard

**Ubicacion:** `src/components/find-players/player-flip-card.tsx`

Card de 260x300px con animacion flip 3D via `framer-motion`.

**Props:**
```ts
type PlayerFlipCardProps = {
  player: AvailablePlayer;
  distanceKm: number;
  isActive: boolean;
  actionSlot?: ReactNode;  // Slot para InvitePlayerDialog
};
```

**Front (cara visible por defecto):**
- Avatar (80px) con `border-glow-{level}` segun OVR
- Fondo con aura segun rarity (`aura-bronze/silver/gold/elite`)
- Nombre del jugador (bold, truncado)
- `PlayerPositionBadge` (size="sm") + `PlayerOvr` (size="compact")
- Distancia con icono MapPin
- Preview de disponibilidad

**Back (al hacer tap/click):**
- OVR grande centrado (text-5xl) con color de nivel
- Posicion con icono y nombre completo (ej: "Delantero")
- Disponibilidad detallada con icono Clock
- Distancia
- Boton "Invitar a partido" (via `actionSlot`, full-width)
- Boton "Ver mas (Proximamente)" disabled (placeholder para resenas futuras)

**Animacion:**
```tsx
<motion.div
  animate={{ rotateY: isFlipped ? 180 : 0 }}
  transition={{ duration: 0.5, type: 'spring', stiffness: 120, damping: 15 }}
  style={{ transformStyle: 'preserve-3d' }}
/>
```

**Reutiliza:** `Avatar`, `PlayerPositionBadge`, `PlayerOvr`, `positionConfig`, `getOvrLevel`, `formatDistance`, `formatAvailability`, clases CSS `aura-*` y `border-glow-*`.

---

### 2. PlayerMapCarousel

**Ubicacion:** `src/components/find-players/player-map-carousel.tsx`

Carrusel horizontal usando Embla Carousel (componentes `ui/carousel.tsx`).

**Props:**
```ts
type PlayerMapCarouselProps = {
  players: AvailablePlayer[];
  distanceMap: Map<string, number>;
  activePlayerId: string | null;
  onActiveChange: (uid: string | null) => void;
  userMatches: Match[];
  api: CarouselApi | undefined;
  setApi: (api: CarouselApi) => void;
};
```

**Configuracion Embla:**
- `align: 'center'` — card activa centrada
- `loop: false` — sin loop infinito
- `dragFree: false` — snap a cada card
- `basis-auto` en items — respeta ancho fijo de 260px
- Peek de cards adyacentes visible

**Sincronizacion bidireccional:**

| Direccion | Trigger | Accion |
|-----------|---------|--------|
| Carrusel -> Mapa | User swipea card | `api.on('select')` llama `onActiveChange(uid)` |
| Mapa -> Carrusel | User toca marcador | `useEffect` detecta cambio en `activePlayerId` y llama `api.scrollTo(index)` |

---

### 3. MapOverlayFilters

**Ubicacion:** `src/components/find-players/map-overlay-filters.tsx`

Barra de filtros superpuesta al mapa con efecto glassmorphism.

**Props:** Todas las props de filtros + `playerCount` y `locationLabel`.

**Visual:**
- Posicion: `absolute top-3 left-3 right-3 z-20`
- Fondo: `bg-card/90 backdrop-blur-md rounded-2xl border shadow-lg`
- **Header siempre visible:** Badge con count + ubicacion + toggle expandir
- **Expandido:** Muestra `PlayerFiltersBar` existente
- Animacion collapse con `AnimatePresence` + `motion.div`

---

## Pagina (page.tsx)

**Ubicacion:** `src/app/find-players/page.tsx`

### Lo que se elimino:
- `Drawer`, `DrawerContent`, `DrawerHeader`, `DrawerTitle`
- `ScrollArea`
- `PageHeader`
- `PlayerSearchCard` (lista de cards)
- `MapPlayerInfoCard` (overlay)
- `useIsMobile` hook
- `listRef`
- Split condicional mobile/desktop (`if (isMobile)`)
- `useToast` (no se usaba)

### Lo que se mantuvo:
- Todo el state de filtros (position, ovr, radius, day, time)
- Location state y `handleRequestLocation`
- Data fetching (queries Firestore para `availablePlayers` y `matches`)
- `distanceMap` computation
- `filteredPlayers` con todos los filtros
- `FirstTimeInfoDialog`

### Estados de la UI:
| Estado | Render |
|--------|--------|
| Cargando usuario | Spinner centrado |
| Sin ubicacion | Overlay centrado con prompt "Activa tu ubicacion" |
| Buscando jugadores | Pill flotante con spinner |
| 0 jugadores encontrados | Card centrada "No se encontraron jugadores" |
| N jugadores encontrados | Mapa + filtros + carrusel |

---

## Flujo de interaccion

1. Usuario abre `/find-players`
2. Si no tiene ubicacion guardada, ve prompt para activarla
3. Al activar, el mapa se carga fullscreen con marcadores
4. Los filtros aparecen arriba (colapsados por defecto)
5. El carrusel de cards aparece abajo con la primera card centrada
6. **Swipe en carrusel** -> card se centra -> marcador se destaca -> mapa panea
7. **Tap en marcador** -> carrusel scrollea a esa card -> marcador se destaca
8. **Tap en card** -> flip 3D mostrando detalles + boton Invitar
9. **Tap en "Invitar a partido"** -> abre `InvitePlayerDialog`
10. Filtros se expanden tocando el header -> `PlayerFiltersBar` se muestra

---

## Dependencias usadas

- `framer-motion` — flip 3D animation + AnimatePresence para filtros
- `embla-carousel-react` — carrusel horizontal (via `ui/carousel.tsx`)
- `@vis.gl/react-google-maps` — mapa (sin cambios)
- CSS classes `aura-*` y `border-glow-*` de `globals.css`
