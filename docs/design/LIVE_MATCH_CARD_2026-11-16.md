# Estado En vivo sin glow — 1.0.23+24

A partir de la captura del usuario, se simplifica el destacado de los partidos activos en el listado.

- Se retiran el halo rojo exterior, el borde rojo y el pulso de la tarjeta. `_MatchCard` pasa de StatefulWidget con AnimationController a StatelessWidget.
- Se mantiene el borde tenue asociado al tipo de partido, igual que en las otras tarjetas.
- La etiqueta dice «En vivo», con un punto rojo pequeño y estático sobre una superficie neutra. La tinta principal es la del tema; las etiquetas usan una tipografía de lectura más clara.
- El botón usa `primary/onPrimary`, sin fondo rojo ni rayo en el texto; se mantiene su destino de navegación.
- La fotografía de un partido activo recibe la misma opacidad que los próximos, sin aumentar su brillo para llamar la atención.
- No cambian datos, permisos, resultados ni comportamiento del partido.

Trabajo en `feat/flutter-mobile-app`, sin nuevo worktree ni distribución externa. Analizador sin errores ni advertencias, con 28 observaciones informativas previas.

Comparativas de Partidos actualizadas en Game y Claro, con el cambio intencional de tipografía de etiquetas. Los tres casos de pantalla (ambos modos y texto al 130 %) pasan.

Resultado final: **204 pruebas aprobadas**. APK instalado con `adb install -r` en `emulator-5554`; Android confirma versión 1.0.23, código 24. Se verificó con el partido activo real de Briseida en Game: sin halo ni borde rojo, etiqueta neutra con punto fijo y botón primario. Se deja el listado abierto en esa tarjeta. Captura: `patea_mobile/build/typography-review/installed-live-card-no-glow.png`.
