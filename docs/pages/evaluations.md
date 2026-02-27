# Ruta: /evaluations
## Propósito General
Esta ruta sirve como un panel de control centralizado para que los usuarios gestionen y visualicen sus actividades de evaluación. Permite a los usuarios ver las evaluaciones que tienen pendientes de completar, el progreso de las evaluaciones en las que han participado, y responder a solicitudes de revelación de identidad de otros jugadores que desean saber quién los evaluó. En resumen, es el centro de operaciones para todas las interacciones del usuario relacionadas con el sistema de evaluación.

## Componentes y Estructura
La página `EvaluationsPage` es el componente principal que orquesta la visualización de las evaluaciones y solicitudes.

-   **`EvaluationsPage`**:
    -   Utiliza `PageHeader` para el título de la página.
    -   Emplea `Tabs` (`TabsList`, `TabsTrigger`, `TabsContent`) para organizar el contenido en dos secciones principales: "Pendientes" (para evaluaciones) y "Solicitudes de Identidad".
    -   Muestra `Alert` para mensajes informativos o de estado.
    -   Utiliza `Skeleton` para indicar estados de carga mientras se recuperan los datos.
    -   Renderiza `Card` para agrupar información de manera visual.
    -   Para las evaluaciones pendientes/completadas:
        -   `MatchEventCard`: Componente para mostrar detalles de un partido.
        -   `GamerProgress`: Para visualizar el progreso de las asignaciones de evaluación.
        -   `Progress`: Barra de progreso para el estado general de la evaluación.
        -   `Button` y `Link`: Para navegar a las páginas de edición o visualización de evaluaciones.
    -   Para las solicitudes de identidad:
        -   `IdentityRevealRequestCard`: Un componente hijo específico para mostrar y gestionar cada solicitud de revelación de identidad.
    -   **Diálogos Modales**:
        -   `FirstTimeInfoDialog`: Posiblemente para guiar a nuevos usuarios.
        -   `MatchTeamsDialog`: Para ver los equipos de un partido.
        -   `ViewSubmissionDialog`: Para ver una evaluación ya enviada.
        -   `AttributesHelpDialog`: Para proporcionar ayuda sobre los atributos de evaluación.
    -   **Elementos UI Adicionales**: `Avatar`, `Badge`, `Loader2` (para estados de carga), iconos de `lucide-react` (`ShieldQuestion`, `Calendar`, `Edit`, `Eye`, `FileClock`, `Users`, `MapPin`, `UsersRound`, `Check`, `EyeOff`).

-   **`IdentityRevealRequestCard`**:
    -   Un componente funcional que recibe una solicitud de identidad (`request`) y una función `onResponded`.
    -   Muestra la foto y el nombre del jugador que solicita la revelación, junto con el título del partido.
    -   Ofrece dos botones (`Mantener anonimato` y `Revelar identidad`) para que el usuario responda a la solicitud.
    -   Maneja estados de carga (`loading`) y muestra un spinner (`Loader2`) mientras se procesa la respuesta.
    -   Utiliza `Avatar`, `Button`, y clases de estilo para su presentación.

## Hooks, Server Actions y Lógica
La página `EvaluationsPage` y sus componentes utilizan una combinación de hooks de React, hooks personalizados de Firebase, y Server Actions para gestionar el estado, la interacción con la base de datos y la lógica de negocio.

### Hooks de Estado y Efecto
-   **`useState`**:
    -   `pendingItems`: Almacena una lista de objetos `PendingItem`, que representan los partidos con asignaciones de evaluación pendientes o completadas por el usuario.
    -   `isLoadingItems`: Booleano que indica si se están cargando los `pendingItems`.
    -   `identityRequests`: Almacena una lista de objetos `IdentityRevealRequest`, que son las solicitudes de otros jugadores para que el usuario revele su identidad como evaluador.
    -   `isLoadingRequests`: Booleano que indica si se están cargando las `identityRequests`.
    -   `loading` (dentro de `IdentityRevealRequestCard`): Controla el estado de carga de los botones de respuesta a la solicitud de identidad.
-   **`useEffect`**:
    -   **Carga y Procesamiento de Evaluaciones (`pendingItems`)**:
        -   Se ejecuta cuando `userAssignments`, `firestore`, `user`, `assignmentsLoading` o `userLoading` cambian.
        -   **Fase 1 (Inicial)**:
            -   Obtiene las asignaciones pendientes (`userAssignments`) y completadas del usuario (`collectionGroup('assignments')`, `where('evaluatorId', '==', user.uid)`, `where('status', '==', 'completed')`).
            -   Obtiene las entregas de evaluación del usuario (`collection('evaluationSubmissions')`, `where('evaluatorId', '==', user.uid)`).
            -   Identifica todos los `matchId` relevantes (donde el usuario tiene asignaciones pendientes, completadas o entregas).
            -   Filtra "Ghost Matches": Solo incluye partidos donde el usuario tiene asignaciones o entregas, evitando mostrar partidos con 0/0.
        -   **Fase 2 (Detalle de Partidos y Entregas)**:
            -   Recupera los documentos `Match` correspondientes a los `matchId` relevantes.
            -   Recupera las `processedSubmissions` del usuario para cada partido.
            -   Construye la lista `pendingItems` con la información agregada.
            -   Ordena `pendingItems` por fecha del partido (más reciente primero).
        -   **Fase 3 (Actualizaciones en Tiempo Real)**:
            -   Para cada `PendingItem` que aún no tiene una entrega de evaluación (`submission`), establece un listener `onSnapshot` en la subcolección `assignments` del partido (`collection(firestore, 'matches', item.match.id, 'assignments')`).
            -   Este listener actualiza en tiempo real el `totalAssignments` y `completedAssignments` para ese partido, reflejando el progreso de la evaluación.
            -   Devuelve una función de limpieza para desuscribirse de estos listeners cuando el componente se desmonta o las dependencias cambian.
    -   **Carga de Solicitudes de Revelación de Identidad (`identityRequests`)**:
        -   Se ejecuta cuando `user` o `firestore` cambian.
        -   Consulta la colección `evaluations` para encontrar documentos donde el `evaluatorId` sea el usuario actual y `identityRequestStatus` sea 'pending'.
        -   Para cada evaluación encontrada, realiza consultas adicionales (`getDoc`) para obtener los detalles del `player` (solicitante) y el `match` asociado, enriqueciendo así el objeto `IdentityRevealRequest`.
        -   Actualiza el estado `identityRequests` con los datos enriquecidos.

### Hooks Personalizados y de Librería
-   **`useUser()` (de `@/firebase`)**: Proporciona el objeto `user` autenticado y el estado de carga (`userLoading`).
-   **`useFirestore()` (de `@/firebase`)**: Proporciona la instancia de `firestore` para interactuar con la base de datos.
-   **`useCollection<EvaluationAssignment>(userAssignmentsQuery)` (de `@/firebase`)**: Un hook personalizado que escucha en tiempo real los cambios en la colección de asignaciones pendientes del usuario, devolviendo los datos (`userAssignments`) y el estado de carga (`assignmentsLoading`).
-   **`useMemo`**:
    -   `userAssignmentsQuery`: Memoiza la construcción del objeto `Query` para las asignaciones pendientes del usuario, asegurando que solo se recalcule cuando `firestore` o `user?.uid` cambien.
-   **`useCallback`**:
    -   `handleRequestResponded`: Memoiza la función que se llama cuando se responde a una solicitud de identidad, filtrando la solicitud de la lista `identityRequests`.
-   **`useToast()` (de `@/hooks/use-toast`)**: Proporciona la función `toast` para mostrar notificaciones al usuario.

### Server Actions
-   **`respondToIdentityRevealAction(evaluationId, userId, response)`**:
    -   Importada de `@/lib/actions/evaluation-actions`.
    -   Es invocada por el componente `IdentityRevealRequestCard` cuando el usuario acepta o rechaza una solicitud de revelación de identidad.
    -   Esta acción se encarga de actualizar el estado de la evaluación en la base de datos (Firestore) y posiblemente de notificar al jugador solicitante.
    -   Maneja la lógica de negocio en el servidor, como la actualización del estado `identityRequestStatus` de la evaluación.

### Lógica de Base de Datos (Firestore)
-   **Consultas de Colección y Grupo de Colecciones**:
    -   `collectionGroup(firestore, 'assignments')`: Utilizado para consultar asignaciones en todas las subcolecciones `assignments` de los documentos `matches`.
    -   `collection(firestore, 'evaluationSubmissions')`: Para obtener las entregas de evaluación del usuario.
    -   `collection(firestore, 'matches')`: Para obtener los detalles de los partidos.
    -   `collection(firestore, 'evaluations')`: Para obtener las evaluaciones que tienen solicitudes de identidad pendientes.
    -   `collection(firestore, 'players')`: Para obtener los detalles de los jugadores.
-   **Filtros (`where`)**: Ampliamente utilizado para filtrar documentos por `evaluatorId`, `status`, `matchId`, `identityRequestStatus`, y `__name__` (para consultar documentos por ID).
-   **Lecturas (`getDocs`, `getDoc`)**: Se utilizan para obtener datos una sola vez. `Promise.all` se usa para ejecutar múltiples lecturas en paralelo y mejorar el rendimiento.
-   **Listeners en Tiempo Real (`onSnapshot`)**: Se utilizan para mantener el progreso de las asignaciones de evaluación actualizado en la UI sin necesidad de recargar la página.

### Lógica de Negocio Adicional
-   **`isRealUser`**: Función auxiliar para determinar si un `Player` es un usuario real (su `id` coincide con su `ownerUid`).
-   **`format`, `subDays`, `isBefore` (de `date-fns`)**: Utilizadas para formatear fechas y realizar comparaciones de fechas, por ejemplo, para mostrar la fecha del partido o filtrar por antigüedad.
-   **`cn` (de `@/lib/utils`)**: Función utilitaria para construir cadenas de clases CSS condicionalmente.
-   **Manejo de Errores**: Se utilizan bloques `try...catch` y `toast` para informar al usuario sobre posibles errores durante las operaciones de red o base de datos.
-   **Optimización**: El código intenta optimizar las consultas a Firestore agrupando `matchIds` y usando `Promise.all` para reducir el número de viajes de ida y vuelta al servidor. La lógica de `onSnapshot` se aplica selectivamente solo a los partidos que aún no han sido completamente evaluados por el usuario.