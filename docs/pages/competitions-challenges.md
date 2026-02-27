# Ruta: /competitions/challenges
## Propósito General
Esta página está diseñada para que los usuarios gestionen los desafíos de equipo que han recibido. Muestra una lista de desafíos pendientes dirigidos a los equipos creados por el usuario actual dentro de su grupo activo. La página maneja la autenticación del usuario, la pertenencia a grupos y la existencia de equipos para mostrar la información relevante o mensajes de orientación.

## Componentes y Estructura
La página se estructura como un contenedor flexible vertical (`flex flex-col gap-8`) y presenta las siguientes secciones y componentes:

*   **Manejo de Estados Iniciales (Early Exits):**
    *   Si `userLoading` es verdadero, muestra un `Loader2` giratorio.
    *   Si el usuario no está autenticado (`!user`), muestra un `Alert` pidiéndole que inicie sesión.
    *   Si el usuario no tiene un `activeGroupId`, muestra un `Alert` pidiéndole que cree o se una a un grupo.

*   **Cabecera de la Página:**
    *   Un `div` que contiene `PageHeader` y un botón de navegación.
    *   `PageHeader`: Muestra el título "Desafíos Recibidos" y una descripción.
        *   Incluye `InvitationsSheet` como componente hijo, que probablemente gestiona otras invitaciones.
    *   `Button` (como `Link`): Un botón "Volver" (`ArrowLeft`) que redirige a `/competitions`.

*   **Sección de Desafíos Pendientes:**
    *   Un `div` que contiene un encabezado estilizado y la lista de desafíos.
    *   `h2` con un icono `Bell`: Titulado "Desafíos Pendientes", resaltado con un borde `border-l-destructive`.
    *   **Contenido Condicional:**
        *   **Estado de Carga:** Si `invitationsLoading` o `teamsLoading` son verdaderos, muestra un `div` con varios componentes `Skeleton` para indicar que se está cargando el contenido.
        *   **Desafíos Disponibles:** Si `userTeam` existe y `invitations` están disponibles, renderiza el componente `TeamChallengesList`.
            *   Recibe `invitations`, `teamId` (del equipo del usuario), `userId` y una función `onUpdate` (para refrescar los desafíos).
        *   **Sin Equipos Creados:** Si `userTeam` no existe (el usuario no ha creado equipos), muestra un `Alert` indicando que debe crear un equipo para recibir desafíos.

*   **Componentes Importados:**
    *   `PageHeader` (componente de UI personalizado)
    *   `Link` (de Next.js para navegación)
    *   `Button`, `Alert`, `AlertDescription`, `Skeleton` (componentes de UI de Shadcn/ui o similares)
    *   `Loader2`, `Users`, `Bell`, `ArrowLeft` (iconos de Lucide React)
    *   `InvitationsSheet` (componente para gestionar invitaciones)
    *   `TeamChallengesList` (componente para mostrar la lista de desafíos de equipo)

## Hooks, Server Actions y Lógica
La página es un componente de cliente (`'use client'`) y utiliza varios hooks de React y hooks personalizados de Firebase para gestionar el estado y la interacción con la base de datos.

*   **Hooks de Estado y Contexto:**
    *   `useUser()`: Hook personalizado de `@/firebase` para obtener el objeto `user` autenticado y su estado de carga (`userLoading`).
    *   `useFirestore()`: Hook personalizado de `@/firebase` para obtener la instancia de Firestore (`firestore`).
    *   `useCollection<GroupTeam>(teamsQuery)`: Hook personalizado de `@/firebase` para escuchar en tiempo real una colección de documentos de Firestore. Retorna los datos (`teams`) y el estado de carga (`teamsLoading`) para los equipos del usuario.
    *   `useState<Invitation[]>([]), useState(true)`: Para gestionar el estado de las invitaciones (`invitations`) y su estado de carga (`invitationsLoading`).

*   **Lógica de Consulta de Datos (Firestore):**
    *   **`teamsQuery` (con `useMemo`):**
        *   Crea una consulta memoizada para obtener los equipos del usuario.
        *   Depende de `firestore` y `user?.activeGroupId`.
        *   Consulta la colección `teams` donde `groupId` coincide con el `activeGroupId` del usuario.
    *   **`fetchInvitations` (con `useMemo`):**
        *   Define una función asíncrona memoizada para buscar invitaciones pendientes de desafíos de equipo.
        *   Depende de `firestore`, `teams` y `user`.
        *   **Pasos:**
            1.  Identifica los `userTeamIds` (IDs de los equipos creados por el usuario actual).
            2.  Si no hay equipos creados por el usuario, establece las invitaciones como vacías y finaliza la carga.
            3.  Para cada `userTeamId`, construye una consulta anidada:
                *   `collection(firestore, 'teams', teamId, 'invitations')`
                *   `where('type', '==', 'team_challenge')`
                *   `where('status', '==', 'pending')`
            4.  Ejecuta `getDocs` para cada consulta de invitación.
            5.  Combina todos los resultados en un solo array de `Invitation[]`.
            6.  Maneja los estados de carga (`setInvitationsLoading`) y posibles errores.

*   **`useEffect`:**
    *   Ejecuta `fetchInvitations()` cuando la función `fetchInvitations` cambia (lo que ocurre si sus dependencias `firestore`, `teams` o `user` cambian). Esto asegura que las invitaciones se carguen o se actualicen dinámicamente.

*   **Server Actions:**
    *   No se utilizan Server Actions explícitamente en este componente de cliente. Toda la interacción con la base de datos se realiza a través del SDK de cliente de Firebase.

*   **Tipos de Datos:**
    *   Importa `GroupTeam` e `Invitation` de `@/lib/types` para tipar correctamente los datos obtenidos de Firestore.