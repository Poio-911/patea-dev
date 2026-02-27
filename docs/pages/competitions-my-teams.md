# Ruta: /competitions/my-teams
## Propósito General
Esta ruta está diseñada para que los usuarios gestionen las postulaciones de sus equipos para partidos amistosos. Permite visualizar los equipos asociados al grupo activo del usuario y gestionar su disponibilidad. La página también maneja la autenticación del usuario y la verificación de la membresía a un grupo antes de mostrar el contenido principal.

## Componentes y Estructura
El componente `MyTeamsPage` es un cliente (`'use client'`) y organiza su contenido en una estructura flexible con un encabezado y una sección principal de gestión de equipos.

-   **`PageHeader`**: Componente principal para el título de la página ("Mis Equipos") y una descripción ("Gestioná las postulaciones de tus equipos para partidos amistosos").
    -   **`InvitationsSheet`**: Renderizado como un hijo de `PageHeader`, probablemente un componente para gestionar invitaciones relacionadas con los equipos o el grupo.
-   **`Button` (shadcn/ui)**: Utilizado para la navegación.
    -   **`Link` (Next.js)**: Envuelve el botón para proporcionar navegación a la ruta `/competitions`, permitiendo al usuario volver a la página anterior.
    -   **`ArrowLeft` (lucide-react)**: Icono que acompaña al botón "Volver".
-   **`Alert` y `AlertDescription` (shadcn/ui)**: Utilizados para mostrar mensajes informativos o de error al usuario, como la necesidad de iniciar sesión, unirse a un grupo o la ausencia de equipos.
-   **`Loader2` (lucide-react)**: Un icono de spinner que se muestra durante los estados de carga de datos.
-   **`Users` (lucide-react)**: Icono utilizado en las alertas y en el encabezado de la sección "Postular Equipos".
-   **`MyTeamsAvailability`**: El componente central que recibe la lista de equipos (`teams`), el ID del usuario (`userId`) y un estado de actividad (`isActive`) para mostrar y gestionar la disponibilidad de los equipos.

La estructura general es un `div` principal con `flex flex-col gap-8`, que contiene:
1.  Un `div` para el encabezado de la página y el botón de "Volver".
2.  Un `div` para la sección de "Postular Equipos", que incluye un título estilizado y el componente `MyTeamsAvailability` o un mensaje de alerta/carga.

## Hooks, Server Actions y Lógica
Este componente es un cliente (`'use client'`) y utiliza varios hooks para la gestión de estado, datos y lógica de negocio.

-   **`useUser()`**: Un hook personalizado (presumiblemente de `@/firebase`) que proporciona el objeto `user` autenticado y un estado de carga (`userLoading`).
-   **`useFirestore()`**: Un hook personalizado (presumiblemente de `@/firebase`) que proporciona una instancia del cliente de Firestore.
-   **`useCollection<GroupTeam>(teamsQuery)`**: Un hook personalizado (presumiblemente de `@/firebase`) que se suscribe a una colección de Firestore basada en una consulta (`teamsQuery`) y devuelve los datos (`teams`) y un estado de carga (`teamsLoading`).
-   **`useMemo`**: Se utiliza para memoizar la creación de la consulta de Firestore (`teamsQuery`).
    -   La consulta se construye solo si `firestore` y `user?.activeGroupId` están disponibles.
    -   La consulta busca documentos en la colección `teams` donde el campo `groupId` coincide con el `activeGroupId` del usuario, asegurando que solo se recuperen los equipos del grupo activo del usuario.
-   **Gestión de Estados de Carga**:
    -   Se define una variable `loading` que es `true` si `userLoading` o `teamsLoading` es `true`.
    -   Si `loading` es `true`, se renderiza un `Loader2` centrado.
-   **Renderizado Condicional por Estado del Usuario/Grupo**:
    -   Si `!user` (el usuario no ha iniciado sesión), se muestra una `Alert` pidiéndole que inicie sesión.
    -   Si `!user.activeGroupId` (el usuario no tiene un grupo activo), se muestra una `Alert` pidiéndole que cree o se una a un grupo.
-   **Renderizado de Equipos**:
    -   Si `teamsLoading` es `true`, se muestra un `Loader2`.
    -   Si `teams` existe (hay equipos), se renderiza el componente `MyTeamsAvailability`, pasándole los `teams` recuperados, el `user.uid` y `isActive={true}`.
    -   Si `teams` es nulo o vacío después de la carga, se muestra una `Alert` indicando que no hay equipos disponibles.
-   **Interacción con la Base de Datos**:
    -   La lógica de la página interactúa con Firestore para leer la colección `teams`, filtrando por el `groupId` del usuario activo.
-   **No se utilizan Server Actions** directamente en este componente, ya que es un componente cliente y la interacción con la base de datos se realiza a través de los hooks de Firebase del lado del cliente.