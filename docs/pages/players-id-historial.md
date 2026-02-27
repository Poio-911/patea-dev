# Ruta: /players/[id]/historial
## Propósito General
Esta ruta está diseñada para mostrar el historial detallado de partidos de un jugador específico. Incluye evaluaciones, goles y la evolución de atributos del jugador a lo largo del tiempo. Permite al usuario navegar de vuelta al perfil del jugador y presenta la información de manera estructurada, obteniendo los datos del jugador desde Firestore.

## Componentes y Estructura
El componente `HistorialPage` es un componente de cliente (`'use client'`) que organiza la visualización del historial.

*   **Contenedor Principal**: Un `div` con `flex flex-col gap-6` que organiza los elementos verticalmente con espaciado.
*   **Botón de Navegación**:
    *   Un `Button` de tipo `outline` envuelto en un `Link` de Next.js.
    *   Permite al usuario volver al perfil del jugador (`/players/${playerId}`).
    *   Incluye el icono `ArrowLeft` de `lucide-react`.
*   **Encabezado de Página**:
    *   `PageHeader`: Componente que muestra el título "Historial de Partidos" y una descripción dinámica que incluye el nombre del jugador (`Evaluaciones, goles y evolución de atributos de ${player.name}.`).
*   **Separador**:
    *   `Separator`: Un componente UI que proporciona una línea divisoria visual.
*   **Vista del Historial de Partidos**:
    *   `PlayerMatchDebriefView`: Este es el componente principal que se encarga de renderizar el historial de partidos del jugador. Recibe `playerId` como prop para cargar y mostrar los datos relevantes.
*   **Estados de Carga y Error**:
    *   Durante la carga de datos del jugador, se muestra un `Loader2` animado.
    *   Si el jugador no se encuentra después de la carga, se muestra el mensaje "Jugador no encontrado.".

## Hooks, Server Actions y Lógica
Este componente utiliza principalmente hooks de React y hooks personalizados para interactuar con Firebase Firestore.

*   **`useParams` (de `next/navigation`)**:
    *   Se utiliza para extraer el parámetro `id` de la URL, que representa el ID del jugador.
    *   `const params = useParams<{ id: string }>();`
    *   `const playerId = params?.id;`
*   **`useFirestore` (de `@/firebase`)**:
    *   Hook personalizado que proporciona una instancia del objeto `Firestore` inicializado.
    *   `const firestore = useFirestore();`
*   **`doc` (de `firebase/firestore`)**:
    *   Función de Firebase SDK utilizada para crear una referencia a un documento específico en Firestore.
    *   `const playerRef = firestore && playerId ? doc(firestore, 'players', playerId as string) : null;`
    *   Crea una referencia al documento del jugador en la colección `players` usando el `playerId` obtenido de la URL.
*   **`useDoc<Player>` (de `@/firebase`)**:
    *   Hook personalizado diseñado para escuchar en tiempo real los cambios de un documento específico en Firestore.
    *   `const { data: player, loading: playerLoading } = useDoc<Player>(playerRef);`
    *   Recibe la referencia del documento (`playerRef`) y devuelve el `data` del documento (tipado como `Player`) y un estado `loading` booleano.
*   **Manejo de Base de Datos**:
    *   El componente lee los datos del jugador de la colección `players` en Firestore utilizando el `playerId`. Esta operación se realiza de forma reactiva a través del hook `useDoc`.
*   **Lógica de Renderizado Condicional**:
    *   El componente verifica el estado `playerLoading` para mostrar un spinner de carga mientras se obtienen los datos.
    *   Después de la carga, si `player` es `null` o `undefined`, indica que el jugador no fue encontrado y muestra un mensaje apropiado.
    *   Una vez que los datos del jugador están disponibles, se renderiza la interfaz principal con el `PageHeader` y el `PlayerMatchDebriefView`.
*   **No Server Actions**: Este componente es un cliente (`'use client'`) y no utiliza Next.js Server Actions. Toda la interacción con la base de datos (lectura) se gestiona directamente en el cliente a través de los hooks de Firebase.