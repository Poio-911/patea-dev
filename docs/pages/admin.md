# Ruta: /admin
## Propósito General
Esta ruta (`/admin`) sirve como el panel de control principal para los administradores de la plataforma. Su propósito es proporcionar una visión general y en tiempo real de las métricas clave del sistema, como el número total de usuarios, partidos históricos, partidos activos/próximos y grupos/ligas. La información se obtiene directamente de Firebase Firestore, ofreciendo una instantánea actualizada del estado de la aplicación.

## Componentes y Estructura
El componente `AdminDashboardPage` es una página de cliente (`'use client'`) que organiza la información en un diseño de dashboard.

-   **Contenedor Principal:** Un `div` que envuelve todo el contenido, aplicando estilos de espaciado (`space-y-8`) y una animación de entrada (`animate-in fade-in duration-500`).
-   **Encabezado de la Página:**
    -   `h1`: Título principal "Dashboard General".
    -   `p`: Descripción contextual que indica que las métricas son en tiempo real de Firestore.
-   **Métricas del Dashboard:**
    -   Un `div` con un diseño de cuadrícula (`grid gap-4 md:grid-cols-2 lg:grid-cols-4`) para mostrar las métricas en tarjetas.
    -   Cada métrica se presenta dentro de un componente `Card` (de `@/components/ui/card`), que incluye:
        -   `CardHeader`: Contiene el título de la métrica (`CardTitle`) y un icono representativo (de `lucide-react`).
            -   **Usuarios Totales:** `Users` icon.
            -   **Partidos Históricos:** `Activity` icon.
            -   **Partidos Activos/Próximos:** `Swords` icon.
            -   **Grupos y Ligas:** `Trophy` icon.
        -   `CardContent`: Muestra el valor numérico de la métrica (formateado con `toLocaleString()`) y una breve descripción (`p`).
-   **Estado de Carga:**
    -   Cuando `loading` es `true`, se renderiza un `div` centrado con un icono `Loader2` animado y un mensaje de "Consultando métricas globales...".
-   **Estado de Error:**
    -   Cuando `error` no es `null`, se muestra un componente `Alert` de tipo `destructive` con un icono `AlertCircle`, un `AlertTitle` de "Error" y un `AlertDescription` que contiene el mensaje de error.
-   **Espacio Reservado para Futuras Funcionalidades:**
    -   Una `Card` adicional con un borde punteado (`border-dashed`) y fondo transparente (`bg-transparent`) que actúa como un marcador de posición para futuras implementaciones, como la gestión de usuarios. Incluye un `CardTitle` y `CardDescription` que detallan la funcionalidad pendiente.

**Componentes de UI Reutilizables:**
-   `Card`, `CardContent`, `CardHeader`, `CardTitle`, `CardDescription` (de `@/components/ui/card`)
-   `Alert`, `AlertDescription`, `AlertTitle` (de `@/components/ui/alert`)
-   Iconos de `lucide-react`: `Users`, `Swords`, `Trophy`, `Activity`, `AlertCircle`, `Loader2`.

## Hooks, Server Actions y Lógica
Este componente es un cliente-side component, como lo indica `'use client'`. Toda la lógica de obtención de datos y gestión de estado se ejecuta en el navegador.

-   **Estado Local (`useState`):**
    -   `metrics`: Objeto que almacena los recuentos de las diferentes categorías (`users`, `matches`, `groups`, `activeMatches`). Inicializado a cero.
    -   `loading`: Booleano que controla la visualización del estado de carga. Inicializado a `true`.
    -   `error`: String o `null` que almacena un mensaje de error si la obtención de datos falla. Inicializado a `null`.
-   **Efecto Secundario (`useEffect`):**
    -   Se ejecuta una única vez al montar el componente (debido a la dependencia `[]`).
    -   Contiene una función asíncrona `fetchMetrics` que encapsula la lógica de obtención de datos.
    -   **Inicialización de Firebase:** Llama a `initializeFirebase()` (importado de `@/firebase`) para obtener la instancia de la aplicación Firebase.
    -   **Acceso a Firestore:** Obtiene la instancia de la base de datos Firestore utilizando `getFirestore(firebaseApp)`.
    -   **Obtención de Métricas (Firestore):**
        -   Utiliza `Promise.all` para ejecutar múltiples consultas de recuento de forma concurrente, mejorando la eficiencia.
        -   Para cada métrica, se usa `getCountFromServer()` de Firebase v9, que es una operación de agregación eficiente que cuenta documentos en una colección o consulta con una sola lectura.
        -   **Usuarios:** `getCountFromServer(collection(db, 'users'))`
        -   **Partidos:** `getCountFromServer(collection(db, 'matches'))`
        -   **Grupos:** `getCountFromServer(collection(db, 'groups'))`
        -   **Partidos Activos/Próximos:** `getCountFromServer(query(collection(db, 'matches'), where('status', 'in', ['active', 'upcoming'])))`. Esta consulta filtra los partidos por su estado.
    -   **Actualización del Estado:** Una vez que todas las promesas se resuelven, actualiza el estado `metrics` con los recuentos obtenidos.
    -   **Manejo de Errores:** Un bloque `try...catch` captura cualquier error durante la obtención de datos, lo registra en la consola y actualiza el estado `error` con un mensaje amigable para el usuario.
    -   **Finalización de Carga:** El bloque `finally` asegura que `setLoading(false)` se ejecute siempre, independientemente de si la operación fue exitosa o falló, para ocultar el indicador de carga.
-   **Interacción con la Base de Datos:**
    -   El componente interactúa directamente con Firebase Firestore para consultar datos.
    -   No utiliza Next.js Server Actions (`'use server'`) ya que toda la lógica de datos se maneja en el cliente a través del SDK de Firebase.