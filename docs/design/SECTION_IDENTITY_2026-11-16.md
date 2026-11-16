# Identidad de Evaluaciones, Ranking y Entrenador

## Dirección visual

Se conserva el sistema aprobado: carbón #0B0E13, blanco #FCFCFD, volt #CCFF33, azul #156BF4 y ámbar de reconocimiento. Space Grotesk para títulos y lectura; los números deportivos existentes para puestos y estadísticas. Las fotos son el foco editorial y los datos quedan sobre superficies limpias del tema.

Tres escenas distintas, visibles con datos existentes: conversación después del partido, reconocimiento entre compañeros y trabajo individual con pelota. No se reutiliza otra vez la misma cancha. Las fotografías son ilustrativas, no fotos reales de usuarios.

Estructuras:

- Evaluaciones: cabecera compacta con fotografía y pendientes/completadas reales → aviso de cierre únicamente cuando aplica → pestañas existentes → evaluaciones. Se evita aumentar la cabecera con más cajas de estadísticas.
- Ranking: portada del plantel → filtros OVR/Goles/Asistencias → tabla con avatares, puesto compartido si hay empate, posición como texto de color y valor seleccionado. Cada fila abre la ficha real. No se resalta podio para estadísticas en cero. El listado se construye de forma diferida y no modifica el plantel recibido.
- Entrenamiento: portada → identidad del usuario y OVR real → objetivo sugerido por el menor atributo guardado → elección de otro objetivo → ejercicio de tres pasos → acceso a la progresión existente.

No se agregan movimientos de fondo. El cambio de ejercicio tiene fundido breve de 180 ms y el cambio de pestaña de Evaluaciones dura 220 ms; ambos respetan movimiento reducido.

## Corrección funcional del entrenador

Antes existía una conversación simulada: un temporizador de 1,2 segundos devolvía siempre la misma respuesta y el saludo afirmaba conocer evaluaciones. Se retira esa simulación. Ahora se ofrecen ejercicios técnicos escritos y seleccionados localmente según los atributos de la ficha. Los arqueros usan la misma correspondencia de atributos que su perfil (estirada/def, reflejos/dri, paradas/sho, velocidad/pac, saque/pas, posición/phy), con ejercicios propios.

No hay llamada a IA, generación de entrenamiento ni modificación de OVR. Si falta la ficha o falla su lectura, no se inventa un plan. La ficha ausente ofrece acceso al plantel.

## Acceso

Ranking y Entrenador tenían rutas sin enlaces visibles. El menú de usuario ahora incluye **Ranking del plantel** y **Mi entrenamiento**. La hoja puede desplazarse para mantener los accesos disponibles en pantallas cortas y con texto ampliado. Evaluaciones sigue en la barra inferior.

## Recursos

Generados con la herramienta incorporada `image_gen`, optimizados como WebP de 1200 × 800, calidad 83. Tres archivos suman 191.472 bytes (~187 KiB):

- `patea_mobile/assets/brand/patea_evaluations.webp`
- `patea_mobile/assets/brand/patea_ranking.webp`
- `patea_mobile/assets/brand/patea_coach.webp`

Prompts completos: [SECTION_IDENTITY_PROMPTS_2026-11-16.json](SECTION_IDENTITY_PROMPTS_2026-11-16.json).
Originales, dimensiones, tamaños y SHA256: [SECTION_IDENTITY_2026-11-16.json](SECTION_IDENTITY_2026-11-16.json).

## Validación

Versión local **1.0.17+18** en `feat/flutter-mobile-app`. Sin nuevo worktree ni distribución externa.

Se agrega Entrenador a los goldens de pantallas: 13 pantallas, 26 imágenes en los dos temas y 39 casos incluyendo texto a 1,3×. También se comprueban ordenación por estadística, no mutación del plantel, puestos empatados, correspondencia de atributos de arquero, cambio de ejercicio, ficha ausente y accesos del menú en una ventana corta.

Analizador sin errores ni advertencias, con 29 observaciones informativas anteriores.

Suite completa: **185 pruebas aprobadas**. Goldens: **39 casos aprobados**, incluyendo 26 imágenes de pantalla y los dos temas con texto ampliado. Comparativo visual: `patea_mobile/build/typography-review/section-identity-final.jpg`.

## Revisión en Android

Sesión de Briseida conservada con instalación sobre la app existente. Evaluaciones muestra sus contadores reales. Ranking contiene 15 jugadores: OVR liderado por Luis Suarez (88); al cambiar a Goles, Aurelio y Briseida comparten el puesto 1 con 5 goles, y el siguiente puesto es 3. Entrenamiento muestra OVR 55 y los atributos de Briseida (Ritmo 56, Tiro 57, Pase 66, Regate 63, Defensa 40, Físico 49); sugiere Defensa 40. Se verifican los accesos del menú y el cambio a Claro.

Capturas en `patea_mobile/build/typography-review/installed-identity-evaluations.png`, `installed-identity-ranking.png` e `installed-identity-coach.png`. En revisión se corrigió la marca de selección de los objetivos para que use el color de texto del tema y mantenga contraste en Claro. La suite completa vuelve a pasar tras esa corrección (185 pruebas).

APK final compilado e instalado con `adb install -r` en `emulator-5554`: Android confirma versión 1.0.17, código 18. Sin distribución externa.
