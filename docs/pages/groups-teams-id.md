# Ruta: /groups/teams/[id]
## Propósito General
Esta ruta está diseñada para mostrar los detalles de un equipo específico dentro de un grupo. Permite a los usuarios visualizar la información del equipo, su plantilla (jugadores titulares y suplentes), los próximos partidos y el historial de encuentros. Además, ofrece funcionalidades de gestión como la edición y eliminación del equipo, así como la administración de su plantilla, con permisos basados en el rol del usuario dentro del grupo o si es el creador del equipo.

## Componentes y Estructura
La página se organiza en una estructura de `div` principal que contiene varios componentes para presentar la información de manera clara:

*   **Navegación y Encabezado:**
    *   Un `Button` con un `Link` para volver a la página de "Grupos".
    *   `PageHeader`: Muestra el nombre del equipo como título principal.
    *   `JerseyPreview`: Si el equipo tiene un diseño de camiseta (`team.jersey`), se muestra una vista previa.
    *   `Badge`: Muestra el número total de jugadores en el equipo.

*   **Acciones de Gestión (Condicional):**
    *   Un `div` que contiene botones para "Editar Equipo" y "Eliminar Equipo", visibles solo si el usuario tiene permisos (`canEditTeam`).
    *   `Button` para "Editar Equipo" que abre el `EditTeamDialog`.
    *   `AlertDialog`: Componente para confirmar la eliminación del equipo, con `AlertDialogTrigger`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogCancel` y `AlertDialogAction`.

*   **Sección de Partidos y Competiciones (Condicional):**
    *   `Card`: Visible solo para el creador del equipo (`isOwner`).
    *   `CardHeader`, `CardTitle`, `CardDescription`: Título y descripción para la sección.
    *   `Button` con `Link` a la página de "Competiciones".

*   **Próximos Partidos:**
    *   `Card`: Contiene la lista de partidos futuros.
    *   `CardHeader`, `CardTitle`, `CardDescription`: Título y descripción.
    *   `UpcomingMatchesFeed`: Componente que muestra los partidos próximos del equipo.

*   **Plantilla del Equipo - Titulares:**
    *   `Card`: Sección dedicada a los jugadores titulares.
    *   `CardHeader`, `CardTitle`, `CardDescription`: Título y descripción, incluyendo el conteo de titulares.
    *   `ManageRosterDialog`: Botón para "Gestionar Plantel", visible si `canEditTeam`, que abre un diálogo para modificar la plantilla.
    *   `GroupTeamRosterPlayer`: Componente que renderiza cada jugador titular en un `grid`.
    *   `Alert`: Se muestra si no hay titulares definidos.

*   **Plantilla del Equipo - Suplentes:**
    *   `Card`: Sección dedicada a los jugadores suplentes.
    *   `CardHeader`, `CardTitle`, `CardDescription`: Título y descripción, incluyendo el conteo de suplentes.
    *   `GroupTeamRosterPlayer`: Componente que renderiza cada jugador suplente en un `grid`.
    *   (El código proporcionado se corta aquí, pero se asume que también tendría un `Alert` si no hay suplentes).

*   **Componentes de UI Reutilizables:**
    *   `Loader2`: Icono de carga.
    *   `ArrowLeft`, `ShieldCheck`, `UserCheck`, `History`, `Globe`, `Swords`, `Pencil`, `Trash2`: Iconos de Lucide React.
    *   `Separator`: Para dividir secciones.
    *   `Switch`, `Label`: (No se usan directamente en el render final del código proporcionado, pero están importados).
    *   `format` y `es` de `date-fns`: Para formateo de fechas.

## Hooks, Server Actions y Lógica
La página utiliza una combinación de hooks de React, hooks personalizados, hooks de Firebase y Server Actions para gestionar el estado, los datos y las interacciones del usuario.

### Hooks de React y Next.js:
*   `useParams<{ id: string }>()`: Obtiene el `id` del equipo de la URL.
*   `useRouter()`: Permite la navegación programática (ej. después de eliminar un equipo).
*   `useState`:
    *   `isUpdating`: Booleano para indicar si una operación de actualización está en curso (no usado en el código proporcionado para `updateDoc`, pero declarado).
    *   `currentUserRole`: Almacena el rol del usuario actual en el grupo.
    *   `isEditOpen`: Booleano para controlar la visibilidad del diálogo de edición del equipo.
    *   `isDeleting`: Booleano para indicar si la operación de eliminación está en curso.
*   `useEffect`:
    *   Se utiliza para `fetchRole`: Una función asíncrona que se ejecuta cuando `team?.groupId` o `user?.uid` cambian. Llama a la Server Action `getUserRoleInGroupAction` para obtener el rol del usuario en el grupo y lo almacena en `currentUserRole`.
*   `useMemo`:
    *   `teamRef`: Crea una referencia al documento del equipo en Firestore, optimizando su creación. Depende de `firestore` y `teamId`.
    *   `groupPlayersQuery`: Crea una consulta para obtener todos los jugadores del grupo al que pertenece el equipo. Depende de `firestore` y `team?.groupId`.
    *   `groupMatchesQuery`: Crea una consulta para obtener todos los partidos del grupo al que pertenece el equipo. Depende de `firestore` y `team?.groupId`.
    *   `upcomingMatches`, `pastMatches`: Filtra y ordena los partidos del grupo (`allGroupMatches`) para obtener los partidos próximos y pasados relevantes para el equipo actual. Depende de `allGroupMatches` y `team?.name`.
    *   `titulares`, `suplentes`: Procesa la lista de miembros del equipo (`team.members`) y los `groupPlayers` para crear una lista detallada de jugadores (`DetailedTeamPlayer`), separándolos en titulares y suplentes. Depende de `team`, `groupPlayers` y `loading`.

### Hooks de Firebase (`@/firebase`):
*   `useFirestore()`: Obtiene la instancia de Firestore.
*   `useUser()`: Obtiene la información del usuario autenticado.
*   `useDoc<GroupTeam>(teamRef)`: Suscribe y obtiene los datos del documento del equipo en tiempo real. Devuelve `data` (el equipo), `loading` y `error`.
*   `useCollection<Player>(groupPlayersQuery)`: Suscribe y obtiene una colección de jugadores del grupo. Devuelve `data` (los jugadores) y `loading`.
*   `useCollection<Match>(groupMatchesQuery)`: Suscribe y obtiene una colección de partidos del grupo. Devuelve `data` (los partidos) y `loading`.

### Hooks Personalizados:
*   `useToast()`: Proporciona una función `toast` para mostrar notificaciones al usuario.

### Server Actions:
*   `getUserRoleInGroupAction(groupId: string)`: Importada de `@/lib/actions/group-role-actions`. Se utiliza para obtener el rol del usuario actual dentro de un grupo específico, lo cual es crucial para la gestión de permisos.

### Lógica de Base de Datos (Firestore):
*   `doc`, `collection`, `query`, `where`, `updateDoc`, `deleteDoc`: Funciones de `firebase/firestore` para interactuar con la base de datos.
*   **`handleDeleteTeam`**:
    *   Función asíncrona que se encarga de eliminar el documento del equipo de la colección `teams` en Firestore.
    *   Maneja el estado `isDeleting` para deshabilitar el botón durante la operación.
    *   Utiliza `toast` para mostrar mensajes de éxito o error.
    *   Redirige al usuario a `/groups` después de una eliminación exitosa.

### Lógica de Permisos:
*   `isOwner`: Booleano que determina si el usuario actual (`user?.uid`) es el creador del equipo (`team?.createdBy`).
*   `currentUserRole`: Almacena el rol del usuario en el grupo, obtenido a través de `getUserRoleInGroupAction`.
*   `hasPermission(currentUserRole, 'teams.edit')`: Función utilitaria de `@/lib/group-permissions` que verifica si el rol del usuario tiene el permiso específico para editar equipos.
*   `canEditTeam`: Booleano derivado de `isOwner` o `hasPermission`, que controla la visibilidad de las acciones de edición y eliminación.

### Manejo de Estados de Carga y Errores:
*   `loading`: Variable combinada que es `true` si `teamLoading`, `playersLoading` o `matchesLoading` es `true`. Se usa para mostrar un `Loader2` mientras se cargan los datos.
*   Se muestra un mensaje "Equipo no encontrado" si `!team` o `teamError` es `true`, con un botón para volver a la página de grupos.

### Lógica de Datos y Transformación:
*   Los datos de `team`, `groupPlayers` y `allGroupMatches` se obtienen de Firestore.
*   Los partidos se filtran y ordenan en `upcomingMatches` y `pastMatches`.
*   Los miembros del equipo se enriquecen con detalles de `groupPlayers` y se dividen en `titulares` y `suplentes` para su visualización.
*   `memberCount`: Calcula el número total de miembros del equipo.