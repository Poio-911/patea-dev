# Ruta: /dashboard
## Propósito General
La ruta `/dashboard` sirve como el panel de control principal para los usuarios autenticados en la aplicación. Su propósito es proporcionar una visión general personalizada y en tiempo real de la actividad relacionada con el grupo de fútbol activo del usuario. Esto incluye información sobre partidos próximos y recientes, estadísticas del jugador, y la gestión del grupo. La página también maneja diferentes estados de usuario, como la bienvenida a nuevos usuarios sin grupo, la reorientación de usuarios existentes sin un grupo activo seleccionado, y la visualización del contenido completo del dashboard para usuarios con un grupo activo.

## Componentes y Estructura
El componente principal es `DashboardContent`, que es un componente de cliente (`'use client'`). La estructura de la página es altamente condicional, adaptándose al estado del usuario:

*   **Estado de Carga:** Muestra un `DashboardSkeleton` mientras se cargan los datos iniciales.
*   **Usuario Nuevo (sin grupos):** Presenta una interfaz de bienvenida con un `SoccerPlayerIcon` animado, un título llamativo y opciones para "Crear mi Clan" o "Unirme con Código", dirigiendo al usuario a la ruta `/groups`. Utiliza `motion.div` de `framer-motion` para animaciones de entrada.
*   **Usuario Existente (sin grupo activo):** Muestra un mensaje para seleccionar un grupo activo, con un `Users2` icon animado y un botón para "Seleccionar mi Grupo Activo", también dirigiendo a `/groups`. Utiliza `motion.div` para animaciones.
*   **Dashboard Principal (con grupo activo):**
    *   `FirstTimeInfoDialog`: Un diálogo que se muestra una vez para informar al usuario sobre las características del dashboard.
    *   `NotificationPermissionPrompt`: Un banner que solicita permiso para enviar notificaciones.
    *   `PageHeader`: Muestra el título "El Vestuario" y una descripción, acompañado de un `MateIcon`.
    *   `DashboardTabs`: Un componente clave que organiza el contenido del dashboard en pestañas (el código proporcionado se corta aquí, pero su nombre sugiere esta funcionalidad).
    *   **Componentes de UI y Funcionales (importados y potencialmente usados dentro de `DashboardTabs` o en otras secciones):**
        *   `Card`, `CardContent`, `CardHeader`, `CardTitle`, `CardDescription`: Para estructurar y presentar información en bloques.
        *   `Avatar`, `AvatarFallback`, `AvatarImage`: Para mostrar avatares de usuarios o jugadores.
        *   `MatchVisualizer`: Para visualizar partidos en vivo.
        *   `NextMatchCard`: Para mostrar detalles del próximo partido.
        *   `Badge`: Para etiquetas de estado (ej. estado del partido).
        *   `Separator`: Para dividir secciones visualmente.
        *   `SoccerPlayerIcon`, `MateIcon`, `FindMatchIcon`: Iconos personalizados.
        *   `PlayerStatsCard`: Para mostrar estadísticas de jugadores.
        *   `PlayerPositionBadge`: Para indicar la posición de un jugador.
        *   `Alert`, `AlertDescription`, `AlertTitle`: Para mostrar mensajes de alerta.
        *   `Button`, `Link`: Para navegación y acciones.
    *   **Animaciones:** Utiliza `framer-motion` con `PAGE_VARIANTS`, `LIST_VARIANTS`, y `CARD_VARIANTS` para transiciones y animaciones de elementos.
    *   **Configuración de Estilos:** `statusConfig` define clases CSS para diferentes estados de partido.

## Hooks, Server Actions y Lógica
El componente `DashboardContent` es un componente de cliente y no utiliza Server Actions directamente en este fragmento de código. La lógica se basa en React Hooks y los hooks de Firebase para la gestión de datos:

*   **`useUser()`:** Obtiene el objeto de usuario autenticado, incluyendo `user.uid` (ID de usuario) y `user.activeGroupId` (ID del grupo activo).
*   **`useFirestore()`:** Proporciona una instancia de Firestore para realizar consultas.
*   **`useState`:**
    *   `showVisualizer`: Controla la visibilidad del componente `MatchVisualizer`.
    *   `selectedLive`: Almacena el objeto `Match` seleccionado para la visualización en vivo.
*   **`useMemo` (para optimización de consultas y datos derivados):**
    *   **Referencias y Consultas de Firestore:**
        *   `groupMatchesQuery`: Consulta todos los partidos del `activeGroupId`, ordenados por fecha descendente.
        *   `playerRef`: Referencia al documento del jugador actual (`players/{uid}`).
        *   `availablePlayerRef`: Referencia al documento de disponibilidad del jugador actual (`availablePlayers/{uid}`).
        *   `userProfileRef`: Referencia al perfil del usuario actual (`users/{uid}`).
        *   `allPlayersInGroupQuery`: Consulta todos los jugadores en el `activeGroupId`.
        *   `activeGroupRef`: Referencia al documento del grupo activo (`groups/{activeGroupId}`).
        *   `upcomingMatchesQuery`: Consulta los próximos 5 partidos (`status == 'upcoming'`) del grupo activo, ordenados por fecha ascendente.
        *   `friendlyMatchesQuery`: Consulta partidos amistosos intergrupo (`type == 'intergroup_friendly'`) del grupo activo.
        *   `activeMatchesQuery`: Consulta partidos con `status == 'active'` en el grupo activo.
    *   **Datos Derivados:**
        *   `matches`: Una versión ordenada de `groupMatches` por fecha descendente.
        *   `nextMatch`, `recentMatches`: Calcula el próximo partido (activo o próximo) y los dos partidos más recientes (no próximos) a partir de `matches`, incluyendo lógica para parsear la hora del partido.
        *   `groupRecentMatches`: Los 4 partidos más recientemente "evaluados" del grupo.
        *   `totalGroupMatchesCount`: El número total de partidos "evaluados", "completados" o "activos".
        *   `liveMatches`: Filtra `activeGroupMatches` para incluir solo partidos con `liveStatus` de 'first_half', 'second_half' o 'half_time'.
*   **Hooks de Firebase (`@/firebase`):**
    *   `useDoc<T>(ref)`: Para obtener documentos individuales (ej. `player`, `availablePlayerData`, `userProfile`, `activeGroup`).
    *   `useCollection<T>(query)`: Para obtener colecciones de documentos (ej. `groupMatches`, `allPlayersInGroup`, `upcomingMatchesData`, `friendlyMatchesData`, `activeGroupMatches`).
*   **Gestión del Estado de Carga:**
    *   La variable `loading` consolida los estados de carga de múltiples hooks de datos (`allPlayersLoading`, `groupMatchesLoading`, etc.) para mostrar el `DashboardSkeleton` de manera coherente.
*   **Lógica Condicional de Onboarding:**
    *   Verifica `user?.activeGroupId` y `user?.groups` para determinar si el usuario es nuevo, un usuario existente sin grupo activo, o un usuario con un grupo activo.
*   **Utilidades:**
    *   `cn`: Para combinar clases CSS de forma condicional.
    *   `date-fns`: Para formatear y manipular fechas (`format`, `isToday`, `parseISO`, `es` locale).
*   **Tipos:** Importa tipos de datos (`Player`, `Match`, `AvailablePlayer`, `UserProfile`, `Group`) desde `@/lib/types` para asegurar la seguridad de tipos.