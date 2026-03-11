# Pateá ⚽

**Plataforma web de gestión de fútbol amateur con inteligencia artificial**

Pateá es una aplicación Next.js que permite a grupos de amigos organizar partidos, gestionar jugadores con sistema de atributos tipo FIFA, evaluar rendimientos, y utilizar inteligencia artificial para mejorar la experiencia deportiva.

## 🚀 Características Principales

- **Gestión de Jugadores**: Perfiles con atributos (PAC, SHO, PAS, DRI, DEF, PHY) y sistema de OVR dinámico
- **Organización de Partidos**: Partidos amistosos, ligas, copas y desafíos entre equipos
- **Equipos Balanceados con IA**: Generación automática de equipos equilibrados usando Gemini AI
- **Evaluación Post-Partido**: Sistema de evaluación con 150+ tags de rendimiento
- **Progresión de Jugadores**: Atributos que evolucionan basados en evaluaciones reales
- **13 Flujos de IA**: Asistente virtual, análisis de progresión, generación de imágenes, crónicas de partidos
- **Competiciones**: Sistema completo de ligas y copas con brackets
- **Google Fit Integration**: Tracking de actividad física vinculado a rendimiento
- **Rankings/Leaderboard**: Tablas de clasificación por OVR, goles, asistencias, partidos y rating
- **Red Social Deportiva**: Feed de actividades, seguimiento entre usuarios
- **PWA**: Instalable como app nativa con soporte offline

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Frontend**: React 18, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Firebase (Firestore, Auth, Storage, Cloud Functions)
- **AI**: Google Gemini 2.0 Flash (via Firebase Genkit)
- **Health**: Google Fit API
- **Maps**: Google Maps API
- **Payments**: MercadoPago
- **Notifications**: Firebase Cloud Messaging
- **Testing**: Playwright
- **Hosting**: Firebase App Hosting

## 📋 Prerequisites

- **Node.js**: >= 18.0.0
- **npm** o **yarn**
- **Firebase Project** configurado
- **Google Gemini API Key**
- **Google Maps API Key**
- **MercadoPago Account** (opcional, para monetización)

## ⚙️ Installation

1. **Clone el repositorio**

```bash
git clone https://github.com/your-org/patea.git
cd patea
```

2. **Instala las dependencias**

```bash
npm install
```

3. **Configura las variables de entorno**

```bash
cp .env.example .env.local
```

Edita `.env.local` y completa las siguientes variables:

```env
# Google Gemini AI
GOOGLE_GENAI_API_KEY=your_gemini_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here

# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id_here
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id_here
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
NEXT_PUBLIC_FIREBASE_VAPID_KEY=your_vapid_key_here

# Google Maps
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here

# MercadoPago (opcional)
MERCADOPAGO_ACCESS_TOKEN=APP_USR-your_access_token_here
MERCADOPAGO_PUBLIC_KEY=APP_USR-your_public_key_here
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=APP_USR-your_public_key_here
```

4. **Configura Firebase**

- Crea un proyecto en [Firebase Console](https://console.firebase.google.com/)
- Habilita Authentication (Google provider)
- Crea una base de datos Firestore
- Configura Storage rules
- Descarga las credenciales de servicio para Firebase Admin

## 🚀 Development

**Iniciar el servidor de desarrollo:**

```bash
npm run dev
```

La aplicación estará disponible en [http://localhost:3000](http://localhost:3000)

**Iniciar el servidor de AI flows (Genkit):**

```bash
# Modo desarrollo estándar
npm run genkit:dev

# Modo watch (auto-reload)
npm run genkit:watch
```

## 🏗️ Build & Deploy

**Build para producción:**

```bash
npm run build
```

**Verificar tipos TypeScript:**

```bash
npm run typecheck
```

**Linting:**

```bash
npm run lint
```

**Iniciar servidor de producción:**

```bash
npm run start
```

## 🧪 Testing

```bash
# Ejecutar todos los tests
npm test

# UI mode (interactivo)
npm run test:ui

# Modo headed (visible)
npm run test:headed

# Modo debug
npm run test:debug
```

## 📁 Estructura del Proyecto

```
patea/
├── src/
│   ├── app/                 # Next.js App Router (páginas y rutas)
│   │   ├── players/        # Gestión de jugadores
│   │   ├── matches/        # Organización de partidos
│   │   ├── competitions/   # Ligas y copas
│   │   ├── groups/         # Grupos y equipos
│   │   ├── social/         # Feed social
│   │   └── api/            # API routes (webhooks, callbacks)
│   ├── components/         # Componentes React
│   │   ├── ui/            # Componentes base (shadcn/ui)
│   │   ├── icons/         # Iconos personalizados
│   │   └── [feature]/     # Componentes por feature
│   ├── lib/               # Utilidades y lógica de negocio
│   │   ├── actions/       # Server Actions
│   │   ├── types.ts       # TypeScript types
│   │   └── utils/         # Utilidades helper
│   ├── ai/                # Integraciones IA (Genkit)
│   │   ├── flows/         # 13 flujos de IA
│   │   └── genkit.ts      # Configuración de Genkit
│   ├── firebase/          # Firebase SDK y configuración
│   │   ├── firestore/     # Hooks de Firestore
│   │   └── auth/          # Hooks de Auth
│   └── hooks/             # React Hooks personalizados
├── docs/                   # Documentación completa
│   ├── sections/          # 12 secciones funcionales
│   └── ai-flows/          # Documentación de flujos de IA
├── public/                # Assets estáticos
└── scripts/               # Scripts de utilidad
```

## 📖 Documentación

La documentación completa del proyecto se encuentra en la carpeta `/docs/`:

- **[docs/README.md](./docs/README.md)** - Índice maestro con overview completo
- **[docs/sections/](./docs/sections/)** - 12 secciones funcionales detalladas
- **[docs/ai-flows/](./docs/ai-flows/)** - Documentación de los 13 flujos de IA
- **[CLAUDE.md](./CLAUDE.md)** - Guía para Claude Code (desarrollo asistido por IA)

### Documentación por Sección:

1. [Dashboard](./docs/sections/01-dashboard.md) - Vista principal y resumen
2. [Jugadores](./docs/sections/02-players.md) - Sistema de gestión de jugadores
3. [Partidos](./docs/sections/03-matches.md) - Organización y gestión de partidos
4. [Competiciones](./docs/sections/04-competitions.md) - Ligas y copas
5. [Grupos/Equipos](./docs/sections/05-groups-teams.md) - Gestión de grupos
6. [Salud y Fitness](./docs/sections/06-health-fitness.md) - Integración con Google Fit
7. [Social](./docs/sections/07-social.md) - Feed y seguimientos
8. [Auth y Configuración](./docs/sections/08-auth-settings.md) - Autenticación y ajustes
9. [Team Challenges](./docs/sections/09-team-challenges.md) - Desafíos entre equipos
10. [Venues](./docs/sections/10-venues.md) - Sistema de lugares
11. [Payments/Credits](./docs/sections/11-payments-credits.md) - Pagos y créditos
12. [PWA](./docs/sections/12-pwa.md) - Progressive Web App features

## 🤖 AI Flows

Pateá integra 13 flujos de inteligencia artificial usando Google Gemini:

## Feature Operational Status

Estado operativo rápido (fuente de verdad técnica en [docs/technical/ESTADO_APP_2026-03-10.md](docs/technical/ESTADO_APP_2026-03-10.md)):

- `Payments (Mercado Pago)`: OFF
- `AI Image Generation`: OFF
- `Match Invitations Accept/Reject`: ON
- `Notifications mark-all-read`: ON
- `Evaluation Submissions`: ON
- `Competitions participation queries (>10 teams)`: ON (chunked)

**Gestión de Equipos:**
- `generate-balanced-teams` - Genera equipos equilibrados

**Análisis de Jugadores:**
- `suggest-player-improvements` - Sugerencias de mejora
- `analyze-player-progression` - Análisis de progresión
- `detect-player-patterns` - Detección de patrones
- `analyze-text-performance` - Análisis de texto libre para extraer cambios de atributos

**Búsqueda:**
- `find-best-fit-player` - Encuentra jugadores compatibles

**Asistencia:**
- `coach-conversation` - Chat con DT virtual
- `get-app-help` - Ayuda contextual

**Información de Partidos:**
- `get-match-day-forecast` - Pronóstico del clima
- `generate-match-chronicle` - Crónica del partido

**Generación Visual:**
- `generate-duo-image` - Imágenes de jugadores
- `generate-player-card-image` - Tarjetas de jugador
- `generate-group-summary` - Resumen de grupo

Ver [documentación de AI flows](./docs/ai-flows/README.md) para más detalles.

## 🗄️ Firebase Setup

### Firestore Collections

```
users/               # Usuarios
players/             # Jugadores
matches/             # Partidos
groups/              # Grupos
leagues/             # Ligas
cups/                # Copas
socialActivities/    # Feed social
follows/             # Seguimientos
notifications/       # Notificaciones
venues/              # Lugares
```

### Índices Requeridos

Crea los siguientes índices compuestos en Firestore:

1. **socialActivities**: `userId` (ASC) + `timestamp` (DESC)
2. **follows**: `followerId` (ASC) + `createdAt` (DESC)
3. **matches**: `groupId` (ASC) + `date` (DESC)
4. **players**: `groupId` (ASC) + `ovr` (DESC)

Ver [docs/FIRESTORE_INDEXES_DEPLOYMENT.md](./docs/FIRESTORE_INDEXES_DEPLOYMENT.md) para instrucciones detalladas.

## 🔐 Security

- Las reglas de Firestore están en `firestore.rules`
- Las reglas de Storage están en `storage.rules`
- Nunca commitees archivos `.env.local` o credenciales
- Las API keys de Firebase son públicas pero protegidas por reglas

## 🚢 Deployment

El proyecto está configurado para Firebase App Hosting:

```bash
# Deploy a Firebase
npm run build
firebase deploy
```

Ver `firebase.json` para configuración de deployment.

## 🤝 Contributing

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📝 Scripts Adicionales

```bash
# Migrar estructura de copas
npm run migrate:cups

# Inicializar paquetes de créditos
npm run init:packages
```

## 📄 License

Este proyecto es privado. Todos los derechos reservados.

## 👥 Team

Desarrollado por el equipo de Pateá.

## 📞 Support

Para soporte y preguntas:
- Email: support@patea.app
- Documentación: [/docs/README.md](./docs/README.md)
- Issues: GitHub Issues

---

**Hecho con ⚽ y ☕ por el equipo de Pateá**
