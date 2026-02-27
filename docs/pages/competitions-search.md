# Ruta: /competitions/search
## Propósito General
Esta ruta permite a los usuarios autenticados buscar y visualizar equipos disponibles para jugar partidos amistosos. Actúa como un punto de encuentro donde los usuarios pueden encontrar otros equipos y potencialmente iniciar o unirse a competiciones. La página requiere que el usuario esté logueado y asociado a un grupo activo para funcionar.

## Componentes y Estructura
La página `/competitions/search` es un componente de cliente (`'use client'`) que organiza su contenido en una estructura vertical con espaciado (`flex flex-col gap-8`).

Los componentes principales y su estructura son:

*   **Contenedor Principal (`div`):** Envuelve toda la interfaz, aplicando un diseño de columna con un espacio de 8 unidades entre elementos.
*   **Cabecera de la Página:**
    *   Un `div` que alinea elementos entre sí (`justify-between`).
    *   **`PageHeader`:** Muestra el título "Buscar Partidos" y una descripción "Encontrá equipos disponibles para jugar partidos amistosos".
        *   Dentro de `PageHeader`, se renderiza `InvitationsSheet`, un componente que probablemente gestiona invitaciones relacionadas con partidos o grupos.
    *   **`Button` (con `Link`):** Un botón de "Volver" que redirige al usuario a la ruta `/competitions`, utilizando el icono `ArrowLeft`.
*   **Sección de Equipos Disponibles:**
    *   Un `div` que contiene el título de la sección y la cuadrícula de equipos.
    *   **Título de la Sección:** Un `h2` con el texto "Equipos Disponibles", estilizado con un borde izquierdo y un icono `Search` dentro de un contenedor redondeado.
    *   **`AvailablePostsGrid`:** Este es el componente central para mostrar los equipos. Recibe las siguientes props:
        *   `userId`: El ID del usuario actual.
        *   `userTeams`: Una lista de los equipos a los que pertenece el usuario.
        *   `isActive`: Un booleano (`true`) que indica que la cuadrícula está activa.
    *   **`Alert` (Cargando):** Se muestra si `teams` aún no se ha cargado, indicando "Cargando equipos disponibles...".

**Manejo de Estados de Carga y Errores (UI):**

*   **`Loader2`:** Se muestra un spinner de carga si `userLoading` o `teamsLoading` es `true`.
*   **`Alert` (No logueado):** Si el usuario no está autenticado (`!user`), se muestra una alerta pidiéndole que inicie sesión.
*   **`Alert` (Sin grupo activo):** Si el usuario está logueado pero no tiene un `activeGroupId`, se muestra una alerta pidiéndole que cree o se una a un grupo.

## Hooks, Server Actions y Lógica
Este componente es un cliente de React y utiliza varios hooks para la gestión del estado, la autenticación y la interacción con Firestore. No utiliza Server Actions directamente en este archivo.

*   **`'use client'`**: Declara el componente como un Client Component de Next.js, lo que permite el uso de hooks de React y la interactividad del lado del cliente.
*   **`useUser()` (de `@/firebase`)**:
    *   Hook personalizado para obtener la información del usuario autenticado (`user`) y su estado de carga (`userLoading`).
    *   Es fundamental para determinar si el usuario ha iniciado sesión y para acceder a propiedades como `user.uid` y `user.activeGroupId`.
*   **`useFirestore()` (de `@/firebase`)**:
    *   Hook personalizado que proporciona una instancia del cliente de Firestore, necesaria para realizar consultas a la base de datos.
*   **`useMemo()` (de React)**:
    *   Se utiliza para memorizar la creación del objeto `teamsQuery`.
    *   La consulta se construye solo si `firestore` y `user?.activeGroupId` están disponibles. Esto evita recrear el objeto de consulta en cada renderizado si las dependencias no cambian.
    *   La consulta de Firestore busca documentos en la colección `teams` donde el campo `groupId` coincide con el `user.activeGroupId` del usuario actual.
*   **`useCollection<GroupTeam>(teamsQuery)` (de `@/firebase`)**:
    *   Hook personalizado que escucha en tiempo real los cambios en una colección de Firestore basada en el `teamsQuery` proporcionado.
    *   Devuelve los datos de la colección (`data` renombrado a `teams`) y su estado de carga (`loading` renombrado a `teamsLoading`).
    *   El tipo `GroupTeam` se usa para tipar los documentos recuperados de la colección `teams`.
*   **Lógica de Carga y Renderizado Condicional:**
    *   `const loading = userLoading || teamsLoading;`: Combina los estados de carga del usuario y los equipos para mostrar un único indicador de carga.
    *   La página renderiza condicionalmente:
        *   Un spinner de carga si `loading` es `true`.
        *   Alertas si el usuario no está logueado o no tiene un `activeGroupId`.
        *   El contenido principal de la página (cabecera, botón de volver, sección de equipos) una vez que el usuario está autenticado, tiene un grupo activo y los datos de los equipos se han cargado.
*   **Paso de Props:**
    *   `AvailablePostsGrid` recibe `userId` (del `user` autenticado) y `userTeams` (los equipos obtenidos de Firestore) para mostrar los equipos disponibles de manera relevante para el usuario.