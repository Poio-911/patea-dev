# Ruta: /notifications
## Propósito General
Esta ruta tiene como propósito principal mostrar al usuario una lista de todas sus notificaciones. Permite visualizar notificaciones nuevas y antiguas, agruparlas por fecha (hoy, ayer, o fecha específica), y ofrece la funcionalidad de marcar todas las notificaciones no leídas como leídas.

## Componentes y Estructura
La página es un componente cliente (`'use client'`) que organiza la visualización de notificaciones.

*   **`PageHeader`**: Componente principal para el encabezado de la página, mostrando el título "Notificaciones" y una descripción. Incluye condicionalmente un botón para "Marcar todo como leído" si hay notificaciones sin leer.
*   **`Button`**: Utilizado para la acción de marcar todas las notificaciones como leídas.
*   **`Alert`**:
    *   Se muestra si el usuario no está autenticado, indicando "Acceso Denegado".
    *   Se muestra si no hay notificaciones, indicando "Bandeja Vacía".
*   **`Skeleton`**: Se renderiza durante los estados de carga (`userLoading` o `notificationsLoading`) para proporcionar una experiencia de usuario fluida, mostrando marcadores de posición para las notificaciones.
*   **`IconWrapper`**: Un componente auxiliar que renderiza un `Avatar` con un `AvatarFallback` que contiene un icono (`lucide-react`) dinámico basado en el `type` de la notificación. Los iconos se mapean desde el objeto `notificationIcons`.
*   **`Link` (de `next/link`)**: Cada notificación individual es un enlace que redirige al usuario a la URL especificada en `notification.link`.
*   **Estructura de Notificaciones**:
    *   Las notificaciones se agrupan por fecha (`Hoy`, `Ayer`, `Día de la semana, d de MMMM`).
    *   Cada grupo de notificaciones tiene un título (`h3`) con la fecha.
    *   Cada notificación individual se renderiza dentro de un `div` con estilos condicionales (`bg-primary/10` y `border-primary/20` si no está leída, `bg-card` si está leída).
    *   Muestra el `IconWrapper`, el `title`, `message` y la fecha formateada (`formatDistanceToNow`).
    *   Un pequeño círculo (`div`) de color primario indica visualmente si la notificación no ha sido leída.

## Hooks, Server Actions y Lógica
La página utiliza varios hooks de React y de librerías externas para gestionar el estado, la lógica de datos y la interacción con Firebase.

*   **`'use client'`**: Indica que este es un componente cliente de React, lo que permite el uso de hooks de estado y efecto, y la interacción directa con el navegador.
*   **`useUser()` (de `@/firebase`)**: Hook personalizado para obtener el objeto `user` autenticado de Firebase y su estado de carga (`userLoading`).
*   **`useFirestore()` (de `@/firebase`)**: Hook personalizado para obtener la instancia de Firestore.
*   **`useToast()` (de `@/hooks/use-toast`)**: Hook personalizado para mostrar notificaciones tipo "toast" al usuario, por ejemplo, al marcar notificaciones como leídas o en caso de error.
*   **`useMemo`**:
    *   **`notificationsQuery`**: Crea una consulta de Firestore optimizada para obtener las notificaciones del usuario actual, ordenadas por `createdAt` de forma descendente. Se recalcula solo cuando `firestore` o `user?.uid` cambian.
    *   **`groupedNotifications`**: Procesa la lista de notificaciones (`notifications`) para agruparlas por fecha (Hoy, Ayer, o fecha completa formateada). Utiliza `date-fns` (`isToday`, `isYesterday`, `format`, `parseISO`, `es` locale) para esta lógica. Se recalcula solo cuando `notifications` cambia.
    *   **`unreadCount`**: Calcula el número de notificaciones no leídas filtrando la lista de `notifications`. Se recalcula solo cuando `notifications` cambia.
*   **`useCollection<Notification>(notificationsQuery)` (de `@/firebase`)**: Hook personalizado que se suscribe a la consulta de Firestore definida en `notificationsQuery` y proporciona los datos de las notificaciones (`notifications`) en tiempo real, junto con su estado de carga (`notificationsLoading`).
*   **`markAllAsRead` (función asíncrona)**:
    *   Esta función se ejecuta cuando el usuario hace clic en el botón "Marcar todo como leído".
    *   Verifica que haya un usuario, una instancia de Firestore, notificaciones sin leer y notificaciones disponibles.
    *   Utiliza un `writeBatch` de Firestore para realizar múltiples actualizaciones de forma atómica.
    *   Itera sobre todas las notificaciones y, si una no está leída (`!n.isRead`), añade una operación de `update` al batch para establecer `isRead: true` en el documento correspondiente.
    *   `await batch.commit()`: Ejecuta todas las operaciones del batch.
    *   Muestra un `toast` de éxito o de error dependiendo del resultado de la operación.
    *   Manejo de errores con `try...catch` para capturar y registrar cualquier problema durante la actualización.
*   **Lógica de Renderizado Condicional**:
    *   Muestra `Skeleton` si `userLoading` o `notificationsLoading` es verdadero.
    *   Muestra un `Alert` si `!user` (usuario no autenticado).
    *   Muestra el `PageHeader` con el botón "Marcar todo como leído" si `unreadCount > 0`.
    *   Si hay `notifications`, las renderiza agrupadas por fecha.
    *   Si no hay `notifications`, muestra un `Alert` de "Bandeja Vacía".
*   **Formato de Fechas**: Utiliza `date-fns` (`format`, `formatDistanceToNow`, `isToday`, `isYesterday`, `parseISO`, `es` locale) para formatear las fechas de creación de las notificaciones de manera legible y localizada.
*   **Tipado**: Importa `Notification` y `NotificationType` de `@/lib/types` para asegurar la seguridad de tipos en los datos de las notificaciones.
*   **Utilidades**: Utiliza `cn` de `@/lib/utils` para combinar clases de Tailwind CSS de forma condicional.