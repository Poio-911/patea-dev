# Ruta: /feed
## Propósito General
Esta ruta está diseñada para mostrar un feed de actividad social, presentando las acciones y publicaciones recientes de los jugadores que el usuario sigue. Proporciona una vista principal del feed y una barra lateral complementaria para información adicional o navegación, adaptándose a diferentes tamaños de pantalla.

## Componentes y Estructura
El componente `FeedPage` es un Client Component de Next.js, lo que le permite interactuar con el navegador.

*   **Contenedor Principal:** Un `div` raíz con `className="flex flex-col gap-4"` organiza los elementos de la página verticalmente con un espaciado uniforme.
*   **`PageHeader`:**
    *   Se renderiza en la parte superior de la página.
    *   Recibe las props `title="Feed"` y `description="Actividad reciente de jugadores que sigues."`.
    *   Su función es proporcionar un título claro y una breve descripción del contenido de la página.
*   **Contenedor de Contenido y Sidebar:** Un `div` con un diseño responsivo:
    *   **En pantallas pequeñas (hasta `md`):** `flex flex-col` organiza el contenido en una sola columna vertical.
    *   **En pantallas medianas (`md`) y superiores:** `grid grid-cols-[1fr_300px]` crea un diseño de dos columnas:
        *   La primera columna (`1fr`) es flexible y ocupa el espacio restante.
        *   La segunda columna (`300px`) tiene un ancho fijo de 300 píxeles.
    *   **`SocialFeed`:**
        *   Es el componente principal que muestra el flujo de actividad social.
        *   Se le pasan las props `limit={50}` (probablemente para controlar el número máximo de elementos a mostrar) y `showHeader={true}` (para indicar si debe renderizar su propio encabezado interno).
        *   Ocupa la columna principal (flexible) del diseño.
    *   **`FeedSidebar`:**
        *   Proporciona contenido adicional o navegación lateral.
        *   Está envuelto en un `div` con `className="hidden md:block sticky top-20"`:
            *   `hidden`: Oculta la barra lateral en pantallas pequeñas.
            *   `md:block`: La hace visible en pantallas medianas y grandes.
            *   `sticky top-20`: Hace que la barra lateral se mantenga fija en la parte superior de la ventana de visualización (con un desplazamiento de 20px) cuando el usuario hace scroll, una vez que su contenedor padre alcanza esa posición.
        *   Ocupa la columna lateral (de 300px de ancho) del diseño en pantallas grandes.

## Hooks, Server Actions y Lógica
*   **Directiva `'use client'`:** Declara este componente como un Client Component de React en el entorno de Next.js. Esto permite el uso de hooks de React (como `useState`, `useEffect`, `useContext`, etc.) y la interacción directa con el DOM y eventos del navegador.
*   **Hooks de React:** El componente `FeedPage` en sí mismo no utiliza directamente `useState`, `useEffect` ni ningún hook personalizado. La gestión del estado y los efectos secundarios se delega a sus componentes hijos (`SocialFeed`, `FeedSidebar`), que son los responsables de su propia lógica interna.
*   **Server Actions y Manejo de Base de Datos:** No se importan ni se definen Server Actions directamente en este archivo. Tampoco hay lógica explícita de acceso o manipulación de bases de datos. Se asume que cualquier interacción con la base de datos o APIs para la obtención de datos (data fetching) o la realización de operaciones se maneja dentro de los componentes hijos (`SocialFeed`, `FeedSidebar`), ya sea a través de Server Components anidados, Server Actions importadas en esos componentes, o llamadas a API desde el lado del cliente.