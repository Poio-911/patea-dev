# 🏆 Documentación del Sistema de Competiciones: Amistosos, Ligas y Copas

**Versión 1.0 - Fecha: 07 de Noviembre 2025**

---

## 1. Visión General

El sistema de Competiciones está diseñado para ser el corazón social y competitivo de la aplicación. El objetivo es transformar la simple organización de partidos en un ecosistema dinámico donde los equipos puedan medirse, mejorar y competir en formatos estructurados.

La implementación se divide en dos fases principales:

-   **Fase 1: Partidos Amistosos y Desafíos (Implementado)**: Permite que los equipos creados dentro de la plataforma se encuentren y se desafíen entre sí, rompiendo la barrera de los grupos cerrados.
-   **Fase 2: Ligas y Copas (Visión a Futuro)**: Construirá sobre la base de los amistosos para permitir a los usuarios crear y gestionar torneos completos con tablas de posiciones, fixtures y fases eliminatorias.

---

## 2. Fase 1: Sistema de Desafíos y Amistosos (Implementado)

Esta funcionalidad permite a un equipo (el "desafiante") invitar a otro equipo (el "desafiado") a un partido amistoso.

### a. Flujo de Usuario (Paso a Paso)

1.  **Hacer un Equipo "Desafiable" (Opt-In)**:
    -   **¿Dónde?**: En la página de detalle de un equipo (`/groups/teams/[id]`).
    -   **¿Quién?**: Solo el dueño del equipo.
    -   **¿Cómo?**: El dueño encontrará un interruptor ("Disponibilidad para Desafíos"). Al activarlo, el campo `isChallengeable` del equipo se pone en `true`, haciendo que el equipo aparezca en la lista de búsqueda para otros.

2.  **Iniciar un Desafío**:
    -   **Paso 1**: El dueño de un equipo navega a la página de su propio equipo en `/groups/teams/[id]`.
    -   **Paso 2**: Hace clic en el botón **"Buscar Rival"**. Esto lo lleva a la página de búsqueda (`/competitions/find-opponent/[teamId]`), pasando el ID de su equipo como el "desafiante".

3.  **Buscar y Enviar el Desafío**:
    -   **¿Dónde?**: En la página `/competitions/find-opponent/[teamId]`.
    -   **¿Qué se ve?**: Una grilla con todos los equipos de la plataforma que hayan activado la opción `isChallengeable` (y que no sean el suyo).
    -   **Acción**: Al encontrar un rival interesante, el usuario hace clic en el botón **"Desafiar"**.

4.  **Proceso de Invitación (Backend)**:
    -   Al hacer clic en "Desafiar", una `server-action` se ejecuta:
        -   Crea un documento de `invitation` en la subcolección del equipo **desafiado** (`/teams/{challengedTeamId}/invitations/{invitationId}`).
        -   Crea un documento de `notification` para el **dueño** del equipo desafiado, avisándole del nuevo desafío.

5.  **Recibir y Gestionar Invitaciones**:
    -   **¿Dónde?**: En la página de **Competiciones (`/competitions`)**.
    -   **¿Cómo?**: El dueño del equipo desafiado verá una notificación en el ícono de la campana (`NotificationBell`). Al hacer clic en la "Bandeja de Invitaciones" (`InvitationsSheet`), verá una tarjeta con los detalles del desafío.
    -   **Acción**: Cualquier miembro del equipo desafiado puede **Aceptar** o **Rechazar** el desafío.
        -   Si **acepta**, se creará un nuevo partido de tipo `intergroup_friendly` y se notificará a ambos capitanes.
        -   Si **rechaza**, se actualiza el estado de la invitación y se notifica al equipo desafiante.

### b. Arquitectura de Datos (Firestore)

-   **`teams/{teamId}`**:
    -   `isChallengeable: boolean` (campo nuevo).
-   **`teams/{teamId}/invitations/{invitationId}`**:
    -   **Descripción**: Almacena los desafíos recibidos por un equipo.
    -   **Campos Clave**: `type: 'team_challenge'`, `status: 'pending' | 'accepted' | 'declined'`, `fromTeamId`, `fromTeamName`, `fromTeamJersey`.
-   **`users/{userId}/notifications/{notificationId}`**:
    -   **Descripción**: Almacena notificaciones personales, incluyendo los avisos de nuevos desafíos.

### c. Componentes Clave

-   `src/app/groups/teams/[id]/page.tsx`: Ahora es el centro de mando táctico del equipo.
-   `src/app/competitions/page.tsx`: Hub central para ver desafíos y (en el futuro) torneos.
-   `src/app/competitions/find-opponent/[teamId]/page.tsx`: "Mercado" de equipos desafiables.
-   `src/components/invitations-sheet.tsx`: Bandeja de entrada para gestionar invitaciones.

---

## 3. Fase 2: Ligas y Copas (Visión a Futuro)

La infraestructura actual de equipos, jugadores y partidos amistosos es la base perfecta para construir un sistema completo de torneos.

### a. Concepto General

Los organizadores (usuarios "Pro") podrán crear dos tipos de competiciones:

-   **Ligas**:
    -   Formato de todos contra todos (ida y vuelta opcional).
    -   Sistema de puntos (3 por victoria, 1 por empate).
    -   Generación automática de `fixtures` (calendario de partidos).
    -   Tabla de posiciones que se actualiza en tiempo real a medida que los partidos se completan y evalúan.

-   **Copas**:
    -   Formato de eliminación directa (octavos, cuartos, semi, final).
    -   Generación automática del "bracket" o cuadro del torneo.
    -   Opción de fase de grupos previa.

### b. Nuevas Entidades de Datos

Para soportar esto, se crearían nuevas colecciones en Firestore:

-   **`/leagues/{leagueId}`**:
    -   `name`, `format`, `teams` (array de teamIds), `rules`, `ownerUid`.
    -   Subcolección: `/leagues/{leagueId}/standings/{teamId}` (para la tabla de posiciones).
    -   Subcolección: `/leagues/{leagueId}/matches/{matchId}` (para el fixture).

-   **`/cups/{cupId}`**:
    -   `name`, `format` ('single_elimination'), `teams`, `brackets`.
    -   Subcolección: `/cups/{cupId}/rounds/{roundId}`.

### c. Integración con el Flujo Existente

-   **Creación de Partidos**: Los partidos de liga/copa se crearían automáticamente al generar el fixture. Aparecerían en la lista de "Próximos Partidos" de cada equipo.
-   **Evaluación**: El sistema de evaluación de jugadores post-partido se mantendría sin cambios, asegurando que el rendimiento en competiciones siga afectando el OVR de los jugadores.
-   **Resultados**: Al finalizar y evaluar un partido, una Cloud Function se encargaría de actualizar la tabla de posiciones de la liga o de hacer avanzar al equipo ganador en el bracket de la copa.

Esta visión convierte a "Pateá" de una herramienta de organización a una **plataforma completa de gestión deportiva amateur**, aumentando exponencialmente el engagement y abriendo nuevas vías de monetización.
