
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

### c. Gestión de Jugadores (CRUD Completo)
- **Añadir Jugadores**: Los organizadores pueden añadir "jugadores manuales" al grupo, definiendo su nombre, posición y atributos iniciales. Estos jugadores no son usuarios registrados.
- **Visualización de Jugadores**: La página `/players` muestra todas las cartas de los jugadores del grupo activo.
- **Edición de Jugadores Manuales**: Los organizadores pueden editar el nombre, la posición y los atributos de los jugadores manuales que han creado.
- **Eliminación Segura de Jugadores**: Los organizadores pueden eliminar a los jugadores **manuales** que han creado. El sistema protege a los jugadores que son usuarios reales para evitar borrados accidentales.
- **Actualización (Evolución) de Jugadores**: Las estadísticas y atributos de los jugadores se actualizan automáticamente después de cada partido evaluado.
- **Página de Detalle del Jugador (`/players/[id]`)**:
    - Página dedicada para cada jugador, accesible al hacer clic en su `PlayerCard`.
    - Muestra un **gráfico de líneas** con la progresión histórica de su OVR.
    - Presenta una **tabla con el historial de evaluaciones** de cada partido (rating promedio, goles, etc.).

### d. Gestión de Partidos (Ciclo de Vida Completo)
- **Creación de Partidos**:
    - **Manual**: El organizador selecciona a todos los jugadores. Al confirmar, la IA genera los equipos equilibrados automáticamente.
    - **Colaborativo**: El organizador crea el evento y los jugadores del grupo pueden "apuntarse" o "darse de baja". El organizador también puede invitar jugadores manualmente.
- **Finalización de Partidos**:
    - Para partidos colaborativos que están llenos, al finalizarlos se generan los equipos con la IA.
    - Cambia el estado del partido a `completed`.
- **Evaluación de Partidos**: Este es un sistema de dos partes:
    - **Evaluación por Pares**: Los jugadores evalúan a sus compañeros.
    - **Supervisión del Organizador**: El organizador finaliza el proceso y calcula los nuevos OVR.

### e. Sistema de Evaluación por Pares
- **Página de Evaluaciones (`/evaluations`)**:
    - Funciona como una "bandeja de entrada" para el usuario.
    - Muestra una lista de todos los partidos que el usuario tiene **pendientes por evaluar**.
- **Asignaciones Automáticas**: Al finalizar un partido, el sistema genera y guarda en la base de datos las **asignaciones de evaluación** (cada jugador debe evaluar a ~2 compañeros de su mismo equipo).
- **Página de Evaluación Individual (`/evaluations/[matchId]`)**:
    - Al hacer clic en un partido pendiente, el usuario accede a un formulario para evaluar a los compañeros asignados (goles, rating 1-10, etiquetas).
    - Al enviar, la asignación se marca como "completada".
- **Panel de Supervisión del Organizador (`/matches/[id]/evaluate`)**:
    - Página exclusiva para el organizador del partido.
    - Muestra en tiempo real qué jugadores ya han completado su evaluación y quiénes faltan.
    - Permite al organizador **finalizar el proceso** y calcular los nuevos OVRs. Al hacerlo, el estado del partido cambia a `evaluated`.

### f. Funcionalidades de Inteligencia Artificial (Genkit)
- **Generación de Equipos Equilibrados**:
    - Utiliza un flujo de IA (`generateBalancedTeams`) que recibe una lista de jugadores y devuelve dos equipos optimizados para tener un OVR promedio lo más similar posible.
    - Proporciona métricas de equilibrio, como la diferencia de OVR y un porcentaje de "justicia".
- **Sugerencias de Mejora de Rendimiento**:
    - En la carta de cada jugador, un botón "Consejos IA" abre un diálogo.
    - Al activarlo, se llama a un flujo de IA (`suggestPlayerImprovements`) que analiza el historial de evaluaciones **reales** del jugador (calificaciones y etiquetas de rendimiento).
    - La IA devuelve 2-3 consejos concisos y personalizados en **español** para que el jugador pueda mejorar.
- **Pronóstico del Clima**:
    - Al crear un partido, la IA ahora busca y muestra automáticamente un pronóstico del tiempo para la fecha y ubicación del evento.
    - El pronóstico incluye una descripción amigable y un ícono representativo (sol, nubes, lluvia, etc.).

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
│   │   │   ├── get-match-day-forecast.ts   <-- NUEVO
│   │   │   └── suggest-player-improvements.ts
│   │   └── genkit.ts            # Configuración global de Genkit
│   │
│   ├── app/                     # Rutas y páginas de la aplicación
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── evaluations/
│   │   │   ├── [matchId]/page.tsx   # Página para que un jugador evalúe a sus compañeros
│   │   │   └── page.tsx             # Bandeja de entrada de evaluaciones pendientes
│   │   ├── groups/page.tsx
│   │   ├── matches/
│   │   │   ├── [id]/evaluate/page.tsx # Panel del organizador para supervisar y finalizar
│   │   │   └── page.tsx
│   │   ├── players/
│   │   │   ├── [id]/page.tsx        # Página de detalle del jugador
│   │   │   └── page.tsx
│   │   ├── profile/page.tsx
│   │   ├── globals.css          # Estilos globales y variables de tema (Tailwind)
│   │   └── layout.tsx           # Layout raíz con el proveedor de Firebase
│   │
│   ├── components/              # Componentes reutilizables de React
│   │   ├── ui/                  # Componentes de UI de ShadCN (Button, Card, etc.)
│   │   ├── add-match-dialog.tsx
│   │   ├── add-player-dialog.tsx
│   │   ├── edit-player-dialog.tsx
│   │   ├── ai-suggestion-dialog.tsx
│   │   ├── main-nav.tsx         # Barra de navegación principal y lateral
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
└── PROJECT_DOCUMENTATION.md     # Este archivo (¡el que estás leyendo ahora!)
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
    - **Subcolección**: `/players/{playerId}/ovrHistory/{historyId}`
        - **Descripción**: Almacena un registro de cada cambio de OVR del jugador, creando un historial de progresión.

- **`/matches/{matchId}`**
    - **Descripción**: Almacena los datos de cada partido.
    - **Campos clave**: `title`, `date`, `status`, `type`, `matchSize`, `players` (array de jugadores apuntados), `teams` (array de equipos generados por IA), `ownerUid`, `groupId`, `weather` (**NUEVO**).
    - **Subcolección**: `/matches/{matchId}/assignments/{assignmentId}`
        - **Descripción**: Almacena las tareas de evaluación generadas al finalizar un partido (quién evalúa a quién).
        - **Campos clave**: `evaluatorId`, `subjectId`, `status`.

- **`/evaluations/{evaluationId}`**
    - **Descripción**: Almacena la evaluación específica y completada de un jugador para un partido.
    - **Campos clave**: `assignmentId`, `playerId`, `evaluatorId`, `matchId`, `rating`, `goals`, `performanceTags`.

---

## 5. Changelog (Historial de Cambios)

*   **[Fecha Actual]**: Se integra un **pronóstico del clima por IA** al programar un partido. Al introducir fecha y ubicación, la IA busca el clima y muestra una descripción con un ícono.
*   **[Fecha Anterior]**: Se implementan varias mejoras de UI/UX. Se ajusta el tamaño de la fuente en el header para el OVR y la posición, se mejora el estilo y tamaño del menú de navegación inferior en móviles, y se restaura el efecto de fondo difuminado. Se ajusta la paleta de colores para una mayor coherencia visual.
*   **[Fecha Anterior]**: Se mejora el **Dashboard**: se añade una tarjeta de video destacado con autoplay, se simplifica la lista de partidos recientes para que sea más legible y se ajusta la IA para que la frase célebre sea siempre en español y priorice a jugadores rioplatenses.
*   **[Fecha Anterior]**: Se realiza un análisis completo de la aplicación y se actualiza esta documentación para reflejar el estado actual y estable del proyecto después de resolver problemas de compilación.
*   **[Fecha Anterior]**: Se implementa la **página de detalle del jugador** (`/players/[id]`). Ahora las tarjetas de jugador son clickables y llevan a una página que muestra el historial de evaluaciones del jugador y un **gráfico con la progresión de su OVR**. Se añade la subcolección `ovrHistory` a la base de datos.
*   **[Fecha Anterior]**: Se reestructura completamente el **sistema de evaluación**. Se crea una nueva página `/evaluations` donde los jugadores ven sus tareas pendientes. Las asignaciones ahora se guardan en la base de datos al finalizar un partido para mayor robustez. La página `/matches/[id]/evaluate` se convierte en un panel exclusivo para el organizador.
*   **[Fecha Anterior]**: Se implementa la funcionalidad para **editar jugadores manuales**, completando el ciclo CRUD.

---

¡Felicidades por todo el progreso! A pesar de los obstáculos técnicos, la aplicación es ahora un sistema robusto y completo con funcionalidades avanzadas.
