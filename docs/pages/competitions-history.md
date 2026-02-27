# Ruta: /competitions/history
## Propósito General
Esta ruta está diseñada para mostrar el historial de partidos amistosos ("intergroup_friendly") en los que el usuario actualmente autenticado ha participado. Permite a los usuarios revisar de manera centralizada todos los encuentros amistosos jugados, independientemente del grupo al que pertenezcan los otros participantes.

## Componentes y Estructura
La página se organiza en una estructura de diseño flexible (`flex flex-col gap-8`) y utiliza varios componentes de UI y personalizados:

*   **`PageHeader`**: Componente que encabeza la página con el título "Historial de Amistosos" y una descripción "Revisá todos los partidos amistosos jugados".
    *   Como hijo, renderiza `InvitationsSheet`, un componente que probablemente gestiona o muestra invitaciones.
*   **`Button` (con `Link`)**: Un botón de navegación que permite al usuario volver a la ruta `/competitions`.
*   **Sección de "Partidos Jugados"**: Un bloque visualmente destacado con un borde izquierdo y un título `h2` que incluye un icono de `Swords`, indicando la temática de partidos.
*   **Renderizado Condicional de Partidos**:
    *   **Estado de Carga (`matchesLoading`)**: Muestra un `div` con un `grid` que contiene tres componentes `Card`, cada uno con `Skeleton` para simular el contenido mientras se cargan los datos.
    *   **Datos Disponibles**: Si `friendlyMatches` tiene elementos, se renderiza un `div` con un `grid` que mapea cada partido a un componente `FriendlyMatchCard`.
    *   **Sin Datos**: Si no hay partidos amistosos registrados, se muestra un componente `Alert` con el mensaje "No hay partidos amistosos registrados todavía."
*   **Estados de Error/Carga Inicial**:
    *   **Carga de Usuario (`userLoading`)**: Muestra un `Loader2` animado en el centro de la pantalla.
    *   **Usuario No Autenticado**: Muestra un `Alert` que indica la necesidad de iniciar sesión para ver el historial.
*   **Componentes de UI Importados**:
    *   `Button`, `Alert`, `AlertDescription`, `Card`, `CardContent`, `CardHeader`, `Skeleton` (de `@/components/ui`).
    *   `Loader2`, `Users`, `Swords`, `ArrowLeft` (iconos de `lucide-react`).
    *   `InvitationsSheet`, `FriendlyMatchCard` (componentes personalizados de `@/components`).

## Hooks, Server Actions y Lógica
Este componente es un cliente (`'use client'`) y gestiona la lógica de datos y estado en el lado del cliente:

*   **`useUser()`**: Hook personalizado de `@/firebase` que proporciona el objeto del usuario autenticado (`user`) y un estado de carga (`userLoading`). Es fundamental para la autenticación y la personalización de la vista.
*   **`useFirestore()`**: Hook personalizado de `@/firebase` que devuelve una instancia del cliente de Firestore, necesaria para interactuar con la base de datos.
*   **`useMemo()`**: Se utiliza para memoizar la creación de la consulta de Firestore (`friendlyMatchesQuery`). Esto asegura que la consulta solo se recree si `firestore` o `user?.uid` cambian, optimizando el rendimiento.
    *   **Lógica de Consulta**: La consulta busca documentos en la colección `matches`. Filtra por `type` igual a `'intergroup_friendly'` y utiliza `where('playerUids', 'array-contains', user.uid)` para incluir solo los partidos donde el UID del usuario actual esté presente en el array `playerUids`. Esto permite al usuario ver todos los partidos amistosos en los que ha participado, sin importar los grupos involucrados.
*   **`useCollection<Match>(friendlyMatchesQuery)`**: Hook personalizado de `@/firebase` que se encarga de escuchar en tiempo real los cambios en la colección de Firestore definida por `friendlyMatchesQuery`.
    *   Devuelve los datos de la colección (`friendlyMatches`) y un estado de carga (`matchesLoading`).
    *   El tipo `Match` se importa de `@/lib/types` para tipar correctamente los datos recibidos.
*   **Manejo de Estados y Renderizado Condicional**:
    *   La página primero verifica el estado de carga del usuario (`userLoading`) y la autenticación (`!user`) para mostrar un spinner o un mensaje de inicio de sesión, respectivamente.
    *   Posteriormente, utiliza `matchesLoading` para mostrar esqueletos de carga mientras se recuperan los partidos.
    *   Finalmente, renderiza la lista de `FriendlyMatchCard` si hay partidos, o un mensaje si no los hay.
*   **Interacción con la Base de Datos**: Toda la interacción con la base de datos se realiza a través de los hooks de Firebase (`useFirestore`, `useCollection`), que abstraen las operaciones de lectura de Firestore. No se utilizan Server Actions explícitas en este componente.