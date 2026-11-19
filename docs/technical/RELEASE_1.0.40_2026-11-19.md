# Entrega de prueba 1.0.40 · 19/11/2026

Rama: `feat/flutter-mobile-app`. Cambios móviles: `c8616b25`; verificación de TestFlight: `12c126f4`.

## Contenido y comprobaciones

Se commitearon los pendientes del diseñador de jerseys, colores, escudos, integración en equipos y sus referencias visuales. Se incluyen también los jugadores sin cuenta, recuperación por contacto verificado, el acceso condicional de perfil y la regla de destacar un solo atributo mayor a 70, con desempate por posición.

19 pruebas Flutter aprobadas de jerseys, grupos y resaltado. 14 pruebas del verificador de TestFlight aprobadas. Firma release Android comprobada con apksigner: SHA-256 `DF:CE:3E:9B:E7:A6:40:9C:EE:E9:18:0C:D8:64:35:5F:2B:FA:78:98:0E:43:65:6A:B9:53:FB:1D:46:A8:59:7E`.

## Android

APK release 1.0.40 (41), compilado y distribuido mediante Firebase CLI al grupo existente `test-patea`, sin añadir testers ni grupos. Instalado también con `adb install -r` conservando datos en el emulador.

[Entrega de Firebase App Distribution](https://appdistribution.firebase.google.com/testerapps/1:5614567933:android:4b0b919482aa0dc5861994/releases/4qjg64unuii9g).

## iOS

[Build de Codemagic](https://codemagic.io/app/6a9b3fecaea87264a4d6ae80/build/6afef44efacdd5a578172a70), fuente `f78c8b9a`, workflow `ios-testflight`, firma e integración existentes. Estado pendiente de compilación y verificación en TestFlight.

Se canceló la primera solicitud que aún estaba en cola (`6afef13725baf9171f958f3e`) para incluir la corrección del verificador. El análisis del registro de la entrega anterior mostró un HTTP 404 al intentar asignar manualmente una build a un grupo interno con acceso automático. Ahora se respeta `hasAccessToAllBuilds`; para grupos de asignación explícita se usa el endpoint documentado de Apple desde la build. Se sigue exigiendo `VALID`, versión correcta e `IN_BETA_TESTING`, sin ampliar destinatarios.

Referencias: [Acceso automático de grupos internos](https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers/), [asignación explícita de grupos a una build](https://developer.apple.com/documentation/appstoreconnectapi/post-v1-builds-_id_-relationships-betagroups).

### Asignación de máquina iOS

La corrida con `xcode: latest` (`6afef22a327ac7f6b4542914`) quedó esperando una máquina. Se canceló aún sin compilar y se fijó Xcode 26.5 según la recomendación del soporte de Codemagic para usar otro pool, sin cambiar firma ni destinatarios. La nueva corrida `6afef44efacdd5a578172a70` consiguió máquina y comenzó a las 10:06 de Montevideo. [Referencia del proveedor](https://github.com/orgs/codemagic-ci-cd/discussions/3570).

La comprobación de Apple en la corrida activa confirmó app `6808798274`, grupo interno **Patea-Test**, `hasAccessToAllBuilds=true`, sin modificar sus integrantes. Firma y certificados aplicados correctamente.

### Sustituida por 1.0.41

La revisión completa detectó que un error de red en la consulta de recuperación podía romper el perfil propio al leer `AsyncError.value`. Se canceló la compilación iOS `6afef44efacdd5a578172a70` antes de publicar y se incorporó la lectura segura de datos. Android 1.0.40 (41) ya había sido distribuido; la entrega final de esta sesión es [1.0.41](RELEASE_1.0.41_2026-11-19.md).
