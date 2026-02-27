# Ruta: /matches/[id]
## Propósito General
Esta ruta está diseñada para mostrar los detalles específicos de un partido individual. Utiliza el `id` proporcionado en la URL para identificar el partido y renderiza un componente dedicado (`MatchDetailView`) para presentar su información. También incluye un botón de navegación para regresar a la lista general de partidos y gestiona el estado de carga mientras se obtienen los datos del partido.

## Componentes y Estructura
- **`MatchDetailPage` (Componente Cliente)**: Es el componente principal de la página, marcado con `'use client'`.
- **`Suspense`**: Envuelve el contenido principal para manejar estados de carga.
    - **`fallback`**: Muestra un spinner (`Loader2`) centrado mientras los componentes hijos (especialmente `MatchDetailView`) están cargando o resolviendo sus datos.
- **Contenedor de Diseño**: Un `div` con la clase `space-y-2` organiza verticalmente los elementos.
    - **`BackButton`**: Un componente de navegación que permite al usuario volver a la ruta `/matches` (lista de partidos).
    - **`MatchDetailView`**: El componente central encargado de renderizar los detalles del partido. Recibe el `matchId` extraído de la URL como prop.

## Hooks, Server Actions y Lógica
- **`useParams` (Hook de Next.js)**: Se utiliza para extraer el parámetro `id` de la URL dinámica (`/matches/[id]`).
- **Lógica de Validación**:
    - Verifica si el `id` extraído de los parámetros de la URL existe y es de tipo `string`.
    - Si el `id` no es válido, renderiza un mensaje de error (`"ID de partido no válido."`) en lugar del contenido de la página.
- **Gestión de Carga**: El componente `Suspense` se encarga de mostrar un indicador de carga (`Loader2`) mientras el `MatchDetailView` (o cualquier componente hijo que use `Suspense` internamente) está procesando o esperando datos.
- **Server Actions**: No se utilizan Server Actions directamente en este archivo de página. La lógica de obtención de datos para `MatchDetailView` podría residir dentro de ese componente, posiblemente utilizando Server Actions o una API.