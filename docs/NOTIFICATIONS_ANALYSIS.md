# Análisis y Estrategia de Implementación: Sistema de Notificaciones

## 1. Resumen Ejecutivo

Este documento describe la estrategia para diseñar e implementar un sistema de notificaciones robusto y en tiempo real para la aplicación "Amateur Football Manager". El objetivo es mantener a los usuarios informados sobre eventos clave que requieren su atención o que son de su interés, aumentando así la participación y la retención.

**Conclusión Principal**: La arquitectura actual basada en Firebase es ideal para un sistema de notificaciones eficiente. La estrategia recomendada se basa en el uso de **Cloud Functions for Firebase** para escuchar cambios en Firestore y gestionar la creación de notificaciones, y un sistema de notificaciones **en la aplicación (In-App)** como primera fase (MVP), con la posibilidad de expandir a notificaciones push en el futuro.

---

## 2. Requisitos: ¿Qué y Cuándo Notificar?

Basado en la solicitud, los eventos clave que deben generar una notificación son:

1.  **Invitación a Partido (Manual)**:
    *   **Disparador**: Un organizador te añade manualmente a un partido.
    *   **Destinatario**: El jugador que fue añadido.
    *   **Mensaje de ejemplo**: "¡Has sido convocado! [Nombre del Organizador] te ha añadido al partido '[Nombre del Partido]'."

2.  **Nuevo Jugador se Une (Colaborativo)**:
    *   **Disparador**: Un jugador se une a un partido colaborativo al que tú también estás apuntado.
    *   **Destinatario**: El organizador del partido y, opcionalmente, los demás jugadores ya apuntados.
    *   **Mensaje para el organizador**: "[Nombre del Jugador] se ha apuntado al partido '[Nombre del Partido]'. Quedan [X] plazas."

3.  **Evaluaciones Pendientes**:
    *   **Disparador**: Un partido que jugaste se marca como `completed` y se generan tus asignaciones de evaluación.
    *   **Destinatario**: Cada jugador que tiene compañeros por evaluar.
    *   **Mensaje de ejemplo**: "¡Es hora de evaluar! Tienes evaluaciones pendientes para el partido '[Nombre del Partido]'."

4.  **Jugador Externo se Une (Público)**:
    *   **Disparador**: Un jugador que no pertenece a tu grupo se une a un partido público que tú organizaste.
    *   **Destinatario**: El organizador del partido.
    *   **Mensaje de ejemplo**: "¡Nuevo fichaje! [Nombre del Jugador] (externo) se ha unido a tu partido público '[Nombre del Partido]'."

---

## 3. Arquitectura Propuesta

Para evitar que la lógica de negocio se disperse por el cliente y para asegurar que las notificaciones se generen de manera fiable, la siguiente arquitectura es la más adecuada.

### a. Estructura de Datos en Firestore

Necesitamos una nueva colección para almacenar las notificaciones de cada usuario.

-   **`/users/{userId}/notifications/{notificationId}`**
    -   **Descripción**: Una subcolección dentro de cada usuario que contendrá sus notificaciones personales. Esto es altamente escalable y seguro, ya que cada usuario solo puede leer su propia subcolección.
    -   **Campos de la Notificación**:
        ```json
        {
          "id": "notif_123",
          "type": "match_invite" | "new_joiner" | "evaluation_pending",
          "title": "¡Convocado!",
          "message": "Has sido añadido al partido 'Clásico de los Miércoles'.",
          "link": "/matches/match_abc", // Enlace para redirigir al usuario
          "isRead": false,
          "createdAt": "2024-10-26T10:00:00Z" // Timestamp
        }
        ```

### b. Lógica de Backend: Cloud Functions for Firebase

La generación de notificaciones debe ser gestionada por el backend para garantizar que se ejecuten incluso si el usuario no está activo. **Cloud Functions** es la herramienta perfecta para esto.

-   **Función 1: `onMatchUpdate()`**
    *   **Disparador**: `onUpdate` en la colección `/matches/{matchId}`.
    *   **Lógica**:
        1.  Detectar cambios en el array `players`. Si se ha añadido un jugador nuevo, comparar la lista de jugadores "antes" y "después" del cambio.
        2.  Si un jugador fue añadido por el organizador (partido manual), generar una notificación de `match_invite` para ese jugador.
        3.  Si un jugador se unió por sí mismo (partido colaborativo), generar una notificación de `new_joiner` para el organizador.
        4.  Detectar cambio de estado de `upcoming` a `completed`. Cuando esto ocurra, y se hayan generado las `assignments`, crear una notificación de `evaluation_pending` para cada `evaluatorId`.

-   **Función 2: `onPlayerCreate()` (si fuera necesario)**
    *   Actualmente, el flujo de añadir jugadores a un partido se maneja en el `onUpdate` del partido, lo cual es más eficiente.

### c. Interfaz de Usuario (Cliente)

1.  **Componente de Notificaciones (`NotificationBell.tsx`)**:
    *   Un icono de campana en la barra de navegación principal (`main-nav.tsx`).
    *   El componente escuchará en tiempo real la subcolección `/users/{userId}/notifications` donde `isRead` sea `false`.
    *   Mostrará un **punto rojo o un contador** si hay notificaciones no leídas.
    *   Al hacer clic, abrirá un `Popover` o `DropdownMenu`.

2.  **Dropdown de Notificaciones**:
    *   Listará las notificaciones más recientes (ej: las últimas 5).
    *   Cada notificación mostrará el mensaje y hace cuánto tiempo se recibió.
    *   Hacer clic en una notificación la marcará como `isRead = true` y redirigirá al usuario al `link` correspondiente.

---

## 4. Plan de Implementación por Fases

### Fase 1: Notificaciones "In-App" (MVP)

Esta fase se centra en construir la funcionalidad principal visible para el usuario.

1.  **Modificar `docs/backend.json`**: Añadir la nueva entidad `notification` y la subcolección `/users/{userId}/notifications/{notificationId}`.
2.  **Modificar `main-nav.tsx`**:
    *   Añadir un nuevo componente `NotificationBell` en la barra de navegación.
3.  **Crear `components/notification-bell.tsx`**:
    *   Este componente se encargará de:
        *   Escuchar las notificaciones no leídas del usuario actual usando el hook `useCollection`.
        *   Mostrar el icono de campana con un indicador de notificaciones nuevas.
        *   Renderizar un `DropdownMenu` con la lista de notificaciones.
        *   Implementar la lógica para marcar una notificación como leída (`updateDoc`) al hacer clic en ella.
4.  **Implementar Cloud Functions (Lógica de Generación)**:
    *   Escribir y desplegar la Cloud Function `onMatchUpdate` en un archivo (ej: `functions/src/index.ts`) que contendrá la lógica principal para crear los documentos de notificación en Firestore según los eventos descritos.

### Fase 2: Notificaciones Push (Mejora Futura)

Una vez que el sistema de notificaciones en la app esté funcionando, se puede ampliar para enviar notificaciones push.

1.  **Configurar Firebase Cloud Messaging (FCM)**:
    *   Añadir el SDK de FCM al cliente y solicitar permiso al usuario para recibir notificaciones.
    *   Guardar los "FCM tokens" de cada dispositivo de un usuario en su documento de Firestore (ej: en una subcolección `/users/{userId}/fcm_tokens`).
2.  **Actualizar Cloud Functions**:
    *   Modificar las funciones existentes para que, además de crear el documento de notificación en Firestore, envíen un mensaje a través de FCM al dispositivo del usuario.
    *   El payload de la notificación push incluiría el título, mensaje y el enlace para abrir la app en la pantalla correcta.

Este enfoque por fases nos permite entregar valor rápidamente con el MVP y construir sobre una base sólida para funcionalidades más avanzadas en el futuro.