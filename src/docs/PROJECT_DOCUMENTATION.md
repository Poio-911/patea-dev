
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

### c. Gestión de Jugadores y Equipos Persistentes
- **Añadir Jugadores Manuales**: Los organizadores pueden añadir jugadores que no son usuarios registrados.
- **Creación de Equipos**: Dentro de un grupo, los usuarios pueden crear "equipos" o "clubes" persistentes con nombre, camiseta personalizada y un plantel fijo de jugadores.
- **Página de Detalle del Equipo (`/groups/teams/[id]`)**: Centro de mando táctico para gestionar el plantel (titulares/suplentes), ver estadísticas y acceder a funciones competitivas.

### d. Sistema de Competiciones y Amistosos
- **Desafíos entre Equipos**: Los dueños de equipos pueden hacer que su equipo sea "desafiable" para que otros los encuentren.
- **Búsqueda de Rivales**: Un sistema permite buscar equipos disponibles para desafiar.
- **Gestión de Invitaciones**: Una bandeja centralizada en la sección "Competiciones" permite a los miembros del equipo aceptar o rechazar desafíos.
- **Partidos Inter-Grupo**: Al aceptar un desafío, se genera automáticamente un partido amistoso entre los dos equipos.
- **(Visión a Futuro)**: Esta base permitirá la creación de **Ligas y Copas** con fixtures automáticos y tablas de posiciones. Para más detalles, ver `docs/COMPETICIONES.md`.

### e. Sistema de Evaluación por Pares
- **Evaluación por Puntos o Etiquetas**: Después de un partido, los jugadores evalúan a sus compañeros usando un sistema de rating (1-10) o etiquetas de rendimiento.
- **Panel de Supervisión del Organizador**: El organizador finaliza el proceso de evaluación, lo que dispara el cálculo y la actualización de los OVRs y atributos de los jugadores, haciendo que las "cartas" de los jugadores evolucionen.

### f. Funcionalidades de Inteligencia Artificial (Genkit)
- **Generación de Equipos Equilibrados**: (`generateBalancedTeams`).
- **Sugerencias de Mejora**: (`suggestPlayerImprovements`).
- **Pronóstico del Clima**: (`getMatchDayForecast`).
- **Asistente de Fichajes**: (`findBestFitPlayer`).
- **Análisis de Rendimiento y Progresión**: (`detectPlayerPatterns`, `analyzePlayerProgression`).

---

## 3. Arquitectura y Estructura de Archivos

La aplicación sigue una estructura moderna de Next.js con el App Router.

```
/
├── public/
├── src/
│   ├── ai/                      # Lógica de Inteligencia Artificial con Genkit
│   ├── app/                     # Rutas y páginas de la aplicación
│   │   ├── competitions/        # Hub de desafíos, ligas y copas
│   │   │   ├── find-opponent/[teamId]/page.tsx
│   │   │   └── page.tsx
│   │   ├── groups/
│   │   │   ├── teams/[id]/page.tsx # Página de detalle del equipo
│   │   │   └── page.tsx
│   │   └── ...
│   │
│   ├── components/              # Componentes reutilizables de React
│   │   ├── team-builder/        # Componentes para crear equipos
│   │   ├── invitations-sheet.tsx
│   │   └── ...
│   │
│   ├── firebase/                # Configuración y hooks de Firebase
│   └── lib/                     # Utilidades, tipos y lógica de negocio
│
├── docs/
│   ├── backend.json             # "Blueprint" de la estructura de datos
│   ├── COMPETICIONES.md         # <-- NUEVO: Detalle del sistema de amistosos y torneos
│   └── PROJECT_DOCUMENTATION.md # Este archivo
│
└── ...
```

---

## 4. Estructura de la Base de Datos (Firestore)

-   **`/users/{userId}`**: Perfil público del usuario.
    -   Subcolección: `/notifications/{notificationId}`: Notificaciones personales.

-   **`/groups/{groupId}`**: Información de cada grupo de usuarios.

-   **`/teams/{teamId}`**: Equipos persistentes creados por los usuarios, con su camiseta, plantel, etc.
    -   `isChallengeable: boolean`: Flag para que el equipo aparezca en búsquedas.
    -   Subcolección: `/invitations/{invitationId}`: Almacena los desafíos recibidos.

-   **`/players/{playerId}`**: La "carta" de cada jugador con sus atributos y estadísticas.
    -   Subcolección: `/ovrHistory/{historyId}`: Historial de progresión de OVR.

-   **`/matches/{matchId}`**: Datos de cada partido.
    -   Subcolecciones para `assignments`, `selfEvaluations`, y `messages`.

---

## 5. Changelog (Historial de Cambios)

*   **[Fecha Actual]**: Se implementa el **sistema de desafíos entre equipos**. Los equipos pueden marcarse como "desafiables", buscar rivales y enviar/recibir invitaciones a partidos amistosos. Se reestructura la sección "Competiciones" para centralizar la gestión de estos desafíos.
*   **[Fecha Anterior]**: Se soluciona un error crítico de permisos en Firestore que impedía la carga de perfiles de usuario. Se mejora la UI de las tarjetas de equipo para mayor legibilidad en móviles.
*   **[Fecha Anterior]**: Se integra un pronóstico del clima por IA, se mejora el Dashboard, se implementa la página de detalle del jugador con gráfico de OVR y se reestructura el sistema de evaluación por pares.

---

¡Felicidades por todo el progreso! La aplicación es ahora un sistema robusto y completo con funcionalidades avanzadas.
