# Ruta: /explorar
## Propósito General
La página `/explorar` sirve como un centro para que los usuarios descubran y participen en la comunidad de partidos de fútbol. Permite a los usuarios buscar "agentes libres" (jugadores disponibles para unirse a partidos) y "partidos abiertos" (partidos públicos a los que pueden unirse). Además, proporciona una interfaz para que el usuario actual gestione su propia disponibilidad como "agente libre".

## Componentes y Estructura
La página `ExplorarPage` es un componente cliente de React que organiza el contenido principal.

-   **Contenedor Principal:** Un `div` con `max-w-2xl mx-auto space-y-6 px-4 pb-12` centra el contenido y añade espaciado.
-   **Encabezado:** Un `h1` ("Explorar") y un `p` descriptivo introducen la sección.
-   **Banner de Agente Libre:**
    -   Un `div` condicional (`user && ...`) muestra un banner informativo.
    -   Este banner indica si el usuario está activo en el mercado de fichajes o lo invita a ofrecerse.
    -   Contiene un `Dialog` (de `@/components/ui/dialog`) que se activa mediante un `Button`.
    -   Dentro del `DialogContent`, se renderiza el componente `AvailabilityCard`, que permite al usuario ajustar su disponibilidad.
    -   Icono `Megaphone` de `lucide-react` para la indicación visual del estado de agente libre.
-   **Navegación por Pestañas (Tabs):**
    -   Utiliza el componente `Tabs` de `@/components/ui/tabs` para alternar entre dos vistas principales.
    -   `TabsList` contiene dos `TabsTrigger`:
        -   "Mercado de Fichajes" (con icono `UserSearch` de `lucide-react`).
        -   "Partidos Abiertos" (con icono `Calendar` de `lucide-react`).
    -   `TabsContent` para "players" renderiza el componente `ExploreContent`.
    -   `TabsContent` para "matches" renderiza el componente `PublicMatchesContent`.
-   **Componentes Hijos Importados:**
    -   `ExploreContent`: Muestra el contenido relacionado con la búsqueda de jugadores.
    -   `PublicMatchesContent`: Muestra el contenido relacionado con los partidos públicos.
    -   `AvailabilityCard`: Permite al usuario gestionar su estado de disponibilidad como jugador.
-   **Componentes UI de Shadcn/ui:** `Tabs`, `TabsContent`, `TabsList`, `TabsTrigger`, `Button`, `Dialog`, `DialogContent`, `DialogTrigger`, `DialogTitle`, `DialogHeader`.

## Hooks, Server Actions y Lógica
-   **`'use client'`**: Declara el componente como un Client Component de Next.js, lo que permite el uso de hooks de React y la interacción con el navegador.
-   **`useState('players')`**:
    -   `activeTab`: Gestiona el estado de la pestaña activa en el componente `Tabs`, inicializándose en 'players'.
    -   `setActiveTab`: Función para actualizar la pestaña activa cuando el usuario cambia de vista.
-   **`useUser()` (de `@/firebase`)**:
    -   Hook personalizado para obtener el objeto `user` autenticado de Firebase. Se utiliza para determinar si hay un usuario logueado y para obtener su `uid`.
-   **`useFirestore()` (de `@/firebase`)**:
    -   Hook personalizado para obtener la instancia de `firestore` de Firebase, necesaria para realizar operaciones de base de datos.
-   **`useDoc<Type>(docRef)` (de `@/firebase`)**:
    -   Hook personalizado para escuchar en tiempo real los datos de un documento específico en Firestore.
    -   `data: userProfile`: Fetchea el perfil del usuario actual desde `users/{user.uid}`. Se usa para obtener `savedLocation` para el `AvailabilityCard`.
    -   `data: currentPlayer`: Fetchea los datos del jugador actual desde `players/{user.uid}`. Se pasa al `AvailabilityCard`.
    -   `data: currentAvailability`: Fetchea los datos de disponibilidad del jugador actual desde `availablePlayers/{user.uid}`. Se usa para determinar `isFreeAgent` y se pasa al `AvailabilityCard`.
    -   Las llamadas a `useDoc` son condicionales (`user && firestore ? ... : null`) para asegurar que el usuario y la instancia de Firestore estén disponibles antes de intentar crear la referencia del documento.
-   **`doc` (de `firebase/firestore`)**:
    -   Función utilizada para crear referencias a documentos específicos en Firestore, que luego se pasan a `useDoc`.
-   **Lógica de `isFreeAgent`**:
    -   `const isFreeAgent = currentAvailability !== null;`
    -   Esta variable booleana determina si el usuario actual tiene un documento en la colección `availablePlayers`, lo que indica que se ha ofrecido como agente libre.
    -   Se utiliza para renderizar condicionalmente el texto y la variante del botón en el "Free Agent Banner".
-   **Renderizado Condicional**:
    -   El "Free Agent Banner" solo se muestra si `user` está autenticado.
    -   El contenido de las pestañas (`ExploreContent` o `PublicMatchesContent`) se renderiza según el valor de `activeTab`.
-   **Tipos de Datos**: Se importan `Player`, `UserProfile`, `AvailablePlayer` de `@/lib/types` para tipar los datos obtenidos de Firestore.
-   **No hay Server Actions**: Este componente es un Client Component y no utiliza Server Actions de Next.js. Toda la interacción con la base de datos se realiza a través de los hooks de Firebase en el lado del cliente.