# Presentaciones de información y ficha rápida

## Clima

Se conserva la hoja inferior porque es una consulta contextual breve. El contenido se apoya directamente sobre una superficie de color popover, sin tarjeta interior, borde ni doble margen. Mantiene el acceso compacto desde la portada, la actualización, los avisos y el cierre por gesto. Sigue siendo desplazable si el contenido o la escala de texto requieren más altura.

## Jugador desde el detalle del partido

La player card aparece en un diálogo transparente sobre el partido oscurecido. No hay panel exterior ni barra de arrastre. La tarjeta mantiene su diseño y relación 2:3; el espacio disponible permite ampliarla hasta 340 puntos de ancho. En pantallas cortas el contenido puede desplazarse, manteniendo un ancho legible.

La X tiene un área de interacción de 48 puntos. También se puede cerrar con Atrás o tocando fuera. Ver perfil completo es una acción de texto debajo de la tarjeta; primero cierra la vista rápida y después navega al perfil. Se conserva la carga del jugador completo y la ficha de respaldo de la convocatoria mientras se obtiene.

El menú del usuario y las hojas de acciones conservan su presentación de menú. Esta revisión afecta a la consulta del clima y a la ampliación de la player card desde el partido.

## Validación

33 pruebas de vista rápida, clima e integración del detalle: cierre, navegación al perfil, ausencia de paneles anidados, Game/Claro, lectura y controles a escala 2x en pantalla de 360 × 640. Capturas de demostración en `patea_mobile/build/overlay-review` y `patea_mobile/build/weather-review`. No se modifican datos externos.
