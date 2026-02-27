# Ruta: /competitions/challenge-team/[postId]
## Propósito General
Esta ruta permite a un usuario autenticado desafiar a un equipo que ha publicado su disponibilidad para un partido amistoso. El usuario puede ver los detalles de la postulación del equipo rival y seleccionar uno de sus propios equipos para enviar el desafío. Una vez confirmado, se crea un nuevo partido amistoso y el usuario es redirigido a la página de dicho partido.

## Componentes y Estructura
El componente principal `ChallengeTeamPage` organiza la interfaz de usuario en varias secciones:

*   **Encabezado de Página:** Utiliza `PageHeader` para mostrar el título "Seleccionar Tu Equipo" y una descripción. Incluye un botón `Volver` (`Button` con `Link`) para regresar a la página de competiciones.
*   **Detalles del Equipo a Desafiar:** Presentado dentro de un `Card` con `CardHeader` y `CardContent`.
    *   Muestra el nombre del equipo (`CardTitle`), su jersey (`JerseyPreview`), y una `Badge` indicándolo como "Rival".
    *   Detalla la ubicación (`MapPin`), fecha (`Calendar`) y hora (`Clock`) del partido propuesto, utilizando `format` de `date-fns` para la fecha.
*   **Listado de Equipos del Usuario:**
    *   Un título `Tus Equipos` introduce la sección.
    *   Si el usuario tiene equipos (`myTeams`), se muestran en un diseño de cuadrícula (`grid grid-cols-1 md:grid-cols-2`) utilizando `Card` para cada equipo.
        *   Cada `Card` muestra el jersey (`JerseyPreview`), nombre (`CardTitle`) y número de jugadores (`CardDescription`) del equipo.
        *   Un `Badge` indica el equipo actualmente `Seleccionado`.
        *   Las tarjetas son interactivas (`cursor-pointer`) y visualmente resaltan el equipo seleccionado (`ring-2 ring-primary`).
    *   Si el usuario no tiene equipos, se muestra un `Alert` informativo con un `Link` para crear un nuevo equipo.
*   **Botones de Acción:** Ubicados al final de la página.
    *   `Cancelar`: Un `Button` con `Link` para volver a `/competitions`.
    *   `Confirmar Desafío`: Un `Button` grande que inicia el proceso de desafío. Muestra un `Loader2` y texto "Creando Partido..." cuando el desafío está en curso. Está deshabilitado si no se ha seleccionado un equipo o si el desafío ya está en progreso.
*   **Diálogo de Código de Conducta:** Implementado con `ResponsiveAlertDialog` y sus subcomponentes.
    *   Aparece antes de confirmar el desafío para recordar al usuario las normas de respeto y juego limpio.
    *   Contiene un `AlertDialogTitle`, `AlertDialogDescription` con una lista de puntos, y `AlertDialogFooter` con opciones para `Cancelar` o `Aceptar y Desafiar`.
*   **Estados de Carga y Error:**
    *   Un `Loader2` animado se muestra en el centro de la pantalla mientras se cargan los datos iniciales (`loading || teamsLoading`).
    *   Si no se puede cargar el usuario o la postulación, se muestra un `Alert` de error con un botón para `Volver`.

## Hooks, Server Actions y Lógica
El componente `ChallengeTeamPage` utiliza una combinación de hooks de React, hooks de Next.js, hooks personalizados de Firebase y Server Actions para gestionar el estado, la interacción con el usuario y la comunicación con el backend.

*   **Hooks de Next.js:**
    *   `useParams<{ postId: string }>()`: Obtiene el `postId` de la URL dinámica.
    *   `useRouter()`: Permite la navegación programática después de un desafío exitoso.
*   **Hooks de Firebase (personalizados):**
    *   `useUser()`: Proporciona el objeto `user` del usuario autenticado.
    *   `useFirestore()`: Proporciona una instancia de la base de datos Firestore.
    *   `useCollection<GroupTeam>(myTeamsQuery)`: Escucha en tiempo real una colección de Firestore. Se utiliza para obtener los equipos del usuario (`myTeams`) y su estado de carga (`teamsLoading`).
*   **Hooks de React:**
    *   `useState`:
        *   `post`: Almacena los detalles de la postulación del equipo a desafiar (`TeamAvailabilityPost`).
        *   `loading`: Booleano que indica si la postulación inicial está cargando.
        *   `challenging`: Booleano que indica si la acción de desafiar está en curso.
        *   `selectedTeamId`: Almacena el ID del equipo del usuario seleccionado para el desafío.
        *   `showCodeOfConduct`: Booleano que controla la visibilidad del `AlertDialog`.
    *   `useEffect`:
        *   Se ejecuta cuando `postId`, `user?.uid` o `toast` cambian.
        *   Llama a la Server Action `getAvailableTeamPostsAction(user.uid)` para obtener todas las postulaciones disponibles.
        *   Filtra los resultados para encontrar la postulación específica (`postId`).
        *   Actualiza el estado `post` y `loading`.
        *   Maneja errores mostrando `toast` destructivos.
    *   `useMemo`:
        *   `myTeamsQuery`: Memoiza la consulta de Firestore para obtener los equipos del usuario. La consulta se construye solo si `firestore` y `user?.uid` están disponibles, buscando equipos donde `createdBy` coincida con el `uid` del usuario.
*   **Hooks personalizados:**
    *   `useToast()`: Proporciona la función `toast` para mostrar notificaciones al usuario.
*   **Server Actions (`@/lib/actions/server-actions`):**
    *   `getAvailableTeamPostsAction(user.uid)`:
        *   **Propósito:** Recupera una lista de todas las postulaciones de equipos disponibles para ser desafiados por el usuario actual.
        *   **Uso:** Llamada dentro de `useEffect` para cargar los datos del `post` específico.
        *   **Retorno:** Un objeto con una propiedad `posts` (un array de `TeamAvailabilityPost`) o una propiedad `error`.
    *   `challengeTeamPostAction(postId: string, selectedTeamId: string, userId: string)`:
        *   **Propósito:** Procesa la lógica para crear un nuevo partido amistoso entre el equipo desafiado (`postId`) y el equipo del usuario (`selectedTeamId`).
        *   **Uso:** Llamada en la función `handleConfirmChallenge`.
        *   **Retorno:** Un objeto con una propiedad `matchId` (el ID del partido creado) en caso de éxito, o una propiedad `error` en caso de fallo.
*   **Lógica de Negocio y Manejo de Eventos:**
    *   **`handleInitiateChallenge()`:**
        *   Verifica si `selectedTeamId` tiene un valor. Si no, muestra un `toast` de advertencia.
        *   Si hay un equipo seleccionado, establece `showCodeOfConduct(true)` para abrir el diálogo de confirmación.
    *   **`handleConfirmChallenge()`:**
        *   Se ejecuta cuando el usuario acepta el Código de Conducta.
        *   Establece `challenging(true)` para mostrar un estado de carga en el botón.
        *   Llama a `challengeTeamPostAction` con los IDs necesarios.
        *   En caso de éxito:
            *   Activa la animación `celebrationConfetti()`.
            *   Muestra un `toast` de éxito.
            *   Redirige al usuario a la página del partido recién creado (`/matches/[matchId]`) o a `/competitions` si no se devuelve un `matchId`.
        *   En caso de error:
            *   Muestra un `toast` destructivo con el mensaje de error.
        *   Finalmente, establece `challenging(false)`.
    *   **Manejo de Errores y Carga:**
        *   Se utilizan bloques `try-catch` para manejar errores en las llamadas a Server Actions, mostrando mensajes al usuario a través de `useToast`.
        *   El componente renderiza un spinner de carga (`Loader2`) mientras `loading` o `teamsLoading` son `true`.
        *   Si `user` o `post` no están disponibles después de la carga, se muestra un `Alert` de error.
    *   **Validación:** Se verifica la existencia de `user?.uid` y `postId` antes de intentar cargar datos o realizar acciones.
    *   **Formato de Fecha:** Se utiliza `date-fns` con el locale `es` para formatear la fecha de la postulación de manera legible.