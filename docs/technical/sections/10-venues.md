# Venues - Sistema de Lugares

## Descripción General

Sistema de gestión de lugares (canchas, campos, gimnasios) donde se juegan los partidos. Permite guardar venues favoritos con información completa, pricing, disponibilidad y ratings del grupo.

## Componentes Principales

### venues/venue-card.tsx

Tarjeta que muestra información de un venue.

**Contenido:**
- Nombre del lugar
- Dirección completa
- Mapa preview (Google Maps thumbnail)
- Rating promedio del grupo (⭐)
- Precio promedio por hora
- Amenities/facilidades (vestuarios, estacionamiento, iluminación, etc.)
- Foto principal
- Distancia desde ubicación del usuario
- Disponibilidad (próximos slots disponibles)

**Acciones:**
- Ver en mapa (abre Google Maps)
- Llamar al lugar
- Crear partido en este venue
- Editar (si eres quien lo agregó)
- Marcar como favorito

### venues/venue-manager.tsx

Interfaz de gestión de venues del grupo.

**Features:**
- Lista de todos los venues del grupo
- Buscar por nombre/dirección
- Filtros: precio, rating, distancia, amenities
- Ordenamiento: alfabético, rating, más usado, cercanía
- Agregar nuevo venue
- Importar desde Google Places
- Ver estadísticas (# partidos jugados aquí)

**Vista:**
- Grid de cards (desktop)
- Lista (mobile)
- Mapa con markers (alternate view)

## Server Actions

### venue-actions.ts

```typescript
// Crear venue nuevo
createVenueAction(data: {
  name: string;
  address: string;
  coordinates: { lat: number; lng: number };
  placeId?: string;  // Google Places ID
  phone?: string;
  website?: string;
  pricing?: {
    pricePerHour?: number;
    currency: string;
    notes?: string;
  };
  amenities?: string[];  // Array de amenities
  photos?: string[];  // URLs de fotos
  groupId: string;
})

// Actualizar venue
updateVenueAction(venueId: string, updates: Partial<Venue>)

// Eliminar venue (solo si no tiene partidos asociados)
deleteVenueAction(venueId: string)

// Rate venue después de un partido
rateVenueAction(venueId: string, rating: number, comment?: string, matchId: string)

// Marcar como favorito
toggleVenueFavoriteAction(venueId: string, userId: string)

// Reportar issue con venue
reportVenueIssueAction(venueId: string, issue: string, userId: string)

// Sugerir venue correction
suggestVenueCorrectionAction(venueId: string, corrections: Partial<Venue>)

// Import from Google Places
importVenueFromPlacesAction(placeId: string, groupId: string)
```

## Modelo de Datos

### Venue

```typescript
// /venues/{venueId}
{
  id: string;
  name: string;
  address: string;
  coordinates: {
    lat: number;
    lng: number;
  };

  // Google Places integration
  placeId?: string;
  googleRating?: number;
  googlePhotoUrls?: string[];

  // Contact
  phone?: string;
  website?: string;
  email?: string;

  // Pricing
  pricing?: {
    pricePerHour?: number;
    currency: string;  // 'ARS', 'USD', etc.
    notes?: string;  // "Descuento grupales", etc.
    deposit?: number;
    paymentMethods?: string[];  // ['cash', 'transfer', 'card']
  };

  // Amenities
  amenities?: string[];
  // Ejemplos: 'vestuarios', 'estacionamiento', 'iluminacion',
  // 'techado', 'cantina', 'wifi', 'duchas', 'parrilla'

  // Photos
  photos?: Array<{
    url: string;
    uploadedBy: string;
    uploadedAt: Timestamp;
  }>;

  // Group context
  groupId: string;
  addedBy: string;  // userId
  addedAt: Timestamp;

  // Stats
  stats: {
    matchesPlayed: number;
    lastUsed?: Timestamp;
    averageRating?: number;
    ratingCount: number;
    favoriteCount: number;
  };

  // Availability (optional - para venues con sistema de reserva)
  availability?: {
    monday?: string[];    // ['09:00-12:00', '14:00-18:00']
    tuesday?: string[];
    wednesday?: string[];
    thursday?: string[];
    friday?: string[];
    saturday?: string[];
    sunday?: string[];
  };

  // Metadata
  surface?: 'grass' | 'synthetic' | 'indoor' | 'concrete';
  size?: '5v5' | '7v7' | '11v11' | 'futsal';
  indoor?: boolean;
  lighting?: boolean;

  // Moderation
  verified?: boolean;  // Verificado por admin del grupo
  hidden?: boolean;  // Oculto por problemas reportados
}
```

### VenueRating

```typescript
// /venues/{venueId}/ratings/{ratingId}
{
  id: string;
  userId: string;
  userName: string;
  matchId: string;  // Partido donde se jugó
  rating: number;  // 1-5 estrellas
  comment?: string;
  aspects?: {
    cleanliness?: number;
    staff?: number;
    facilities?: number;
    value?: number;
  };
  createdAt: Timestamp;
}
```

### VenueFavorite

```typescript
// /users/{userId}/favoriteVenues/{venueId}
{
  venueId: string;
  venueName: string;
  addedAt: Timestamp;
}
```

## Integración con Google Maps

### Venue Selector en AddMatchDialog

Al crear un partido, el usuario puede:

1. **Buscar venue existente**:
   - Dropdown con venues del grupo
   - Autocomplete por nombre
   - Ordenado por más usados

2. **Crear venue nuevo inline**:
   - Buscar con Google Places Autocomplete
   - Seleccionar de resultados
   - Auto-completa dirección, coordenadas, teléfono
   - Usuario agrega pricing y amenities
   - Se guarda en `/venues/`

3. **Marcar en mapa**:
   - Click en mapa para seleccionar ubicación
   - Reverse geocoding para obtener dirección
   - Venue temporal (no se guarda en DB)

### Venue Map View

Vista de mapa con todos los venues del grupo:
- Markers con color según rating
- Cluster de markers cercanos
- Info window con preview card
- Dirección desde ubicación actual
- Filtros overlay (precio, rating, amenities)

## Amenities Predefinidos

Lista de amenities comunes con iconos:

```typescript
const AMENITIES = [
  { id: 'vestuarios', label: 'Vestuarios', icon: 'Users' },
  { id: 'duchas', label: 'Duchas', icon: 'Droplet' },
  { id: 'estacionamiento', label: 'Estacionamiento', icon: 'Car' },
  { id: 'iluminacion', label: 'Iluminación', icon: 'Lightbulb' },
  { id: 'techado', label: 'Techado', icon: 'Home' },
  { id: 'cantina', label: 'Cantina/Bar', icon: 'Coffee' },
  { id: 'wifi', label: 'WiFi', icon: 'Wifi' },
  { id: 'parrilla', label: 'Parrilla', icon: 'Flame' },
  { id: 'seguridad', label: 'Seguridad', icon: 'Shield' },
  { id: 'arbitro', label: 'Árbitro incluido', icon: 'Whistle' },
  { id: 'pelotas', label: 'Pelotas incluidas', icon: 'Ball' },
  { id: 'petos', label: 'Petos incluidos', icon: 'Shirt' },
  { id: 'primeros_auxilios', label: 'Primeros auxilios', icon: 'Cross' },
  { id: 'accesible', label: 'Accesible', icon: 'Accessibility' },
];
```

## Rating System

### Post-Match Rating Flow

Después de finalizar un partido:

1. **Prompt para rating**:
   - "¿Cómo estuvo la cancha?"
   - 5 estrellas quick rating
   - Opcional: Comentario detallado
   - Opcional: Aspectos específicos (limpieza, staff, etc.)

2. **Agregado a historial**:
   - Rating guardado en `/venues/{venueId}/ratings/{ratingId}`
   - Stats del venue actualizados
   - Visible en venue card

3. **Incentivo**:
   - Acumular ratings ayuda al grupo
   - Badge por "Venue Reviewer" (10+ ratings)

### Average Rating Calculation

```typescript
// Recalcular promedio cuando se agrega rating
const ratings = await getRatings(venueId);
const avgRating = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;

await updateDoc(venueRef, {
  'stats.averageRating': avgRating,
  'stats.ratingCount': ratings.length
});
```

## Búsqueda y Filtros

### Search

- Búsqueda por nombre (fuzzy search)
- Búsqueda por dirección/zona
- Autocompletado con historial reciente

### Filtros

**Precio:**
- Gratis
- Hasta $X por hora
- $X - $Y por hora
- Más de $Y por hora

**Rating:**
- 4+ estrellas
- 3+ estrellas
- Cualquier rating

**Distancia:**
- Menos de 5km
- Menos de 10km
- Menos de 20km
- Cualquier distancia

**Amenities:**
- Multi-select de amenities deseados
- Lógica AND (tiene todos) o OR (tiene alguno)

**Surface:**
- Pasto natural
- Sintético
- Indoor
- Cemento/Concreto

**Size:**
- Fútbol 5
- Fútbol 7
- Fútbol 11
- Futsal

### Ordenamiento

- **Relevancia**: Combinación de rating, uso reciente, distancia
- **Rating**: Mayor a menor
- **Más usados**: Por # de partidos
- **Más recientes**: Último partido jugado
- **Cercanía**: Distancia desde ubicación actual
- **Precio**: Menor a mayor
- **Alfabético**: A-Z

## Estadísticas del Venue

Vista estadística en detalle del venue:

**Uso:**
- Total de partidos jugados aquí
- Último partido: [fecha]
- Partido más reciente con resultado
- Frecuencia de uso (partidos/mes)

**Performance:**
- Equipo local gana X% aquí
- Promedio de goles por partido
- Partidos más memorables (por rating)

**Calendario:**
- Próximos partidos programados
- Disponibilidad por día/hora

**Costos:**
- Gasto total del grupo en este venue
- Costo promedio por partido
- Evolución de precios (si hay historial)

## Importación desde Google Places

Workflow para importar venue oficial:

1. **Usuario busca con Google Places Autocomplete**
2. **Selecciona resultado**
3. **Sistema auto-completa**:
   - Nombre
   - Dirección
   - Coordenadas
   - PlaceId
   - Teléfono
   - Rating de Google
   - Fotos de Google
   - Horarios de atención

4. **Usuario completa**:
   - Precio (no está en Google)
   - Amenities específicos para fútbol
   - Notas personales del grupo

5. **Se crea venue con flag `googlePlacesImported: true`**

### Sync con Google Places

Opcional: Actualizar periódicamente info de Google:
- Rating actualizado
- Nuevas fotos
- Horarios cambiados
- Status (abierto/cerrado)

## Venue Verification

### Proceso de Verificación

Admin del grupo puede "verificar" un venue:

1. **Requisitos**:
   - Al menos 3 partidos jugados
   - Al menos 5 ratings
   - Rating promedio ≥ 3.5
   - Info completa (pricing, amenities, fotos)

2. **Badge "Verified"**:
   - Checkmark azul en venue card
   - Mayor confianza para nuevos miembros
   - Prioridad en sugerencias

### Reportar Problemas

Usuarios pueden reportar:
- Info incorrecta (dirección, teléfono, etc.)
- Venue cerrado permanentemente
- Problemas de seguridad
- Cambio de administración/ownership

Admin revisa y:
- Corrige info
- Marca como "hidden" si cerrado
- Elimina si ya no existe

## UI/UX Considerations

### Add Venue Flow

**Opción 1: Quick Add** (inline en match creation):
- Solo nombre, dirección, precio
- Guardado rápido
- Completar después (opcional)

**Opción 2: Full Add** (desde venue manager):
- Formulario completo
- Upload de fotos
- Todos los amenities
- Import desde Google Places

### Venue Card Design

**Mobile:**
- Card compacta
- Foto principal como header
- Info esencial visible
- Expandir para ver más

**Desktop:**
- Card más detallada
- Foto, mapa, amenities inline
- Hover para preview
- Click para full detail view

### Empty States

- **No venues en grupo**: CTA para agregar el primero
- **No results en búsqueda**: Sugerencia de modificar filtros
- **No favoritos**: Sugerencia de marcar venues frecuentes

## Responsive Design

### Mobile
- Lista vertical de cards
- FAB para "Agregar Venue"
- Bottom sheet para filtros
- Swipe entre venues en detalle

### Tablet
- Grid 2 columnas
- Sidebar con mapa
- Filtros permanentes

### Desktop
- Grid 3-4 columnas
- Mapa grande lateral
- Filtros expandidos
- Multi-select para comparar venues

## Optimizaciones

- **Cache de venues cercanos**: Basado en ubicación del usuario
- **Lazy load de fotos**: Solo cargar cuando visible
- **Prefetch de ratings**: Al hover sobre venue card
- **Compression de imágenes**: Al subir fotos
- **Geocoding cache**: Evitar llamadas repetidas a Google Maps API

## Integraciones

### Con Matches
- Selector de venue en AddMatchDialog
- Link desde match a venue detail
- Stats de "partidos jugados aquí"

### Con Google Maps
- Dirección autocomplete
- Visualización en mapa
- Cálculo de distancia
- Navigación (abrir Google Maps app)

### Con Payments
- Tracking de costos por venue
- Histórico de gastos en venue
- Promedio de costo por partido

### Con Notifications
- Notificar cambios en venue favorito
- Alertar si venue cerró
- Recordar rating después de partido

## Limitaciones Actuales

- Venues limitados a un grupo (no compartidos entre grupos)
- No sistema de reserva integrado
- Pricing manual (no API de venues)
- Fotos solo desde device (no scraped de Google)

## Próximas Mejoras

- [ ] Sistema de reserva integrado (API con complejos deportivos)
- [ ] Compartir venues entre grupos (directory global)
- [ ] Pricing dinámico por horario (peak hours)
- [ ] Calendario de disponibilidad real-time
- [ ] Reviews más detallados (con fotos)
- [ ] Comparación lado a lado de 2-3 venues
- [ ] Recomendaciones basadas en preferencias del grupo
- [ ] Descuentos/promociones de venues partner
- [ ] Check-in con código QR
- [ ] Historial de mantenimiento del venue

---

**Nota**: Un buen sistema de venues mejora significativamente la experiencia de organización de partidos, especialmente para grupos que rotan entre múltiples canchas. Facilita la toma de decisiones y mantiene un historial valioso de dónde juega el grupo.
