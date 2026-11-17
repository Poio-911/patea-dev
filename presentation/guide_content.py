"""Contenido de la guía: procesos disponibles en la app móvil, noviembre 2026."""
PAGES = []


def process(section, title, intro, route, before, steps, result, note, screen, look):
    PAGES.append(dict(section=section, title=title, intro=intro, route=route,
                      before=before, steps=steps, result=result, note=note,
                      screen=screen, look=look))


process('01 · EMPEZAR', 'Crear una cuenta o ingresar',
        'Tu cuenta identifica al jugador que participa, organiza y evalúa. Usá siempre el mismo acceso para conservar tu recorrido.',
        'Pantalla de acceso', 'Necesitás conexión y un correo al que puedas acceder, o una cuenta de Google.',
        [
            ('Elegí cómo entrar', 'Si ya tenés cuenta, seleccioná Ingresar. Para una cuenta nueva, elegí Crear cuenta. Son dos acciones distintas aunque compartan la misma pantalla.'),
            ('Completá el formulario', 'Ingresá los datos que pide la opción elegida. Revisá el correo antes de continuar y escribí tu contraseña; el control del ojo permite comprobar lo escrito.'),
            ('O continuá con Google', 'Tocá Continuar con Google y elegí la cuenta que querés usar. Esperá a que termine el acceso antes de volver a tocar el botón.'),
            ('Seguí la orientación inicial', 'Al entrar por primera vez, recorré la introducción disponible. Después completá tu perfil y seleccioná o creá el grupo con el que vas a jugar.'),
            ('Confirmá quién ingresó', 'Abrí el menú del usuario y comprobá nombre y correo. Esto evita organizar o evaluar desde una cuenta de prueba o de otra persona.'),
        ],
        'Quedás dentro de la app con una identidad asociada a tu sesión. Tener cuenta no te incorpora automáticamente a todos los grupos.',
        'Si el correo ya tiene cuenta, volvé a Ingresar. Crear otra cuenta para resolver un problema de acceso puede separar tu historial.',
        'login', 'Las opciones Ingresar y Crear cuenta cambian el formulario. Google es otra vía de acceso, no un paso obligatorio.')

process('01 · EMPEZAR', 'Recuperar el acceso y cerrar sesión',
        'Podés recuperar una contraseña olvidada sin crear otro jugador. Cerrar sesión sirve para salir de un dispositivo o cambiar de cuenta.',
        'Acceso / Menú del usuario', 'Para recuperar una contraseña, tené acceso al correo registrado.',
        [
            ('Escribí tu correo', 'En la pantalla de acceso, ingresá la dirección de la cuenta. La recuperación usa ese dato, por lo que no conviene dejarlo vacío ni escribir otro correo.'),
            ('Pedí la recuperación', 'Tocá Recuperar contraseña y esperá la confirmación de envío. Si hay un error, revisá la dirección y la conexión antes de repetir.'),
            ('Revisá tu casilla', 'Abrí el mensaje de recuperación y seguí sus instrucciones. Si no lo encontrás, revisá también correo no deseado. Después volvé a Ingresar.'),
            ('Distinguí el acceso con Google', 'Si entrás mediante Google, volvé a usar esa opción y la misma cuenta. La contraseña de Google se administra desde su propio servicio.'),
            ('Salí cuando corresponda', 'Con la sesión iniciada, abrí el menú del usuario y tocá Cerrar sesión. Para volver, usá el método de acceso de esa misma cuenta.'),
        ],
        'Recuperás el acceso a tu identidad existente o dejás de tener una sesión abierta en el dispositivo.',
        'Cerrar sesión no equivale a borrar la cuenta, un grupo, un equipo o los resultados. No compartas contraseñas ni enlaces de recuperación.',
        'login', 'La recuperación parte del correo escrito en el formulario. No hace falta completar una contraseña que no recordás.')

process('01 · EMPEZAR', 'Orientarte entre las secciones',
        'La barra inferior reúne el trabajo cotidiano. El menú del usuario abre las herramientas personales y de organización del grupo.',
        'Barra inferior / Menú del usuario', 'Iniciá sesión y comprobá qué grupo está activo.',
        [
            ('Empezá por Panel', 'Consultá lo que requiere atención: actividad propia y del grupo, próxima fecha, resultados y partidos en curso. Una tarjeta puede llevarte directamente al encuentro.'),
            ('Abrí Jugadores', 'Encontrá las fichas del plantel y entrá en un perfil para consultar atributos e historial. La lista depende del contexto del grupo activo.'),
            ('Usá Partidos', 'Tocá la pelota de la barra inferior. El menú distingue Mis Partidos y Competiciones. Elegí Mis Partidos para revisar encuentros y abrir una convocatoria.'),
            ('Pasá por Explorar y Evaluaciones', 'Explorar sirve para buscar jugadores o partidos públicos. Evaluaciones reúne tareas pendientes, envíos anteriores y solicitudes de identidad.'),
            ('Abrí tu menú personal', 'Desde el encabezado accedé a Mi Perfil, Gestionar Grupos, Ranking del plantel, Mi entrenamiento, notificaciones, tema visual y Cerrar sesión.'),
        ],
        'Podés elegir la sección según lo que querés resolver, en vez de recorrer todas las pantallas para encontrar una acción.',
        'Si falta información, comprobá primero cuenta y grupo activo. Cambiar el grupo cambia el contexto; no significa que se hayan borrado los datos.',
        'user_menu', 'Las herramientas personales están en este menú. En la barra inferior, Partidos abre Mis Partidos y Competiciones.')

process('02 · TU JUGADOR', 'Completar y editar tu perfil',
        'Tu perfil es la identidad que aparece en fichas, planteles, partidos y devoluciones. Revisá la vista previa antes de guardar.',
        'Menú del usuario > Mi Perfil > Editar perfil', 'Necesitás estar en tu propio perfil para editar tus datos.',
        [
            ('Abrí la edición', 'Entrá en Mi Perfil y usá la acción de editar. Consultar la ficha de otra persona no te da acceso a modificarla.'),
            ('Elegí un nombre reconocible', 'Completá Nombre o apodo como querés que te identifiquen en la cancha. Evitá confundirlo con el nombre de un grupo o de un equipo.'),
            ('Indicá tu posición', 'Elegí DEL, MED, DEF o POR. La posición se usa para presentar tu ficha y aporta contexto a la organización deportiva.'),
            ('Completá los datos disponibles', 'Podés indicar pie hábil y año de nacimiento en los controles correspondientes. Revisá que sean correctos antes de confirmar.'),
            ('Guardá y comprobá', 'Tocá Guardar cambios y esperá la confirmación. Volvé al perfil para revisar nombre, posición y foto; salir sin guardar puede dejar cambios pendientes.'),
        ],
        'Tu ficha refleja los datos guardados. Los atributos deportivos y el OVR tienen su propio recorrido y no se cambian al elegir una posición.',
        'Si el botón está ocupado guardando o generando una imagen, esperá. La vista previa muestra cómo va a quedar, pero no sustituye Guardar cambios.',
        'edit_profile', 'El nombre, la posición, el pie hábil y el año de nacimiento se editan aquí. La foto nueva puede aparecer todavía sin guardar.')

process('02 · TU JUGADOR', 'Elegir y ajustar la foto',
        'Una foto clara hace más fácil reconocer a cada jugador en el plantel y en la cancha de Dirigir. Podés cargar una imagen y ajustar su encuadre.',
        'Mi Perfil > Editar perfil > Foto', 'Permití cámara o galería cuando el sistema lo pida y usá una imagen propia o autorizada.',
        [
            ('Elegí el origen', 'Abrí las acciones de foto y seleccioná cámara o galería, según lo que quieras usar. Si cancelás el selector, podés seguir editando los demás datos.'),
            ('Buscá un retrato legible', 'Conviene que el rostro se distinga y tenga espacio alrededor. Una foto de equipo completa puede servir como recuerdo, pero no identifica bien una ficha individual.'),
            ('Ajustá el encuadre', 'Usá Ajustar encuadre cuando esté disponible. Revisá la posición del rostro en la vista previa, porque la app reutiliza el retrato en tamaños distintos.'),
            ('Confirmá el cambio', 'Si aparece Foto nueva sin guardar, todavía falta confirmar la edición. Tocá Guardar cambios y esperá a que la carga termine.'),
            ('Revisá la ficha publicada', 'Volvé al perfil o al listado de jugadores. Comprobá que la imagen se reconozca tanto en la tarjeta como en el avatar pequeño.'),
        ],
        'La foto queda asociada a tu jugador una vez guardada correctamente y se reutiliza en las vistas que muestran su identidad.',
        'Si rechazaste un permiso del dispositivo, revisalo en los ajustes del sistema antes de volver a intentar. No vuelvas a subir la foto repetidamente mientras se está cargando.',
        'edit_profile', 'La vista previa ayuda a ver el recorte. Cambiar una foto y guardar el perfil son partes del mismo proceso.')

process('02 · TU JUGADOR', 'Generar un retrato deportivo',
        'La edición de perfil incluye una alternativa asistida por IA para transformar tu foto en un retrato deportivo. Revisá el resultado antes de usarlo.',
        'Mi Perfil > Editar perfil > Retrato con IA', 'Necesitás una foto de origen cargada y créditos disponibles para la generación.',
        [
            ('Prepará la foto de origen', 'Primero cargá una imagen donde se distinga bien el rostro. Si la app pide una foto guardada, completá ese paso antes de generar.'),
            ('Abrí la opción de generación', 'Leé las opciones y el consumo de créditos que informa la pantalla. La generación es opcional: podés usar la app con una foto convencional.'),
            ('Esperá el resultado', 'La imagen requiere procesamiento y conexión. Evitá iniciar varias solicitudes mientras la primera sigue en curso.'),
            ('Revisá la identidad y el recorte', 'Comprobá que el retrato represente a la persona y que el encuadre funcione en la tarjeta. Un resultado generado puede necesitar corrección o una nueva foto de origen.'),
            ('Comprobá qué quedó guardado', 'Seguí la confirmación de la pantalla y revisá tu perfil al terminar. Si modificaste otros datos pendientes, guardalos también.'),
        ],
        'Podés presentar una identidad visual deportiva sin alterar tus estadísticas, posición real ni historial de partidos.',
        'Los créditos de generación no son una mejora del OVR. La guía no presupone un sistema de compra de créditos disponible en la app.',
        'profile', 'El retrato forma parte de la presentación de la ficha. El OVR y los atributos siguen mostrando información deportiva.')

process('03 · EL GRUPO', 'Crear o ingresar a un grupo',
        'El grupo reúne a la comunidad que organiza y juega junta. Es el contexto en el que encontrás plantel, equipos, partidos y competiciones.',
        'Menú del usuario > Gestionar Grupos', 'Para unirte a un grupo existente, pedile su código de invitación a quien lo administra.',
        [
            ('Abrí Gestionar Grupos', 'Si todavía no seleccionaste uno, la pantalla te permite elegir entre tus grupos o empezar por crear uno e ingresar con código.'),
            ('Creá un grupo nuevo', 'Usá Crear grupo, completá el nombre solicitado y confirmá. Elegí un nombre que tus compañeros puedan reconocer.'),
            ('O unite con un código', 'Tocá Unirse a grupo, escribí el código recibido y confirmá con Unirme. Un código incorrecto no identifica al grupo que querés.'),
            ('Seleccioná el grupo activo', 'Si pertenecés a varios, elegí el que vas a usar en este momento. La app utiliza ese contexto para mostrar la actividad correspondiente.'),
            ('Revisá el resultado', 'Comprobá el nombre del grupo, sus equipos y el plantel. Si acabás de crearlo, algunas secciones estarán vacías hasta que incorporen contenido.'),
        ],
        'Quedás vinculado al grupo elegido o creás uno nuevo para organizar tu propia comunidad.',
        'Entrar a un grupo no convierte automáticamente a todos sus miembros en administradores. Los controles disponibles dependen de tu rol.',
        'groups', 'El grupo y los equipos son niveles diferentes. Un grupo puede reunir varios equipos y organizar fechas entre ellos.')

process('03 · EL GRUPO', 'Invitar y cambiar de contexto',
        'Antes de crear un partido o un equipo, verificá el grupo activo. Compartir su código permite que otros se incorporen por el flujo de ingreso.',
        'Gestionar Grupos > Grupo activo', 'Necesitás pertenecer al grupo. Las acciones de administración se muestran según tus permisos.',
        [
            ('Comprobá el encabezado', 'Revisá el nombre del grupo seleccionado antes de actuar. Esto es especialmente útil si participás en más de una comunidad.'),
            ('Compartí la invitación', 'Usá Invitar al grupo o Copiar código de invitación. Enviá el código a las personas que deben sumarse para que lo introduzcan desde su propia cuenta.'),
            ('Explicá el siguiente paso', 'Quien recibe el código debe entrar en Gestionar Grupos y elegir unirse. Compartir una captura o un nombre parecido no reemplaza ese ingreso.'),
            ('Cambiá al grupo correcto', 'Si querés trabajar con otro grupo, usá el selector disponible y elegilo. Después volvé a revisar equipos y plantel antes de crear contenido.'),
            ('Administrá dentro de tu rol', 'Usá los controles de gestión que tengas habilitados. Si falta una acción, consultá al responsable del grupo en lugar de crear un duplicado para sortear el permiso.'),
        ],
        'El grupo activo queda claro y tus compañeros tienen una vía concreta para sumarse a la misma comunidad.',
        'Un código de grupo sirve para ingresar a esa comunidad. No es una confirmación de asistencia a un partido ni una inscripción en una copa.',
        'groups', 'El código y el acceso a equipos conviven en la pantalla del grupo. Confirmá el contexto antes de usar Crear.')

process('03 · EL GRUPO', 'Consultar el plantel y sus fichas',
        'Jugadores presenta a las personas del grupo. Desde una ficha podés conocer su posición, atributos y recorrido sin confundirlos con una convocatoria puntual.',
        'Barra inferior > Jugadores > Ficha', 'Seleccioná el grupo que contiene el plantel que querés consultar.',
        [
            ('Recorré los jugadores', 'Abrí Jugadores y encontrá la ficha de la persona que buscás. Usá las opciones de búsqueda u organización que estén visibles en la lista.'),
            ('Interpretá la tarjeta', 'El nombre identifica al jugador; DEL, MED, DEF o POR indica la posición. El OVR resume su nivel y los atributos desglosan el perfil deportivo.'),
            ('Abrí el perfil completo', 'Tocá la ficha para consultar más información. La vista integra identidad, estadísticas y registros de encuentros cuando existen.'),
            ('Distinguí perfil y asistencia', 'Estar en el plantel del grupo no significa estar convocado para cada fecha. Para conocer la participación real, abrí el detalle del partido correspondiente.'),
            ('Usá la carga manual cuando corresponda', 'Si tu rol permite crear jugadores manuales, completá el formulario desde el plantel. Revisá primero si esa persona ya tiene una ficha para evitar duplicados.'),
        ],
        'Podés reconocer al plantel y consultar el recorrido de cada jugador desde una ficha consistente.',
        'Una ficha manual y una cuenta con acceso no son lo mismo. No prometas a alguien que podrá iniciar sesión solamente porque creaste una ficha con su nombre.',
        'players', 'Los atributos RIT, TIR, PAS, REG, DEF y FIS describen dimensiones distintas. El color ayuda a destacar datos, no reemplaza sus valores.')

process('04 · EQUIPOS', 'Crear un equipo e identificarlo',
        'Los equipos tienen nombre, camiseta y plantel propio dentro del grupo. Sirven para encuentros entre equipos y para participar en competiciones.',
        'Gestionar Grupos > Equipos > Crear', 'Necesitás un grupo activo y permiso para crear equipos.',
        [
            ('Revisá los equipos existentes', 'Entrá en la sección del grupo y comprobá si el equipo ya está creado. Crear otro con un nombre similar puede repartir el plantel y confundir la competición.'),
            ('Abrí la creación', 'Usá Crear en el bloque de equipos. Completá el nombre y los campos que solicita el formulario.'),
            ('Diseñá la camiseta', 'Elegí las opciones de diseño y colores disponibles. La camiseta permite reconocer al equipo en sus fichas, partidos y cruces.'),
            ('Armá el plantel inicial', 'Seleccioná jugadores del contexto permitido y revisá la lista. La identidad visual y la composición del plantel se administran por separado.'),
            ('Guardá y abrí el detalle', 'Confirmá la creación y comprobá que nombre, camiseta y jugadores estén correctos. Desde el detalle podés seguir administrando lo que habilite tu rol.'),
        ],
        'El equipo queda identificado dentro del grupo y puede utilizarse en los flujos que enfrentan equipos ya formados.',
        'Una camiseta parecida no une dos equipos. Para un partido entre equipos, elegí las entidades correctas en el selector.',
        'create_team', 'La creación avanza por pasos. Revisá la identidad y el plantel antes de confirmar el nuevo equipo.')

process('04 · EQUIPOS', 'Administrar jugadores y dorsales',
        'El detalle de un equipo permite organizar sus integrantes. La condición de titular o suplente y el dorsal ayudan a presentar el plantel.',
        'Gestionar Grupos > Equipo > Gestión del plantel', 'La edición depende del creador y de los permisos del grupo.',
        [
            ('Abrí el equipo correcto', 'Comprobá el nombre y la camiseta antes de modificar su composición. Consultar un equipo ajeno no habilita automáticamente su edición.'),
            ('Entrá en la gestión del plantel', 'Usá la acción disponible para administrar integrantes. Compará la lista actual con quienes realmente deben pertenecer al equipo.'),
            ('Agregá o quitá integrantes', 'Seleccioná las personas que correspondan. Revisá nombres similares y evitá agregar dos fichas diferentes para el mismo jugador.'),
            ('Ordená la presentación', 'Asigná el dorsal y la condición Titular o Suplente en los controles del integrante. Son datos del plantel del equipo, no una promesa de asistencia a toda fecha.'),
            ('Guardá y revisá', 'Confirmá los cambios y comprobá ambas listas en el detalle. Para el próximo partido, revisá además la convocatoria propia del encuentro.'),
        ],
        'El plantel queda actualizado y más fácil de reconocer al organizar encuentros y consultar la ficha del equipo.',
        'Eliminar un equipo es una acción diferente de quitar un integrante. Leé la confirmación y comprobá posibles vínculos con partidos o torneos antes de aceptar.',
        'team', 'La vista separa titulares y suplentes. Los números pertenecen a cada integrante del equipo.')

process('05 · ORGANIZAR', 'Elegir cómo armar un partido',
        'La creación del partido se organiza por pasos. Primero definís el contexto; después elegís cómo se completa el plantel y revisás la convocatoria.',
        'Partidos > Armar partido', 'Comprobá el grupo activo y tené claro si convocás personas o enfrentás equipos.',
        [
            ('Poné un nombre reconocible', 'Escribí el nombre del partido. Usá una referencia que ayude al grupo a distinguirlo de otras fechas, especialmente si juegan siempre en la misma cancha.'),
            ('Elegí la modalidad deportiva', 'Seleccioná fútbol 5, 7 u 11 entre las opciones disponibles. Esa decisión cambia el tamaño esperado de la convocatoria.'),
            ('Decidí cómo entra el plantel', 'Elegir jugadores permite convocar personas; Inscripción abierta empieza sin plantel para que se anoten; Enfrentar dos equipos utiliza equipos existentes.'),
            ('Definí la visibilidad', 'Sólo el grupo conserva la convocatoria dentro de esa comunidad. Público permite que el encuentro participe de los flujos para personas de afuera.'),
            ('Continuá hasta revisar', 'Completá los pasos de lugar, horario y participantes que correspondan. Leé el resumen antes de confirmar la creación.'),
        ],
        'Se crea una convocatoria con reglas claras sobre quién participa y cómo se completa.',
        'Elegir Inscripción abierta y elegir Público son decisiones distintas: una define cómo se llena el plantel y la otra su alcance.',
        'create_match', 'La creación combina modalidad, método de convocatoria y visibilidad. Revisá las tres decisiones, no solamente el nombre.')

process('05 · ORGANIZAR', 'Definir lugar y horario',
        'Podés crear una fecha con horario decidido o consultar disponibilidad al grupo. El detalle del partido reúne luego la información vigente.',
        'Armar partido > Lugar y horario', 'Si la fecha está acordada, prepará día, hora y dirección de la cancha.',
        [
            ('Buscá la cancha', 'Completá Dirección de la cancha y elegí la referencia que corresponda. Revisá la localidad para no confundir direcciones con el mismo nombre.'),
            ('Usá Ya tengo horario', 'Cuando ya está decidido, elegí la fecha y la hora en sus controles. Comprobá el día seleccionado y la franja horaria antes de avanzar.'),
            ('O elegí Consultar al grupo', 'Si todavía no hay acuerdo, usá esta alternativa. El encuentro puede quedar en planificación y resolverse mediante las propuestas del detalle.'),
            ('Revisá el contexto', 'Cuando existen ubicación y fecha suficientes, la app puede mostrar información de clima. Tomala como referencia y no como confirmación de reserva.'),
            ('Avisá qué está confirmado', 'Una vez creado el partido, usá su detalle y el chat para distinguir datos definitivos de opciones que todavía se están votando.'),
        ],
        'El encuentro tiene una referencia concreta de lugar y hora o un proceso abierto para definirlos con el grupo.',
        'Guardar una cancha en la app no reserva un turno ni realiza un pago. Acordá la contratación del espacio por el canal que use el organizador.',
        'create_match', 'Ya tengo horario y Consultar al grupo permiten comenzar desde situaciones distintas. No hace falta inventar una fecha definitiva para organizarse.')

process('05 · ORGANIZAR', 'Votar y cerrar la planificación',
        'La planificación permite consultar cuándo puede jugar cada persona y qué cancha prefiere. Fecha y lugar no se votan de la misma manera.',
        'Partidos > Detalle > Planificación', 'El partido debe estar en planificación o tener la votación abierta.',
        [
            ('Consultá las alternativas', 'Abrí el detalle y revisá las propuestas de fecha y de cancha. Mirá el horario completo y no solamente el día.'),
            ('Marcá tu disponibilidad', 'En la votación de fecha podés marcar varias opciones: la pregunta es cuándo podés jugar. Volvé a revisar tus marcas si tu disponibilidad cambia.'),
            ('Elegí una cancha', 'La votación de lugar es de una sola opción. Compará dirección y preferencias antes de votar.'),
            ('Agregá opciones si organizás', 'El organizador dispone de Proponer para incorporar alternativas. Conviene mantener opciones concretas para que la consulta resulte fácil de resolver.'),
            ('Confirmá la decisión', 'El organizador elige la opción definitiva mediante el control correspondiente. Después revisá el dato confirmado en el detalle y avisá por el chat si hace falta.'),
        ],
        'El grupo puede pasar de varias posibilidades a una referencia acordada para jugar.',
        'La alternativa con más votos ayuda a decidir, pero votar no reserva la cancha ni sustituye la confirmación del organizador.',
        'planning', 'En fecha se puede expresar disponibilidad para varios días; en cancha se elige una opción. El organizador dispone de acciones adicionales.')

process('05 · ORGANIZAR', 'Convocar y equilibrar jugadores',
        'Cuando elegís personas para un partido, la app puede asistir con el equilibrio deportivo. La revisión final sigue siendo parte de organizar.',
        'Armar partido > Elegir jugadores', 'Tené el plantel correcto en el grupo y elegí la modalidad 5, 7 u 11.',
        [
            ('Seleccioná a quienes juegan', 'Marcá las fichas que corresponden a esta fecha. Revisá nombres, posiciones y disponibilidad real: pertenecer al grupo no asegura asistencia.'),
            ('Completá el cupo necesario', 'Observá la cantidad seleccionada y el tamaño del partido. Evitá incluir una persona dos veces mediante fichas duplicadas.'),
            ('Revisá las posiciones', 'Identificá arqueros, defensores, volantes y delanteros. Las opciones de armado consideran el nivel y la distribución deportiva disponible.'),
            ('Consultá la propuesta de equipos', 'Revisá los equipos generados o presentados por el flujo. Un promedio parecido ayuda, pero no expresa por sí solo acuerdos, lesiones o la función del día.'),
            ('Confirmá con el grupo', 'Comprobá el reparto en el detalle del encuentro y comunicá cualquier cambio permitido antes de empezar a dirigir.'),
        ],
        'La convocatoria queda distribuida con una referencia de nivel y posiciones para organizar un encuentro más parejo.',
        'OVR es una orientación deportiva. No debe interpretarse como garantía de resultado ni como sustituto de conocer a quienes juegan.',
        'match_detail', 'La ficha del partido muestra los equipos y sus integrantes. Revisá tanto el promedio como la composición de cada lado.')

process('05 · ORGANIZAR', 'Inscripciones, invitaciones y cupos',
        'Una convocatoria puede completarse por inscripción o por invitación. La información del detalle permite distinguir participación confirmada de una solicitud pendiente.',
        'Partidos > Detalle / Explorar > Invitación', 'Consultá las reglas de ingreso del partido y si todavía tiene lugar.',
        [
            ('Revisá el estado del encuentro', 'Comprobá que sea la fecha correcta y que todavía admita participación. Mirá el cupo ocupado y el total previsto.'),
            ('Usá la acción que ofrece la ficha', 'Según el tipo de encuentro, podés anotarte o enviar una solicitud. Leé el resultado: pedir un lugar no siempre implica quedar confirmado.'),
            ('Invitá desde una convocatoria propia', 'Si organizás, usá la búsqueda de jugadores y seleccioná el partido futuro al que querés invitar. Revisá día, lugar y cupos antes de enviar.'),
            ('Comprobá solicitudes y cambios', 'El organizador revisa los pedidos mediante los controles habilitados. Después verificá que la lista de participantes refleje la decisión.'),
            ('Volvé a mirar antes de ir', 'Una solicitud enviada, un mensaje de chat o pertenecer al grupo no reemplazan la confirmación visible en la convocatoria.'),
        ],
        'Cada persona puede identificar si está dentro del partido, esperando respuesta o viendo un encuentro sin cupos.',
        'Si aparece Partido completo, no crees una segunda solicitud desde otra ficha. Consultá al organizador y revisá si se liberó un lugar.',
        'explore_matches', 'Ya participás y Pedido enviado representan estados distintos. El contador de jugadores ayuda a comprobar el cupo.')

process('06 · LA FECHA', 'Leer el detalle del partido',
        'El detalle es el punto de encuentro de la convocatoria: reúne contexto, equipos y accesos que cambian a medida que avanza la fecha.',
        'Partidos > Elegir un encuentro', 'Abrí el partido concreto; varios encuentros pueden tener nombres similares.',
        [
            ('Identificá el encuentro', 'Revisá nombre, estado, modalidad, día, hora y cancha. Si algo está pendiente, consultá la planificación antes de tomarlo como definitivo.'),
            ('Comprobá quién juega', 'Leé los equipos y sus integrantes. Mirá los cupos y las acciones de ingreso si querés sumarte.'),
            ('Ubicá lo que corresponde ahora', 'Antes de jugar predominan convocatoria y planificación. En curso podés seguir el vivo; al terminar aparecen resultados y accesos de evaluación según tu participación.'),
            ('Entrá en las herramientas', 'Usá los accesos disponibles para chat, vivo, estadísticas y contenido del encuentro. Las acciones de dirección son diferentes de las de consulta.'),
            ('Verificá tu rol', 'Si no ves un control para modificar o dirigir, comprobá quién organiza. No todos los participantes pueden cambiar el estado de un encuentro.'),
        ],
        'Podés entender qué está ocurriendo y continuar con la acción adecuada sin perder el contexto del partido.',
        'Los botones disponibles dependen del estado y de tu relación con la fecha. Una captura de otra fase puede mostrar controles distintos.',
        'match_detail', 'El encabezado, la convocatoria y las acciones inferiores se complementan. Empezá por el estado antes de buscar un botón.')

process('06 · LA FECHA', 'Iniciar y controlar el partido',
        'Dirigir reúne cancha, marcador y reloj. Los controles de juego corresponden al organizador; seguir el vivo no otorga ese permiso.',
        'Detalle > Dirigir / Vivo', 'Comprobá equipos e integrantes. Para dirigir, usá la cuenta que organiza el partido.',
        [
            ('Entrá en la vista de cancha', 'Abrí Dirigir desde el encuentro. Identificá ambos equipos y comprobá que los jugadores correspondan a la fecha.'),
            ('Iniciá cuando empieza el juego', 'Tocá Iniciar partido. El encuentro pasa a estar en curso y el reloj acompaña su desarrollo.'),
            ('Pausá si hace falta', 'Usá Pausar para detener el avance y Reanudar para seguir. Pausar no significa cerrar el encuentro ni publicar el resultado final.'),
            ('Administrá los períodos', 'Desde el primer tiempo podés pasar a Descanso y luego a Segundo tiempo. Revisá el período visible al retomar.'),
            ('Terminá con confirmación', 'Al concluir, usá Finalizar y leé la confirmación. Comprobá el marcador antes de cerrar: finalizar habilita el recorrido posterior del partido.'),
        ],
        'El estado del partido y su reloj quedan coordinados para quienes consultan la misma fecha.',
        'El segundo tiempo utiliza la referencia del minuto 45 o el minuto acumulado si es mayor. No asumas una duración configurable del reloj que la pantalla no ofrezca.',
        'live', 'La cancha es la referencia principal. Marcador, período y controles deben leerse juntos para distinguir pausa, descanso y cierre.')

process('06 · LA FECHA', 'Registrar goles y otros eventos',
        'Los eventos vinculan el resultado con lo que pasó en la cancha. Registralos con el jugador, equipo y momento correctos.',
        'Vivo > Gol / Más eventos', 'Para registrar, necesitás los controles de dirección del organizador.',
        [
            ('Elegí el tipo de evento', 'Usá Gol para una anotación o Más eventos para las otras acciones disponibles, como asistencias y tarjetas.'),
            ('Identificá al protagonista', 'Seleccioná al jugador y comprobá su equipo. Las fotos, nombres y posiciones ayudan a evitar confundir personas.'),
            ('Revisá los datos antes de confirmar', 'Comprobá minuto, tipo y protagonista en el formulario. Si hay datos adicionales, completalos según lo sucedido.'),
            ('Confirmá una sola vez', 'Esperá a que termine el guardado. Si la conexión demora, revisá la lista de eventos antes de repetir para no registrar la misma jugada dos veces.'),
            ('Contrastá marcador y cronología', 'Consultá las pestañas o secciones de eventos y estadísticas. Ante una diferencia, revisá el origen antes de sumar una corrección a ciegas.'),
        ],
        'El vivo puede mostrar un marcador y una secuencia de acciones asociados a la fecha.',
        'La carga del vivo y los datos que cada persona informa al evaluar son registros con propósitos diferentes. Conviene revisarlos con coherencia al cerrar.',
        'live', 'La acción Gol facilita el registro habitual. Más eventos reúne otros tipos; el registro debe corresponder al protagonista elegido.')

process('06 · LA FECHA', 'Coordinarse por el chat',
        'El chat mantiene la conversación dentro del encuentro. Sirve para coordinar llegada, avisar cambios y aclarar acuerdos de esa fecha.',
        'Detalle o Vivo > Chat del partido', 'El acceso depende de tu relación y permisos sobre el partido.',
        [
            ('Abrí el chat correcto', 'Entrá desde el encuentro que querés coordinar. Comprobá el nombre para no enviar un mensaje sobre otra fecha.'),
            ('Leé el contexto reciente', 'Revisá los mensajes anteriores antes de preguntar por cancha, horario o participación. La conversación puede contener avisos importantes.'),
            ('Escribí un mensaje concreto', 'Indicá qué cambió o qué necesitás confirmar. Para una llegada tarde, por ejemplo, aclarar a qué fecha te referís evita malentendidos.'),
            ('Enviá y verificá', 'Tocá enviar y comprobá que el mensaje aparezca en la conversación. Si demora, evitá repetirlo sin revisar el estado.'),
            ('Confirmá también el dato formal', 'Cuando cambie algo del encuentro, revisá el detalle. Un acuerdo escrito en el chat no actualiza por sí solo el horario, el plantel o el marcador.'),
        ],
        'Los mensajes quedan vinculados al contexto del partido y pueden consultarse junto con su actividad.',
        'El chat del encuentro no es una confirmación automática de inscripción ni una herramienta de reserva. No compartas credenciales o información privada innecesaria.',
        'chat', 'Cada conversación pertenece a una fecha. El detalle sigue siendo la referencia para sus datos confirmados.')

process('07 · DESPUÉS DE JUGAR', 'Encontrar las evaluaciones pendientes',
        'Cuando termina un partido, la devolución permite registrar cómo jugó cada compañero. La bandeja organiza lo pendiente y lo ya enviado.',
        'Barra inferior > Evaluaciones', 'Debés usar la cuenta que participó y tener tareas de evaluación asignadas para esa fecha.',
        [
            ('Abrí Pendientes', 'Buscá la tarjeta del encuentro y comprobá nombre y fecha. Una notificación es un aviso; la bandeja muestra las tareas que tu cuenta tiene para completar.'),
            ('Entrá con Evaluar ahora', 'Abrí el formulario de ese partido. Revisá los compañeros que aparecen: la app utiliza las asignaciones de evaluación, no una lista arbitraria de todo el grupo.'),
            ('Consultá Historial si ya enviaste', 'Si no encontrás la tarea entre las pendientes, revisá los envíos anteriores. Un formulario enviado no debe tratarse como una nueva tarea.'),
            ('Actualizá la vista', 'Deslizá para actualizar cuando corresponda y comprobá que haya conexión. Si existe un error, usá Reintentar.'),
            ('Revisá cuenta y cierre', 'Si sigue faltando, comprobá que entraste con la identidad participante y que el organizador finalizó el encuentro. Compartí esos datos si necesitás ayuda.'),
        ],
        'Podés identificar qué devolución falta completar y entrar al formulario del partido correcto.',
        'No todas las personas del grupo evalúan todos los partidos. Ver un encuentro o recibir un mensaje no reemplaza una asignación válida.',
        'evaluations', 'Pendientes, Historial y Solicitudes tienen funciones distintas. Historial corresponde a tus evaluaciones enviadas.')

process('07 · DESPUÉS DE JUGAR', 'Completar una devolución',
        'El formulario reúne tu partido y la evaluación de compañeros. La prioridad es describir lo que realmente viste, con un criterio consistente.',
        'Evaluaciones > Pendientes > Evaluar ahora', 'Revisá el partido y los jugadores asignados antes de empezar.',
        [
            ('Completá Tu partido', 'Informá tus goles y asistencias con los controles de suma y resta. Elegí la figura del partido si querés emitir un voto.'),
            ('Evaluá a cada compañero', 'En cada ficha elegí el modo disponible: nota de 1 a 10, etiquetas o reseña. Cambiar de modo modifica la forma de expresar esa devolución.'),
            ('Cumplí lo que pide el modo', 'Para etiquetas, elegí al menos tres. Para reseña, escribí al menos diez caracteres. Una nota debe reflejar el rendimiento de esa fecha.'),
            ('Aportá tu recuerdo', 'Si completás el testimonio del partido, describí una jugada o una impresión concreta. Ese contenido puede aportar al relato posterior.'),
            ('Revisá antes de enviar', 'Tocá Revisar y enviar y leé el resumen. Podés Seguir editando o confirmar con Enviar evaluaciones. Esperá el resultado del envío.'),
        ],
        'La devolución pasa al recorrido de evaluaciones y puede alimentar el historial deportivo según el procesamiento correspondiente.',
        'Enviar es una confirmación, no un guardado informal de borrador. Revisá notas, nombres, goles y asistencias antes de aceptarla.',
        'evaluate', 'Tu partido y Tus compañeros son partes distintas. La revisión final ayuda a detectar un dato equivocado antes del envío.')

process('07 · DESPUÉS DE JUGAR', 'Privacidad de las evaluaciones',
        'Las devoluciones pueden presentarse sin identificar al compañero que las hizo. Una solicitud de identidad requiere una decisión de esa persona.',
        'Evaluaciones > Solicitudes / Perfil > Devoluciones', 'Distinguí la nota recibida de la identidad de quien evaluó.',
        [
            ('Leé la devolución por su contenido', 'En el historial del perfil podés encontrar notas, etiquetas y cambios por atributo. Compañero anónimo indica que no se muestra su identidad.'),
            ('Usá los controles disponibles', 'Si la vista ofrece solicitar identidad, esa acción inicia un pedido. No revela por sí sola quién escribió la devolución.'),
            ('Consultá Solicitudes', 'Si otra persona quiere saber que fuiste vos quien la evaluó, el pedido aparece en esta pestaña de tu bandeja.'),
            ('Decidí con información', 'Revisá quién pide conocer tu identidad y sobre qué devolución. Podés elegir Mantener anonimato o Revelar identidad.'),
            ('Respetá el resultado', 'La decisión se guarda y la visibilidad sigue ese proceso. Una conversación externa no modifica automáticamente la opción elegida en la app.'),
        ],
        'La identificación del evaluador se trata de forma explícita y separada del contenido deportivo.',
        'No asumas que una nota permite deducir su autor ni presentes el anonimato como un error. Evaluá con respeto aunque tu identidad no se muestre.',
        'evaluations', 'Solicitudes no reúne pedidos de ingreso a partidos: aquí se trata de la identidad asociada a evaluaciones.')

process('07 · DESPUÉS DE JUGAR', 'Consultar historial y evolución',
        'El perfil reúne la trayectoria del jugador. Los registros por partido permiten entender de dónde vienen las estadísticas y los cambios deportivos.',
        'Jugadores > Perfil / Mi Perfil > Historial y Progresión', 'Necesitás registros guardados para que aparezcan resultados y cambios.',
        [
            ('Abrí el perfil', 'Elegí tu ficha o la de otro jugador. Diferenciá los datos generales de los registros de una fecha específica.'),
            ('Consultá los encuentros', 'Recorré el historial y abrí el registro que quieras entender. Nombre, fecha y lugar ayudan a reconocer el partido.'),
            ('Leé la devolución completa', 'Revisá goles, asistencias, valoración y etiquetas cuando existan. Los cambios por atributo pueden tener signos positivos o negativos.'),
            ('Abrí Progresión', 'Consultá el gráfico y los registros de OVR. Compará fechas y valores: un punto aislado no cuenta por sí solo toda la evolución.'),
            ('Relacioná datos y contexto', 'Usá el historial para conversar sobre el rendimiento o orientar la práctica. Distinguí un cambio deportivo de una edición de nombre o foto.'),
        ],
        'Podés seguir el recorrido de una persona y consultar evidencia por fecha en lugar de mirar solamente el OVR actual.',
        'Si todavía no hay historial, puede faltar actividad evaluada o procesamiento. No significa que la foto o el perfil estén mal guardados.',
        'progression', 'La curva muestra cambios a lo largo del tiempo. El registro inferior ayuda a ubicar cada variación en una fecha concreta.')

process('07 · DESPUÉS DE JUGAR', 'Leer la crónica del encuentro',
        'La crónica transforma el cierre de la fecha en un relato. Se apoya en la información disponible del partido y los testimonios aportados.',
        'Detalle del partido finalizado > Crónica', 'El partido debe contar con contexto suficiente; generar puede requerir permisos y conexión.',
        [
            ('Entrá al partido terminado', 'Comprobá resultado y participantes. Las secciones posteriores al juego pueden reunir figura, planilla y relato.'),
            ('Leé la crónica existente', 'Si ya hay una generada, revisá título, texto y voces del vestuario. Reconocé qué partes describen datos y cuáles son narración.'),
            ('Generá si está habilitado', 'Si aparece la acción para generar, usala desde el rol permitido y esperá el procesamiento. No hace falta lanzar solicitudes repetidas.'),
            ('Contrastá con la fecha', 'Una crónica asistida por IA puede contener una interpretación equivocada. Para confirmar un resultado, usá la planilla y los datos del encuentro.'),
            ('Mejorá el contexto futuro', 'Al evaluar otros partidos, aportá testimonios claros y específicos. Un relato con datos útiles resulta más reconocible para el grupo.'),
        ],
        'La fecha conserva una memoria narrativa además de sus números y evaluaciones.',
        'La crónica no es una transmisión ni una validación oficial de hechos. Si no se puede generar, conservá el resultado y revisá conexión, permisos y el mensaje de error.',
        'story', 'El relato y las voces del vestuario acompañan al resultado. Las capturas de esta guía usan una crónica de demostración.')

process('07 · DESPUÉS DE JUGAR', 'Agregar y consultar clips',
        'Los clips permiten vincular un video corto con el partido. Pueden asociarse a un minuto y, cuando corresponde, a un jugador.',
        'Detalle del partido > Clips', 'Necesitás un archivo de video y acceso habilitado para cargar contenido en esa fecha.',
        [
            ('Abrí los clips del partido', 'Consultá primero los videos existentes. Verificá que estés en la fecha que corresponde a la jugada.'),
            ('Usá Subir', 'Elegí Grabar para capturar desde la cámara o Elegir para buscar un archivo. La pantalla indica hasta 30 segundos. Revisá los permisos del sistema si los solicita.'),
            ('Completá el contexto', 'Indicá el minuto y el jugador cuando el formulario lo permita. Esa referencia ayuda a encontrar la acción después.'),
            ('Esperá la subida', 'Los videos pueden requerir más tiempo y datos que una foto. No cierres ni repitas la carga sin comprobar si terminó.'),
            ('Reproducí para verificar', 'Abrí el clip guardado y comprobá que corresponda al encuentro y se pueda ver. Antes de compartir imágenes de otras personas, acordá su uso.'),
        ],
        'El encuentro puede conservar jugadas en video dentro de su contexto deportivo.',
        'Cargar clips no significa emitir video en directo. La disponibilidad depende del archivo, la conexión y los permisos de la fecha.',
        'clip_upload', 'Grabar y Elegir son las dos entradas de video. Después se define el minuto y, opcionalmente, el jugador antes de Subir clip.')

process('08 · COMPETICIONES', 'Preparar una liga o una copa',
        'Una competición conecta equipos y partidos con una estructura común. La liga organiza fechas y tabla; la copa organiza cruces de eliminación.',
        'Barra inferior > Partidos > Competiciones > Crear', 'Tené un grupo activo, equipos creados y permisos para organizar la competición.',
        [
            ('Elegí el tipo', 'Usá Liga para un calendario de enfrentamientos y tabla. Elegí Copa para un cuadro con avance por rondas hasta un campeón.'),
            ('Completá la identidad', 'Escribí nombre, descripción y acuerdos del torneo. Conviene dejar claros el formato y el criterio de organización antes de comenzar.'),
            ('Decidí las inscripciones', 'Podés seleccionar equipos del grupo o abrir inscripciones para recibir solicitudes. Abrir la convocatoria no equivale a iniciar los partidos.'),
            ('Revisá la capacidad', 'Configurá los cupos y seleccioná participantes. Para sortear una copa se necesitan 2, 4, 8, 16 o 32 equipos.'),
            ('Guardá y comprobá el resumen', 'Entrá a la competición creada y revisá participantes y configuración. Iniciar es un paso posterior que genera la estructura deportiva.'),
        ],
        'La competición queda preparada para completar participantes y revisar su organización antes de comenzar.',
        'Antes de iniciar, revisá todo el formato. Una competición con partidos tiene historia que debe conservarse y no se trata como un borrador vacío.',
        'create_league', 'El formulario comienza por la identidad y apertura de inscripciones. Guardar la preparación y comenzar el torneo son pasos distintos.')

process('08 · COMPETICIONES', 'Configurar e iniciar una liga',
        'La liga genera enfrentamientos y una clasificación. Conviene resolver formato, puntaje y calendario antes de iniciar.',
        'Competiciones > Liga > Configurar torneo', 'Necesitás equipos participantes y ser organizador del torneo.',
        [
            ('Revisá participantes', 'Comprobá que los equipos elegidos sean los correctos y que no falten aprobaciones. La capacidad máxima del formato móvil es de 16 equipos.'),
            ('Definí el formato', 'Elegí si se juega una rueda o Ida y vuelta. Esta decisión modifica la cantidad de enfrentamientos que se generarán.'),
            ('Acordá los puntos', 'Configurá los valores de victoria y empate que permite el formulario. Comunicá el criterio al grupo antes de empezar.'),
            ('Prepará el calendario', 'Elegí frecuencia semanal o cada dos semanas y revisá la primera fecha, hora y sede en los controles disponibles.'),
            ('Iniciá la liga', 'Usá Iniciar liga y revisá la programación. Después entrá en Fechas para abrir los encuentros y en Tabla para consultar la clasificación.'),
        ],
        'La competición pasa de configuración a un recorrido de jornadas con partidos asociados.',
        'Generar fechas organiza la competición en la app; no contrata sedes ni asegura que todos puedan jugar. Confirmá esos acuerdos con los equipos.',
        'league', 'El resumen permite ver el estado y el próximo encuentro. Fechas y Tabla tienen propósitos complementarios.')

process('08 · COMPETICIONES', 'Jugar fechas y cerrar la liga',
        'La clasificación depende de los resultados de sus encuentros. El cierre comprueba que el recorrido esté resuelto y confirma al campeón.',
        'Liga > Fechas / Tabla / Resumen', 'Para administrar, necesitás el rol organizador. Para cerrar, las fechas deben estar resueltas.',
        [
            ('Encontrá la jornada', 'Abrí Fechas y consultá los cruces. El filtro Sólo mi equipo facilita ubicar lo propio; una jornada también puede incluir descanso.'),
            ('Prepará cada partido', 'Usá Abrir partido o Preparar y abrir partido según la ficha. Completá la programación que falte antes de jugar.'),
            ('Cerrá los encuentros', 'Registrá y finalizá cada partido mediante su flujo. Volvé a la liga para comprobar que el resultado figure correctamente.'),
            ('Leé la tabla', 'Consultá puntos, partidos y goles. El criterio de cierre considera puntos, diferencia y goles a favor. Revisá la cabecera de cada columna.'),
            ('Confirmá al campeón', 'Cuando corresponda, usá Cerrar liga y confirmar campeón. Si persiste un empate en los criterios, confirmá el desempate deportivo acordado que pide la pantalla.'),
        ],
        'La liga conserva fechas, resultados, clasificación y cierre en una misma estructura.',
        'Una tabla no reemplaza acuerdos disciplinarios o reglamentarios externos. No cierres con resultados sin revisar ni elijas un desempate arbitrario.',
        'league_table', 'La tabla se interpreta con sus columnas. Cerrar la liga es una acción del organizador y requiere comprobar los resultados.')

process('08 · COMPETICIONES', 'Sortear y avanzar en una copa',
        'La copa utiliza un cuadro de eliminación. Cada cruce resuelto permite avanzar hacia la siguiente ronda.',
        'Competiciones > Copa > Cruces', 'Para iniciar, necesitás 2, 4, 8, 16 o 32 participantes y permiso de organización.',
        [
            ('Completá el cuadro antes de iniciar', 'Revisá equipos, cupos e inscripciones. No alcanza con elegir una capacidad: los participantes necesarios deben estar incorporados.'),
            ('Elegí cómo ordenar el sorteo', 'Usá las opciones disponibles: sorteo libre o cabezas por nivel. Acordá ese criterio antes de generar los enfrentamientos.'),
            ('Tocá Sortear e iniciar', 'Comprobá el cuadro resultante en Cruces. Los partidos quedan asociados a la competición y se gestionan desde sus accesos.'),
            ('Resolvé cada encuentro', 'Abrí el partido, prepará lo que falte y registrá su resultado. Si empatan y el cruce necesita ganador, completá el desempate requerido.'),
            ('Seguí el avance', 'Volvé al cuadro para comprobar quién pasó y qué ronda sigue. El recorrido culmina en la final y la identificación del campeón.'),
        ],
        'El grupo dispone de un cuadro con partidos reales y avance deportivo entre rondas.',
        'Los penales de desempate se registran separados del marcador del juego. No sumes esos tantos al resultado del partido para forzar un ganador.',
        'cup_bracket', 'Cruces muestra el camino de la copa. Antes del inicio, el cuadro puede estar abierto y todavía sin enfrentamientos.')

process('08 · COMPETICIONES', 'Gestionar solicitudes de equipos',
        'Una competición abierta permite recibir pedidos de participación. El organizador decide qué equipos quedan admitidos dentro del cupo.',
        'Competiciones > Torneo abierto > Inscripciones', 'Para solicitar, necesitás un equipo habilitado. Para aprobar, debés organizar el torneo.',
        [
            ('Leé las condiciones', 'Antes de pedir ingreso, consultá nombre, descripción, formato y cupos. Un torneo abierto no garantiza que cualquier equipo ingrese inmediatamente.'),
            ('Enviá la solicitud del equipo', 'Usá la acción de inscripción y elegí el equipo permitido. Esperá la confirmación de envío.'),
            ('Revisá su estado', 'El resumen distingue una solicitud pendiente de una participación aprobada. Si ya no corresponde, usá Retirar solicitud cuando esté disponible.'),
            ('Administrá las respuestas', 'Como organizador, revisá los pedidos y usá los controles para aprobar o rechazar. Comprobá cupos y composición antes de iniciar el torneo.'),
            ('Verificá los participantes definitivos', 'Antes de generar fechas o sortear, revisá el listado efectivo. Una solicitud enviada no cuenta como un equipo admitido.'),
        ],
        'La lista de participantes refleja decisiones explícitas y cada solicitante puede consultar su situación.',
        'Las solicitudes de torneo, las de ingreso a partidos y las de identidad de evaluaciones son procesos distintos.',
        'cup', 'En el resumen se reúnen estado, información y participación. Leé el estado del equipo antes de dar por confirmada su inscripción.')

process('08 · COMPETICIONES', 'Editar, archivar o eliminar',
        'Conservar el historial importa cuando una competición ya tuvo actividad. Por eso eliminar un borrador y archivar un torneo cumplen funciones diferentes.',
        'Competición > Menú de acciones', 'Las acciones dependen de que seas organizador y del estado del torneo.',
        [
            ('Abrí la configuración', 'Usá Configurar torneo para revisar los campos que todavía admite la edición. No presupongas que un formato iniciado se puede rehacer como uno nuevo.'),
            ('Eliminá sólo el borrador correcto', 'Si aparece Eliminar borrador, leé la confirmación. Se elimina ese borrador y sus solicitudes; comprobá nombre y ausencia de partidos antes de aceptar.'),
            ('Archivá para conservar', 'Si ya hay actividad, usá Archivar torneo. La competición se oculta de la lista habitual y mantiene partidos, resultados y planteles.'),
            ('Encontrá las archivadas', 'Usá el acceso Archivadas de competiciones para consultar el historial que ya no aparece en la lista principal.'),
            ('Restaurá cuando corresponda', 'Abrí el torneo archivado y elegí Restaurar torneo. Después comprobá su estado antes de continuar con nuevas acciones.'),
        ],
        'Podés ordenar la lista de competiciones sin tratar la historia deportiva como un dato descartable.',
        'Archivar no borra resultados. Eliminar un borrador es una confirmación destructiva y debe usarse sobre el torneo correcto.',
        'league', 'El menú del torneo concentra configuración y archivo. El estado condiciona las acciones que se muestran.')

process('09 · EXPLORAR', 'Encontrar e invitar jugadores',
        'Explorar permite buscar personas fuera de la lista habitual. Podés buscar por zona o tomar como referencia una convocatoria propia.',
        'Barra inferior > Explorar > Jugadores', 'Para invitar, necesitás un partido futuro propio que pueda recibir jugadores.',
        [
            ('Elegí para qué buscás', 'En Buscar para, seleccioná tu partido o Mi zona · sin partido. Así queda claro el contexto de la búsqueda.'),
            ('Definí la zona', 'Usá la ubicación disponible o buscá barrio, ciudad o dirección. Comprobá que la referencia corresponda al lugar donde querés jugar.'),
            ('Ajustá los filtros', 'Aplicá radio, posición y disponibilidad según lo que necesitás. Si no aparecen personas, ampliá la zona o quitá restricciones.'),
            ('Revisá el perfil', 'Consultá nombre, posición, nivel y disponibilidad publicada antes de invitar. No asumas que aparecer en una búsqueda confirma asistencia.'),
            ('Enviá una invitación concreta', 'Elegí el encuentro propio, revisá fecha y cupos y confirmá Enviar invitación. Después comprobá la participación en el detalle.'),
        ],
        'La búsqueda puede transformarse en una invitación vinculada a una fecha real, con lugar y horario consultables.',
        'Cambiar la zona de búsqueda no publica automáticamente tu disponibilidad. La pantalla distingue ambas acciones.',
        'explore', 'Buscar para vincula la búsqueda con un encuentro o con tu zona. Esa elección orienta las invitaciones.')

process('09 · EXPLORAR', 'Publicar tu disponibilidad',
        'La disponibilidad ayuda a que otras personas te encuentren para jugar. Se configura por separado de la zona usada en una búsqueda puntual.',
        'Explorar > Disponibilidad personal', 'Revisá qué zona y horarios querés hacer visibles antes de confirmar.',
        [
            ('Abrí tu disponibilidad', 'Buscá la acción personal que invita a publicar zona y horarios. No alcanza con cambiar el radio de búsqueda.'),
            ('Indicá dónde podés jugar', 'Completá la zona solicitada. Elegí una referencia útil para encontrar encuentros cercanos sin publicar más detalle del necesario.'),
            ('Definí cuándo estás disponible', 'Usá los días y franjas que ofrece el formulario. Publicá posibilidades reales y revisalas cuando cambie tu rutina.'),
            ('Confirmá la publicación', 'Revisá la información y guardá mediante la acción disponible. Volvé a comprobar cómo queda tu estado.'),
            ('Actualizá cuando cambie', 'Si ya no buscás partido o cambian tus horarios, volvé a la disponibilidad y ajustala con los controles que ofrece la app.'),
        ],
        'Tu disponibilidad publicada aporta contexto a quienes buscan jugadores en la zona.',
        'Una disponibilidad es una señal de interés, no una inscripción automática en todos los encuentros compatibles. Confirmá cada invitación por su flujo.',
        'availability', 'La acción personal de disponibilidad es independiente de los filtros usados para ver resultados. Revisá zona, días y franjas antes de guardar.')

process('09 · EXPLORAR', 'Buscar y pedir lugar en un partido',
        'La pestaña Partidos reúne convocatorias públicas. Podés revisar su contexto antes de pedir un lugar.',
        'Explorar > Partidos', 'Buscá una fecha que puedas jugar y revisá su modalidad y forma de ingreso.',
        [
            ('Ajustá la búsqueda', 'Elegí zona y filtros de fecha o ingreso disponibles. Si no encontrás resultados, probá ampliar el área o usar Ver todas las zonas y fechas.'),
            ('Compará las convocatorias', 'Leé modalidad, ubicación, día, hora y cupos. No elijas solamente por el nombre o la imagen de la tarjeta.'),
            ('Abrí Detalle', 'Consultá el encuentro completo, sus participantes y su estado. Comprobá si hay información todavía por confirmar.'),
            ('Solicitá participar', 'Usá la acción de ingreso disponible. Esperá la confirmación y distinguí si quedaste anotado o si enviaste un pedido al organizador.'),
            ('Revisá antes de presentarte', 'Pedido enviado significa que hay una gestión pendiente. Ya participás indica otro estado. Confirmá también el lugar y horario definitivo.'),
        ],
        'Podés encontrar una convocatoria adecuada y seguir su proceso de participación con información suficiente.',
        'Si no hay partidos cercanos, no significa que la búsqueda esté rota. Puede no haber convocatorias públicas que cumplan tus filtros.',
        'explore_matches', 'Los estados de la tarjeta ayudan a distinguir cupos, solicitudes y participación. Detalle permite revisar antes de pedir ingreso.')

process('10 · SEGUIR MEJORANDO', 'Consultar el ranking del plantel',
        'El ranking ordena información deportiva del grupo. Sirve para comparar recorridos dentro de ese contexto y volver a las fichas de cada jugador.',
        'Menú del usuario > Ranking del plantel', 'Seleccioná el grupo que querés consultar y esperá a que carguen sus datos.',
        [
            ('Comprobá el contexto', 'Revisá el grupo activo. Un ranking de otro plantel reúne personas y resultados diferentes.'),
            ('Leé el criterio de la vista', 'Consultá el indicador por el que se presenta la clasificación y sus valores. No confundas una posición de tabla con la posición futbolística.'),
            ('Reconocé los empates', 'Dos jugadores pueden compartir valores. Compará lo que la vista informa antes de atribuir una diferencia a un error.'),
            ('Entrá en la ficha', 'Cuando quieras entender un recorrido, consultá el perfil y su historial. La tabla es una entrada al contexto, no una explicación completa de cada rendimiento.'),
            ('Usalo con sentido deportivo', 'Tomá la clasificación como referencia para conversar o seguir objetivos. Las evaluaciones deben seguir describiendo cada fecha, no una rivalidad por el ranking.'),
        ],
        'Podés reconocer posiciones relativas del plantel y profundizar en los registros de las personas.',
        'No es una clasificación universal de todos los futbolistas ni una garantía para armar equipos. Su alcance es el conjunto de datos del grupo.',
        'ranking', 'La tabla del plantel debe leerse con sus valores y contexto. La identidad visual no cambia el criterio deportivo.')

process('10 · SEGUIR MEJORANDO', 'Usar Mi entrenamiento',
        'La sección ofrece orientación de práctica basada en los atributos guardados del jugador. Ayuda a convertir el perfil en un punto de partida.',
        'Menú del usuario > Mi entrenamiento', 'Necesitás un perfil con sus atributos disponibles.',
        [
            ('Revisá tu ficha de referencia', 'Comprobá que la pantalla muestre a tu jugador. Las sugerencias se apoyan en los datos que la app tiene guardados.'),
            ('Identificá las prioridades', 'Leé el enfoque y los atributos destacados. Diferenciá lo que ya hacés bien de lo que convendría practicar.'),
            ('Consultá los ejercicios', 'Revisá las propuestas y su explicación. Elegí una práctica que puedas realizar con espacio y condiciones adecuadas.'),
            ('Relacioná práctica y juego', 'Usá el historial para observar el recorrido con el tiempo. Hacer un ejercicio no actualiza por sí mismo tus atributos en la app.'),
            ('Revisá más adelante', 'Cuando exista nueva información deportiva, volvé a consultar las sugerencias y compará el foco propuesto.'),
        ],
        'Tenés una orientación inicial de práctica conectada con el perfil deportivo.',
        'La función actual utiliza sugerencias locales por atributos. No es un chat con un entrenador, un seguimiento automático de actividad ni una evaluación médica.',
        'coach', 'Las recomendaciones parten de los atributos guardados. No hace falta una conversación de IA para consultar esta sección.')

process('10 · SEGUIR MEJORANDO', 'Consultar actividad de comunidad',
        'La comunidad presenta actividad disponible en formato de lectura. Permite recuperar el contexto de lo que ocurre alrededor del juego.',
        'Panel > El grupo / Vista Comunidad cuando esté accesible', 'La barra principal de esta edición no incluye un acceso directo a Comunidad.',
        [
            ('Ubicá la actividad accesible', 'Empezá por Panel y la pestaña El grupo. La vista Comunidad está integrada como pantalla de lectura, pero esta edición no ofrece una entrada directa desde la barra principal.'),
            ('Leé las tarjetas', 'Revisá el tipo de actividad y su fecha. Una tarjeta puede resumir un evento sin mostrar toda la información asociada.'),
            ('Consultá el contenido relacionado', 'Cuando la tarjeta ofrezca un acceso, abrilo para conocer el partido o perfil correspondiente.'),
            ('Interpretá los estados vacíos', 'Si todavía no hay actividad, puede faltar contenido para mostrar. Volvé después de jugar o de registrar nuevas acciones.'),
            ('Usá el canal correcto para conversar', 'Para coordinar una fecha, utilizá el chat de ese partido. Esta sección de lectura no reemplaza una conversación del encuentro.'),
        ],
        'Podés consultar actividad y encontrar contexto sin depender de mensajes dispersos.',
        'La versión móvil revisada no incluye aquí un flujo completo de publicaciones propias, reacciones o seguidores. Esas acciones no forman parte de esta guía.',
        'community', 'Referencia de la vista de lectura integrada. Para la actividad accesible desde la navegación habitual, usá Panel > El grupo.')

process('11 · AJUSTES Y AYUDA', 'Notificaciones y modo visual',
        'El menú personal permite ajustar cómo volvés a la app y cómo la ves. Los permisos del teléfono y la configuración de la app se complementan.',
        'Menú del usuario > Notificaciones / Tema', 'Para avisos, necesitás permitir notificaciones en el sistema operativo.',
        [
            ('Abrí el menú del usuario', 'Tocá tu identidad en el encabezado. Comprobá que sea la cuenta a la que querés asociar los avisos.'),
            ('Activá las notificaciones', 'Usá Activar Notificaciones y respondé al permiso del sistema. Si fue rechazado antes, puede ser necesario cambiarlo en los ajustes del dispositivo.'),
            ('Usá el aviso como acceso', 'Al recibir una notificación, abrila y verificá el contenido de la app. El aviso no sustituye el estado actual de un partido o de una evaluación.'),
            ('Elegí el tema', 'Usá el selector del menú para alternar la experiencia oscura Game o Cancha y la opción Claro según las etiquetas visibles.'),
            ('Comprobá la lectura', 'El tema modifica la presentación, no tus datos, permisos o participaciones. Podés elegir el que resulte más cómodo en el entorno donde estás.'),
        ],
        'Podés recibir avisos cuando el dispositivo los permite y elegir una presentación visual más cómoda.',
        'Si no llega una notificación, entrá igualmente a la sección correspondiente. Una tarea pendiente no debe depender de que hayas visto el aviso.',
        'user_menu', 'El menú superior reúne preferencias personales. Las capturas de la guía usan el modo Game para mantener una referencia visual consistente.')
