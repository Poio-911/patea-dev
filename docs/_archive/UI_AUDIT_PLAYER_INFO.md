# Auditoría UI: Información de Jugadores (OVR / Posición / Atributos / Foto)

Fecha: 2025-11-13

## Objetivo
Unificar la presentación de datos clave del jugador (Foto, Nombre, Posición, OVR, Atributos principales) para lograr consistencia visual y cognitiva en toda la app.

## Componentes Relevantes Analizados
- `PlayerCard` (listado general en `/players`)
- `PlayerDetailCard` (perfil propio y de otros jugadores)
- `PlayerProfileView` (envoltorio del perfil con acciones de generación/crop)
- `TeamRosterPlayer` (jugadores dentro del roster de equipo/grupos)
- Listas compactas (e.g. match teams / dialogs) — ya simplificadas recientemente

## Diferencias Detectadas
1. Posición:
   - `PlayerCard`: texto grande (2xl) con color por posición.
   - `PlayerDetailCard`: badge estilizado (variant secondary) con color por posición.
   - `TeamRosterPlayer`: badge `outline` con fondo claro + icono posicional.
   - Listas simplificadas recientes: badge pequeño (text-xs) con estilo minimal.
2. OVR:
   - `PlayerCard`: número muy grande (text-5xl) arriba a la derecha.
   - `PlayerDetailCard`: número centrado en círculo grande (h-20 w-20).
   - `TeamRosterPlayer`: badge secundario pequeño con solo el valor numérico.
   - Listas simples: badge secundario text-xs o badge dedicado.
3. Atributos (PAC, SHO, PAS, DRI, DEF, PHY):
   - `PlayerCard`: grid 2 columnas con bloques (border-2 resaltado del mayor atributo).
   - `PlayerDetailCard`: pills estilizados border-2 y color por valor (amarillo/verde/gris).
   - Otros contextos: No siempre se muestran; a veces ausentes (roster, listas).
4. Foto:
   - `PlayerCard`: avatar circular grande (h-24) dentro de la tarjeta con borde de color posicional.
   - `PlayerDetailCard`: avatar ampliado (h-40) con overlay de generación IA.
   - `TeamRosterPlayer`: avatar mediano (h-16) con badge número camiseta.
5. Acciones de Foto (Generar/Cambiar):
   - Perfil propio: presentes (crop + generar IA) en `PlayerDetailCard` y `PlayerProfileView`.
   - Otras vistas: No se muestran (esperado).
6. Iconografía de posición:
   - `PlayerCard`: usa ícono gigante de fondo (decorativo) según posición.
   - `TeamRosterPlayer`: ícono pequeño junto al nombre.
   - `PlayerDetailCard`: no muestra ícono posicional explícito (solo color).

## Problemas de Consistencia
- El usuario percibe incoherencia especialmente entre la tarjeta listada (`PlayerCard`) y el perfil (`PlayerDetailCard`).
- Distinta semántica visual para OVR (gigante vs. circular vs. badge pequeño) sin patrón claro de jerarquía.
- Diferencias en la forma de destacar el atributo principal.
- Posición a veces es texto, otras badge, otras con ícono: falta decisión de canonical.
- Estilos de color: variedad entre `text-*`, `badge variant outline`, `border-*` → coste cognitivo.

## Propuesta de Estilo Unificado (Canonical Design)
"Canonical Player Info Block" que todo componente puede adaptar según densidad.

### Tokens / Variantes
- Posición: siempre `Badge` con color semántico y texto en mayúsculas.
- OVR: siempre número con clase base `font-headline font-bold` y tamaño adaptativo:
  - Compacto: `text-sm badge variant secondary`.
  - Estándar (listado / perfil): `text-4xl` sin círculo; si se requiere destacar más, envolver en contenedor sutil (`rounded-md bg-muted/30 px-2`).
- Atributos: estructura única base:
  ```tsx
  <div className="grid grid-cols-2 gap-1">
    {stats.map(s => (
      <div key={s.key} className={cn("flex items-center justify-between rounded-md px-2 py-1 text-xs", s.key===primary.key && "bg-primary/5 border border-primary/30")}> 
        <span className="text-muted-foreground">{labels[s.key]}</span>
        <span className="font-bold text-foreground">{s.value}</span>
      </div>
    ))}
  </div>
  ```
- Ícono de posición: opcional; regla: sólo en vista compacta de roster (alineado a la izquierda) o en fondo decorativo en PlayerCard si se mantiene tema "cromo". Evitar combinación simultánea ícono + badge + color excesivo.
- Foto: tamaño escalonado:
  - Compacto (roster/listas): `h-16 w-16`.
  - Tarjeta estándar: `h-24 w-24`.
  - Perfil: `h-32 w-32` (reduce de 40 para mejorar cohesión y mobile).
- Especialidad (nickname): siempre debajo de OVR y posición, alineado centro, ícono + nombre en `text-xs` si se mantiene.

### Jerarquía Visual
1. Nombre
2. OVR + Posición (en una misma fila, OVR a la izquierda, Posición badge a la derecha en perfil; invertido en tarjetas si se desea mantener layout actual)
3. Foto centrada debajo o arriba según layout.
4. Atributos grid.
5. Acciones (sólo perfil propio): botones estandarizados `size="sm"` alineados en fila.

### Estilos Base Centralizados (Nuevo archivo sugerido)
Crear `components/player-styles.ts` exportando:
- `getPositionBadgeClasses(position)`
- `PlayerAttributesGrid` (componente reutilizable)
- `PlayerOvr` (acepta `size: 'compact' | 'standard'`)
- `PlayerPhoto` (maneja crop + tamaños + loading overlay)

## Cambios Recomendados
1. Refactor `PlayerDetailCard` para usar misma grilla de atributos que `PlayerCard` (eliminando pills personalizadas).
2. Unificar representación de posición a `Badge` en `PlayerCard` (reemplazar texto libre grande) — mantener color + uppercase.
3. Ajustar OVR en `PlayerDetailCard` retirando círculo gigante → mismo estilo base tipográfico.
4. Incorporar ícono de posición sólo en roster y opcionalmente como fondo tenue en `PlayerCard` (ya existe) → no añadirlo al perfil.
5. Reducir foto en perfil de `h-40` a `h-32` para coherencia y mejor viewport mobile.
6. Centralizar lógica de specialty para no duplicar markup entre componentes.
7. Introducir capas responsivas: en mobile atributos se muestran scroll horizontal opcional si falta ancho.

## Botones de Foto Perfil
Ya existen: "Generar Foto IA" y "Cambiar Foto". Confirmar ubicarlos juntos debajo de la foto siempre que sea el perfil del usuario, con contador de créditos como `Badge` pequeño.

## Próximos Pasos (Implementación)
1. Crear módulo de estilos reutilizables (`player-styles.tsx`).
2. Refactor `PlayerDetailCard` → usar componentes unificados.
3. Refactor `PlayerCard` → cambiar Position de texto grande a Badge + ajustar OVR tamaño.
4. Actualizar `TeamRosterPlayer` sólo para reusar `PlayerOvr` y `getPositionBadgeClasses`.
5. QA visual en mobile (Chrome dev tools) y ajustar espacios.

## Riesgos / Consideraciones
- Cambios visuales pueden alterar percepción de "gaming feel"; acordar si se prioriza limpieza sobre impacto.
- Reemplazar elementos grandes puede afectar branding inicial (e.g. OVR gigante). Se puede mantener un "variant" si se necesita.

## Aprobación
Esperando feedback del propietario antes de proceder con refactors.

---
Generado automáticamente por auditoría UI.
