# Ruta: /competitions/leagues/[id]
## Propósito General
Esta ruta está diseñada para mostrar los detalles de una liga específica. Permite a los usuarios visualizar la clasificación, el calendario de partidos, los equipos participantes, los máximos goleadores y, si son el propietario de la liga, gestionar las solicitudes de equipos. Los propietarios también pueden iniciar, finalizar o eliminar la liga. Además, los usuarios que participan en la liga pueden ver información específica de su equipo, como estadísticas y próximos partidos.

## Componentes y Estructura
El componente principal es `LeagueDetailPage`, que organiza la información en un diseño vertical (`space-y-6`).

-   **Navegación:**
    -   `BackButton`: Permite al usuario regresar a la página general de competiciones.
-   **Encabezado de la Liga:**
    -   `LeagueHeader`: Muestra el nombre y estado de la liga, el organizador, y proporciona la navegación por pestañas (`standings`, `fixture`, `teams`, `scorers`, `applications`, `my-team`). También incluye botones de acción para el propietario (iniciar, finalizar, eliminar liga).
-   **Celebración del Campeón:**
    -   `ChampionCelebration`: Se renderiza condicionalmente si la liga ha finalizado (`league.status === 'completed'`) y tiene un campeón definido, mostrando el nombre y la camiseta del campeón y subcampeón.
-   **Contenido por Pestañas (renderizado condicional):**
    -   `MyTeamView`: Visible en la pestaña 'my-team' si el usuario pertenece a un equipo en la liga. Muestra estadísticas del equipo del usuario, su próximo partido y su forma reciente.
    -   `LeagueStandingsTable`: Muestra la tabla de clasificación de la liga en la pestaña 'standings'.
    -   `LeagueFixture`: Presenta el calendario de partidos de la liga, agrupados por ronda, en la pestaña 'fixture'. Permite al propietario editar partidos.
    -   `LeagueTopScorers`: Muestra una lista de los máximos goleadores de la liga en la pestaña 'scorers'.
    -   **Lista de Equipos:** En la pestaña 'teams', se utiliza un `Card` para envolver una cuadrícula de `Card`s individuales, cada una mostrando el nombre del equipo y una `JerseyPreview`.
    -   `ApplicationsManager`: Visible en la pestaña 'applications' solo para el propietario de la liga, permitiendo gestionar las solicitudes de equipos.
-   **Diálogos Modales:**
    -   `MatchScheduleDialog`: Se abre para editar los detalles de un partido específico cuando `editingMatch` tiene un valor.
    -   `AlertDialog` (componente `ResponsiveAlertDialog` y sus subcomponentes):
        -   **Diálogo de Inicio de Liga:** Confirma la acción de iniciar la liga.
        -   **Diálogo de Finalización de Liga:** Confirma la acción de finalizar la liga.
        -   **Diálogo de Eliminación de Liga:** Solicita confirmación para eliminar la liga y sus datos asociados.
-   **Indicadores de Carga y Errores:**
    -   `Loader2`: Se muestra durante la carga inicial de datos de la liga o partidos.
    -   Mensaje "Liga no encontrada": Se muestra si no se encuentra la liga con el `id` proporcionado.
-   **Componentes UI:** Utiliza componentes de `@/components/ui` como `Button`, `Link`, `Alert`, `Card`, `JerseyPreview`, y `ResponsiveAlertDialog` para una interfaz consistente.

## Hooks, Server Actions y Lógica

### Hooks
-   **Next.js Hooks:**
    -   `useParams()`: Extrae el `id` de la liga de la URL dinámica.
    -   `useRouter()`: Se utiliza para la navegación programática, por ejemplo, después de eliminar una liga.
-   **React Hooks:**
    -   `useState`:
        -   `activeTab`: Controla la pestaña activa (`'standings'`, `'fixture'`, etc.).
        -   `editingMatch`: Almacena el objeto `Match` que se está editando en el `MatchScheduleDialog`.
        -   `showStartDialog`, `showCompleteDialog`, `showDeleteDialog`: Controlan la visibilidad de los diálogos de confirmación.
        -   `isUpdatingStatus`: Un booleano para deshabilitar botones y mostrar un spinner durante las operaciones de actualización de estado.
    -   `useMemo`: Optimiza cálculos y referencias de objetos para evitar re-renderizados innecesarios.
        -   `leagueRef`, `organizerRef`, `matchesQuery`, `teamsQuery`: Crean referencias y consultas de Firestore de forma eficiente.
        -   `standings`: Calcula la clasificación de la liga a partir de los partidos completados y los equipos.
        -   `userTeam`: Identifica el equipo del usuario actual dentro de la liga.
        -   `userTeamStats`: Obtiene las estadísticas del equipo del usuario de la clasificación calculada.
        -   `userNextMatch`: Encuentra el próximo partido del equipo del usuario.
        -   `userRecentForm`: Calcula la forma reciente (W/L/D) del equipo del usuario a partir de los últimos 5 partidos completados.
        -   `currentRound`: Determina la ronda actual de la liga.
-   **Firebase Hooks (`@/firebase`):**
    -   `useFirestore()`: Proporciona la instancia de Firestore.
    -   `useUser()`: Obtiene el objeto del usuario autenticado actualmente.
    -   `useDoc<League>(leagueRef)`: Suscribe y obtiene los datos de la liga.
    -   `useDoc<any>(organizerRef)`: Suscribe y obtiene los datos del organizador (usuario).
    -   `useCollection<Match>(matchesQuery)`: Suscribe y obtiene la colección de partidos de la liga.
    -   `useCollection<GroupTeam>(teamsQuery)`: Suscribe y obtiene la colección de equipos participantes.
-   **Custom Hooks:**
    -   `useToast()`: Para mostrar notificaciones de éxito o error al usuario.

### Server Actions (`@/lib/actions/server-actions`)
-   `updateLeagueStatusAction(leagueId, status)`:
    -   **`handleStartLeague`**: Llama a esta acción para cambiar el estado de la liga a `'in_progress'`. Muestra un `toast` de éxito o error.
    -   **`handleCompleteLeague`**: Llama a esta acción para cambiar el estado de la liga a `'completed'`. Muestra un `toast` de éxito o error.
-   `deleteLeagueAction(leagueId)`:
    -   **`handleDeleteLeague`**: Llama a esta acción para eliminar la liga y todos sus partidos asociados. Muestra un `toast` de éxito o error y redirige al usuario a la página de competiciones si tiene éxito.

### Lógica
-   **Carga de Datos:** La página gestiona la carga de datos de la liga, el organizador, los partidos y los equipos utilizando los hooks de Firebase. Muestra un spinner de carga (`Loader2`) mientras los datos están pendientes.
-   **Manejo de Liga No Encontrada:** Si la liga no se encuentra después de la carga, se muestra un mensaje de error y un botón para volver.
-   **Permisos de Propietario:** La variable `isOwner` (`user?.uid === league?.ownerUid`) se utiliza para controlar la visibilidad de las acciones administrativas (iniciar, finalizar, eliminar liga, gestionar aplicaciones, editar partidos) y ciertas pestañas.
-   **Gestión de Estado de la Liga:**
    -   Los diálogos de confirmación (`AlertDialog`) se utilizan para las acciones críticas de iniciar, finalizar y eliminar la liga.
    -   Las funciones `handleStartLeague`, `handleCompleteLeague` y `handleDeleteLeague` interactúan con las Server Actions correspondientes y gestionan los estados de carga (`isUpdatingStatus`) y las notificaciones (`toast`).
-   **Edición de Partidos:** La función `handleEditMatch` actualiza el estado `editingMatch`, lo que provoca la apertura del `MatchScheduleDialog` con los datos del partido seleccionado.
-   **Cálculos Derivados:**
    -   `calculateLeagueStandings`: Una función de utilidad que procesa los partidos completados y los equipos para generar la tabla de clasificación.
    -   `getCurrentRound`: Una función de utilidad que determina la ronda actual de la liga basándose en los partidos.
-   **Información del Equipo del Usuario:** Se implementa lógica para identificar si el usuario actual pertenece a un equipo en la liga y, en ese caso, calcular y mostrar estadísticas relevantes para ese equipo.
-   **Renderizado Condicional:** El contenido de la página se adapta dinámicamente según la pestaña activa, el estado de la liga y los permisos del usuario.