# Pateá en la App Store: lista de verificación y ficha

Estado al 22/11/2026. App `com.patea.app`, App Store Connect ID `6808798274`, equipo `V2PH3V3SJN`.

## 1. Requisitos de Apple

| Requisito | Estado |
|---|---|
| Sign in with Apple (guideline 4.8) | Hecho. Botón en el login (iOS), permiso en los entitlements, proveedor habilitado en Firebase. |
| Borrar la cuenta desde la app (5.1.1v) | Hecho. Menú de usuario → «Eliminar mi cuenta». Función `deleteMyAccount`. |
| Revocar el token de Apple al borrar | Hecho. Clave `KS4R57KCV5` y Service ID `com.patea.app.signin` cargados en Firebase. |
| Manifiesto de privacidad | Hecho. `ios/Runner/PrivacyInfo.xcprivacy`. |
| Política de privacidad y términos | Hecho. https://patea-app.web.app/privacidad/ y /terminos/ (se generan con `scripts/build_legal_site.py`). |
| Denunciar y bloquear contenido (1.2) | Hecho. Publicaciones y comentarios. Las denuncias van a `reports/` en Firestore. |
| Moderación en 24 h | **Pendiente de proceso**: alguien tiene que revisar `reports/` y actuar dentro de las 24 h. |
| Contacto de soporte público | **Pendiente**: definir correo o URL de soporte para la ficha y las páginas legales. |
| Perfil de firma en Codemagic (`patea_appstore`) | **Pendiente**: se invalidó al activar Sign in with Apple. Traer el perfil «Patea App Store» desde Apple. |
| Compras integradas (3.1.1) para créditos de IA | Código hecho, solo en la versión de la tienda. **Pendiente**: trámites de Apple (sección 6). |

## 2. Ficha (texto sugerido)

**Nombre:** Pateá
**Subtítulo (30 car.):** Tu fútbol, con historia
**Categoría:** Deportes. Secundaria: Redes sociales.

**Descripción:**
Pateá es la app para organizar el fútbol entre amigos y quedar en la historia del grupo.

• Armá el partido: grupos, equipos, camisetas, planteles y convocatoria.
• Jugalo en vivo: marcador, eventos, chat y clips del partido.
• Evaluá y mejorá: evaluaciones entre jugadores, estadísticas, ranking y progresión.
• Competí: ligas y copas con tabla, fechas y cruces.
• Comunidad: novedades del grupo, publicaciones y fotos.
• Tu carta de jugador: con foto, posición y OVR, que sube partido a partido.

**Palabras clave (100 car.):** fútbol,partido,equipo,amigos,cancha,liga,jugadores,evaluación,ranking,grupo

**URL de soporte:** definir.
**URL de privacidad:** https://patea-app.web.app/privacidad/
**URL de marketing:** https://patea-app.web.app/

## 3. Información para el revisor

- Sin cuenta de demostración no se puede probar la app: crear una cuenta de prueba y cargar su correo y contraseña en «Notas de revisión». **Pendiente.**
- Cómo ver las funciones de Apple: iniciar sesión con Apple o con correo; eliminar la cuenta está en el menú de usuario.
- Contenido generado por usuarios: la app tiene denuncia y bloqueo en publicaciones y comentarios, y moderación dentro de las 24 h.
- Permisos que pide la app: cámara, fotos, micrófono (notas de voz y clips), ubicación mientras se usa (partidos cercanos) y notificaciones.
- Inteligencia artificial: la foto de la carta y los análisis se generan con Google Gemini.

## 4. Etiquetas de privacidad (App Privacy)

Coinciden con `PrivacyInfo.xcprivacy`. Ninguna se usa para seguimiento (tracking = No).

| Dato | Vinculado al usuario | Finalidad |
|---|---|---|
| Correo electrónico | Sí | Funcionalidad de la app |
| Nombre | Sí | Funcionalidad de la app |
| Fotos o videos | Sí | Funcionalidad de la app |
| Datos de audio | Sí | Funcionalidad de la app |
| Ubicación precisa | Sí | Funcionalidad de la app |
| Otro contenido del usuario | Sí | Funcionalidad de la app |
| ID de usuario | Sí | Funcionalidad de la app y análisis |
| ID de dispositivo (token de notificaciones) | Sí | Funcionalidad de la app |
| Datos de fallos | No | Funcionalidad de la app |
| Interacción con el producto | No | Análisis |

Si algún día se agregan avisos de terceros hay que declarar el seguimiento, pedir el permiso de iOS y actualizar el manifiesto.

## 5. Clasificación por edad

Responder sin contenido sexual, violencia gráfica ni apuestas. **Hay contenido generado por usuarios**: marcarlo. Si más adelante se aceptan avisos de apuestas, la clasificación cambia.

## 6. Créditos de IA con compras integradas

**Ya está hecho en el código, y solo se activa en la versión de la App Store.** En TestFlight, en desarrollo y en Android no aparece nada de compras: la app le pregunta al sistema si el recibo es de la tienda (`receipt`) o de pruebas (`sandboxReceipt`) y, ante cualquier duda, no muestra nada.

- Los créditos comprados se guardan aparte (`purchasedCredits`), no vencen y no los pisa el reinicio mensual. Se gastan después de los gratuitos del mes.
- La app compra con StoreKit y manda la transacción a `redeemIapPurchase`, que la valida con la App Store Server API (producción y sandbox), es idempotente por transacción y recién ahí suma los créditos. Si el servidor falla, la compra queda abierta y se reintenta sola.
- Productos (consumibles): `com.patea.app.credits_5`, `credits_15` y `credits_40`. El catálogo está en `functions/src/lib/iap.ts` y `lib/core/services/credits_store_service.dart`.

Estado en App Store Connect (22/11/2026):

- **Hecho:** los tres productos consumibles están creados (`credits_5` a US$0,99, `credits_15` a US$2,99 y `credits_40` a US$6,99), disponibles en todos los países, con nombre y descripción en español (México), captura de revisión y notas. Los precios se pueden cambiar mientras no estén a la venta.
- **Hecho:** clave de compras integradas «Patea compras» (`M8JJ4286GP`) cargada en `internalConfig/iap` de Firestore. El sandbox de Apple la acepta; producción da 401 hasta que la app se publique, y el servidor ya lo tolera.
- **Pendiente, solo el titular:** en [Negocio](https://appstoreconnect.apple.com/business), el **Acuerdo de apps de pago** está en «información del usuario pendiente»: faltan la cuenta bancaria y el formulario fiscal.
- **Pendiente:** probar con un usuario de sandbox desde el build de la tienda y, al enviar la primera versión, **añadir las tres compras a la revisión** junto con el binario (Apple exige que la primera compra viaje con una versión de la app).
- La captura se regenera con `flutter test --no-pub --update-goldens tool/store_review_export_test.dart` (sale en `build/store_review/`).

## 7. Cómo publicar

1. Traer el perfil nuevo a Codemagic.
2. Crear el tag `ios-testflight-<versión>-<fecha>` desde `feat/flutter-mobile-app`.
3. Probar en TestFlight: Sign in with Apple, borrar cuenta (con una cuenta de prueba), denunciar y bloquear, notificaciones.
4. Completar la ficha en App Store Connect y elegir el build.
5. Enviar a revisión. En `codemagic.yaml` está `submit_to_app_store: false`; cambiarlo solo si se quiere que Codemagic envíe solo.
