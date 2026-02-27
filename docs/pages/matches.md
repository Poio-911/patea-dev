# Ruta: /matches
## Propósito General
La ruta `/matches` sirve como el centro principal para que los usuarios de un grupo gestionen y visualicen los partidos. Se enfoca específicamente en los "amistosos" (partidos manuales, colaborativos, por equipos e intergrupo). Permite a los usuarios ver partidos próximos, el historial, filtrar por tipo, estado y si son creados por ellos, así como cambiar el modo de visualización. También maneja la lógica para la finalización de partidos pendientes y la persistencia de las preferencias del usuario.

## Componentes y Estructura
La página se estructura como un contenedor `div` principal con `flex flex-col gap-6`.

*   **`FirstTimeInfoDialog`**: Un diálogo que se muestra la primera vez que un usuario visita la sección de partidos, proporcionando información introductoria.
*   **`PendingFinalizationDialog`**: Un diálogo que se muestra si el usuario tiene partidos "amistosos" pasados con estado "upcoming" que aún no han sido finalizados, ofreciendo la opción de finalizarlos en lote.
*   **`Alert`**: Se muestra condicionalmente si el usuario no tiene un `activeGroupId`, indicando que no hay un grupo activo y sugiriendo crear o unirse a uno.
*   **`PageHeader`**: Componente para el encabezado de la página, mostrando el título "Partidos" y un botón para añadir un nuevo partido (`AddMatchDialog`).
*   **`QuickTimeFilter`**: Permite al usuario filtrar los partidos por periodos de tiempo (`upcoming`, `this_week`, `history`), mostrando también el conteo de partidos para cada filtro.
*   **`MatchFilters`**: Un componente de filtro más detallado que permite filtrar por tipo de partido, estado y si el usuario es el propietario (`onlyMine`).
*   **`ViewModeToggle`**: Permite al usuario alternar entre diferentes modos de visualización de los partidos (e.g., 'grid', 'list').
*   **`NextMatchCard`**: Muestra el partido amistoso más próximo como un elemento destacado, si existe.
*   **`motion.div`**: Utilizado para animaciones de entrada de la lista de partidos, aplicando `LIST_VARIANTS` y `ITEM_VARIANTS` de `framer-motion`.
*   **`MatchCard`**: Componente para mostrar un partido individual en el modo de vista 'grid'.
*   **`CompactMatchCard`**: Componente para mostrar un partido individual en el modo de vista 'list'.
*   **`AddMatchDialog`**: Un diálogo para añadir nuevos partidos, accesible desde el `PageHeader`.
*   **`ResponsivePopover`**: Utilizado para los filtros de partidos, permitiendo una experiencia responsiva en diferentes tamaños de pantalla.
*   **Iconos**: `Users2`, `Calendar`, `Loader2`, `Info`, `UserCheck`, `Shirt`, `Globe`, `HelpCircle`, `Users` de `lucide-react` se utilizan para la interfaz de usuario y los estados.
*   **Estado de Carga**: Muestra un `Loader2` con un mensaje "Cargando partidos..." mientras se cargan los datos iniciales.

## Hooks, Server Actions y Lógica
La página utiliza una combinación de hooks de React, hooks personalizados de Firebase, y Server Actions para la gestión de datos y estado.

### Hooks de Estado (`useState`)
*   `viewMode`: Almacena el modo de visualización actual de los partidos ('grid' o 'list'), con un valor inicial de 'grid'.
*   `matchFilters`: Objeto que contiene los filtros aplicados a los partidos (tipos, estados, `onlyMine`), inicializado con `DEFAULT_FILTERS`.
*   `preferencesLoaded`: Booleano que indica si las preferencias del usuario se han cargado desde el servidor.
*   `timeFilter`: Almacena el filtro de tiempo actual ('upcoming', 'this_week', 'history'), inicializado en 'upcoming'.
*   `showPendingDialog`: Booleano para controlar la visibilidad del `PendingFinalizationDialog`.

### Hooks de Referencia (`useRef`)
*   `debounceRef`: Se utiliza para implementar un debounce en la función `persistPreferences`, evitando múltiples llamadas a la acción del servidor en un corto periodo.
*   `hasCheckedPending`: Booleano para asegurar que el diálogo de partidos pendientes solo se muestre una vez por carga de página.

### Hooks de Firebase
*   `useUser()`: Obtiene la información del usuario autenticado (`user`) y su estado de carga (`userLoading`).
*   `useFirestore()`: Proporciona una instancia de la base de datos Firestore.
*   `useCollection<T>(query)`: Hook personalizado para escuchar colecciones de Firestore en tiempo real.
    *   `groupMatches`: Colección de partidos del grupo activo del usuario.
    *   `joinedMatches`: Colección de partidos en los que el usuario ha participado.
    *   `allGroupPlayers`: Colección de jugadores del grupo activo del usuario.

### Hooks de Efecto (`useEffect`)
*   **Carga de Preferencias del Usuario**: Se ejecuta al montar el componente o cuando `user.uid` cambia. Llama a `getUserPreferencesAction` para cargar las preferencias de `matchesViewMode` y `matchFilters` del usuario y actualiza los estados locales.
*   **Verificación de Partidos Pendientes**: Se ejecuta cuando `pendingFinalizationMatches.length` cambia. Si hay partidos pendientes y no se ha verificado antes (`hasCheckedPending.current`), establece `showPendingDialog(true)`.

### Hooks de Memoización (`useMemo`)
*   **Queries de Firestore**:
    *   `playersQuery`: Crea una consulta para obtener todos los jugadores del `activeGroupId` del usuario.
    *   `groupMatchesQuery`: Crea una consulta para obtener todos los partidos del `activeGroupId` del usuario, ordenados por fecha descendente.
    *   `joinedMatchesQuery`: Crea una consulta para obtener todos los partidos en los que el `user.uid` está en el array `playerUids`.
*   **`allMatches`**: Combina los `groupMatches` y `joinedMatches` en un único array, eliminando duplicados y ordenándolos por fecha descendente.
*   **`pendingFinalizationMatches`**: Filtra `allMatches` para encontrar partidos que son propiedad del usuario (`ownerUid === user.uid`), tienen estado 'upcoming', su fecha es anterior a hoy y no son de tipo competición.
*   **`amistososMatches`**: Filtra `allMatches` para incluir solo los tipos de partidos considerados "amistosos" ('manual', 'collaborative', 'by_teams', 'intergroup_friendly').
*   **`filteredMatches`**: Aplica secuencialmente los filtros de `matchFilters` (tipos, estados, `onlyMine`) y `timeFilter` (`upcoming`, `this_week`, `history`) a `amistososMatches`.
*   **`sortedFilteredMatches`**: Ordena `filteredMatches` cronológicamente (ascendente para próximos, descendente para historial).
*   **`featuredMatch`**: Identifica el partido amistoso más próximo (con estado 'active' o 'upcoming' y fecha/hora futura) para mostrarlo de forma destacada.
*   **`timeCounts`**: Calcula el número de partidos para cada categoría de `timeFilter` (`upcoming`, `this_week`, `history`) basándose en `amistososMatches`.
*   **`sortedPlayers`**: Ordena `allGroupPlayers` por `ovr` (overall rating) de forma descendente.
*   **`gridMatches`**: Simplemente una referencia a `sortedFilteredMatches` (el `featuredMatch` no se excluye de esta lista).

### Hooks de Callback (`useCallback`)
*   **`persistPreferences`**: Función debounced que guarda las preferencias de `viewMode` y `matchFilters` del usuario en la base de datos a través de `updateUserPreferencesAction`.
*   **`handleViewModeChange`**: Actualiza el estado `viewMode` y llama a `persistPreferences`.
*   **`handleFiltersChange`**: Actualiza el estado `matchFilters` y llama a `persistPreferences`.

### Server Actions
*   `getUserPreferencesAction(user.uid)`: Recupera las preferencias del usuario desde el servidor.
*   `updateUserPreferencesAction(user.uid, { matchesViewMode, matchFilters })`: Persiste las preferencias actualizadas del usuario en el servidor.

### Lógica de Base de Datos y Manejo de Datos
*   **Carga de Datos**: Utiliza `useCollection` para obtener datos en tiempo real de Firestore para jugadores y partidos.
*   **Combinación de Partidos**: `allMatches` combina partidos del grupo y partidos en los que el usuario participa para asegurar que se muestren todos los relevantes.
*   **Finalización de Partidos Pendientes**:
    *   La función `handleFinalizeAllPending` se encarga de actualizar el estado de múltiples partidos pendientes a 'completed' y añadir una marca de tiempo `finalizedAt`.
    *   Utiliza `writeBatch` de Firestore para realizar múltiples escrituras atómicas, garantizando que todas las actualizaciones se completen o ninguna lo haga.
    *   Muestra notificaciones `toast` de éxito o error.
*   **Filtros y Ordenación**: La lógica de `useMemo` para `filteredMatches` y `sortedFilteredMatches` implementa los complejos criterios de filtrado y ordenación basados en el estado de los filtros y el tiempo.
*   **Estado de Carga Global**: La variable `loading` combina los estados de carga de `useUser` y `useCollection` para mostrar un indicador de carga general.
*   **`useToast()`**: Hook para mostrar notificaciones al usuario sobre el éxito o fracaso de operaciones (e.g., finalización de partidos).