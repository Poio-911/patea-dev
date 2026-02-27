# Ruta: /rankings
## Propósito General
Esta ruta tiene como propósito principal mostrar los rankings de jugadores. La visualización de los rankings es dinámica, pudiendo mostrar los mejores jugadores de un grupo específico al que pertenece el usuario activo, o los rankings globales si el usuario no tiene un grupo activo definido.

## Componentes y Estructura
El componente `RankingsPage` es un componente de cliente (`'use client'`) que organiza la interfaz de usuario para la página de rankings.

*   **Estructura Principal:** Un contenedor `div` con estilos de Tailwind CSS (`flex flex-col gap-6`) que organiza sus elementos hijos en una columna con espaciado.
*   **`PageHeader`**: Este componente se utiliza para mostrar el título de la página ("Rankings") y una descripción contextual. La descripción es dinámica:
    *   Si el usuario tiene un `activeGroupId`, la descripción indica que se muestran "Los mejores jugadores de tu grupo en cada categoría."
    *   Si el usuario no tiene un `activeGroupId`, la descripción indica "Rankings globales de todos los jugadores."
*   **`RankingsPanel`**: Este es el componente principal que se encarga de renderizar la lógica y la interfaz de los rankings propiamente dichos. Recibe dos propiedades:
    *   `groupId`: El ID del grupo activo del usuario, si existe. Esto permite al panel filtrar y mostrar rankings específicos del grupo.
    *   `userId`: El ID único del usuario actual, que podría usarse para resaltar al propio usuario en la lista de rankings o para otras lógicas específicas del usuario.

## Hooks, Server Actions y Lógica
*   **`'use client'`**: Declara este componente como un Client Component de Next.js, lo que significa que se renderiza en el navegador y puede utilizar hooks de React y manejar interactividad del lado del cliente.
*   **`export const dynamic = 'force-dynamic';`**: Esta configuración de Next.js asegura que la página no sea estáticamente optimizada y se renderice dinámicamente en cada solicitud, incluso si fuera un componente de servidor (aunque aquí es de cliente, refuerza el comportamiento dinámico).
*   **`useUser` (Custom Hook)**: Se importa y utiliza el hook personalizado `useUser` desde `@/firebase`. Este hook es responsable de obtener la información del usuario autenticado. El objeto `user` devuelto por este hook es fundamental para determinar si se deben mostrar rankings de grupo o globales, y para pasar los IDs necesarios a `RankingsPanel`.
*   **Lógica Condicional de UI**: La descripción del `PageHeader` se determina condicionalmente basándose en la existencia de `user?.activeGroupId`, lo que permite una experiencia de usuario adaptada al contexto del grupo.
*   **Paso de Props**: Los datos del usuario (`activeGroupId` y `uid`) obtenidos del hook `useUser` se pasan como propiedades al componente `RankingsPanel`, delegando la lógica de filtrado y visualización de los rankings a dicho componente.
*   **No Server Actions**: En este componente específico, no se importan ni se utilizan Server Actions de Next.js. La lógica de obtención de datos del usuario se maneja a través del hook de cliente `useUser`, que probablemente interactúa con Firebase Authentication o una API del lado del cliente.