# Fondos unificados — 16 de noviembre de 2026

## Criterio aplicado

Una sola composición estable por tema, resuelta en `patea_mobile/lib/core/widgets/patea_background.dart`: Game conserva carbón, volt y turquesa suaves; Claro conserva blanco con azul y ámbar al 5 %. Ambos incluyen líneas de cancha discretas, sin animación ni imágenes globales. Todas las paradas del degradado son opacas para mantener el tinte previsto.

Las fotografías quedan en portadas, cabeceras y tarjetas protagonistas: no se colocan detrás de formularios ni listas. Se mantienen los retratos, la fotografía de acceso, las cinco escenas estables por partido y la cancha dibujada del directo. El reproductor de video conserva negro.

## Cambios

- Retirado el prototipo `fondo_claro.dart`, sus variantes Foto/Mancha, el proveedor aleatorio y los selectores del menú de desarrollo y la galería. La preferencia histórica `fondoClaro` deja de consultarse; no se borran otros ajustes ni datos de usuario.
- Armar partido deja de cubrir el lienzo compartido con un Scaffold opaco.
- Las tarjetas de contenido que usaban `card` al 40, 55 o 75 % en Grupos, Explorar, detalle del partido y crónica pasan a la superficie opaca del tema. No se modifican velos de fotografía, controles superpuestos ni colores semánticos de selección.
- El arnés de pantallas ya no necesita fijar un índice fotográfico global.

## Alcance y verificación

Versión local: **1.0.16+17**, rama `feat/flutter-mobile-app`, sin nuevo worktree.

- Goldens de las 12 pantallas en Game y Claro regenerados; también se comprueba escala de texto 1,3× (36 casos).
- Inspección visual del comparativo Grupos y detalle de partido en ambos temas: `patea_mobile/build/typography-review/backgrounds-unified.jpg`.
- Suite completa: **174 pruebas aprobadas**, incluyendo comparación de goldens actualizados.
- Analizador: sin errores ni advertencias; 29 observaciones informativas anteriores.
- No se agregan dependencias ni archivos de medios. Las nueve fotos históricas se conservan como recursos existentes; ya no pueden elegirse como fondo global.

La aprobación comprende consistencia de fondos y superficies. No rediseña la estructura de cada pantalla ni genera nuevas portadas.

## Instalación local

APK release android-x64 compilado e instalado con `adb install -r` en `emulator-5554`: Android confirma `versionName=1.0.16`, `versionCode=17`. Se conservó la sesión de Briseida. Se comprobó el Panel en Game y Claro sobre el dispositivo; se deja Claro abierto para revisión. Capturas: `patea_mobile/build/typography-review/installed-backgrounds-1.0.16.png` y `installed-backgrounds-light-1.0.16.png`. Sin distribución externa.
