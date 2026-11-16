# Evaluación completa y componentes de identidad

Rama `feat/flutter-mobile-app`. Android `1.0.27+28`.

## Criterio visual

Los recuadros de posición, OVR, participantes y contadores daban el mismo peso a datos secundarios y acciones. La evaluación también repetía selectores con borde y mostraba diez chips para un único voto al MVP. Se conservan las tarjetas como agrupación de contenido; la identidad y los datos breves pasan a tipografía.

- Posición: texto de color y tipografía de lectura como presentación predeterminada del componente compartido. En la evaluación muestra el nombre completo del puesto.
- Menú: OVR numérico con su etiqueta y color de nivel, sin fondo ni borde.
- Pestañas: cantidades como texto junto al nombre, sin pastillas.
- Bandeja: nombres completos de los jugadores junto a sus avatares, sin chips. Los nombres largos pueden ocupar dos líneas sin desbordar. El plazo queda como texto de estado.

## Formulario

1. Contexto del partido y cantidad de jugadores asignados.
2. Estadísticas personales en dos filas con controles de sumar/restar, límites 0–20 y estados deshabilitados en los extremos.
3. Figura del partido en un selector único y opcional, conservando los candidatos y sus IDs reales.
4. Relato personal opcional desplegable, con límite existente de 1.000 caracteres.
5. Cada compañero con avatar, nombre, posición y pestañas Nota/Etiquetas del lenguaje común de la app.
6. Nota de 1 a 10 con denominador, descripción de la escala, extremos visibles y lectura accesible del valor. Se elimina el amarillo/rojo automático de la nota media.
7. Etiquetas en filas con casillas, descripción y agrupación entre aportes y aspectos por mejorar. Se conservan el catálogo y sus efectos enviados al servidor; la vista deja de mostrar las variaciones internas de atributos como metadatos en cada opción.
8. Acción persistente Revisar y enviar. Se oculta con el teclado para dar espacio al relato. La revisión presenta estadísticas y notas antes de confirmar. Cancelar conserva los cambios. El estado ocupado bloquea los controles y los errores de envío conservan el formulario.

Se mantiene el contrato de backend (`points`/`tags`), la escala 1–10 y el mínimo de tres etiquetas por evaluación de ese tipo. No se enviaron evaluaciones reales durante la revisión.

## Verificación

- `evaluation_form_redesign_test.dart`: selector del MVP, estadísticas, revisión/cancelación/envío simulado, bloqueo de envío, persistencia de etiquetas entre modos, validación de tres etiquetas, teclado, menú sin tarjeta de OVR y nombres extensos.
- Pruebas a 320 px de ancho con texto al 130 % en Game y Claro.
- Goldens nuevos del formulario y del menú en ambos temas. Referencias de los componentes compartidos, pestañas de partidos y bandeja actualizadas por cambios visuales intencionales.
- La bandeja conserva la actualización automática corregida en `EVALUATIONS_LIVE_INBOX_FIX_2026-11-16.md`.

- Suite completa: **237 pruebas aprobadas**. Análisis sin errores ni advertencias; 28 observaciones informativas preexistentes.
- APK release x64 instalado con reemplazo: versión `1.0.27`, código `28`. Revisión manual del formulario real de Briseida con Eminencia y Álvaro, notas y etiquetas, menú y ambos temas. Se restauró Game y se dejó abierto el formulario en las notas.
- Capturas de revisión: `patea_mobile/build/typography-review/evaluation-redesign-*`. No se modificaron ni enviaron evaluaciones reales.
