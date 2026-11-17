# Partidos compactos e iconos del menú — 1.0.32+33

La vista de dos columnas deja de imponer una proporción de 0,72 a todas las tarjetas. Las filas se crean bajo demanda y toman la altura del contenido, conservando la separación de 10 px y dos columnas. El título también toma su altura natural. Se corrige el desborde del tipo y organizador en el destacado a 320 px con texto al 130 %: los elementos pasan a otra línea cuando hace falta.

Cuatro pruebas verifican Game/Claro, texto normal y ampliado, ausencia de desbordes y distancia entre la acción y el borde inferior. Se comprueban también las referencias visuales existentes de Partidos.

## Propuestas de iconos

Las variantes son propuestas visuales; el menú instalado conserva sus iconos hasta elegir una familia. No se cambian rutas ni nombres de las secciones.

| Variante | Panel | Jugadores | Partidos | Explorar | Evaluaciones |
| --- | --- | --- | --- | --- | --- |
| Mixta, recomendada | Casa | Grupo | Duelo | Lupa | Planilla con lápiz |
| Familiar | Casa | Grupo | Calendario | Brújula | Planilla revisada |
| De cancha | Terreno | Camiseta | Duelo | Radar | Estrella |

Las tres mantienen trazos consistentes, etiquetas visibles y estado activo del tema. La propuesta Mixta reemplaza persona individual y globo por plantel y búsqueda, y vincula evaluar con completar una planilla. Las variantes se entregan en una comparación interactiva dentro del chat.


## Selección aplicada — 1.0.33+34

El usuario eligió **opción 1, Tabler deportivo** de las nuevas familias. Sustituye las propuestas anteriores de iconos. El menú usa los SVG originales de Tabler, con viewBox 24×24, trazo 2 y color semántico del tema:

| Sección | Archivo Tabler |
| --- | --- |
| Panel | soccer-field |
| Jugadores | shirt-sport |
| Partidos | ball-football |
| Explorar | map-search |
| Evaluaciones | clipboard-check |

Se empaquetan en `patea_mobile/assets/icons/nav-*.svg`; no requieren red. `SectionIcon` centraliza tamaño, tintado y alternativa Material para secciones sin SVG. La barra mantiene rutas, etiquetas, selección accesible y animación existente; Mis Partidos usa la misma pelota en el menú desplegable. Competiciones conserva su copa.

Fuentes originales: https://github.com/tabler/tabler-icons/tree/main/icons/outline. Licencia MIT de Paweł Kuna conservada en `assets/icons/TABLER_LICENSE.txt`. Los trazados no se redibujaron ni deformaron.

Verificación: 13 pruebas existentes de navegación, identidad de secciones y flujos de perfil/competiciones aprobadas; análisis sin errores ni advertencias (avisos informativos de estilo previos). APK release local 1.0.33+34 para revisión Android; no implica una distribución nueva en TestFlight.
