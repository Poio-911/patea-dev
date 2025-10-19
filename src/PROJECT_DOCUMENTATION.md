
# Documentación del Proyecto: Amateur Football Manager (AFM)

## 1. Resumen del Proyecto

**Amateur Football Manager (AFM)** es una aplicación web completa diseñada para ayudar a los organizadores y jugadores de fútbol amateur a gestionar sus equipos, partidos y rendimiento. La aplicación utiliza una moderna pila de tecnologías, incluyendo **Next.js**, **Firebase** y **Google AI (Genkit)**, para ofrecer una experiencia fluida, inteligente y en tiempo real.

El objetivo principal es simplificar la organización de partidos, permitir la creación de equipos equilibrados mediante IA, y proporcionar a los jugadores un sistema de progresión y retroalimentación basado en su rendimiento real.

---

## 2. Características Principales Implementadas

A continuación se detallan las funcionalidades clave que hemos construido:

### a. Autenticación y Perfil de Usuario
- **Registro y Login**: Los usuarios pueden crear una cuenta usando email/contraseña o iniciar sesión con Google.
- **Creación Automática de Perfil y Grupo**: Al registrarse, se crea automáticamente un perfil de usuario, un perfil de jugador asociado y un **primer grupo** para el usuario.
- **Página de Perfil Personal (`/profile`)**:
    - Muestra la información de la cuenta y la carta de jugador personal.
    - Permite la **subida y actualización de la foto de perfil**.
    - Incluye pestañas para ver los partidos y jugadores manuales creados por el usuario.

### b. Gestión de Grupos
- **CRUD Completo de Grupos**: Los usuarios pueden crear, editar el nombre y eliminar sus propios grupos. La eliminación de un grupo también elimina todos los jugadores y partidos asociados.
- **Unión a Grupos**: Posibilidad de unirse a grupos existentes mediante un código de invitación único.
- **Grupo Activo**: Los usuarios pueden pertenecer a múltiples grupos y seleccionar cuál es su "grupo activo" desde un menú desplegable.

### c. Gestión de Jugadores (CRUD Completo)
- **Añadir Jugadores**: Los organizadores pueden añadir "jugadores manuales" al grupo.
- **Visualización de Jugadores**: La página `/players` muestra todas las cartas de los jugadores del grupo activo.
- **Edición y Eliminación**: Los organizadores pueden editar y eliminar a los jugadores **manuales** que han creado.
- **Página de Detalle del Jugador (`/players/[id]`)**:
    - Muestra un **gráfico de líneas** con la progresión histórica de su OVR.
    - Presenta una **tabla con el historial de evaluaciones** de cada partido.

### d. Búsqueda de Partidos y Jugadores
- **Página de Búsqueda (`/find-match`)**: Interfaz unificada con mapa para encontrar partidos públicos y jugadores libres.
- **Búsqueda de Partidos**: Los usuarios pueden buscar partidos públicos cercanos, filtrando por radio, fecha y tamaño del partido. Los resultados se muestran en el mapa y en una lista.
- **Búsqueda de Jugadores**: Permite a los organizadores buscar jugadores que se hayan marcado como "visibles", filtrando por posición y OVR.
- **Asistente de Fichajes (IA)**: Una función de IA (`findBestFitPlayer`) recomienda los mejores jugadores disponibles para completar un partido específico, basándose en la posición y el equilibrio del equipo.

### e. Visibilidad y Disponibilidad del Jugador
- **Interruptor de Visibilidad**: En el dashboard, los jugadores pueden hacerse "visibles" para que otros organizadores los encuentren y los inviten a partidos.
- **Configuración de Disponibilidad**: Los usuarios pueden especificar los días y horarios en los que suelen estar disponibles para jugar, ayudando a los organizadores a encontrar al jugador perfecto.

### f. Gestión de Partidos e Invitaciones
- **Creación de Partidos**: Manual (el DT elige) o Colaborativo (los jugadores se apuntan). Los partidos colaborativos pueden ser públicos.
- **Invitaciones a Jugadores**: Los organizadores pueden invitar a jugadores de fuera de su grupo a partidos públicos. El jugador invitado recibe una notificación y puede aceptar o rechazar.
- **Bandeja de Invitaciones**: Un panel centralizado donde los jugadores ven y gestionan todas sus invitaciones a partidos.

### g. Sistema de Evaluación por Pares
- **Evaluación por Puntos o Etiquetas (IA)**: Al evaluar, se puede elegir entre un sistema de puntuación tradicional (1-10) o un sistema dinámico de etiquetas generadas por IA que afectan directamente a los atributos.
- **Auto-evaluación**: Los jugadores reportan sus propios goles en el formulario de evaluación.
- **Panel de Supervisión del Organizador**: El organizador finaliza el proceso de evaluación, lo que dispara el cálculo y la actualización de los OVRs y estadísticas de los jugadores.

### h. Notificaciones y Chat
- **Notificaciones en Tiempo Real**: Un sistema de notificaciones en la app avisa al usuario sobre invitaciones a partidos, nuevos jugadores que se unen o evaluaciones pendientes.
- **Chat por Partido**: Cada partido tiene su propia sala de chat para que los jugadores coordinen detalles.

### i. Funcionalidades de Inteligencia Artificial (Genkit)
- **Generación de Equipos Equilibrados**: (`generateBalancedTeams`).
- **Sugerencias de Mejora**: (`suggestPlayerImprovements`).
- **Pronóstico del Clima**: (`getMatchDayForecast`).
- **Generación de Etiquetas de Evaluación**: (`generateEvaluationTags`).
- **Asistente de Fichajes**: (`findBestFitPlayer`).

---

## 3. Arquitectura y Estructura de Archivos

```
/
├── public/
├── src/
│   ├── ai/
│   │   ├── flows/
│   │   │   ├── find-best-fit-player.ts      # <-- NUEVO
│   │   │   ├── generate-balanced-teams.ts
│   │   │   ├── generate-evaluation-tags.ts
│   │   │   └── ...
│   │   └── genkit.ts
│   │
│   ├── app/
│   │   ├── dashboard/page.tsx
│   │   ├── evaluations/
│   │   │   ├── [matchId]/page.tsx
│   │   │   └── page.tsx
│   │   ├── find-match/page.tsx           # <-- NUEVO
│   │   ├── groups/page.tsx
│   │   ├── matches/
│   │   │   ├── [id]/evaluate/page.tsx
│   │   │   └── page.tsx
│   │   ├── players/
│   │   │   ├── [id]/page.tsx
│   │   │   └── page.tsx
│   │   ├── profile/page.tsx
│   │   └── ...
│   │
│   ├── components/
│   │   ├── add-match-dialog.tsx
│   │   ├── add-player-dialog.tsx
│   │   ├── edit-player-dialog.tsx
│   │   ├── find-best-fit-dialog.tsx      # <-- NUEVO
│   │   ├── invitations-sheet.tsx         # <-- NUEVO
│   │   ├── main-nav.tsx
│   │   ├── match-card.tsx
│   │   ├── match-chat-sheet.tsx          # <-- NUEVO
│   │   ├── match-details-dialog.tsx      # <-- NUEVO
│   │   ├── match-marker.tsx              # <-- NUEVO
│   │   ├── player-card.tsx
│   │   ├── player-marker.tsx             # <-- NUEVO
│   │   ├── notification-bell.tsx         # <-- NUEVO
│   │   ├── set-availability-dialog.tsx   # <-- NUEVO
│   │   └── ...
│   │
│   ├── firebase/
│   │   ├── auth/use-user.tsx
│   │   ├── firestore/
│   │   └── ...
│   │
│   └── lib/
│       ├── actions.ts
│       ├── types.ts
│       └── ...
│
├── docs/
│   └── backend.json
│
└── ...
```

---

## 4. Estructura de la Base de Datos (Firestore)

- **`/users/{userId}`**: Perfil público del usuario.
  - **Subcolección**: `/users/{userId}/notifications/{notificationId}`: Almacena notificaciones personales.

- **`/groups/{groupId}`**: Información de cada grupo.

- **`/players/{playerId}`**: Carta y estadísticas de cada jugador.
  - **Subcolección**: `/players/{playerId}/ovrHistory/{historyId}`: Historial de progresión de OVR.

- **`/availablePlayers/{playerId}`**: Almacena jugadores que han activado su visibilidad pública, incluyendo su ubicación y horarios disponibles.

- **`/matches/{matchId}`**: Datos de cada partido.
  - **Subcolección**: `/matches/{matchId}/assignments/{assignmentId}`: Tareas de evaluación.
  - **Subcolección**: `/matches/{matchId}/invitations/{invitationId}`: Invitaciones enviadas para este partido.
  - **Subcolelección**: `/matches/{matchId}/selfEvaluations/{userId}`: Auto-reporte de goles.
  - **Subcolección**: `/matches/{matchId}/messages/{messageId}`: Chat del partido.

- **`/evaluations/{evaluationId}`**: Registros de evaluaciones completadas.

---

## 5. Changelog (Historial de Cambios)

*   **[Fecha Actual]**: Se implementa la búsqueda de partidos y jugadores en un mapa, junto con un sistema de invitaciones, visibilidad pública y un asistente de IA para fichajes.
*   **[Fecha Anterior]**: Se añade la funcionalidad completa de editar y eliminar grupos, incluyendo la limpieza de datos asociados. Se mejora la guía de bienvenida con un carrusel visual.
*   **[Fecha Anterior]**: Se integra un pronóstico del clima por IA al programar un partido.
*   **[Fecha Anterior]**: Se mejora el Dashboard, se ajusta la IA para citas célebres y se realizan múltiples mejoras de UI/UX.
*   **[Fecha Anterior]**: Se implementa la página de detalle del jugador con gráfico de progresión de OVR.
*   **[Fecha Anterior]**: Se reestructura completamente el sistema de evaluación por pares.

---

¡Felicidades por el increíble avance! La aplicación es ahora un sistema muy completo y robusto.
