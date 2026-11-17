# Entrega de prueba 1.0.34 - 17/11/2026

Autorización: compilar y distribuir iOS y Android a los grupos de prueba existentes. Rama `feat/flutter-mobile-app`; no se publica en App Store ni Google Play.

## Contenido

Versión móvil `1.0.34+35`: rediseño de Explorar e invitaciones, clima compacto y actualizado en el detalle con avisos, simplificación de vistas de clima y jugador, legibilidad de MANUAL y cambios acumulados en la rama desde la entrega anterior. Fuente funcional previa al ajuste de versión: `e834be24`.

## Android

APK release firmado, versión 1.0.34 (35), compilado correctamente y distribuido con Firebase CLI al grupo existente `test-patea` (Test Patea).

[Entrega para testers](https://appdistribution.firebase.google.com/testerapps/1:5614567933:android:4b0b919482aa0dc5861994/releases/4bk3biieq4s30).

Consulta posterior de App Distribution: versión, build y recurso confirmados. No se añadieron testers ni grupos.

## iOS

Se utiliza `ios-testflight` en Codemagic, integración App Store Connect `patea`, app 6808798274 y firma existente. Número de build calculado contra Apple. El publicador nativo sigue subiendo el IPA; después se verifica procesamiento VALID y disponibilidad IN_BETA_TESTING con pertenencia a los grupos internos seleccionados.

`scripts/testflight_delivery.py` conserva los grupos internos con acceso automático; en su ausencia, los de la entrega válida anterior o el único interno existente. Rechaza selección ambigua, grupos externos o de otra app y builds con versión equivocada. No crea grupos, invita personas ni publica en App Store. Usa las credenciales ya inyectadas por la integración dentro de CI, sin copiarlas a esta máquina.

Ocho pruebas locales de selección, asignación y verificación aprobadas; YAML analizado correctamente. El resultado iOS se registra al finalizar la corrida; una subida por sí sola no acredita entrega al grupo.

### Reintento iOS

La primera corrida `6afcb1aa799fbd143cdf1c16` falló antes de compilar: el verificador interpretó una referencia de credencial de Codemagic como contenido PEM. Se corrigió la resolución en memoria de `@file:` y `@env:`, siguiendo el mecanismo del CLI oficial; 11 pruebas aprobadas. No se exportan claves. El token de monitoreo se usa desde su archivo local existente fuera del repositorio.

El CI completo de GitHub terminó correctamente en `c92ec3b0`, tras ajustar el harness de capturas y actualizar las dos referencias visuales de detalle con clima integrado. Estos ajustes no cambian el binario Android ya distribuido.
