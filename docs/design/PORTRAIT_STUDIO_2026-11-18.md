# Tu retrato — 18/11/2026

## Experiencia implementada

Desde Editar perfil → Cambiar foto se abre una pantalla dedicada, en ambos temas. El retrato vertical ocupa el centro; se alterna entre foto y ficha. Cámara y galería permiten elegir una nueva referencia.

La camiseta tiene color principal y secundario (azul, rojo, verde, dorado, violeta, negro y blanco) y tres diseños: lisa, rayas verticales o banda horizontal. El servidor valida colores hexadecimales y un diseño permitido; nunca acepta instrucciones libres del cliente.

El fondo **no tiene selector**. La IA elige un color sólido aleatorio en cada generación, excluyendo blanco y negro puros. No hay recorte automático del fondo, chroma key, recoloreado ni filtros posteriores. Se conserva como base el prompt aprobado: identidad y edad próximas a la referencia, ropa sin emblemas inventados, pose relajada y relación 2:3. No se promete identidad facial exacta.

## Generar, revisar y aplicar

Generar usa un crédito cuando termina correctamente. La vista previa queda guardada por servidor sin modificar la foto actual. Se puede comparar con la referencia, ver la ficha, generar otra o conservar la actual. Aplicar mediante **Usar esta foto** no consume otro crédito. Descartar una generación no devuelve el crédito ya usado; el costo se informa antes de generar.

La fuente local se sube antes de generar, sin convertirla previamente en foto activa. El servidor conserva esa referencia original al aplicar. La ruta original guardada `aiSourcePhotoUrl` se expone en el modelo móvil y se preserva al resolver fotos de respaldo. Una foto histórica sin referencia guardada usa la foto disponible; el usuario puede cargar una nueva.

`generatePlayerPhoto` mantiene compatibilidad con clientes existentes; el móvil solicita `previewOnly`. `applyPlayerPhoto` aplica un borrador del usuario autenticado y sincroniza players, users, availablePlayers y Firebase Auth. El encuadre vuelve a 50/50, zoom 1. Las vistas previas tienen vigencia de siete días. No se habilita lectura de borradores desde el cliente ni se configura una purga automática en esta revisión.

## Validación

- Functions: TypeScript compilado; 61 pruebas aprobadas, 22 de emulador omitidas. Las nuevas pruebas verifican crédito único, ausencia de reemplazo al previsualizar, aplicación idempotente y rechazo de borradores ajenos, fuente ajena, camiseta inválida o créditos agotados.
- Flutter: 12 pruebas de perfil/recorte/guardado y dos del nuevo editor, en Cancha y Claro. Verifican selección de color y que una vista previa no se aplique sola. No hay captura golden aprobada nueva.
- Ambas funciones desplegadas en `mil-disculpis`, `us-central1`, mediante Firebase CLI. Android se compila como 1.0.35 (36) para instalación local; sin distribución a grupos ni TestFlight en esta revisión.

Las pruebas de personalización usan servicios simulados. La validación de generación real del prompt base está documentada en `docs/technical/PROFILE_PHOTO_LIVE_TEST_2026-11-18.md`; queda la prueba de uso en dispositivo del flujo recién desplegado.

## Instalación local confirmada

APK release compilado en 256 segundos (90,8 MB). Instalación con `adb install -r` en `emulator-5554`: **Success**, sin desinstalar ni borrar datos. Android confirma `versionName=1.0.35`, `versionCode=36`; aplicación lanzada desde el launcher.

Se comprobaron las dos funciones desplegadas sin sesión: ambas responden HTTP 401 UNAUTHENTICATED, sin ejecutar generación. Acceso de prueba: Mi perfil → Editar perfil → Cambiar foto → Tu retrato. Esta revisión no distribuye a Firebase App Distribution ni TestFlight.
