# Estructura del Proyecto - Pateá

## 📁 Estructura General

```
src/
├── app/                    # Next.js App Router
│   ├── players/[id]/      # Perfil de jugadores
│   ├── matches/           # Partidos
│   └── groups/            # Grupos
├── components/            # Componentes React
├── lib/                   # Utilidades y acciones
│   ├── actions/          # Server Actions
│   └── types.ts          # Tipos TypeScript
├── ai/                    # Integraciones IA (Genkit)
│   └── flows/            # Flujos de IA
├── firebase/              # Configuración Firebase
└── hooks/                 # React Hooks personalizados
```

## 🔧 Funciones Principales

### Autenticación (`lib/auth-actions.ts`, `lib/auth-helpers.ts`)
- Login/registro con Google
- Actualización de perfiles
- Gestión de sesiones

### Server Actions (`lib/actions/`)
- **`image-generation.ts`**: Generación de imágenes con IA
  - `generatePlayerCardImageAction()`: Genera foto profesional del jugador

### Datos (`lib/data.ts`)
- Templates de camisetas
- Configuración de posiciones
- Etiquetas de rendimiento

## 🤖 Funciones IA (Genkit)

### Configuración (`ai/genkit.ts`)
- Firebase Genkit con Gemini
- Plugins: Google AI, Cloud Storage, Vertex AI

### Flujos IA (`ai/flows/`)

**Jugadores:**
- `generate-player-card-image.ts`: Foto profesional con IA
- `suggest-player-improvements.ts`: Sugerencias de mejora
- `analyze-player-progression.ts`: Análisis de progresión
- `find-best-fit-player.ts`: Encuentra jugador ideal para equipo

**Partidos:**
- `generate-balanced-teams.ts`: Crea equipos balanceados
- `get-match-day-forecast.ts`: Pronóstico del partido
- `generate-match-chronicle.ts`: Crónica post-partido

**Grupos:**
- `generate-group-summary.ts`: Resumen del grupo
- `detect-player-patterns.ts`: Detecta patrones de jugadores

**Otros:**
- `coach-conversation.ts`: Chat con entrenador virtual
- `get-app-help.ts`: Asistencia en la app
- `generate-duo-image.ts`: Imagen de dupla de jugadores

## 🎨 Componentes UI

### Jugadores
- **`player-detail-card.tsx`**: Tarjeta detallada del perfil
  - Botón "Generar Foto IA" (usa créditos)
  - Botón "Cambiar Foto" (crop)
  - Muestra OVR, posición, atributos
- **`player-card.tsx`**: Tarjeta compacta
- **`player-profile-view.tsx`**: Vista completa del perfil
- **`player-styles.tsx`**: Componentes reutilizables
  - `PlayerPhoto`: Imagen circular con crop
  - `PlayerOvr`: Badge de overall
  - `AttributesGrid`: Grid de atributos

### Imagen
- **`image-cropper-dialog.tsx`**: Dialog para recortar fotos
  - Usa `react-image-crop`
  - Guarda en Firebase Storage
  - Actualiza Firestore con `cropPosition` y `cropZoom`

## 🔄 Flujos de Datos Importantes

### Actualización de Foto del Jugador

**Con IA:**
1. Usuario → Click "Generar Foto IA"
2. `generatePlayerCardImageAction()` (server)
3. Descarga foto actual → IA genera nueva → Sube a Storage
4. Actualiza Firestore: `photoUrl`, `cropPosition`, `cropZoom`
5. `useDoc` detecta cambio → Actualiza UI automáticamente

**Con Crop Manual:**
1. Usuario → Click "Cambiar Foto" → Selecciona/recorta
2. `ImageCropperDialog` → Recorta imagen → Sube a Storage
3. Actualiza Firestore: `photoUrl`, `cropPosition`, `cropZoom`
4. `useDoc` detecta cambio → Actualiza UI

### Sistema de Sincronización Tiempo Real

- **Hook:** `firebase/firestore/use-doc.tsx`
- Usa `onSnapshot` de Firestore
- Actualiza automáticamente cuando cambia el documento
- Usado en perfiles de jugadores, partidos, grupos

## 🗄️ Estructura Firestore

```
users/
  {uid}/
    - photoURL
    - displayName
    - email

players/
  {playerId}/
    - name, position, ovr
    - photoUrl
    - cropPosition: { x, y }
    - cropZoom
    - cardGenerationCredits
    - attributes: { pace, shooting, ... }

availablePlayers/
  {playerId}/
    - photoUrl (sincronizado con players)

matches/
  {matchId}/
    - date, location, teams

groups/
  {groupId}/
    - name, members, stats
```

## 🎯 Puntos Clave

1. **Imágenes sincronizadas**: `users.photoURL` = `players.photoUrl` = `availablePlayers.photoUrl`
2. **Crop automático**: Después de generar con IA, se resetea a `{ x: 50, y: 50 }` y `zoom: 1`
3. **Real-time**: Usar `useDoc` para sincronización automática (no actualizar estado manualmente)
4. **Créditos**: Generación IA consume `cardGenerationCredits`
