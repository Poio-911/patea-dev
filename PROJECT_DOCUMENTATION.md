
# Documentación del Proyecto: Amateur Football Manager (AFM)

## 1. Resumen del Proyecto

**Amateur Football Manager (AFM)** es una aplicación web completa diseñada para ayudar a los organizadores y jugadores de fútbol amateur a gestionar sus equipos, partidos y rendimiento. La aplicación utiliza una moderna pila de tecnologías, incluyendo **Next.js**, **Firebase** y **Google AI (Genkit)**, para ofrecer una experiencia fluida, inteligente y en tiempo real.

El objetivo principal es simplificar la organización de partidos, permitir la creación de equipos equilibrados mediante IA, y proporcionar a los jugadores un sistema de progresión y retroalimentación basado en su rendimiento real.

---

## 2. Características Principales Implementadas

A continuación se detallan las funcionalidades clave que hemos construido:

### a. Autenticación y Perfil de Usuario
- **Registro y Login**: Los usuarios pueden crear una cuenta usando email/contraseña o iniciar sesión con Google.
- **Creación Automática de Perfil**: Al registrarse, se crea automáticamente un perfil de usuario y un perfil de jugador asociado, con estadísticas iniciales.
- **Página de Perfil Personal (`/profile`)**:
    - Muestra la información de la cuenta del usuario (nombre, email).
    - Permite la **subida y actualización de la foto de perfil**, que se almacena en Firebase Storage.
    - Muestra la **carta de jugador** personal con sus atributos (OVR, PAC, SHO, etc.).
    - Presenta estadísticas de rendimiento agregadas (partidos jugados, goles, rating promedio).

### b. Gestión de Grupos
- **Creación y Unión a Grupos**: Los usuarios pueden crear sus propios grupos de jugadores o unirse a grupos existentes mediante un código de invitación único.
- **Grupo Activo**: Los usuarios pueden pertenecer a múltiples grupos y seleccionar cuál es su "grupo activo". Toda la información (jugadores, partidos) se muestra en el contexto del grupo activo.
- **Panel de Control (`/dashboard`)**: Ofrece una vista rápida de las estadísticas del grupo activo, como el número de jugadores, próximos partidos, y el top de jugadores.

### c. Gestión de Jugadores (CRUD)
- **Añadir Jugadores**: Los organizadores pueden añadir "jugadores manuales" al grupo, definiendo su nombre, posición y atributos iniciales. Estos jugadores no son usuarios registrados.
- **Visualización de Jugadores**: La página `/players` muestra todas las cartas de los jugadores del grupo activo.
- **Eliminación Segura de Jugadores**: Los organizadores pueden eliminar a los jugadores **manuales** que han creado. El sistema protege a los jugadores que son usuarios reales para evitar borrados accidentales.
- **Actualización (Evolución) de Jugadores**: Las estadísticas y atributos de los jugadores se actualizan automáticamente después de cada partido evaluado.

### d. Gestión de Partidos (Ciclo de Vida Completo)
- **Creación de Partidos**:
    - **Manual**: El organizador selecciona a todos los jugadores. Al confirmar, la IA genera los equipos equilibrados automáticamente.
    - **Colaborativo**: El organizador crea el evento y los jugadores del grupo pueden "apuntarse" o "darse de baja". El organizador también puede invitar jugadores manualmente.
- **Finalización de Partidos**:
    - Para partidos colaborativos que están llenos, al finalizarlos se generan los equipos con la IA.
    - Cambia el estado del partido a `completed`.
- **Evaluación de Partidos**:
    - Tras finalizar un partido, el organizador puede evaluarlo.
    - En la página de evaluación, se registran los goles y se asigna una calificación de rendimiento (1-10) a cada jugador.
    - Al guardar la evaluación, un sistema de progresión calcula y actualiza el OVR y los atributos específicos de cada jugador, y el estado del partido cambia a `evaluated`.

### e. Funcionalidades de Inteligencia Artificial (Genkit)
- **Generación de Equipos Equilibrados**:
    - Utiliza un flujo de IA (`generateBalancedTeams`) que recibe una lista de jugadores y devuelve dos equipos optimizados para tener un OVR promedio lo más similar posible.
    - Proporciona métricas de equilibrio, como la diferencia de OVR y un porcentaje de "justicia".
- **Sugerencias de Mejora de Rendimiento**:
    - En la carta de cada jugador, un botón "Consejos IA" abre un diálogo.
    - Al activarlo, se llama a un flujo de IA (`suggestPlayerImprovements`) que analiza el historial de evaluaciones **reales** del jugador (calificaciones y etiquetas de rendimiento).
    - La IA devuelve 2-3 consejos concisos y personalizados en **español** para que el jugador pueda mejorar.

---

## 3. Arquitectura y Estructura de Archivos

La aplicación sigue una estructura moderna de Next.js con el App Router.

```
/
├── public/
├── src/
│   ├── ai/                      # Lógica de Inteligencia Artificial con Genkit
│   │   ├── flows/
│   │   │   ├── generate-balanced-teams.ts
│   │   │   └── suggest-player-improvements.ts
│   │   └── genkit.ts            # Configuración global de Genkit
│   │
│   ├── app/                     # Rutas y páginas de la aplicación
│   │   ├── (auth)/              # Rutas de autenticación
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── (main)/              # Rutas principales de la app
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── groups/page.tsx
│   │   │   ├── matches/
│   │   │   │   ├── [id]/evaluate/page.tsx
│   │   │   │   └── page.tsx
│   │   │   ├── players/page.tsx
│   │   │   ├── profile/page.tsx
│   │   │   └── layout.tsx       # Layout principal con la barra lateral
│   │   ├── globals.css          # Estilos globales y variables de tema (Tailwind)
│   │   └── layout.tsx           # Layout raíz de la aplicación
│   │
│   ├── components/              # Componentes reutilizables de React
│   │   ├── ui/                  # Componentes de UI de ShadCN (Button, Card, etc.)
│   │   ├── add-match-dialog.tsx
│   │   ├── add-player-dialog.tsx
│   │   ├── ai-suggestion-dialog.tsx
│   │   ├── main-nav.tsx         # Barra de navegación y lateral
│   │   ├── match-card.tsx
│   │   ├── player-card.tsx
│   │   └── ...
│   │
│   ├── firebase/                # Configuración y hooks de Firebase
│   │   ├── auth/use-user.tsx    # Hook para gestionar el estado del usuario
│   │   ├── firestore/           # Hooks para interactuar con Firestore
│   │   │   ├── use-collection.tsx
│   │   │   └── use-doc.tsx
│   │   ├── client-provider.tsx  # Proveedor de contexto para el cliente
│   │   ├── config.ts            # Configuración del proyecto Firebase
│   │   ├── index.ts             # Punto de entrada para exportar todo lo de Firebase
│   │   └── provider.tsx         # Proveedor principal de contexto de Firebase
│   │
│   └── lib/                     # Utilidades, tipos y lógica de negocio
│       ├── actions.ts           # Acciones de servidor (Server Actions) para llamar a la IA
│       ├── data.ts              # Datos estáticos (ej. etiquetas de rendimiento)
│       ├── types.ts             # Definiciones de tipos de TypeScript (Player, Match, etc.)
│       └── utils.ts             # Funciones de utilidad (ej. `cn` para clases)
│
├── docs/
│   └── backend.json             # "Blueprint" de la estructura de datos
│
├── next.config.ts               # Configuración de Next.js
├── tailwind.config.ts           # Configuración de Tailwind CSS
├── package.json
└── PROJECT_DOCUMENTATION.md     # Este archivo
```

---

## 4. Estructura de la Base de Datos (Firestore)

La base de datos NoSQL en Firestore está estructurada en colecciones de alto nivel. Usamos el archivo `docs/backend.json` como una plantilla para definir nuestras entidades.

- **`/users/{userId}`**
    - **Descripción**: Almacena el perfil público de cada usuario registrado.
    - **Campos clave**: `uid`, `email`, `displayName`, `photoURL`, `activeGroupId`.

- **`/groups/{groupId}`**
    - **Descripción**: Almacena la información de cada grupo de usuarios.
    - **Campos clave**: `name`, `ownerUid`, `inviteCode`, `members` (array de UIDs).

- **`/players/{playerId}`**
    - **Descripción**: Almacena la carta y estadísticas de cada jugador. Para usuarios registrados, `{playerId}` es igual a su `userId`. Para jugadores manuales, es un ID único generado.
    - **Campos clave**: `name`, `position`, `ovr`, `pac`, `sho`, `pas`, `dri`, `def`, `phy`, `photoUrl`, `stats`, `ownerUid`, `groupId`.

- **`/matches/{matchId}`**
    - **Descripción**: Almacena los datos de cada partido.
    - **Campos clave**: `title`, `date`, `status`, `type`, `matchSize`, `players` (array de jugadores apuntados), `teams` (array de equipos generados por IA), `ownerUid`, `groupId`.
    - **Subcolección**: `/matches/{matchId}/evaluations/{playerId}`
        - **Descripción**: Almacena la evaluación específica de un jugador para un partido concreto.
        - **Campos clave**: `rating`, `goals`, `performanceTags`.

---

¡Felicidades por todo el progreso! Esta aplicación es ahora un sistema robusto y completo con funcionalidades avanzadas de IA.
