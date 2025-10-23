# Análisis del Sistema de Diseño de Camisetas

**Fecha:** 23 de Octubre de 2025

Este documento detalla la arquitectura y el funcionamiento del sistema de diseño de camisetas de la aplicación "Amateur Football Manager". El objetivo es proporcionar una guía clara para su mantenimiento y futuras ampliaciones.

---

## 1. Arquitectura General

El sistema está diseñado para ser modular y extensible. Se basa en la combinación de tres elementos clave:

1.  **Componentes React (UI)**: Proporcionan la interfaz para que el usuario diseñe la camiseta.
2.  **Configuración de Templates (Lógica)**: Un archivo central define todos los diseños de camisetas disponibles, sus propiedades y cómo se deben colorear.
3.  **Archivos SVG (Recursos)**: Archivos vectoriales que actúan como plantillas base para cada diseño.

El flujo es el siguiente:
- El usuario interactúa con `JerseyDesigner.tsx`.
- Este componente lee la configuración desde `jersey-templates.ts` para mostrar los diseños y colores.
- Cuando el usuario selecciona un diseño y colores, el componente `JerseyPreview.tsx` carga el archivo SVG correspondiente desde la carpeta `public/jerseys/`.
- `JerseyPreview` aplica dinámicamente los colores seleccionados al contenido del SVG y lo renderiza en tiempo real.

---

## 2. Componentes del Sistema

### a. Archivo de Configuración Central (`src/lib/jersey-templates.ts`)

Este es el cerebro del sistema.

-   **`JERSEY_TEMPLATES`**: Un objeto que mapea cada tipo de camiseta (`JerseyType`) a un objeto de configuración (`JerseyTemplate`).
    -   **`type`**: El identificador único del diseño (ej: `'plain'`, `'vertical'`, `'lines'`).
    -   **`label`**: El nombre que ve el usuario (ej: "Lisa").
    -   **`svgPath`**: La ruta al archivo SVG base en la carpeta `public/`. **Ejemplo**: `/jerseys/plain-pink-football-shirt-svgrepo-com.svg`.
    -   **`colorMapping`**: **La parte más crucial**. Define qué colores dentro del archivo SVG son reemplazables.
        -   `primary`: Un array de códigos de color (en formato hex de 3 o 6 caracteres) que serán reemplazados por el "Color 1" elegido por el usuario.
        -   `secondary`: Idem, pero para el "Color 2".

-   **`applyColorsToSvg` (Función)**:
    -   Esta función recibe el contenido de un archivo SVG, el template correspondiente y los colores elegidos por el usuario.
    -   Utiliza expresiones regulares para buscar los códigos de color definidos en `colorMapping` dentro del string del SVG y los reemplaza por los colores nuevos.
    -   **Importante**: La función busca los colores exactos (insensible a mayúsculas/minúsculas). Por ejemplo, si `colorMapping.primary` es `['#33f']`, la función buscará `fill="#33f"` o `stroke="#33f"` en el SVG para reemplazarlo.

### b. Archivos SVG (`public/jerseys/`)

-   **Ubicación**: Todos los archivos SVG de las camisetas deben residir en la carpeta `public/jerseys/`.
-   **Rol**: Actúan como plantillas visuales.
-   **Convención de Colores (CRÍTICO)**: Para que el sistema funcione, los colores dentro de los archivos SVG deben coincidir **exactamente** con los definidos en el `colorMapping` del archivo `jersey-templates.ts`.
    -   El color que representará al **Color Primario** debe ser `#33f` (azul).
    -   El color que representará al **Color Secundario** debe ser `#ffffff` (blanco).
    -   Si un SVG usa, por ejemplo, `#fff` en lugar de `#ffffff`, el reemplazo fallará. Todos los SVGs deben estar estandarizados a estos colores base.

### c. Componentes de React (UI)

-   **`src/components/team-builder/jersey-designer.tsx`**:
    -   Es la interfaz con la que interactúa el usuario.
    -   Mapea el objeto `JERSEY_TEMPLATES` para renderizar la grilla de selección de diseños.
    -   Para mostrar los íconos de los diseños en gris (y no en sus colores base), pasa colores grises específicos (`#9CA3AF` y `#E5E7EB`) al componente `JerseyPreview` que se usa para cada ícono. Esto demuestra la flexibilidad del sistema de reemplazo de colores.
    -   Maneja la selección de colores primario y secundario, mostrando una paleta de colores populares y un selector de color personalizado.

-   **`src/components/team-builder/jersey-preview.tsx`**:
    -   Es el motor de renderizado.
    -   Recibe un objeto `jersey` con el `type` y los `colors`.
    -   Usa un `useEffect` para cargar el contenido del archivo SVG (`fetch(template.svgPath)`).
    -   Una vez cargado el SVG, llama a `applyColorsToSvg` para inyectar los colores seleccionados.
    -   Finalmente, renderiza el SVG modificado usando `dangerouslySetInnerHTML`. Esto es seguro en este contexto porque el contenido del SVG proviene de nuestros propios archivos locales.

---

## 3. Guía para Añadir un Nuevo Diseño de Camiseta

Para añadir un nuevo diseño sin errores, sigue estos pasos:

1.  **Prepara el archivo SVG**:
    -   Abre tu nuevo SVG en un editor de texto o vectorial.
    -   Identifica qué partes corresponden al color primario y cuáles al secundario.
    -   **Estandariza los colores**: Busca y reemplaza todos los colores primarios por `#33f` y todos los secundarios por `#ffffff`. Asegúrate de usar el formato completo de 6 caracteres para el blanco.
    -   Guarda el archivo SVG estandarizado en la carpeta `public/jerseys/` (ej: `nuevo-diseno.svg`).

2.  **Actualiza los Tipos (`src/lib/types.ts`)**:
    -   Añade el nuevo identificador a `JerseyType`.
        ```typescript
        export type JerseyType = 'plain' | 'vertical' | 'band' | 'chevron' | 'thirds' | 'lines' | 'nuevo_diseno';
        ```

3.  **Añade la Configuración (`src/lib/jersey-templates.ts`)**:
    -   Añade una nueva entrada al objeto `JERSEY_TEMPLATES`.
        ```typescript
        export const JERSEY_TEMPLATES: Record<JerseyType, JerseyTemplate> = {
          // ... otros templates
          nuevo_diseno: { // El 'key' debe coincidir con el tipo que agregaste
            type: 'nuevo_diseno',
            label: 'Nuevo Diseño', // El nombre que verá el usuario
            description: 'Descripción del nuevo diseño',
            svgPath: '/jerseys/nuevo-diseno.svg', // Ruta al nuevo archivo SVG
            colorMapping: {
              primary: ['#33f'], // Debe coincidir con el color primario estandarizado en el SVG
              secondary: ['#ffffff'], // Debe coincidir con el color secundario estandarizado
            },
          },
        };
        ```

4.  **Verifica**:
    -   Levanta la aplicación y ve al diálogo de creación de equipos.
    -   El nuevo diseño debería aparecer en la grilla, en color gris.
    -   Al seleccionarlo, la vista previa debería actualizarse y la selección de colores debería funcionar correctamente.

Siguiendo estos pasos, cualquier nuevo diseño se integrará perfectamente al sistema existente.
