# Identidad compacta de la ficha — 18/11/2026

Revisión solicitada tras comparar las fichas de Cosme y Doroteo. Se conserva la proporción de la card y su panel de atributos.

- Nombre encima de la fila de posición/OVR, sobre el degradado de la foto.
- Altura del nombre según el texto real, hasta dos líneas; ya no se reserva siempre una segunda línea vacía.
- Posición a la izquierda, OVR y valor a la derecha, en una sola fila centrada. Valor más pequeño, manteniendo acento y tipografía deportiva.
- Se elimina la línea decorativa que unía posición y puntuación.
- El degradado empieza más abajo y llega al color de la superficie cerca del pie del retrato, conservando más cara, hombros y camiseta. Se adapta a los colores del tema Cancha y Claro.

No se regeneran imágenes, no se modifica el fondo de las fotos y no se alteran encuadres guardados. Si la foto de origen sólo contiene una cara, el widget no puede recuperar hombros ausentes; el ajuste de encuadre manual sigue disponible.

Se revisaron renderizados en ambos temas y se aprobaron 33 pruebas de fichas, incluida la posición del nombre y alineación de posición/OVR, tamaños de 141/161/260 px, texto ampliado, nombres largos, atributos, arrastre y zoom guardado. Análisis del widget sin incidencias. Se actualizaron las cuatro referencias visuales de Plantel y Editar perfil; sus seis pruebas de captura y texto ampliado pasaron.

Android 1.0.36 (37), compilación release e instalación local para revisión. Sin cambios de backend ni distribución a grupos de prueba.

Compilación completada en 118,5 segundos (90,8 MB). `adb install -r` en `emulator-5554`: Success. Android confirmó versión 1.0.36, código 37, y la aplicación se abrió desde el launcher conservando los datos existentes.
