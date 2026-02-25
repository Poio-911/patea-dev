# Match Cards – Rediseño v4: Integración Temática (Claro, Oscuro y Game Mode)

**Objetivo:** Restaurar la elegancia de las tarjetas asegurando que funcionen perfectamente en Tema Claro, Tema Oscuro y Game Mode (frente a la aproximación "constantemente oscura" de v3 que no escalaba a fondos blancos). 

---

## 1. Problemas de la versión v3
1. **Conflicto de Temas:** Al forzar colores `hsl()` oscuros y `text-white`, las tarjetas se veían pesadas y antinaturales en el Tema Claro de la aplicación.
2. **Exceso de Capas:** Combinar un fondo radial oscuro, texturas de pasto (`pitch-texture`), y paneles de cristal negro (`bg-black/35`) introdujo "ruido visual". 
3. **El Botón Neón:** Usar el `glowColor` del `matchTheme` como fondo del botón de acción principal (`style={{ backgroundColor: matchTheme.glowColor }}`) distraía la vista y no seguía patrones UI convencionales.
4. **Agujeros Negros Radiales:** El gradiente radial cortaba al 65%, dejando una gran zona muerta sin interés visual, arruinando la profundidad de la tarjeta.

---

## 2. Solución v4: Estilos Basados en Tailwind Responsivo (Adaptive Theme)

La clave es usar la potencia de Tailwind (`dark:`, propiedades nativas de colores) en lugar de intentar inyectar variables de color en línea.

### 2.1 La Paleta

Definiremos los mismos tintes pero escalables: Azul (`manual`), Teal (`collaborative`), Indigo (`by_teams`), Ámbar (`league`, `league_final`), Rojo (`cup`), y Verde (`intergroup_friendly`).

Para cada uno, `match-theme.ts` definirá un objeto de clases de Tailwind:
```typescript
{
    // Fondo base de la tarjeta (gradiente súper sutil)
    gradient: 'from-blue-500/10 via-blue-500/5 to-transparent dark:from-blue-500/20 dark:via-blue-500/10',
    
    // El halo decorativo (Glow Orb)
    glow: 'bg-blue-500/30 dark:bg-blue-500/50',
    
    // Insignias (Badges) adaptables
    badge: 'bg-blue-500/10 border-blue-500/20 text-blue-700 dark:bg-blue-500/20 dark:border-blue-500/40 dark:text-blue-300',
    
    // Botón principal
    button: 'bg-blue-100 hover:bg-blue-200 text-blue-800 dark:bg-blue-900/50 dark:hover:bg-blue-900 dark:text-blue-100 border border-blue-200 dark:border-blue-800',
    
    // Borde de la tarjeta
    border: 'border-blue-500/20 dark:border-blue-500/30',
}
```

### 2.2 Reestructuración de la Tarjeta (`MatchCard.tsx`)
*   Se elimina el contenedor `bg-black/35`.
*   El fondo base vuelve a ser dependiente del contenedor global (`bg-card`).
*   Textos: Se retira `text-white` forzado; los textos principales usarán la propiedad dinámica `text-foreground` y el soporte secundario usará `text-muted-foreground`.
*   **Pitch Texture**: Solamente será visible en modo oscuro/game mode (mediante opacidad atada al sistema: `opacity-0 dark:opacity-10`), ya que el césped fotográfico en modo claro desentona severamente.

### 2.3 Solucionando React Keys Duplicates
Durante la implementación se arreglará el aviso de:
`Warning: Encountered two children with the same key` en el `PlayerAvatarStack` 
Usando `Array.from(new Map(players.map(p => [p.uid, p])).values())` para asegurar que nunca falle visualmente el render, incluso si en la base de datos hay basura redundante.

---

## 3. Plan de Acción Técnico

1.  **Refactorizar `match-theme.ts`**: Reemplazar la interface antigua con `MatchTheme` que solo exponga cadenas de Tailwind para background, border, glow, etc.
2.  **Actualizar Tailwind Safelist**: Borrar el safelist de la v3 en `tailwind.config.ts`, y pegar el nuevo bloque con las clases completas de light/dark.
3.  **Actualizar Componentes (`MatchCard`, `CompactMatchCard`, `HeroMatchCard`)**: Limpiar todo CSS Inline de `style={{ background: ... }}`. Usar las nuevas utilidades.
4.  **Fix Avatar Stack**: Añadir el Set/Map para eliminar duplicados inmediatamente.
