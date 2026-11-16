# Grupos, equipos y planteles

Rama `feat/flutter-mobile-app`. Android `1.0.29+30`.

## Diseño aplicado

- **Grupos:** portada fotográfica sin una tarjeta exterior adicional. Nombre, cantidades y foto conservan su papel de identidad. Estado y rol como texto, código completo seleccionable con acción de copia, invitación con el color primario del tema. Secciones abiertas y nombres de equipos con mayor contraste; se eliminan títulos en mayúsculas y etiquetas monoespaciadas pequeñas.
- **Detalle de equipo:** camiseta y nombre como cabecera, trofeos como texto acompañado por su símbolo, acciones estándar y eliminación con tooltip. Agenda con fechas legibles. Plantel con nombre en hasta dos líneas, posición debajo y OVR sin caja; se eliminan los bordes de acento repetidos por jugador.
- **Crear equipo:** pasos Identidad/Plantel explícitos, botones con nombres claros, pie protegido por SafeArea, selección de jugadores con casillas y estado vacío específico cuando una búsqueda no encuentra resultados.
- **Camisetas:** vista previa más grande, diseños con los colores actuales y selección de principal/secundario mediante las pestañas comunes. Se corrige `width` usado en lugar de `borderWidth` para la selección. La paleta incorpora nombres accesibles y zonas táctiles de 48 px.
- **Gestionar plantel:** nombre y avatar separados de los controles. Inclusión con casilla, titularidad con botón de cambio y dorsal con acción explícita; se eliminan las pastillas pequeñas y se preserva la advertencia de números duplicados.

## Contratos conservados

Los permisos del grupo y las acciones de crear, editar y eliminar siguen usando los servicios existentes. La creación conserva IDs, orden de selección, dorsales iniciales y estado `titular`; la gestión conserva titulares/suplentes y números existentes. Las pruebas de escritura usan servicios simulados. La revisión manual no debe guardar modificaciones en equipos reales ni enviar invitaciones.

## Verificación

`groups_style_flow_test.dart` cubre selección y colores de camisetas, borde seleccionado, creación simulada, persistencia de selección entre pasos, guardado de titularidad/dorsales, copia del código y las cuatro vistas a 320 px con texto al 130 % en Game y Claro.

Goldens actualizados de Grupos y detalle de equipo, y nuevos de creación y gestión del plantel, en ambos temas.

Resultado final: 260 pruebas aprobadas. Análisis sin errores ni advertencias; quedan 28 avisos informativos existentes. APK release x64 1.0.29+30 compilado e instalado mediante actualización en emulator-5554. Revisión nativa de Grupos, detalle de equipo y creación en Game, sin modificar datos reales. El arnés visual precarga todos los SVG de camisetas antes de las capturas para evitar referencias incompletas.
