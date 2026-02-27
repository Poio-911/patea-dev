# Ruta: /competitions/find-opponent/[teamId]
## Propósito General
Esta ruta permite a un usuario autenticado buscar y enviar desafíos a otros equipos disponibles. El usuario selecciona uno de sus equipos (identificado por `teamId` en la URL) y la página muestra una lista de equipos de otros usuarios que están marcados como "desafiables". El usuario puede filtrar esta lista por nombre y, finalmente, enviar una invitación de desafío a un equipo rival.

## Componentes y Estructura
El componente principal es `FindOpponentForTeamPage`. La estructura de la página se organiza de la siguiente manera:

-   **Contenedor Principal:** Un `div` que organiza el contenido en una columna con espaciado (`flex flex-col gap-6`).
-   **Cabecera de la Página:**
    -   `PageHeader`: Muestra el título dinámico "Buscar Rival para [Nombre del Equipo]" y una descripción.
    -   `Button` (como `Link`): Un botón "Elegir otro equipo" que permite al usuario volver a la página de competiciones (`/competitions`).
-   **Barra de Búsqueda:**
    -   Un `div` que contiene un icono `Search` y un componente `Input`.
    -   El `Input` permite al usuario buscar equipos por nombre, actualizando el estado `searchTerm`.
-   **Lista de Equipos Rivales / Mensaje de No Disponibilidad:**
    -   **Condicionalmente renderizado:**
        -   Si `filteredTeams` tiene elementos: Se muestra una cuadrícula (`grid`) de componentes `Card`.
            -   Cada `Card` representa un equipo rival potencial.
            -   `CardHeader`: Contiene un `JerseyPreview` del equipo y el `CardTitle` con el nombre del equipo.
            -   `CardFooter`: Contiene un `Button` para "Desafiar" al equipo. Este botón muestra un `Loader2` y el texto "Enviando..." mientras se procesa el desafío.
        -   Si `filteredTeams` está vacío: Se muestra un componente `Alert` indicando que no hay rivales disponibles que coincidan con la búsqueda.
-   **Estados de Carga y Error:**
    -   **Carga Inicial:** Durante la carga de los datos del equipo propio (`challengingTeam`) o de la lista de equipos rivales (`teams`), se muestra un `Loader2` centrado.
    -   **Equipo No Encontrado:** Si el `teamId` de la URL no corresponde a un equipo válido, se muestra un `Alert` de error y un botón para volver a la página de competiciones.

## Hooks, Server Actions y Lógica
La página utiliza una combinación de hooks de React, Next.js y Firebase, junto con Server Actions para la interacción con la base de datos y la lógica de negocio.

-   **Hooks de Next.js:**
    -   `useParams`: Se utiliza para extraer el `teamId` de la URL dinámica (`/competitions/find-opponent/[teamId]`).
-   **Hooks de React:**
    -   `useState`:
        -   `searchTerm`: Almacena la cadena de texto introducida en el campo de búsqueda para filtrar equipos.
        -   `isChallenging`: Almacena el `id` del equipo al que se está enviando un desafío en ese momento. Se usa para deshabilitar los botones de desafío y mostrar un estado de carga específico.
    -   `useMemo`:
        -   `teamRef`: Memoiza la referencia de Firestore al documento del equipo actual (`challengingTeam`) basado en `teamId`.
        -   `teamsQuery`: Memoiza la consulta de Firestore para obtener equipos rivales. Esta consulta filtra los equipos que son `isChallengeable: true` y excluye los equipos creados por el usuario actual (`createdBy != user.uid`).
        -   `filteredTeams`: Memoiza la lista de equipos después de aplicar el filtro por `searchTerm` y asegurar que el equipo propio (`teamId`) no aparezca como un rival potencial.
-   **Hooks de Firebase (de `@/firebase`):**
    -   `useFirestore`: Proporciona la instancia de Firestore para interactuar con la base de datos.
    -   `useUser`: Obtiene la información del usuario autenticado, crucial para filtrar equipos y enviar desafíos.
    -   `useDoc<GroupTeam>(teamRef)`: Fetches los datos del equipo actual (`challengingTeam`) que el usuario está utilizando para desafiar.
    -   `useCollection<GroupTeam>(teamsQuery)`: Fetches la colección de equipos que pueden ser desafiados (`teams`).
-   **Hooks de Utilidad:**
    -   `useToast` (de `@/hooks/use-toast`): Se utiliza para mostrar notificaciones (toasts) al usuario sobre el éxito o fracaso de las operaciones.
-   **Lógica de Base de Datos (Firestore):**
    -   Se construyen referencias a colecciones (`collection`) y documentos (`doc`) de Firestore.
    -   Se utilizan `query` y `where` para filtrar los equipos:
        -   `where('isChallengeable', '==', true)`: Solo se muestran equipos que han optado por ser desafiables.
        -   `where('createdBy', '!=', user.uid)`: Se excluyen los equipos creados por el propio usuario para evitar que se desafíe a sí mismo.
-   **Server Actions:**
    -   `sendTeamChallengeAction(teamId, challengedTeamId, user.uid)`:
        -   Importada de `@/lib/actions/server-actions`.
        -   Esta función asíncrona se invoca cuando el usuario hace clic en "Desafiar".
        -   Es responsable de la lógica del lado del servidor para registrar el desafío, posiblemente creando un nuevo documento de desafío en Firestore, actualizando estados de equipos o enviando notificaciones.
        -   Maneja la lógica de éxito y error, devolviendo un resultado que la UI procesa.
-   **Manejo de Eventos y Lógica de Negocio:**
    -   `handleChallenge(challengedTeamId: string)`: Función asíncrona que se ejecuta al hacer clic en el botón "Desafiar".
        -   Establece `isChallenging` para mostrar el estado de carga en el botón.
        -   Llama a `sendTeamChallengeAction`.
        -   En caso de éxito, dispara la animación `celebrationConfetti()` y muestra un toast de éxito.
        -   En caso de error, muestra un toast destructivo con el mensaje de error.
        -   Finalmente, restablece `isChallenging` a `null`.
    -   **Animaciones:** `celebrationConfetti()` (importada de `@/lib/animations`) se ejecuta al enviar un desafío exitosamente, proporcionando retroalimentación visual al usuario.