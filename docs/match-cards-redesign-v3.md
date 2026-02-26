# Match Cards – Rediseño v3: Gradientes Radiales + Paleta Consistente

**Rama:** `dev-app-Ai`
**Fecha:** 2026-02-25
**Archivos modificados:** 6

---

## Problema que resolvía

| Problema | Síntoma visible |
|---|---|
| `linear-gradient(135deg, ...)` | Dos bandas diagonales de color visibles en la card |
| `collaborative` usaba amber = `league` | Dos tipos distintos con color idéntico |
| `by_teams` usaba slate-blue ≈ `manual` | Difíciles de distinguir visualmente |
| Hero banner en game mode usaba `--primary` (volt yellow) | Chocaba con los colores variados de las cards |
| Botón "Ver Detalles" con `bg-white/15` | Casi invisible sobre el fondo oscuro de la card |

---

## Concepto visual: spotlight radial

El gradiente lineal crea bandas: un color arriba-izquierda, otro abajo-derecha.
El gradiente radial tipo "spotlight" simula una fuente de luz que nace en la esquina
superior-derecha (donde vive el glow orb) y se desvanece hacia negro — exactamente como FIFA FUT / Sofascore.

```
radial-gradient(ellipse 90% 70% at 90% 0%, accentColor 0%, darkBase 65%)
                ↑ forma elíptica   ↑ origen: esquina superior-derecha
```

- `90% 0%` → punto de origen: borde derecho, borde superior
- `ellipse 90% 70%` → forma achatada horizontalmente, cubre casi todo el ancho
- `accentColor 0%` → color del tipo en el origen
- `darkBase 65%` → fondo casi negro donde termina el gradiente
- Sin segundo stop intermedio → transición suave, sin bandas

---

## 1. `src/lib/match-theme.ts`

### Paleta antes vs. después

| Tipo | Color antes | Color después | Cambio |
|---|---|---|---|
| `manual` | Azul | **Azul** | Solo gradiente (linear → radial) |
| `collaborative` | **Amber** | **Teal / Cyan** | Color completo cambiado |
| `by_teams` | **Slate-blue** | **Indigo / Violeta** | Color completo cambiado |
| `league` | Orange/Amber | **Amber** | Badge cambiado de orange → amber |
| `cup` | Rojo | **Rojo** | Solo gradiente |
| `league_final` | Oro → Rojo | **Oro → Rojo** | Solo gradiente (3 stops) |
| `intergroup_friendly` | Verde | **Verde** | Solo gradiente |

### Definiciones completas por tipo

#### `manual` — Azul

```typescript
gradientStyle: 'radial-gradient(ellipse 90% 70% at 90% 0%, hsl(220, 70%, 45%) 0%, hsl(220, 45%, 9%) 65%)',
glowColor:     'hsl(220, 80%, 58%)',
badge:         'bg-blue-500/20 border border-blue-400/40',
badgeText:     'text-blue-200',
border:        'border-blue-500/40',
```

- `hsl(220, 70%, 45%)` — azul medio, origen del spotlight
- `hsl(220, 45%, 9%)` — azul casi negro, base oscura
- `glowColor hsl(220, 80%, 58%)` — azul más brillante para el orb y el botón

#### `collaborative` — Teal / Cyan *(era amber)*

```typescript
gradientStyle: 'radial-gradient(ellipse 90% 70% at 90% 0%, hsl(185, 70%, 36%) 0%, hsl(185, 50%, 9%) 65%)',
glowColor:     'hsl(185, 75%, 48%)',
badge:         'bg-teal-500/20 border border-teal-400/40',
badgeText:     'text-teal-200',
border:        'border-teal-500/40',
```

- `hsl(185, ...)` — tono cyan-teal (entre verde y azul)
- Antes era `hsl(38, ...)` (amber), idéntico a `league`
- Safelist añadida: `bg-teal-500/20`, `border-teal-400/40`, `border-teal-500/40`, `text-teal-200`

#### `by_teams` — Indigo / Violeta *(era slate-blue)*

```typescript
gradientStyle: 'radial-gradient(ellipse 90% 70% at 90% 0%, hsl(252, 52%, 42%) 0%, hsl(252, 38%, 10%) 65%)',
glowColor:     'hsl(252, 60%, 58%)',
badge:         'bg-indigo-500/20 border border-indigo-400/40',
badgeText:     'text-indigo-200',
border:        'border-indigo-500/40',
```

- `hsl(252, ...)` — violeta-indigo (hue más cálido que el azul de `manual`)
- Antes era `hsl(215, ...)` slate-blue, muy similar a `manual` (hsl 220)
- Safelist añadida: `bg-indigo-500/20`, `border-indigo-400/40`, `border-indigo-500/40`, `text-indigo-200`

#### `league` — Amber / Oro

```typescript
gradientStyle: 'radial-gradient(ellipse 90% 70% at 90% 0%, hsl(38, 88%, 40%) 0%, hsl(35, 60%, 9%) 65%)',
glowColor:     'hsl(38, 95%, 55%)',
badge:         'bg-amber-500/20 border border-amber-400/40 font-bold',
badgeText:     'text-amber-200',
border:        'border-amber-500/40',
```

- Badge cambiado de `orange` a `amber` para consistencia con el `glowColor` (hsl 38 = amber)
- `hsl(35, 60%, 9%)` — base muy oscura con ligero tinte cálido
- `font-bold` en badge para reforzar jerarquía competitiva

#### `cup` — Carmesí / Rojo

```typescript
gradientStyle: 'radial-gradient(ellipse 90% 70% at 90% 0%, hsl(0, 65%, 38%) 0%, hsl(0, 50%, 9%) 65%)',
glowColor:     'hsl(0, 80%, 55%)',
badge:         'bg-red-500/20 border border-red-400/40 font-bold',
badgeText:     'text-red-200',
border:        'border-red-500/40',
```

- `hsl(0, ...)` — rojo puro (hue 0°)
- Saturación reducida respecto al v2 (65% vs 70%) para evitar exceso de rojo
- `font-bold` en badge igual que `league`

#### `league_final` — Oro → Rojo (3 stops)

```typescript
gradientStyle: 'radial-gradient(ellipse 90% 70% at 90% 0%, hsl(42, 98%, 45%) 0%, hsl(0, 68%, 30%) 55%, hsl(0, 50%, 9%) 100%)',
glowColor:     'hsl(42, 100%, 58%)',
badge:         'bg-gradient-to-r from-yellow-500/30 via-red-500/30 to-yellow-500/30 border border-yellow-400/50 font-extrabold',
badgeText:     'text-yellow-100',
border:        'border-yellow-500/50',
animate:       true,
```

- Único tipo con **3 stops** en el radial: oro brillante → rojo oscuro → negro
- `hsl(42, 98%, 45%)` — amarillo dorado en el spotlight
- `hsl(0, 68%, 30%)` — rojo medio a mitad del gradiente (55%)
- `hsl(0, 50%, 9%)` — base casi negra con tinte rojo (100%)
- Badge con gradiente horizontal `from-yellow via-red to-yellow` + `animate-pulse`
- `font-extrabold` para máxima jerarquía visual

#### `intergroup_friendly` — Verde

```typescript
gradientStyle: 'radial-gradient(ellipse 90% 70% at 90% 0%, hsl(145, 55%, 30%) 0%, hsl(145, 45%, 8%) 65%)',
glowColor:     'hsl(145, 65%, 45%)',
badge:         'bg-green-500/20 border border-green-400/40',
badgeText:     'text-green-200',
border:        'border-green-500/40',
```

- `hsl(145, ...)` — verde medio (entre césped y esmeralda)
- Saturación conservada, solo tipo de gradiente cambiado

---

## 2. `src/components/match-card.tsx`

### Gradiente: `backgroundImage` → `background`

```tsx
// Antes
style={{ backgroundImage: matchTheme.gradientStyle }}

// Después
style={{ background: matchTheme.gradientStyle }}
```

**Por qué:** `backgroundImage` no acepta `radial-gradient()` combinado con otras propiedades
de fondo. La propiedad shorthand `background` sí. El glow orb sigue siendo un `<div>` separado
con `style={{ background: matchTheme.glowColor }}` (esta parte no cambia).

### Botón "Ver Detalles"

```tsx
// Antes — casi invisible
<Button asChild className="w-full bg-white/15 hover:bg-white/25 text-white border-white/20" variant="outline">

// Después — fondo sólido con el color del tipo
<Button
    asChild
    variant="ghost"
    className="w-full font-semibold text-white shadow-sm"
    style={{ backgroundColor: matchTheme.glowColor }}
>
```

- `variant="ghost"` elimina el borde y el fondo por defecto de Shadcn
- `style={{ backgroundColor: matchTheme.glowColor }}` inyecta el color del tipo como fondo sólido
- `font-semibold` para contraste con el botón "Equipos" (que mantiene `bg-white/10`)
- El botón "Equipos" **no cambia**: sigue con `bg-white/10 hover:bg-white/20 text-white border-white/20`

---

## 3. `src/components/compact-match-card.tsx`

Solo cambio de propiedad CSS, idéntico al de `match-card.tsx`:

```tsx
// Antes
style={{ backgroundImage: matchTheme.gradientStyle }}

// Después
style={{ background: matchTheme.gradientStyle }}
```

El glow orb y el pitch texture no cambian. El efecto visual en la card compacta
(usada en listados y mapas) es el mismo spotlight que en la card completa.

---

## 4. `src/components/next-match-card.tsx`

Este es el hero banner "Próximo Partido" que muestra video de fondo.

### Imports añadidos

```tsx
import { getMatchTheme } from '@/lib/match-theme';
```

### Variable añadida (después del null check)

```tsx
const matchTheme = getMatchTheme(match.type);
```

Se define **después** del `if (!match) return (...)` para garantizar que `match.type` existe.

### Overlay div — antes

```tsx
<div className="absolute inset-0 bg-gradient-to-br from-primary/40 via-primary/25 to-background/50 game-banner-overlay" />
```

Problemas:
- `from-primary/40` usa `--primary` (volt yellow en game mode) → color fijo sin relación al tipo
- `.game .game-banner-overlay` en CSS sobreescribía con `hsl(75, 100%, 60%, 0.35) !important` → volt amarillo en todos los partidos

### Overlay div — después

```tsx
<div
    className="absolute inset-0"
    style={{
        backgroundImage: [
            `radial-gradient(ellipse 100% 80% at 95% 0%, ${matchTheme.glowColor} 0%, transparent 55%)`,
            'linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.65) 100%)'
        ].join(', ')
    }}
/>
```

**Dos capas combinadas con coma (CSS multi-background):**

1. **Radial spotlight** — `radial-gradient(ellipse 100% 80% at 95% 0%, glowColor 0%, transparent 55%)`
   - Origen: esquina superior-derecha del banner (`95% 0%`)
   - `glowColor` en el pico, `transparent` a los 55% → el video se ve en el centro y parte baja
   - `ellipse 100% 80%` — más ancho que en las cards para cubrir el banner grande

2. **Oscurecido para legibilidad** — `linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.65) 100%)`
   - Top: 25% de negro → el video respira arriba
   - Bottom: 65% de negro → texto e info del partido legibles

### Botón "Ver Detalles" — antes

```tsx
<Button asChild size={isCompact ? 'default' : 'lg'} className="game-theme-button">
```

- `game-theme-button` en game mode era sobreescrito con amarillo volt y texto negro

### Botón "Ver Detalles" — después

```tsx
<Button
    asChild
    size={isCompact ? 'default' : 'lg'}
    variant="ghost"
    className="font-bold text-white shadow-md"
    style={{ backgroundColor: matchTheme.glowColor }}
>
```

- Mismo patrón que en `match-card.tsx`: `glowColor` como fondo sólido
- `variant="ghost"` limpia estilos base de Shadcn
- `font-bold` (más peso que `font-semibold` en la card) por el tamaño mayor del banner
- `shadow-md` para elevar el botón sobre el video

---

## 5. `src/app/globals.css`

### Bloque eliminado

```css
/* 1. Banner overlay: Semitransparent green-yellow */
.game .game-banner-overlay {
  background: hsl(75, 100%, 60%, 0.35) !important;
  mix-blend-mode: normal !important;
}
```

**Por qué solo este bloque:** La clase `game-theme-button` sigue siendo usada en
`src/components/match-details/MatchInfoCard.tsx` (botón "Ver Detalles" en la página de detalle
del partido), por lo que sus reglas CSS se mantienen intactas.

La clase `game-banner-overlay` queda como no-op en `MatchInfoCard.tsx` — el overlay de ese
componente tiene sus propios gradientes Tailwind por tipo de partido y sigue funcionando.

### Bloques conservados

- `.game .game-theme-button { ... }` — sigue aplicando a `MatchInfoCard.tsx`
- `.game .game-theme-button svg { ... }` — ídem
- `.game .next-match-banner { ... }` — legibilidad de texto sobre video
- `.game .next-match-banner a:not(.game-theme-button) { ... }` — links en blanco
- `.game svg.icon-with-circle { ... }` — íconos con círculo blanco (Calendario, Reloj, Navegación)
- `.game .badge { ... }` — badges con fondo oscuro en game mode

---

## 6. `tailwind.config.ts`

`src/lib/match-theme.ts` **no está en el array `content`** de Tailwind, por lo que sus
clases dinámicas no son detectadas por el purge. Se añaden manualmente al `safelist`.

### Safelist antes

```typescript
safelist: [
  'border-blue-500/40', 'border-amber-500/40', 'border-slate-500/40',
  'border-orange-500/40', 'border-red-500/40', 'border-yellow-500/50', 'border-green-500/40',
],
```

### Safelist después

```typescript
safelist: [
  // Match type borders
  'border-blue-500/40', 'border-teal-500/40', 'border-indigo-500/40',
  'border-amber-500/40', 'border-red-500/40', 'border-yellow-500/50', 'border-green-500/40',
  // Badge backgrounds
  'bg-blue-500/20', 'bg-teal-500/20', 'bg-indigo-500/20',
  'bg-amber-500/20', 'bg-red-500/20', 'bg-green-500/20',
  // Badge borders
  'border-blue-400/40', 'border-teal-400/40', 'border-indigo-400/40',
  'border-amber-400/40', 'border-red-400/40', 'border-green-400/40',
  // Badge text
  'text-blue-200', 'text-teal-200', 'text-indigo-200',
  'text-amber-200', 'text-red-200', 'text-green-200',
],
```

**Clases eliminadas del safelist:**
- `border-slate-500/40` — `by_teams` ya no usa slate
- `border-orange-500/40` — `league` ya no usa orange

**Clases añadidas al safelist:**
- Teal: `border-teal-500/40`, `bg-teal-500/20`, `border-teal-400/40`, `text-teal-200`
- Indigo: `border-indigo-500/40`, `bg-indigo-500/20`, `border-indigo-400/40`, `text-indigo-200`
- Resto (blue, amber, red, green): backgrounds, borders de badge y textos que antes no estaban

---

## Resultado visual esperado

| Superficie | Antes | Después |
|---|---|---|
| Card background | Dos bandas diagonales de color | Spotlight desde esquina superior-derecha |
| `collaborative` card | Amber (igual que liga) | Teal / Cyan |
| `by_teams` card | Slate-blue (similar a manual) | Indigo / Violeta |
| Botón "Ver Detalles" (card) | Semi-transparente `white/15`, difícil de ver | Fondo sólido con el color del tipo |
| Hero banner overlay | Volt yellow en game mode | Spotlight del color del tipo sobre el video |
| Botón "Ver Detalles" (banner) | Volt yellow en game mode, negro en light/dark | Fondo sólido con el color del tipo en todos los modos |
| Video de fondo (banner) | Parcialmente oculto por overlay opaco | Visible en el centro gracias al overlay semitransparente |

---

## Arquitectura del sistema de temas (referencia)

```
getMatchTheme(match.type)
        ↓
  MatchTheme {
    gradientStyle  → style={{ background: ... }}    (card/compact-card)
    glowColor      → style={{ background: ... }}    (glow orb div)
                   → style={{ backgroundColor: ... }} (botón Ver Detalles)
                   → template literal en backgroundImage (banner overlay)
    badge          → className del Badge de tipo
    badgeText      → className del texto del Badge
    border         → className del borde de la Card
    animate        → condiciona animate-pulse en el badge (solo league_final)
  }
```

El glow orb (`<div className="absolute -top-12 -right-12 w-44 h-44 rounded-full blur-3xl opacity-50">`)
y el gradiente de fondo comparten el mismo `glowColor`, creando coherencia entre la fuente
de luz del spotlight y el halo que aparece en la esquina.
