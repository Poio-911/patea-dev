# Edición de perfil y gestión de competiciones

Rama `feat/flutter-mobile-app`. Android local `1.0.30+31`.

## Perfil

Se conservan los cambios locales del usuario y se reduce la carta de vista previa para dar espacio al formulario. Posición y pie hábil se eligen con texto y una línea de selección, sin pastillas. Guardar permanece al pie, por encima del teclado; evita envíos simultáneos y se bloquea durante generación de foto. Se protege la selección de foto y año contra pantallas desmontadas.

Se corrige también la persistencia de campos opcionales: quitar año de nacimiento o pie hábil envía un null explícito; omitir el campo mantiene el valor anterior. `updateProfile` valida las opciones y los límites de edad como antes.

## Competiciones

- Partidos → Competiciones → Ligas/Copas ofrece Crear liga/Crear copa. El botón reserva el espacio de la navegación inferior; la lista deja margen para el botón y el menú.
- El formulario usa equipos del grupo activo, nombre validado, selección persistente, errores recuperables y bloqueo de envío. Liga privada de 2 a 16 equipos con ida o ida/vuelta; copa privada de 2, 4, 8, 16 o 32 equipos. La creación conserva el contrato de la web y queda en borrador, sin iniciar partidos automáticamente.
- Las ligas abren un detalle real con participantes, fechas, acceso al partido y posiciones calculadas desde resultados finales. Se ignoran marcadores en vivo para puntuar.
- El organizador puede iniciar una liga eligiendo primera fecha y hora. `startLeagueTournament` verifica sesión, propiedad, pertenencia al grupo, equipos y perfiles existentes. Genera todos los partidos semanales en una única transacción; contempla descansos e ida/vuelta y evita fixtures duplicados. Los planteles se resuelven en servidor, no desde atributos enviados por el cliente. Se rechazan planteles vacíos y jugadores compartidos entre equipos.
- El organizador puede iniciar una copa, sortear sus llaves y cargar los resultados con el recorrido existente. Se verifica que los equipos coincidan con la selección guardada y que no haya comenzado.
- Eliminar está disponible sólo para el organizador y requiere confirmación dentro de la app. Elimina el documento del torneo y sus subcolecciones conocidas en un batch (hasta 449 documentos hijos). Los partidos, equipos y jugadores existentes se conservan, como informa la confirmación. Torneos mayores requieren administración; no se hace una eliminación parcial.

## Compatibilidad y revisión

Se leen IDs de equipos actuales y objetos legados, y los nombres de campos de posiciones usados por web. Se conserva la navegación existente a copas y se incorpora `/competitions/league/:id`.

Al ejecutar las pruebas completas se detectó una regresión en los cambios locales del tutorial: `nextPage` no admite duración cero. Con movimiento reducido se usa `jumpToPage`, conservando el diseño y el texto nuevos del usuario. La prueba de edición dejó de exigir una carta de 260 px y comprueba el acceso a Guardar con teclado y texto ampliado.

Las escrituras de prueba se realizan con Firestore simulado y servicios falsos; la revisión nativa no crea, elimina ni inicia torneos reales ni guarda cambios del perfil. Sólo se despliegan `startLeagueTournament` y `updateProfile` en `mil-disculpis`. Ambas funciones rechazan llamadas sin autenticación (401). No se distribuye la app en tiendas.

## Validación

Once pruebas de Node cubren fixture de 2 a 16 equipos, descansos, ida/vuelta, transacción, permisos, duplicados, fechas, planteles y campos opcionales. Las pruebas Flutter cubren CRUD simulado, copa hasta resultado final, clasificación, perfil y creación en ambos temas a 320 px y texto 130 %, además de la separación entre Crear y la navegación inferior. Referencias visuales de competiciones, creación de liga/copa y edición del perfil en ambos temas.


Resultado de la suite final: 281 pruebas aprobadas y 2 fallos en `entry_experience_test.dart`, ajenos a estos recorridos: cambios concurrentes del Panel retiraron el texto «Armar partido» que esas pruebas buscan. No se modifica el Panel ni sus referencias visuales en este commit. Las 16 pruebas específicas de creación, servicios, perfil y permisos (9 de servicio, 5 de UI y 2 de permisos de copa), las 11 de Node y los recorridos de regresión de edición/tutorial pasan. Los goldens de las pantallas de este cambio también pasan.


Entrega local: APK release Android x64 `1.0.30+31` compilado e instalado por actualización en `emulator-5554`. Comprobados en la app real los accesos a editar perfil, Crear liga y Crear copa, con los equipos del grupo de Briseida; el botón queda por encima de la navegación. Análisis Flutter sin errores ni advertencias, con 30 avisos informativos. Se conserva la sesión y no se guardaron modificaciones de datos reales durante la revisión.
