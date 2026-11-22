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
| Compras integradas (3.1.1) para créditos de IA | **Pendiente**: ver sección 4. |

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

Lo que falta fuera del código:

1. Aceptar el **Acuerdo de apps de pago** en App Store Connect y cargar datos bancarios y fiscales (lo hace el titular de la cuenta).
2. Crear los productos consumibles, por ejemplo `com.patea.app.credits_5`, `credits_15` y `credits_40`.
3. Crear una **clave de compras integradas** (App Store Connect → Usuarios y acceso → Claves → Compras integradas) para validar las compras desde el servidor con la App Store Server API.

Con eso, el diseño es: la app compra con StoreKit (`in_app_purchase`), manda el comprobante a una función que lo valida con Apple y suma los créditos a `cardGenerationCredits` de forma idempotente por número de transacción. No se otorgan créditos sin validar en el servidor. Hoy los créditos solo se obtienen gratis cada mes, y Android no vende (se distribuye por Firebase, no por Google Play).

## 7. Cómo publicar

1. Traer el perfil nuevo a Codemagic.
2. Crear el tag `ios-testflight-<versión>-<fecha>` desde `feat/flutter-mobile-app`.
3. Probar en TestFlight: Sign in with Apple, borrar cuenta (con una cuenta de prueba), denunciar y bloquear, notificaciones.
4. Completar la ficha en App Store Connect y elegir el build.
5. Enviar a revisión. En `codemagic.yaml` está `submit_to_app_store: false`; cambiarlo solo si se quiere que Codemagic envíe solo.
