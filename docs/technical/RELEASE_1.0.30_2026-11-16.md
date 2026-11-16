# Entrega iOS 1.0.30

El usuario autoriza compilar y distribuir en TestFlight el 16/11/2026. Rama `feat/flutter-mobile-app`; se incluyen las mejoras de perfil, competiciones y los cambios locales de interfaz aportados por el usuario.

`ios-testflight` publica sólo con etiquetas `ios-testflight-*`. Los pushes ordinarios ya no distribuyen versiones. Se conserva la integración App Store Connect `patea`, firma existente, app 6808798274 y distribución interna histórica sin añadir testers externos. No se envía a revisión de App Store ni se expiran builds anteriores. El número de build se calcula contra Apple en Codemagic, independiente del +31 local.

La prueba del Panel se actualiza para comprobar la bienvenida y la composición vigente; el botón general Armar partido fue retirado deliberadamente por el usuario, y permanece accesible desde Partidos. Los resultados de compilación y publicación se registran al finalizar.


La publicación consulta los grupos actuales de Apple con la integración de CI: conserva los internos con acceso automático, o los internos de la build previa; si hay un único grupo interno lo usa. Si la selección es ambigua, se detiene sin ampliar destinatarios. El paso no termina correctamente hasta que Apple informa procesamiento VALID y se verifica la pertenencia de la build a los grupos elegidos. El comprobante queda en `build/ios/testflight-delivery.json`. Cuatro pruebas locales cubren la selección de grupos y el rechazo de destinos externos o ambiguos.
