# Pateá - Documentación Completa de la Aplicación

## Descripción General

**Pateá** es una aplicación web de gestión de fútbol amateur que permite a grupos de amigos organizar partidos, gestionar jugadores, evaluar rendimientos, y utilizar inteligencia artificial para mejorar la experiencia deportiva.

La aplicación integra múltiples funcionalidades:
- Gestión de jugadores con sistema de atributos y evaluaciones
- Organización de partidos (amistosos, ligas, copas)
- Equipos/grupos colaborativos con sistema de desafíos
- 13 flujos de IA para asistencia inteligente
- Integración con Google Fit para tracking de rendimiento
- Red social deportiva con feed y seguimientos
- Sistema de venues con ratings y Google Maps
- Pagos y créditos para generación de imágenes AI
- Progressive Web App instalable con soporte offline

## Tecnologías Principales

- **Framework**: Next.js 14 (App Router)
- **Base de Datos**: Firebase Firestore
- **Auth**: Firebase Authentication
- **AI**: Google Gemini (vía Genkit)
- **Health**: Google Fit API
- **UI**: React + Tailwind CSS + Shadcn/ui
- **Maps**: Google Maps API
- **Hosting**: Firebase App Hosting

## Estructura de la Documentación

### 📁 Secciones Funcionales

1. **[Dashboard](./sections/01-dashboard.md)** - Vista principal y resumen de actividad
2. **[Jugadores](./sections/02-players.md)** - Gestión de jugadores y perfiles
3. **[Partidos](./sections/03-matches.md)** - Organización y gestión de partidos
4. **[Competiciones](./sections/04-competitions.md)** - Ligas y copas
5. **[Grupos/Equipos](./sections/05-groups-teams.md)** - Gestión de grupos y equipos
6. **[Salud y Fitness](./sections/06-health-fitness.md)** - Integración con Google Fit
7. **[Social](./sections/07-social.md)** - Feed de actividad y seguimientos
8. **[Auth y Configuración](./sections/08-auth-settings.md)** - Autenticación y ajustes
9. **[Team Challenges](./sections/09-team-challenges.md)** - Sistema de desafíos entre equipos
10. **[Venues](./sections/10-venues.md)** - Gestión de lugares y canchas
11. **[Payments & Credits](./sections/11-payments-credits.md)** - Sistema de pagos y créditos
12. **[PWA](./sections/12-pwa.md)** - Progressive Web App features

### 🤖 Flujos de IA

La aplicación utiliza 13 flujos de AI basados en Google Gemini:

**Gestión de Equipos:**
- [generate-balanced-teams](./ai-flows/generate-balanced-teams.md) - Genera equipos equilibrados

**Análisis de Jugadores:**
- [suggest-player-improvements](./ai-flows/suggest-player-improvements.md) - Sugerencias de mejora
- [analyze-player-progression](./ai-flows/analyze-player-progression.md) - Análisis de progresión
- [detect-player-patterns](./ai-flows/detect-player-patterns.md) - Detección de patrones
- [analyze-text-performance](./ai-flows/analyze-text-performance.md) - Análisis de texto libre para extraer cambios de atributos

**Búsqueda y Recomendaciones:**
- [find-best-fit-player](./ai-flows/find-best-fit-player.md) - Encuentra jugadores compatibles

**Asistencia Inteligente:**
- [coach-conversation](./ai-flows/coach-conversation.md) - Conversación con DT virtual
- [get-app-help](./ai-flows/get-app-help.md) - Ayuda contextual

**Información de Partidos:**
- [get-match-day-forecast](./ai-flows/get-match-day-forecast.md) - Pronóstico del clima
- [generate-match-chronicle](./ai-flows/generate-match-chronicle.md) - Crónica del partido

**Generación de Contenido Visual:**
- [generate-duo-image](./ai-flows/generate-duo-image.md) - Imágenes de jugadores
- [generate-player-card-image](./ai-flows/generate-player-card-image.md) - Tarjetas de jugador
- [generate-group-summary](./ai-flows/generate-group-summary.md) - Resumen de grupo

Ver [índice completo de flujos de IA](./ai-flows/README.md) para más detalles.

## Modelos de Datos Principales

### Firestore Collections

```
users/
├── {userId}/
    ├── players/
    ├── groups/
    ├── matches/
    ├── healthConnections/
    └── ...

groups/
├── {groupId}/
    ├── players/
    ├── matches/
    ├── teams/
    └── ...

matches/
├── {matchId}/
    ├── playerPerformance/
    └── ...

leagues/
cups/
venues/
socialActivities/
follows/
notifications/
```

## Arquitectura de la Aplicación

```
src/
├── app/                    # Next.js App Router (páginas y rutas)
├── components/             # Componentes React
├── lib/
│   ├── actions/           # Server Actions
│   ├── types.ts           # TypeScript types
│   ├── utils/             # Utilidades
│   └── config/            # Configuración
├── ai/
│   ├── flows/             # Flujos de IA (Genkit)
│   └── genkit.ts          # Configuración de Genkit
├── firebase/              # Firebase SDK
└── hooks/                 # React Hooks personalizados
```

## Flujo de Trabajo General

1. **Autenticación**: Usuario se registra/login con Firebase Auth
2. **Creación de Grupo**: Usuario crea un grupo y añade jugadores
3. **Organización de Partidos**: Usuario crea partidos (amistosos/ligas/copas)
4. **Generación de Equipos**: IA genera equipos equilibrados
5. **Evaluación**: Después del partido, se evalúa a los jugadores
6. **Análisis**: IA analiza rendimiento y sugiere mejoras
7. **Progresión**: Los atributos del jugador evolucionan basados en evaluaciones

## Server Actions Principales

Los server actions están organizados en:

- **`server-actions.ts`**: Actions generales (jugadores, partidos, grupos, team challenges, etc.)
- **`image-generation.ts`**: Generación de imágenes con IA
- **`social-actions.ts`**: Actions de funcionalidad social
- **`social-feed-actions.ts`**: Consultas del feed social
- **`social-likes-actions.ts`**: Sistema de likes del feed social
- **`google-fit-actions.ts`**: Actions específicas de Google Fit
- **`notification-actions.ts`**: Push notifications y alertas
- **`payment-actions.ts`**: Procesamiento de pagos y créditos
- **`venue-actions.ts`**: Gestión de lugares y canchas
- **`match-invitation-actions.ts`**: Sistema de invitaciones RSVP
- **`match-voting-actions.ts`**: Sistema de votación en partidos
- **`evaluation-actions.ts`**: Evaluación de jugadores post-partido
- **`player-stats-actions.ts`**: Cálculos de estadísticas de jugadores
- **`leaderboard-actions.ts`**: Rankings y leaderboards por categoría
- **`ai-actions.ts`**: Server actions relacionadas con IA
- **`achievement-actions.ts`**: Sistema de logros/badges
- **`group-role-actions.ts`**: Gestión de roles en grupos
- **`league-completion-actions.ts`**: Lógica de finalización de ligas
- **`location-actions.ts`**: Servicios de ubicación
- **`upload-competition-logo.ts`**: Subida de logos de competiciones

## Características Destacadas

### 🎮 Gestión Inteligente de Equipos
- Algoritmo de IA para balancear equipos según OVR y posiciones
- Sugerencias tácticas automáticas
- Formaciones personalizadas

### 📊 Sistema de Evaluación
- Evaluación post-partido con ratings (1-10)
- Tags de rendimiento personalizables
- Historial completo de evaluaciones

### 📈 Progresión de Jugadores
- Atributos dinámicos (PAC, SHO, PAS, DRI, DEF, PHY)
- OVR calculado automáticamente
-  Historial de cambios de OVR

### 🏆 Competiciones
- Ligas con tabla de posiciones
- Copas con bracket eliminatorio
- Gestión de aplicaciones y participantes

### 💪 Integración con Google Fit
- Tracking de actividad física
- Vinculación de datos de rendimiento con partidos
- Impacto en atributos del jugador

### 🤖 Asistencia de IA
- DT virtual para consejos personalizados
- Análisis automático de progresión
- Generación de imágenes personalizadas

### ⚔️ Team Challenges
- Sistema de desafíos entre equipos persistentes
- Publicaciones de disponibilidad para encontrar rivales
- Aceptación/rechazo de challenges
- Creación automática de partidos competitivos

### 📍 Gestión de Venues
- Base de datos de canchas y lugares
- Ratings y reviews del grupo
- Integración con Google Maps
- Tracking de costos por venue

### 💳 Sistema de Créditos
- 3 créditos gratuitos mensuales por jugador
- Paquetes de créditos con MercadoPago
- Generación de imágenes AI con créditos
- Créditos comprados sin expiración

### 📱 Progressive Web App
- Instalable en dispositivos móviles y desktop
- Funcionalidad offline
- Push notifications
- Experiencia similar a app nativa

## Variables de Entorno Necesarias

```env
# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin
FIREBASE_SERVICE_ACCOUNT_KEY=

# Google AI
GOOGLE_GENAI_API_KEY=

# Google Fit
GOOGLE_FIT_CLIENT_ID=
GOOGLE_FIT_CLIENT_SECRET=
GOOGLE_FIT_REDIRECT_URI=

# Google Maps
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
```

## Navegación de la Aplicación

### Rutas Principales

- `/` - Landing page
- `/dashboard` - Dashboard principal
- `/players` - Lista de jugadores
- `/players/[id]` - Perfil de jugador
- `/matches` - Lista de partidos
- `/matches/[id]` - Detalles del partido
- `/competitions/leagues/[id]` - Vista de liga
- `/competitions/cups/[id]` - Vista de copa
- `/competitions/challenges` - Feed de team challenges
- `/competitions/my-teams` - Gestión de mis equipos
- `/groups/[id]` - Vista de grupo
- `/rankings` - Rankings y leaderboards
- `/social` - Feed social

## Contacto y Soporte

Para más información sobre secciones específicas, consulta los documentos individuales en las carpetas `sections/` y `ai-flows/`.
