# Ruta: /players/[id]
## Propósito General
Esta ruta está diseñada para mostrar el perfil detallado de un jugador específico. Permite a los usuarios ver la información individual de un jugador, incluyendo sus datos personales y, si pertenece a un equipo, el dorsal de su camiseta. La página maneja estados de carga, errores de ID no válidos y situaciones donde el jugador no es encontrado, proporcionando una experiencia de usuario robusta.

## Componentes y Estructura
La página se estructura como un componente de cliente (`'use client'`) y renderiza los siguientes elementos:

*   **Contenedor Principal (`div`):** Un `div` con `flex flex-col gap-4` que organiza el contenido verticalmente.
*   **Cabecera de Página (`PageHeader`):** Muestra el nombre del jugador como título y una descripción general ("Perfil y estadísticas del jugador."). Se encuentra en un contenedor flexible que permite alinear el título y el botón de regreso.
*   **Botón de Navegación (`Button` con `Link`):** Un botón con el texto "Volver al Plantel" y un icono de flecha (`ArrowLeft`) que permite al usuario regresar a la lista general de jugadores (`/players`).
*   **Vista del Perfil del Jugador (`PlayerProfileView`):** Este es el componente principal que renderiza los detalles del jugador. Recibe las siguientes props:
    *   `playerId`: El ID único del jugador.
    *   `player`: El objeto completo con los datos del jugador.
    *   `jersey`: El número de dorsal del equipo al que pertenece el jugador (opcional).
*   **Estados Condicionales:**
    *   **Carga (`Loader2`):** Un icono de carga animado (`Loader2`) se muestra mientras se están obteniendo los datos del jugador.
    *   **ID no válido:** Un mensaje simple "ID de jugador no válido." se muestra si el `playerId` no es una cadena o está ausente.
    *   **Jugador no encontrado:** Un mensaje "Jugador no encontrado" se muestra si no se recuperan datos para el `playerId` dado, junto con un botón para volver a la lista de jugadores.

## Hooks, Server Actions y Lógica
La lógica de la página se basa en hooks de React y hooks personalizados para la interacción con Firebase Firestore:

*   **`useParams` (de `next/navigation`):** Se utiliza para extraer el `id` del jugador de la URL dinámica (`/players/[id]`).
*   **`useFirestore` (de `@/firebase`):** Obtiene la instancia de Firestore para realizar operaciones de base de datos.
*   **`useUser` (de `@/firebase`):** Obtiene el usuario autenticado actualmente. Aunque se importa, no se utiliza directamente en la lógica de visualización de esta página.
*   **`useMemo` (de `react`):** Se utiliza para memoizar valores y evitar recálculos innecesarios en cada renderizado:
    *   **`playerRef`:** Crea una referencia al documento del jugador específico en la colección `players` de Firestore (`doc(firestore, 'players', playerId)`).
    *   **`teamsQuery`:** Crea una consulta para obtener todos los documentos de la colección `teams` de Firestore (`query(collection(firestore, 'teams'))`).
    *   **`playerTeam`:** Después de obtener todos los equipos, busca el primer equipo en el que el `playerId` actual sea miembro. Esto se hace iterando sobre `allTeams` y verificando si `team.members` contiene un miembro con el `playerId` correspondiente.
*   **`useDoc<Player>(playerRef)` (de `@/firebase`):** Un hook personalizado que se encarga de escuchar en tiempo real los cambios en el documento del jugador referenciado por `playerRef`. Devuelve el objeto `Player` (`data: player`) y un estado de carga (`loading: playerLoading`).
*   **`useCollection<GroupTeam>(teamsQuery)` (de `@/firebase`):** Un hook personalizado que se encarga de escuchar en tiempo real los cambios en la colección de equipos referenciada por `teamsQuery`. Devuelve un array de objetos `GroupTeam` (`data: allTeams`).
*   **Manejo de Estados:**
    *   La página gestiona el estado de carga (`playerLoading`) para mostrar un spinner mientras se recuperan los datos del jugador.
    *   Verifica la validez del `playerId` extraído de la URL.
    *   Comprueba si se encontró un jugador (`!player`) y muestra un mensaje de "no encontrado" si es necesario.
*   **Lógica de Negocio:**
    *   La lógica principal consiste en obtener los datos del jugador y, de forma independiente, obtener todos los equipos para determinar si el jugador pertenece a alguno y, en ese caso, obtener el dorsal de su camiseta (`jersey`).
    *   Los datos obtenidos se pasan al componente `PlayerProfileView` para su renderizado final.
*   **Server Actions:** No se utilizan Server Actions en este componente de cliente. Toda la interacción con la base de datos se realiza a través de los hooks de Firebase en el lado del cliente.