# Entrega iOS 1.0.30

El usuario autoriza compilar y distribuir en TestFlight el 16/11/2026. Rama `feat/flutter-mobile-app`; se incluyen las mejoras de perfil, competiciones y los cambios locales de interfaz aportados por el usuario.

`ios-testflight` publica sólo con etiquetas `ios-testflight-*`. Los pushes ordinarios ya no distribuyen versiones. Se conserva la integración App Store Connect `patea`, firma existente, app 6808798274 y distribución interna histórica sin añadir testers externos. No se envía a revisión de App Store ni se expiran builds anteriores. El número de build se calcula contra Apple en Codemagic, independiente del +31 local.

La prueba del Panel se actualiza para comprobar la bienvenida y la composición vigente; el botón general Armar partido fue retirado deliberadamente por el usuario, y permanece accesible desde Partidos. Los resultados de compilación y publicación se registran al finalizar.


La publicación consulta los grupos actuales de Apple con la integración de CI: conserva los internos con acceso automático, o los internos de la build previa; si hay un único grupo interno lo usa. Si la selección es ambigua, se detiene sin ampliar destinatarios. El paso no termina correctamente hasta que Apple informa procesamiento VALID y se verifica la pertenencia de la build a los grupos elegidos. El comprobante queda en `build/ios/testflight-delivery.json`. Cuatro pruebas locales cubren la selección de grupos y el rechazo de destinos externos o ambiguos.


## Primer intento — pendiente de publicación

Etiqueta `ios-testflight-1.0.30-20261116`, fuente `cf4ac4ec`. [Build de Codemagic](https://codemagic.io/app/6a9b3fecaea87264a4d6ae80/build/6afb7e0b799fbd143cd747a7). Terminó el 16/11/2026 a las 22:18:17 UTC: firma y compilación del IPA correctas; el paso personalizado de publicación falló antes de confirmar la entrega. No se declara distribuida esta versión. Para revisar el log detallado y reutilizar el artefacto hace falta sesión de Codemagic; se dejó abierto el acceso mediante GitHub.

Validación local: 283 pruebas Flutter y 4 pruebas de selección de grupos aprobadas. Los checks de GitHub de `bd355cf8` están en verde: Flutter, web, Cloud Functions y reglas de Firestore. Ese commit sólo actualiza el doble de prueba de evaluaciones para soportar la lectura previa al análisis; no modifica el IPA.


## Reintento con el publicador nativo

Se retira del workflow el publicador Python añadido en el primer intento, y se restaura el bloque `publishing.app_store_connect` usado en entregas anteriores: integración `patea`, TestFlight habilitado, App Store deshabilitado, sin añadir grupos externos. La compilación sigue restringida a etiquetas explícitas. El primer fallo queda conservado en el registro; la distribución no se da por terminada hasta comprobar el nuevo resultado.
