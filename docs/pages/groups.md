# Ruta: /groups
## Propósito General
Esta ruta sirve como el panel de control principal para la gestión de grupos de fútbol de un usuario. Permite a los usuarios visualizar y administrar sus grupos, incluyendo la creación de nuevos grupos o la unión a grupos existentes. La página muestra información detallada del grupo activo seleccionado, como los jugadores, los equipos guardados, los próximos partidos, el historial de partidos recientes y estadísticas rápidas del grupo. También proporciona accesos directos a otras secciones relevantes de la aplicación, como rankings y el feed social.

## Componentes y Estructura
La página `/groups` está estructurada para ser altamente interactiva y condicional, adaptándose si el usuario tiene un grupo activo o no.

*   **Contenedor Principal:** Un `div` principal con `flex flex-col gap-6` que organiza todo el contenido verticalmente.
*   **Diálogos Modales:**
    *   `FirstTimeInfoDialog`: Un diálogo informativo que se muestra a los usuarios por primera vez para explicar la funcionalidad de la página de grupos.
    *   `CreateGroupDialog`: Un diálogo para que los usuarios puedan crear un nuevo grupo de fútbol. Se abre al hacer clic en el botón "Crear Grupo".
    *   `JoinGroupDialog`: Un diálogo para que los usuarios se unan a un grupo existente utilizando un código. Se abre al hacer clic en el botón "Unirse a Grupo".
*   **Encabezado de Página:**
    *   `PageHeader`: Muestra el título "Mis Grupos".
    *   Botones de acción: "Unirse a Grupo" y "Crear Grupo", que controlan la visibilidad de los diálogos correspondientes.
*   **Estado de Carga:**
    *   Un `div` centralizado con un `Loader2` (icono de carga) se muestra mientras se están cargando los datos del usuario y de Firestore.
*   **Estado "Sin Grupo Activo":**
    *   Si el usuario no tiene un `activeGroupId` o el `activeGroup` no se carga, se muestra:
        *   `Alert`: Una alerta informativa que indica que no hay un grupo seleccionado.
        *   **Condicionalmente:**
            *   Si `allUserGroups` (todos los grupos del usuario) tienen elementos: Se renderiza `UserGroupsList` para que el usuario pueda seleccionar uno de sus grupos existentes.
            *   Si `allUserGroups` está vacío: Se muestra una `Card` con un mensaje de "Bandeja de Grupos Vacía" y botones para "Unirse a uno" o "Crear el mío", que abren los diálogos `JoinGroupDialog` y `CreateGroupDialog` respectivamente.
*   **Estado "Con Grupo Activo":**
    *   Si el usuario tiene un `activeGroupId` y el `activeGroup` se ha cargado, se muestra el contenido principal del dashboard:
        *   `GroupHeroCard`: Una tarjeta destacada que muestra información clave del grupo activo.
        *   **Accesos Directos Rápidos:** Un `grid` de `Link`s que dirigen a las rutas `/rankings` y `/feed`, con iconos (`Trophy`, `MessageSquare`) y estilos distintivos.
        *   **Diseño de Columnas (`grid grid-cols-1 lg:grid-cols-12`):**
            *   **Columna Izquierda (Principal - `lg:col-span-8`):**
                *   **"Equipos Guardados":** Un `div` con un encabezado y el componente `TeamList`, que muestra los equipos guardados del grupo activo y sus jugadores.
                *   **"Últimos Partidos":** Un `div` que se renderiza si hay `safeRecentMatches`. Muestra un encabezado y un `grid` con las dos últimas `FriendlyMatchCard`s (o una representación similar) de partidos completados, incluyendo un resumen o detalles clave. Cada tarjeta es un `Link` a la página de detalles del partido. Si hay más de dos partidos, se muestra un `Link` para "Ver todo el historial policial" que lleva a `/matches`.
            *   **Columna Derecha (Secundaria - `lg:col-span-4`):**
                *   **"La Lupa" (Quick Stats Group):** Un `div` que muestra estadísticas rápidas del grupo, como el `totalMatches` jugados y el `lastMVPPlayer` (jugador más valioso del último partido). Utiliza iconos (`History`, `Trophy`) y `Badge` para la presentación. (El código se corta aquí, pero la intención es clara).

## Hooks, Server Actions y Lógica
La página utiliza una combinación de hooks de React y hooks personalizados de Firebase para gestionar el estado, la autenticación y la recuperación de datos en tiempo real.

*   **Hooks de Estado (React):**
    *   `useState(false)` para `createGroupOpen`: Controla la visibilidad del diálogo de creación de grupo.
    *   `useState(false)` para `joinGroupOpen`: Controla la visibilidad del diálogo de unión a grupo.
*   **Hooks de Autenticación y Firestore (Firebase/Custom):**
    *   `useUser()`: Hook personalizado que proporciona el objeto `user` (incluyendo `uid` y `activeGroupId`) y el estado de carga `userLoading`.
    *   `useFirestore()`: Hook que devuelve la instancia de `firestore` para interactuar con la base de datos.
*   **Hooks de Recuperación de Datos (Firestore/Custom):**
    *   Todos los queries de Firestore se envuelven en `useMemo` para optimizar el rendimiento, asegurando que las consultas solo se reconstruyan cuando sus dependencias (`firestore`, `user?.activeGroupId`, `user?.uid`) cambien.
    *   `useCollection<Player>(groupPlayersQuery)`: Recupera una colección de documentos `Player` para el `activeGroupId` del usuario.
        *   `data: groupPlayers`, `loading: playersLoading`.
    *   `useCollection<Match>(groupMatchesQuery)`: Recupera hasta 5 documentos `Match` para el `activeGroupId` con estado 'upcoming' o 'planning', ordenados por fecha.
        *   `data: upcomingMatches`, `loading: matchesLoading`.
    *   `useCollection<Match>(friendlyMatchesQuery)`: Recupera documentos `Match` de tipo 'intergroup_friendly' para el `activeGroupId`.
        *   `data: friendlyMatches`, `loading: friendlyMatchesLoading`.
    *   `useCollection<Match>(recentMatchesQuery)`: Recupera hasta 5 documentos `Match` completados para el `activeGroupId`, ordenados por fecha descendente.
        *   `data: recentMatches`, `loading: recentMatchesLoading`.
    *   `useDoc<Group>(activeGroupRef)`: Recupera un único documento `Group` correspondiente al `activeGroupId` del usuario.
        *   `data: activeGroup`, `loading: groupLoading`.
    *   `useCollection<Group>(userGroupsQuery)`: Recupera todos los documentos `Group` en los que el `user.uid` es miembro. Se utiliza para determinar si el usuario pertenece a algún grupo, incluso si no tiene uno activo.
        *   `data: allUserGroups`, `loading: allGroupsLoading`.
*   **Manejo de Carga Global:**
    *   La variable `loading` agrega todos los estados de carga individuales (`userLoading || playersLoading || ...`) para mostrar un indicador de carga general.
*   **Lógica de Datos Derivados:**
    *   `safeRecentMatches`: Asegura que `recentMatches` sea un array, incluso si es `null` o `undefined`.
    *   `lastMatchWithMVP`: Busca el partido más reciente entre `safeRecentMatches` que tenga un `bestPlayerId` asignado.
    *   `lastMVPPlayer`: Encuentra el objeto `Player` correspondiente al `bestPlayerId` del `lastMatchWithMVP`.
    *   `totalMatches`: Calcula el número total de partidos jugados, priorizando `activeGroup?.stats?.matchesPlayed` o usando la longitud de `safeRecentMatches`.
*   **Server Actions:**
    *   Este componente de cliente (`'use client'`) no importa ni invoca directamente Server Actions. Sin embargo, los diálogos `CreateGroupDialog` y `JoinGroupDialog` que se renderizan en esta página probablemente interactúan con la base de datos (Firestore) para realizar sus operaciones, lo que podría implicar el uso de Server Actions o escrituras directas a Firestore en sus implementaciones internas.
*   **Manejo de Base de Datos (Firestore):**
    *   Todas las interacciones con la base de datos se realizan a través de las funciones de `firebase/firestore` (`collection`, `query`, `where`, `orderBy`, `limit`, `doc`) y los hooks personalizados (`useCollection`, `useDoc`) que abstraen la lógica de suscripción y actualización de datos en tiempo real.
    *   Las consultas se construyen dinámicamente basadas en el `activeGroupId` del usuario y su `uid`.
*   **Notificaciones:**
    *   `useToast()`: Se importa para mostrar notificaciones al usuario, aunque su uso explícito no se muestra en el fragmento de código proporcionado.