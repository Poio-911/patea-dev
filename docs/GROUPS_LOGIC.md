# Lógica de Grupos y Equipos

## 1. Resumen

La gestión de grupos y equipos es una funcionalidad central de la aplicación. Permite a los usuarios crear comunidades cerradas (`Grupos`), añadir jugadores a ellas y, más importante, formar `Equipos` persistentes dentro de esos grupos, con su propia identidad (nombre y camiseta).

---

## 2. Gestión de Grupos

-   **Creación y Unión**: Los usuarios pueden crear sus propios grupos o unirse a los de otros mediante un código de invitación.
-   **Grupo Activo**: La aplicación siempre opera en el contexto de un "grupo activo". El usuario puede cambiar entre sus grupos desde el menú de perfil.
-   **Página Principal (`/groups`)**: Este es el centro de mando. Aquí, el usuario ve los equipos de su grupo activo, estadísticas de los jugadores (Top OVR, Goleadores) y tiene los botones para crear o unirse a un grupo.

---

## 3. Gestión de Equipos Persistentes

Esta funcionalidad permite crear "clubes" o "plantillas" fijas dentro de un grupo más grande.

### a. Flujo de Creación de Equipo (`CreateTeamDialog.tsx`)

Se activa desde la página `/groups` y consta de un proceso de 2 pasos:

1.  **Paso 1: Identidad del Equipo**
    -   **Nombre del Equipo**: El usuario ingresa un nombre para su equipo.
    -   **Diseño de Camiseta**: Se presenta una interfaz visual (`JerseyDesigner.tsx`) para diseñar la camiseta.

2.  **Paso 2: Selección de Jugadores**
    -   El usuario ve una lista de todos los jugadores del grupo activo.
    -   Puede seleccionar quiénes formarán parte del plantel de este nuevo equipo.
    -   Se requiere seleccionar al menos un jugador.

Al finalizar, se crea un nuevo documento en la colección `/teams` de Firestore. El paso de asignar dorsales se eliminó para agilizar la creación.

### b. Diseño de Camisetas (`JerseyDesigner.tsx`)

-   **Selección de Patrón**: En lugar de una lista de texto, el usuario ve una **grilla visual** con íconos que representan cada diseño (lisa, franjas, etc.).
-   **Selección de Colores**: Paletas de colores predefinidas y un selector de color personalizado para los colores primario y secundario.
-   **Vista Previa en Vivo (`JerseyPreview.tsx`)**: Un componente muestra en tiempo real cómo se verá la camiseta con el patrón y los colores seleccionados.

### c. Visualización de Equipos

-   **Tarjeta de Equipo (`TeamCard.tsx`)**: En la página de grupos, cada equipo se muestra en una tarjeta que incluye:
    -   Una vista previa de su camiseta.
    -   Nombre y cantidad de jugadores.
    -   Una lista de avatares de algunos de sus miembros.
    -   Es **clickeable** y lleva a la página de detalle del equipo.

-   **Página de Detalle del Equipo (`/groups/teams/[id]`)**:
    -   Muestra la camiseta en un tamaño más grande.
    -   Presenta el plantel completo del equipo, dividido en **Titulares** y **Suplentes**.
    -   Cada jugador (`TeamRosterPlayer.tsx`) muestra su **dorsal, avatar, nombre y OVR**.
    -   Un menú de 3 puntos en cada jugador permite al organizador **editar el dorsal y el estado** (titular/suplente) a través de un diálogo (`SetPlayerStatusDialog.tsx`).
    -   Muestra los **próximos partidos** del equipo y su **historial**.

---

## 4. Estructura de Datos (`backend.json`)

La entidad clave para esta funcionalidad es `groupTeam`.

-   **`/teams/{teamId}`** (`groupTeam`):
    -   `name`: Nombre del equipo.
    -   `groupId`: A qué grupo pertenece.
    -   `jersey`: Objeto con `type`, `primaryColor` y `secondaryColor`.
    -   `members`: Un **array de objetos**, donde cada objeto contiene el `playerId`, su `number` (dorsal) y su `status` ('titular' o 'suplente').
    -   `createdBy`: El UID del usuario que creó el equipo.
    -   `createdAt`: Fecha de creación.

---

## 5. Componentes Clave

-   `src/app/groups/page.tsx`: Página principal que orquesta la vista.
-   `src/components/team-builder/team-list.tsx`: Muestra la lista de equipos y el botón para crear uno nuevo.
-   `src/components/create-team-dialog.tsx`: El diálogo modal con el flujo de creación de 2 pasos.
-   `src/components/team-builder/jersey-designer.tsx`: La interfaz para diseñar la camiseta.
-   `src/components/team-builder/jersey-preview.tsx`: Muestra la camiseta en SVG.
-   `src/components/team-builder/team-card.tsx`: La tarjeta de resumen de cada equipo.
-   `src/app/groups/teams/[id]/page.tsx`: La página de detalle de un equipo, que es el centro de gestión táctica.
-   `src/components/team-roster-player.tsx`: La tarjeta individual para cada jugador en el plantel del equipo.
-   `src/components/set-player-status-dialog.tsx`: El diálogo para editar el estado y dorsal de un jugador.
-   `src/components/groups/upcoming-matches-feed.tsx`: Componente que muestra los próximos partidos de un equipo.
-   `src/lib/jersey-templates.ts`: Archivo central que define todos los patrones de camisetas y sus SVGs.
