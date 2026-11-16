# Revisión móvil 1.0.10 (11) — 15 de noviembre de 2026

## Estado de entrega

Compilación Android de revisión instalada en el emulador `emulator-5554` mediante actualización (`adb install -r`), conservando sesión y datos. Versión verificada con Package Manager: `1.0.10`, código `11`. APK release para `android-x64`; no es una entrega universal para teléfonos.

Esta revisión no se publicó en Firebase App Distribution, TestFlight ni web. La distribución sigue detenida por pedido del usuario. El workflow iOS conserva compilación y artefactos, sin publicación automática a Apple; Android CI continúa comentado. El commit local no autoriza una distribución.

## Cambios acumulados desde 1.0.6

- Tipografía: acciones en Space Grotesk, textos informativos en Outfit y Anton reservado a elementos grandes. Revisión de botones, nombres y metadatos en las pantallas principales.
- Fichas: diseño «Marcador lateral», posición recta con color semántico, OVR ámbar conectado mediante línea y punto. Nombre sobre el retrato y degradado hasta atributos. El máximo destaca en ámbar, incluidos empates; la selección de ordenación es independiente.
- Retratos y selección: se conservan fotos, encuadres y zoom hasta 4; vista previa de edición legible y grilla adaptable al tamaño de texto. Correspondencia de atributos de arquero preservada.
- Superficies: fondo tonal con líneas de cancha sutiles en tema Cancha; preferencia de fondo Claro conservada. Campos opacos y contraste de controles activos, deshabilitados y en carga.
- Crear partido: tres pasos identificados; decisiones «Ya tengo horario» y «Consultar al grupo»; calendario en español y hora de 24 horas. Se conserva fecha, plantel y selección de equipos al volver entre pasos.
- Integridad: no cambia el contrato del backend. Consulta al grupo envía fecha/hora vacías para el flujo existente de planificación; cancha obligatoria, requestId y bloqueo de doble envío conservados.
- Accesibilidad: transiciones breves e indicadores que respetan movimiento reducido. `PateaButtonProgress` hereda el color resuelto del botón en 19 ubicaciones.
- Localización: delegados Material, Widgets y Cupertino del SDK; locales `es_UY` y `es`. `flutter_localizations` requiere `intl 0.20.2`.

## Validación

- `flutter test`: **161 pruebas aprobadas**, incluyendo goldens, fichas, edición, creación y contraste de controles en ambos temas.
- `flutter analyze --no-fatal-infos`: sin errores ni advertencias; 15 avisos informativos preexistentes.
- `git diff --check`: correcto.
- APK release compilado y firma verificada con el certificado existente de Pateá. Instalación y apertura de «Armar partido» verificadas en Android.
- No se compiló ni verificó un nuevo binario iOS para esta revisión.

## Referencias

- [Criterios visuales y procedencia de recursos](../design/UX_BRAND_2026-11-15.md).
- [Estado y procedimiento de distribución](DEPLOYS_Y_VERSIONES.md).
- [Entrega anterior 1.0.6](RELEASE_1.0.6_2026-11-15.md).
