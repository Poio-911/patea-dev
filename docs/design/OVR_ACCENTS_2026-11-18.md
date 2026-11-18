# OVR Prisma y Granate — 18/11/2026

Diseño final aprobado tras las propuestas visuales. Sustituye la prueba local de trazos, que no se instaló ni se publicó.

## Identidad

El número tiene un color plano según OVR. A su izquierda están OVR y, debajo de esas letras, la categoría. Ambas etiquetas tienen el mismo tamaño de fuente; la categoría usa peso 700 y el mismo color que el número. El bloque se ajusta a la altura del número, sin agregar otra fila a la ficha. No hay trazos, badges, contornos ni recoloreado de la carta, foto, posición o atributos.

| OVR | Categoría | Cancha | Claro |
| --- | --- | --- | --- |
| Menos de 55 | — | Neutro | Neutro |
| 55–64 | — | Cobre claro | Cobre oscuro |
| 65–69 | — | Plata | Gris azulado |
| 70–79 | PRO | Cian | Azul |
| 80–89 | ELITE | Lila | Violeta |
| 90–94 | ELITE+ | Dorado amarillo #F2C230 | **Granate #A42D51** |
| 95 o más | ELITE+ | Rosa | **Granate #A42D51** |

El granate reemplaza el dorado sólo en Claro, por elección del usuario después de comparar variantes. Categoría y número mantienen exactamente el mismo color. No se usa un degradado permanente en el número.

## Prisma

Desde 71, un reflejo temporal cian/blanco/rosa atraviesa únicamente los dígitos durante 1,3 segundos. La intensidad sube con el valor. La pausa entre pasadas baja de aproximadamente 12 segundos en 71 a cinco en 99, más un desfase de hasta dos segundos según jugador para que no brillen juntos.

Hasta 70 inclusive no hay animación. Se desactiva con movimiento reducido o navegación accesible; se suspende en rutas con TickerMode deshabilitado y cuando la app pasa a segundo plano. Antes de iniciar cada pasada se comprueba que el número esté dentro de la pantalla. No se mantiene un ticker activo durante la pausa.

## Validación

39 pruebas de fichas y OVR: límites de categoría, granate sólo en Claro, contraste de acentos sobre la superficie de la ficha, animación temporal manteniendo color base, ausencia de reflejo en 70/movimiento reducido/fuera de pantalla, tamaños compactos, texto ampliado, encuadres y atributos. Capturas revisadas en Cancha y Claro, incluyendo 93/ELITE+ y 76/PRO. Se actualizan las referencias de Plantel y Editar perfil.

Android 1.0.37 (38), release para instalación local. No cambia el backend ni distribuye a grupos de prueba.

Compilación final completada en 129,3 segundos (90,9 MB). `adb install -r` en `emulator-5554`: Success; Android confirmó versión 1.0.37, código 38. Aplicación abierta desde el launcher, sin desinstalar ni borrar los datos existentes. Las seis pruebas de captura/texto ampliado de Plantel y Editar perfil también pasaron.
