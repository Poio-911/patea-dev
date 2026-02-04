# 👕 Análisis de Equipos y Jerseys

**Fecha:** 3 de Febrero 2026
**Objetivo:** Documentar el proceso de creación de equipos, validaciones de jugadores y la lógica de generación de jerseys en el sistema actual.

---

## 1. 👥 Creación de Equipos

El proceso se realiza íntegramente en el cliente (UI) y se persiste directamente a Firestore.

### Componente Principal
-   **Ubicación:** `src/components/create-team-dialog.tsx`
-   **Hook:** Usamos `react-hook-form` con esquema Zod para gestión de estado y validación.
-   **Wizard:** Proceso de 2 pasos.
    1.  **Diseño:** Nombre del equipo y diseño de camiseta.
    2.  **Plantel:** Selección de jugadores.

### Validaciones y Reglas
El esquema de validación (`createTeamSchema`) y la lógica imponen:
1.  **Nombre del Equipo:**
    -   Tipo: `string`
    -   Regla: Mínimo 3 caracteres.

2.  **Jugadores (`playerIds`):**
    -   Tipo: `array<string>`
    -   Regla: Mínimo 1 jugador seleccionado.
    -   **NUEVO:** Se valida que un jugador no pertenezca a más de 3 equipos simultáneamente. La UI bloquea la selección.
    -   **NUEVO:** Se muestra advertencia si el equipo está desbalanceado (faltan arqueros, defensores o delanteros).

### Estructura de Datos (`GroupTeam`)
Al guardar en Firestore (`teams` collection), se genera:
```typescript
interface GroupTeam {
  // ...
  members: GroupTeamMember[]; // Array de miembros
}

interface GroupTeamMember {
  playerId: string;
  number: number;         // Asignado inteligentemente según posición (NUEVO)
  status: 'titular';      
}
```

---

## 2. 🎨 Sistema de Jerseys y Dorsales

### Dorsales Inteligentes
Se implementó una lógica de asignación (`assignSmartDorsal`) que:
-   Respeta las preferencias históricas por posición (ej. Arqueros: 1, 12, 13...).
-   Evita duplicados dentro del mismo equipo.
-   Asigna automáticamente dorsales libres si los preferidos están ocupados.

### Motor de Renderizado (Jerseys)

El sistema permite personalizar la identidad visual del equipo mediante SVG dinámicos.

### Modelo de Datos (`Jersey`)
```typescript
type Jersey = {
  type: 'plain' | 'vertical' | 'band' | 'chevron' | 'thirds' | 'lines';
  primaryColor: string;   // Hex Code
  secondaryColor: string; // Hex Code
};
```

### Motor de Renderizado
-   **Ubicación:** `src/lib/jersey-templates.ts`
-   **Lógica:**
    -   Existe un registro `JERSEY_TEMPLATES` con 6 diseños base.
    -   Cada template referencia un archivo SVG estático en `/public/jerseys/`.
    -   Define un `colorMapping` que indica qué colores dentro del SVG original deben ser reemplazados por el `primary` y `secondary` elegidos por el usuario.
    -   La función `applyColorsToSvg` realiza el reemplazo de strings (Regex) sobre el contenido del SVG crudo antes de renderizarlo.

### Catálogo de Diseños
1.  **Lisa (`plain`):** Color sólido principal.
2.  **Franjas Verticales (`vertical`):** Estilo clásico (ej. Boca, Milan).
3.  **Franja Horizontal (`band`):** Estilo Boca/River.
4.  **Chevron (`chevron`):** La "V" en el pecho (ej. Vélez).
5.  **Tercios (`thirds`):** División en 3 bloques.
6.  **Líneas (`lines`):** Detalles lineales finos.

### Componente de Diseño (`JerseyDesigner`)
-   Permite seleccionar template.
-   Selector de colores dual (Primario/Secundario).
-   Ofrece una paleta de 16 "Colores Populares" + Picker de espectro completo (Input type color).
-   Visualización en tiempo real mediante `JerseyPreview`.

---

## 3. 🔍 Observaciones y Oportunidades

1.  **Validación de Unicidad:** Permitimos crear múltiples equipos con el mismo nombre en el mismo grupo. Sería ideal validar duplicados.
2.  **Dorsales:** Los números se asignan automáticamente por orden de selección (1, 2, 3...). No hay interfaz para elegir dorsales manualmente durante la creación.
3.  **Capitán:** No se define un capitán explicito en la creación.
4.  **Escudos:** Actualmente los equipos *no tienen escudo personalizado*, solo camiseta. La identidad visual recae 100% en el Jersey.
