# Ruta: /invitations
## Propósito General
Esta ruta permite a los usuarios autenticados visualizar y gestionar sus invitaciones a partidos. Los usuarios pueden ver las invitaciones pendientes y tienen la opción de aceptarlas o rechazarlas. También pueden revisar las invitaciones a las que ya han respondido (aceptadas o rechazadas).

## Componentes y Estructura
El componente principal `InvitationsPage` organiza la interfaz de usuario de la siguiente manera:

*   **`PageHeader`**: Muestra el título "Invitaciones" y una descripción dinámica que indica el número de invitaciones pendientes o un mensaje general si no hay ninguna.
*   **Carga y Acceso Denegado**:
    *   Un spinner `Loader2` se muestra mientras se carga la información del usuario o las invitaciones pendientes.
    *   Una `Alert` se renderiza si el usuario no está autenticado, indicando que el acceso está denegado.
*   **Invitaciones Pendientes**:
    *   Si hay invitaciones pendientes (`pendingInvitations`), se mapean y se renderiza un componente `InvitationCard` para cada una. Este componente permite al usuario interactuar (aceptar/rechazar) con la invitación.
    *   Si no hay invitaciones pendientes, se muestra un `Alert` con un icono `Mail` y un mensaje indicando que no hay invitaciones pendientes.
*   **Invitaciones Respondidas**:
    *   Si hay invitaciones respondidas (`respondedInvitations`), se utiliza un componente `Collapsible` para agruparlas.
    *   El `CollapsibleTrigger` es un `Button` que muestra el texto "Invitaciones respondidas" junto con el recuento y un icono `ChevronUp` o `ChevronDown` para indicar el estado de expansión.
    *   Dentro de `CollapsibleContent`, se mapean las invitaciones respondidas y se renderiza un `RespondedInvitationCard` para cada una, mostrando el estado final de la invitación.
*   **Componentes de UI y Iconos**:
    *   Se utilizan componentes de UI de Shadcn/ui como `Button`, `Alert`, `AlertDescription`, `AlertTitle`, `Collapsible`, `CollapsibleContent`, `CollapsibleTrigger`.
    *   Iconos de `lucide-react` como `Loader2`, `Mail`, `ChevronDown`, `ChevronUp` para mejorar la experiencia visual.

## Hooks, Server Actions y Lógica
Este componente es un cliente (`'use client'`) y utiliza una combinación de hooks de React y hooks personalizados para gestionar el estado, la lógica y la interacción con Firebase Firestore.

*   **Estado Local (`useState`)**:
    *   `processingId`: Almacena el ID de la invitación que se está procesando (aceptando o rechazando) para deshabilitar los botones correspondientes y mostrar un estado de carga. Inicializado en `null`.
    *   `respondedOpen`: Un booleano que controla si la sección de invitaciones respondidas está expandida o colapsada. Inicializado en `false`.
*   **Hooks Personalizados de Firebase (`@/firebase`)**:
    *   `useUser()`: Proporciona el objeto `user` autenticado actualmente y un estado `loading` para el usuario.
    *   `useFirestore()`: Devuelve la instancia de la base de datos Firestore.
    *   `useCollection<Invitation>(query)`: Un hook que escucha en tiempo real una colección de Firestore basada en una consulta, devolviendo los datos (`data`) y un estado de carga (`loading`).
*   **Hooks de Utilidad (`@/hooks`)**:
    *   `useToast()`: Un hook para mostrar notificaciones "toast" al usuario.
*   **Consultas Memoizadas (`useMemo`)**:
    *   `pendingQuery`: Crea una consulta de Firestore para obtener todas las invitaciones pendientes (`status: 'pending'`) dirigidas al `playerId` del usuario actual. La consulta se memoiza para evitar recreaciones innecesarias.
    *   `respondedQuery`: Crea una consulta de Firestore para obtener todas las invitaciones respondidas (`status: 'accepted'` o `'declined'`) dirigidas al `playerId` del usuario actual. También se memoiza.
*   **Manejo de Datos (Firestore)**:
    *   `pendingInvitations`: Datos obtenidos de `useCollection` utilizando `pendingQuery`.
    *   `respondedInvitations`: Datos obtenidos de `useCollection` utilizando `respondedQuery`.
*   **`handleAccept(invitation: Invitation)`**:
    *   Función asíncrona para aceptar una invitación.
    *   Establece `processingId` para la invitación.
    *   Realiza una operación de escritura por lotes (`writeBatch`) para asegurar la atomicidad:
        *   Obtiene el documento del partido (`matchRef`) y el perfil del jugador (`playerRef`) simultáneamente.
        *   Verifica si el partido existe y si el perfil del jugador existe.
        *   Verifica si el partido no está lleno (`matchData.players.length < matchData.matchSize`).
        *   Actualiza el documento del partido (`matchRef`) para añadir al jugador (UID y detalles) a los arrays `players` y `playerUids` utilizando `arrayUnion`.
        *   Actualiza el documento de la invitación (`invitationRef`) para cambiar su `status` a `'accepted'`.
        *   Confirma la transacción por lotes (`batch.commit()`).
    *   Muestra un `toast` de éxito o error.
    *   En caso de error, emite un `FirestorePermissionError` a través de `errorEmitter`.
    *   Restablece `processingId` en el bloque `finally`.
*   **`handleReject(invitation: Invitation)`**:
    *   Función asíncrona para rechazar una invitación.
    *   Establece `processingId` para la invitación.
    *   Actualiza directamente el documento de la invitación (`invitationRef`) para cambiar su `status` a `'declined'` utilizando `updateDoc`.
    *   Muestra un `toast` de éxito o error.
    *   En caso de error, emite un `FirestorePermissionError` a través de `errorEmitter`.
    *   Restablece `processingId` en el bloque `finally`.
*   **Tipos de Datos**:
    *   Se importan tipos `Invitation`, `Match`, `Player` de `@/lib/types` para garantizar la seguridad de tipos en las operaciones de Firestore y el manejo de datos.
*   **Manejo de Errores**:
    *   Se utilizan bloques `try...catch` en las funciones `handleAccept` y `handleReject` para capturar y gestionar posibles errores durante las operaciones de Firestore.
    *   Los errores se registran en la consola (`console.error`) y se muestran al usuario mediante `toast` notifications.
    *   Se utiliza `errorEmitter` para emitir errores de permisos específicos de Firestore, lo que podría ser útil para un sistema de monitoreo o depuración centralizado.
*   **Server Actions**: No se utilizan Server Actions en este componente, ya que todas las interacciones con la base de datos se realizan directamente desde el cliente utilizando el SDK de Firebase.