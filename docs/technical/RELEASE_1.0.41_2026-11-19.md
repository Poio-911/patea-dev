# Entrega de prueba 1.0.41 · 19/11/2026

Rama `feat/flutter-mobile-app`. Fuente móvil `913b13a7`; incluye todos los cambios pendientes de jerseys, jugadores sin cuenta y atributo destacado. Esta revisión sustituye 1.0.40 para incluir la corrección de resiliencia del perfil.

## Validación

- CI completo de GitHub aprobado sobre `1b379643`: Flutter, Web, Cloud Functions y reglas de Firestore. [Ejecución](https://github.com/Poio-911/patea-dev/actions/runs/44534093612).
- Backend y reglas: **102 pruebas aprobadas**, incluyendo Firestore emulado, sin omisiones. El arnés de torneos inicializa la app Admin predeterminada como producción, siempre en proyecto demo.
- Suite Flutter completa: **479 pruebas aprobadas**, con goldens Cancha/Claro y escalado de texto.
- Análisis estático aprobado: sin errores ni advertencias, sólo avisos informativos de estilo. Se excluyen artefactos de `build/` del análisis; el respaldo local de una pantalla no forma parte del código de la app.
- Verificador TestFlight: **14 pruebas aprobadas**.
- Perfil propio: un error de la búsqueda opcional de historial ya no rompe la pantalla; la acción sólo se muestra con una coincidencia válida.
- Creación de partidos: usa el reloj inyectable que ya existe en la app. En producción sigue usando la fecha actual; las capturas dejan de depender del día en que se ejecutan.
- Referencias visuales actualizadas y revisadas para el único atributo destacado y la fecha determinista.
- Ratchet de colores: límites explícitos por archivo para el arte de avatares, jerseys, OVR y entradas de color de foto. El resto de la UI mantiene un presupuesto cero; no se permite trasladar el presupuesto entre archivos.

## Android

APK release 1.0.41 (42) compilado y distribuido correctamente al grupo existente `test-patea`. Firma oficial verificada con apksigner. Instalación `adb install -r` comprobada en el emulador, conservando datos.

[Entrega final de Firebase App Distribution](https://appdistribution.firebase.google.com/testerapps/1:5614567933:android:4b0b919482aa0dc5861994/releases/0k9n0nt4mg0fg).

## iOS

[Build Codemagic](https://codemagic.io/app/6a9b3fecaea87264a4d6ae80/build/6afef7d9f3369878868128c4), fuente `913b13a7`, workflow `ios-testflight`, Xcode 26.5. Build iniciado a las 10:21 y terminado correctamente a las **10:45 de Montevideo**. **iOS 1.0.41 (8) entregado** al grupo interno **Patea-Test**, con acceso automático. Firma e integración existentes.

El verificador autenticado confirmó `processingState: VALID` e `internalBuildState: IN_BETA_TESTING`. Recurso Apple `7cb81d82-8d8d-4b5f-8b1c-0ca8a27db2ef`; grupo `4a5a9c5c-17f3-4198-89d2-4945df5271ed`. Todos los pasos de Codemagic terminaron correctamente, incluida la verificación posterior a la publicación. El IPA generado pesa 73.2 MB.

Se corrigió la publicación para respetar grupos internos con `hasAccessToAllBuilds`. Sigue exigiendo versión correcta, estado `VALID` y disponibilidad `IN_BETA_TESTING`. No se crean grupos ni se añaden testers ni se publica en App Store/Google Play.
