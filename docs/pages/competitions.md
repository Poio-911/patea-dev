# Ruta: /competitions
## Propósito General
Esta ruta sirve como el portal principal para la gestión y exploración de competiciones dentro de un grupo de usuarios. Permite a los usuarios ver y gestionar desafíos amistosos, ligas y copas en las que participan sus equipos. Ofrece funcionalidades para crear nuevas ligas y copas, aceptar o rechazar invitaciones a desafíos, y buscar rivales para partidos amistosos. La página está diseñada para proporcionar una visión general de las actividades competitivas del usuario y facilitar la interacción con ellas.

## Componentes y Estructura
La página `CompetitionsPage` es un componente de cliente (`'use client'`) que organiza la información y las funcionalidades en varias secciones interactivas.

*   **Video Background**: Un video (`/videos/competitions1080.mp4`, `/videos/competitions720.mp4`) se reproduce en bucle como fondo visual, con una superposición blanca para mejorar la legibilidad del contenido.
*   **PageHeader**: Muestra el título "Competiciones" y una descripción, e incluye el componente `InvitationsSheet` para acceder rápidamente a las invitaciones.
*   **Competition Portal - Hero Cards**: Una cuadrícula de tres `CompetitionCard` (Amistosos, Ligas, Copas) actúa como navegación principal y resumen de estado. Cada tarjeta muestra un icono, título, un contador de notificaciones (para amistosos) y estadísticas relevantes, y al hacer clic, cambia la pestaña activa.
*   **Tabs**: Utiliza el componente `Tabs` de Shadcn/ui para organizar el contenido en diferentes categorías: "Amistosos", "Ligas", "Copas" y "Públicas". Aunque la navegación visual se realiza a través de las `CompetitionCard`, internamente se usa `Tabs` para gestionar el estado y el contenido.
    *   **TabsContent "friendly"**:
        *   **Desafíos Pendientes**: Una `Card` que muestra `TeamChallengesList` con las invitaciones pendientes. Incluye un enlace para ver todos los desafíos.
        *   **Postulaciones Activas**: Una `Card` que muestra `MyTeamsAvailability`, permitiendo gestionar la disponibilidad de los equipos del usuario.
        *   **Buscar Rivales**: Una `Card` que contiene `AvailablePostsGrid` para encontrar equipos que buscan partido, con un botón para una "Búsqueda Avanzada".
    *   **TabsContent "leagues"**:
        *   Muestra un encabezado "Torneos de Liga" con una descripción.
        *   Un botón "+ Crear Liga" que abre el `CreateLeagueDialog`.
        *   Una cuadrícula (`grid`) que, cuando hay ligas, renderizará `LeagueCard` para cada liga.
    *   **TabsContent "cups"**:
        *   Muestra un encabezado "Torneos de Copa" con una descripción.
        *   Un botón "+ Crear Copa" que abre el `CreateCupDialog`.
        *   Una cuadrícula (`grid`) que, cuando hay copas, renderizará `CupCard` para cada copa.
    *   **TabsContent "public"**:
        *   Muestra un encabezado "Competiciones Públicas" con una descripción.
        *   Renderiza el componente `PublicCompetitionsBrowser` para explorar competiciones abiertas.
*   **Modales/Dialogs**:
    *   `InvitationsSheet`: Un componente de hoja lateral para gestionar invitaciones.
    *   `CreateLeagueDialog`: Un diálogo para crear nuevas ligas.
    *   `CreateCupDialog`: Un diálogo para crear nuevas copas.
*   **Componentes de UI**: Utiliza una variedad de componentes de Shadcn/ui como `Alert`, `Button`, `Card`, `Badge`, `Loader2` (de `lucide-react`) para la interfaz de usuario.

## Hooks, Server Actions y Lógica
El componente `CompetitionsPage` es un componente de cliente y, por lo tanto, no utiliza Server Actions directamente. Toda la lógica de datos y estado se maneja en el cliente utilizando hooks de React y Firebase.

*   **`useUser()`**: Hook personalizado de Firebase para obtener la información del usuario autenticado (`user`) y su estado de carga (`userLoading`). Es fundamental para determinar si el usuario ha iniciado sesión y si tiene un grupo activo.
*   **`useFirestore()`**: Hook personalizado de Firebase para obtener la instancia de Firestore, necesaria para realizar consultas a la base de datos.
*   **`useState` Hooks**:
    *   `createLeagueOpen`: Booleano para controlar la visibilidad del diálogo `CreateLeagueDialog`.
    *   `createCupOpen`: Booleano para controlar la visibilidad del diálogo `CreateCupDialog`.
    *   `activeTab`: String (`'friendly' | 'leagues' | 'cups' | 'public'`) para controlar la pestaña activa en el componente `Tabs`.
    *   `invitations`: Array de tipo `Invitation` para almacenar las invitaciones pendientes del usuario.
    *   `invitationsLoading`: Booleano para indicar si las invitaciones están siendo cargadas.
*   **`useMemo` Hooks**:
    *   `teamsQuery`: Memoiza la consulta de Firestore para obtener todos los equipos del `activeGroupId` del usuario. Se re-evalúa si `firestore` o `user?.activeGroupId` cambian.
    *   `myTeams`: Filtra los `teams` obtenidos para incluir solo aquellos creados por el `user.uid`. Se re-evalúa si `teams` o `user` cambian.
    *   `myTeamIds`: Extrae los IDs de `myTeams`. Se re-evalúa si `myTeams` cambia.
    *   `leaguesQuery`: Memoiza la consulta de Firestore para obtener todas las ligas del `activeGroupId`. Se re-evalúa si `firestore` o `user?.activeGroupId` cambian.
    *   `cupsQuery`: Memoiza la consulta de Firestore para obtener todas las copas del `activeGroupId`. Se re-evalúa si `firestore` o `user?.activeGroupId` cambian.
    *   `fetchInvitations`: Memoiza una función asíncrona que busca invitaciones pendientes para todos los `myTeamIds`.
        *   Realiza múltiples consultas a Firestore: para cada `teamId` en `myTeamIds`, consulta la subcolección `teams/{teamId}/invitations` donde `type` es `'team_challenge'` y `status` es `'pending'`.
        *   Utiliza `Promise.all` para ejecutar las consultas en paralelo y `flat()` para combinar los resultados.
        *   Actualiza los estados `invitations` e `invitationsLoading`. Se re-evalúa si `firestore` o `myTeamIds` cambian.
*   **`useCollection` Hooks**:
    *   `{ data: teams, loading: teamsLoading } = useCollection<GroupTeam>(teamsQuery)`: Hook personalizado de Firebase que escucha en tiempo real los cambios en la colección de equipos según `teamsQuery`.
    *   `{ data: leagues, loading: leaguesLoading } = useCollection<League>(leaguesQuery)`: Similar para la colección de ligas.
    *   `{ data: cups, loading: cupsLoading } = useCollection<Cup>(cupsQuery)`: Similar para la colección de copas.
*   **`useEffect` Hook**:
    *   Se ejecuta cuando `myTeamIds`, `teamsLoading` o `fetchInvitations` cambian.
    *   Si `myTeamIds` tiene elementos, llama a `fetchInvitations` para obtener las invitaciones.
    *   Si `myTeamIds` está vacío y `teamsLoading` es falso, establece `invitationsLoading` a falso, indicando que no hay equipos y, por lo tanto, no hay invitaciones que cargar.
*   **Lógica de Carga y Errores**:
    *   Muestra un `Loader2` si `userLoading` es verdadero.
    *   Muestra un `Alert` si el usuario no ha iniciado sesión.
    *   Muestra un `Alert` si el usuario no tiene un `activeGroupId`.
    *   Muestra `Loader2` en las secciones de contenido (`TabsContent`) mientras se cargan los datos (`invitationsLoading`, `teamsLoading`, `leaguesLoading`, `cupsLoading`).
*   **Interacción con Firestore**:
    *   Las consultas (`query`, `where`, `collection`) se construyen dinámicamente basadas en el `user.activeGroupId` y los `myTeamIds`.
    *   `getDocs` se utiliza para obtener las invitaciones una sola vez cuando se llama a `fetchInvitations`.
*   **Manejo de Estado de UI**: Los estados `createLeagueOpen`, `createCupOpen` y `activeTab` controlan la visibilidad de los diálogos y el contenido de las pestañas, respectivamente.