# Evaluaciones que no aparecen después de terminar un partido

Rama `feat/flutter-mobile-app`. Android `1.0.26+27`.

## Caso confirmado

Briseida recibió la notificación del partido `qrVOXyawztZBtTg7i6md6Opbt5H2_a20ebcb3-fbb2-492f-8b53-e3d2ec27bf3c`, pero la pestaña Evaluaciones seguía mostrando cero pendientes. Firestore tenía el partido completado y dos asignaciones pendientes para ella; ambos perfiles asignados existían. No faltaban asignaciones ni era necesario regenerarlas.

La bandeja usaba un `FutureProvider` persistente con una lectura única. Una visita anterior podía conservar una lista vacía durante toda la sesión. Terminar el partido y recibir la notificación no invalidaban ese resultado. Además, la lista vacía no permitía desplazar contenido corto para activar la recarga manual.

## Corrección

- La bandeja usa un `StreamProvider.autoDispose` por evaluador.
- Escucha `assignments` con `evaluatorId` del usuario y estados `pending`/`completed`, usando el índice y las reglas existentes. Cada cambio confirmado reconstruye pendientes e historial.
- La consulta exacta se verificó contra Firebase: encontró 13 asignaciones entre pendientes y completadas de Briseida, incluidas las dos del partido recién finalizado.
- El servicio depende de la sesión para reconstruirse cuando cambia el usuario.
- La lista vacía y las listas cortas admiten deslizar para actualizar. El estado de error permite reintentar.
- No se cambian resultados, asignaciones, notificaciones ni evaluaciones guardadas. No hay despliegue de backend ni índices nuevos.

## Regresión

`patea_mobile/test/evaluation_inbox_live_test.dart` comprueba que una bandeja inicialmente vacía recibe nuevas asignaciones sin invalidación manual, que refleja el paso a completadas y que la pantalla abierta reemplaza el estado vacío al recibir el partido y que un gesto real de recarga atraviesa el viewport de las pestañas.

La recarga manual también requería aceptar notificaciones verticales que atraviesan el `TabBarView`; el filtro de profundidad predeterminado descartaba esos gestos. La prueba reproduce esa segunda causa y verifica que vuelve a consultar.

Suite completa: **224 pruebas aprobadas**. Análisis sin errores ni advertencias, con 28 observaciones informativas preexistentes.

Verificación en el emulador con Briseida, APK `1.0.26+27` instalado con reemplazo: aparece **1 pendiente** del Partido Amistoso con Eminencia y Álvaro. Se abrió el formulario y cargaron las asignaciones; se volvió a la bandeja sin enviar evaluaciones. Captura: `patea_mobile/build/typography-review/evaluations-live-inbox-confirmed.png`.
