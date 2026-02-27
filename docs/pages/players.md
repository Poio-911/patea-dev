# Ruta: /players
## Propósito General
Esta ruta (`/players`) sirve como la página principal para gestionar y visualizar el plantel de jugadores del grupo activo del usuario. Permite a los usuarios ver una lista de todos los jugadores asociados a su grupo, agregar nuevos jugadores (manuales), filtrar la lista por posición y rango de OVR (Overall Rating), y acceder a detalles de cada jugador. La página también maneja varios estados, como la carga de datos, la ausencia de un grupo activo, la falta de jugadores en el grupo y la ausencia de jugadores que coincidan con los filtros aplicados.

## Componentes y Estructura
El componente principal de la página es `PlayersPage`, que es un componente de cliente de Next.js.

- **Contenedor Principal:** Un `div` con `flex flex-col gap-8` que organiza el contenido verticalmente.
- **`FirstTimeInfoDialog`**: Un diálogo informativo que se muestra la primera vez que el usuario visita la sección, explicando su propósito.
- **`PageHeader`**: Componente que muestra el título ("Plantel") y una descripción de la página.
    - **`AddPlayerDialog`**: Un componente anidado dentro de `PageHeader` que proporciona la funcionalidad para agregar nuevos jugadores al grupo activo.
- **Barra de Herramientas/Filtros:** Un `div` que contiene:
    - **`AttributesHelpDialog`**: Un botón que abre un diálogo explicando el significado de los atributos de los jugadores.
    - **`PlayerFiltersComponent`**: Un componente que permite al usuario aplicar filtros a la lista de jugadores por posición y rango de OVR.
- **Estados de Carga y Vacío:**
    - **`Skeleton`**: Se renderiza una cuadrícula de esqueletos (`h-64 w-full`) mientras los datos de los jugadores están cargando.
    - **`Alert`**: Se muestran mensajes de alerta condicionales para:
        - Indicar que no hay un grupo activo seleccionado, con un enlace a la página de grupos.
        - Informar que no hay jugadores en el grupo actual.
        - Notificar que no hay jugadores que coincidan con los filtros aplicados.
- **Resumen de Filtros:** Un `div` que muestra el número de jugadores filtrados en relación con el total de jugadores (`Mostrando X de Y jugadores`).
- **Lista de Jugadores:** Una sección (`section`) que organiza las `PlayerCard` en una cuadrícula responsiva (`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4`).
    - **`PlayerCard`**: Componente que muestra la información de un jugador individual (nombre, OVR, posición, foto, etc.).

**Framer Motion:**
- Se importan `motion` y se definen `listVariants` e `itemVariants`, pero no se aplican explícitamente a ningún elemento `motion` en el JSX proporcionado. Esto sugiere una intención de añadir animaciones de entrada a la lista de jugadores, que actualmente no están implementadas.

## Hooks, Server Actions y Lógica
Este componente es un "Client Component" (`'use client'`) y utiliza una combinación de hooks de React y hooks personalizados de Firebase para la gestión de datos y el estado.

- **Hooks de Firebase:**
    - `useUser()`: Obtiene el objeto `user` autenticado y su estado de carga (`userLoading`). El `user.activeGroupId` es crucial para filtrar los datos.
    - `useFirestore()`: Proporciona una instancia de la base de datos Firestore.
    - `useCollection<Player>(playersQuery)`: Escucha en tiempo real una colección de documentos de jugadores (`Player`) basada en la consulta `playersQuery`. Devuelve los datos (`players`) y el estado de carga (`playersLoading`).
    - `useCollection<UserProfile>(usersQuery)`: Escucha en tiempo real una colección de documentos de perfiles de usuario (`UserProfile`) basada en la consulta `usersQuery`. Devuelve los datos (`groupUsers`) y el estado de carga (`usersLoading`).

- **Hooks de React:**
    - `useState<PlayerFilters>`: Gestiona el estado de los filtros aplicados a la lista de jugadores (`filters`, `setFilters`). Inicializado con posiciones vacías y un rango de OVR de [40, 99].
    - `useMemo` para `playersQuery`:
        - Crea una consulta Firestore para la colección `players`.
        - Filtra los jugadores donde `groupId` coincide con `user.activeGroupId`.
        - La consulta se memoiza y solo se recrea si `firestore` o `user.activeGroupId` cambian.
    - `useMemo` para `usersQuery`:
        - Crea una consulta Firestore para la colección `users`.
        - Filtra los usuarios donde el array `groups` contiene `user.activeGroupId`.
        - Esta consulta se utiliza para obtener los perfiles de los usuarios del grupo, que pueden servir como fallback para fotos o para identificar creadores de jugadores manuales.
        - La consulta se memoiza y solo se recrea si `firestore` o `user.activeGroupId` cambian.
    - `useMemo` para `sortedPlayers`:
        - Procesa la lista `players` obtenida de Firestore.
        - **Lógica de Fallback de Foto:** Si un jugador no tiene `photoUrl` (en camelCase) pero tiene un `ownerUid` que corresponde a un `groupUser` con `photoURL` (en PascalCase), se asigna la `photoURL` del usuario como fallback.
        - **Lógica de Nombre del Creador:** Si el `player.id` es diferente de `player.ownerUid` (indicando un jugador manual creado por un usuario), se busca el `displayName` del `creatorDoc` (UserProfile) y se adjunta al objeto del jugador como `creatorName`.
        - Ordena los jugadores resultantes por `ovr` de forma descendente.
        - Se memoiza y se recalcula solo si `players` o `groupUsers` cambian.
    - `useMemo` para `filteredPlayers`:
        - Aplica los filtros definidos en el estado `filters` a la lista `sortedPlayers`.
        - **Filtro por Posición:** Si `filters.positions` no está vacío, filtra los jugadores cuyas posiciones están incluidas en el array de filtros.
        - **Filtro por Rango de OVR:** Si `filters.ovrRange` está definido, filtra los jugadores cuyo `ovr` se encuentra dentro del rango especificado.
        - Se memoiza y se recalcula solo si `sortedPlayers` o `filters` cambian.

- **Lógica de Carga y Estado Global:**
    - La variable `loading` combina los estados de carga de `userLoading`, `playersLoading` y `usersLoading` para controlar la visualización de esqueletos o contenido real.

- **Server Actions:**
    - No se utilizan Server Actions directamente en este componente de cliente. Todas las interacciones con la base de datos se realizan a través de los hooks de Firebase (`useCollection`, `useFirestore`) que operan en el cliente.