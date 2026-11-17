"""A4 portrait process guide, using current Flutter UI and Game identity."""
from pathlib import Path
from xml.sax.saxutils import escape
import json
import re
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from guide_content import PAGES

ROOT = Path(__file__).resolve().parents[1]
TMP = ROOT / 'tmp/pdfs'
ASSETS = TMP / 'assets'
OUT = ROOT / 'output/pdf/Patea_Guia_de_Uso_Game_A4.pdf'
W, H = A4
M = 40
BG, CARD, VOLT, CYAN = '#0B0E13', '#181D25', '#CCFF33', '#00E6D2'
WHITE, MUTED, BORDER = '#F8FAFC', '#B3BDCC', '#47536B'
AUDIT = []
for face, filename in [
    ('Space', 'SpaceGrotesk-Regular.ttf'), ('SpaceB', 'SpaceGrotesk-Bold.ttf'),
    ('Body', 'Outfit-Regular.ttf'), ('BodyB', 'Outfit-SemiBold.ttf'),
    ('Anton', 'Anton-Regular.ttf'), ('Code', 'SourceCodePro-Regular.ttf')
]:
    pdfmetrics.registerFont(TTFont(face, str(ROOT/'patea_mobile/google_fonts'/filename)))
pdfmetrics.registerFontFamily('Body', normal='Body', bold='BodyB', italic='Body', boldItalic='BodyB')

c = canvas.Canvas(str(OUT), pagesize=A4, pageCompression=1)
c.setTitle('Pateá - Guía de uso: de la cuenta a la próxima fecha')
c.setAuthor('Pateá')
c.setSubject('Procesos y orientación de las funciones actuales. A4 vertical, modo Game.')
PAGE = 0
TOTAL = len(PAGES) + 11


def rect(x, y, w, h, color=CARD, radius=9):
    c.setFillColor(HexColor(color))
    c.roundRect(x, H-y-h, w, h, radius, fill=1, stroke=0)


def line(x, y, x2, y2, color=BORDER):
    c.setStrokeColor(HexColor(color))
    c.setLineWidth(.45)
    c.line(x, H-y, x2, H-y2)


def label(x, y, text, size=9, color=MUTED, font='Body'):
    c.setFillColor(HexColor(color)); c.setFont(font, size)
    width = pdfmetrics.stringWidth(text, font, size)
    if x+width > W-20:
        raise ValueError(f'Label overflow p{PAGE}: {text}')
    c.drawString(x, H-y-size*.85, text)


def paragraph(x, y, width, text, size=11, color=WHITE, font='Body', leading=None):
    text = escape(text).replace('\n', '<br/>')
    text = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', text)
    style = ParagraphStyle('guide', fontName=font, fontSize=size,
                           leading=leading or size*1.38, textColor=HexColor(color))
    p = Paragraph(text, style)
    _, height = p.wrap(width, H)
    if y+height > H-49:
        raise ValueError(f'Paragraph overflow p{PAGE}: {y+height:.1f} {text[:85]}')
    AUDIT.append(dict(page=PAGE, x=x, y=y, w=width, h=height, text=text))
    p.drawOn(c, x, H-y-height)
    return y+height


def mark(x=M, y=25, size=22):
    c.drawImage(str(TMP/'patea-mark.png'), x, H-y-size, width=size, height=size, mask='auto')
    label(x+size+7, y+1, 'Pateá', 21, WHITE, 'SpaceB')


def start(title, section, intro=None):
    global PAGE
    PAGE += 1
    c.setFillColor(HexColor(BG)); c.rect(0, 0, W, H, fill=1, stroke=0)
    mark()
    label(W-182, 34, 'GUÍA DE USO · GAME', 8, MUTED, 'Code')
    label(M, 79, section, 9, VOLT, 'Code')
    y = paragraph(M, 102, W-2*M, title, 25, WHITE, 'SpaceB', 29)
    if intro:
        y = paragraph(M, y+14, W-2*M, intro, 11.6, MUTED)
    c.bookmarkPage(f'page-{PAGE}')
    c.addOutlineEntry(title, f'page-{PAGE}', level=0, closed=False)
    return y+18


def finish():
    line(M, H-40, W-M, H-40, '#29303D')
    label(M, H-27, 'PATEÁ / GUÍA PRÁCTICA / NOVIEMBRE 2026', 7.2, MUTED, 'Code')
    label(W-85, H-27, f'{PAGE:02} / {TOTAL:02}', 7.2, MUTED, 'Code')
    c.showPage()


def info_block(x, y, width, title, body, accent=CYAN, size=10.4):
    style = ParagraphStyle('measure', fontName='Body', fontSize=size, leading=size*1.38)
    p = Paragraph(escape(body), style); _, height = p.wrap(width-24, H)
    if y+height+43 > H-49:
        raise ValueError(f'Information block overflow p{PAGE}: y={y:.1f} h={height:.1f}')
    rect(x, y, width, height+43)
    label(x+12, y+11, title, 8, accent, 'Code')
    paragraph(x+12, y+28, width-24, body, size, MUTED)
    return y+height+43


def shot(name, x, y, width=167):
    if name in ('user_menu', 'clip_upload'):
        name += '_detail'
    source = ASSETS/(name+'.jpg')
    with Image.open(source) as image:
        height = width*image.height/image.width
    rect(x-4, y-4, width+8, height+8, '#29303D', 11)
    c.drawImage(str(source), x, H-y-height, width=width, height=height)
    return y+height


def full_entries(y, entries, size=11.2, gap=18):
    for title, body in entries:
        y = paragraph(M, y, W-2*M, title, 13, WHITE, 'BodyB')
        y = paragraph(M, y+6, W-2*M, body, size, MUTED)
        y += gap
    return y


# 01 Cover
PAGE += 1
c.setFillColor(HexColor(BG)); c.rect(0, 0, W, H, fill=1, stroke=0)
c.drawImage(str(ASSETS/'patea_matchday.jpg'), 0, H-405, width=W, height=405,
            preserveAspectRatio=True, anchor='c', anchorAtXY=False)
c.setFillColor(HexColor(BG)); c.rect(0, 0, W, H-365, fill=1, stroke=0)
rect(32, 24, 162, 43, BG)
mark(43, 34, 23)
label(M, 402, 'DE LA CUENTA A LA PRÓXIMA FECHA', 9.6, VOLT, 'Code')
paragraph(M, 436, W-2*M, 'TU FÚTBOL,\nPASO A PASO.', 47, WHITE, 'Anton', 56)
paragraph(M, 580, W-2*M,
          'Una guía para jugar, organizar y seguir el recorrido del grupo con Pateá.',
          18, WHITE, 'SpaceB', 24)
paragraph(M, 665, W-2*M,
          'Qué podés hacer hoy, cómo hacerlo y qué ocurre después. Con procesos explicados, pantallas de referencia y respuestas a dudas habituales.',
          12, MUTED)
label(M, 751, 'A4 VERTICAL · MODO GAME · EDICIÓN NOVIEMBRE 2026', 8.2, VOLT, 'Code')
c.bookmarkPage('page-1'); c.addOutlineEntry('Portada', 'page-1')
finish()

# 02 How to read
y = start('Cómo usar esta guía', 'ANTES DE EMPEZAR',
          'No hace falta leerla de corrido. Buscá la tarea que querés resolver y seguí su proceso completo.')
y = full_entries(y, [
    ('Una tarea por proceso', 'Cada proceso explica para qué sirve, dónde encontrarlo, qué necesitás y los pasos para completarlo. Al final vas a ver el resultado esperado y una aclaración útil.'),
    ('Leé la ruta y los requisitos', 'La ruta indica por dónde entrar. Los nombres citados corresponden a los controles revisados. Algunas acciones aparecen sólo cuando el estado del partido o tus permisos lo permiten.'),
    ('Seguí los pasos en orden', 'Las acciones de confirmar, guardar, enviar o finalizar tienen efectos diferentes. Antes de repetir una acción por una demora, comprobá si el cambio ya quedó registrado.'),
    ('Usá las imágenes como orientación', 'Las capturas provienen de pantallas actuales con datos de demostración. Los nombres, fechas, resultados y cifras que muestran no son instrucciones ni datos de tu cuenta.'),
    ('Dos presentaciones, el mismo recorrido', 'La guía usa Game. Si elegís Claro, cambian colores y fondos; los procesos y permisos siguen dependiendo de tu cuenta, del grupo y de cada actividad.'),
    ('Qué cubre esta edición', 'Funciones integradas de la app móvil 1.0.33+34, revisadas el 17 de noviembre de 2026. No incluye propuestas comerciales ni funciones futuras. Un servicio conectado puede necesitar conexión o disponibilidad para completar una tarea.'),
], gap=20)
finish()

# 03-04 Detailed contents
for offset in (0, 20):
    y = start('Encontrá lo que querés hacer', 'ÍNDICE · '+('1 DE 2' if offset == 0 else '2 DE 2'),
              'Los títulos y números llevan a cada proceso. También podés usar los marcadores del PDF.')
    current = None
    for i in range(offset, min(offset+20, len(PAGES))):
        p = PAGES[i]
        if p['section'] != current:
            if current is not None: y += 4
            current = p['section']
            label(M, y, current, 8.8, VOLT, 'Code'); y += 19
        end = paragraph(M+1, y, W-2*M-46, p['title'], 10.3, WHITE)
        label(W-M-22, y+1, str(i+7), 10, VOLT, 'Code')
        c.linkRect('', f'page-{i+7}', (M, H-end-5, W-M, H-y+3), relative=0, thickness=0)
        y = end+5
    if offset:
        y += 10
        for title, number in [('Glosario para leer las fichas',46),
                              ('Una fecha completa, de principio a fin',47),
                              ('Cuando algo no aparece',48),
                              ('Cuando una acción no se completa',49),
                              ('Lista de comprobación y alcance',50)]:
            label(M, y, title, 10.8, WHITE)
            label(W-M-22, y+1, str(number), 10, VOLT, 'Code')
            c.linkRect('', f'page-{number}', (M,H-y-17,W-M,H-y+3), relative=0, thickness=0)
            y += 20
    finish()

# 05 Roles
y = start('Quién puede hacer cada cosa', 'CUENTAS, GRUPOS Y PERMISOS',
          'La misma pantalla puede mostrar acciones distintas a dos personas. El rol y el estado explican la mayoría de esas diferencias.')
y = full_entries(y, [
    ('Jugador con cuenta', 'Ingresa con su identidad, edita su perfil, consulta la actividad habilitada, busca encuentros y completa las evaluaciones que tiene asignadas. Ser miembro de un grupo no lo convierte en organizador de todas las fechas.'),
    ('Organizador de un partido', 'Es la cuenta responsable de ese encuentro. Dispone de los controles de planificación y dirección habilitados: confirmar opciones, iniciar, pausar, registrar eventos y finalizar. Es un permiso de ese partido, no de toda la app.'),
    ('Responsable del grupo o de un equipo', 'Las acciones de crear, editar o eliminar equipos dependen del creador y de los permisos del grupo. Si falta un control, revisá el rol antes de intentar repetir la tarea desde otra sección.'),
    ('Organizador de una competición', 'Configura el torneo, gestiona participantes y utiliza sus acciones de inicio, cierre y archivo. Participar con un equipo no otorga los controles de organización del torneo.'),
    ('Participante y persona que consulta', 'Consultar una fecha, seguir el marcador o leer un perfil son acciones distintas de dirigir o modificar. Para subir clips y evaluar también importa la relación con el partido.'),
    ('Ficha manual', 'Permite representar a una persona en el plantel cuando el flujo lo admite. No debe confundirse con una cuenta que pueda iniciar sesión, recibir tareas y actuar con esa identidad.'),
], gap=19)
finish()

# 06 States
y = start('Reconocer el momento del proceso', 'ESTADOS QUE CAMBIAN LAS ACCIONES',
          'Antes de buscar un botón, mirá en qué etapa está la actividad y qué relación tenés con ella.')
y = full_entries(y, [
    ('Partido en planificación', 'Se está resolviendo cuándo o dónde jugar, o sigue abierta la votación. Una propuesta y un voto todavía no son un dato definitivo. El organizador confirma la decisión.'),
    ('Partido próximo', 'La convocatoria está preparada para una fecha futura. Revisá cupos y participación. El organizador puede avanzar al inicio cuando corresponde.'),
    ('Partido en curso', 'El estado del juego incluye período, reloj y marcador. Pausa y descanso detienen el avance con propósitos distintos. Seguir el vivo no equivale a dirigirlo.'),
    ('Partido finalizado y evaluación', 'El resultado ya se cerró. Las tareas asignadas permiten completar devoluciones; el historial y el contenido posterior se nutren de los datos disponibles.'),
    ('Pedido enviado y participación confirmada', 'Un pedido necesita resolución cuando el flujo exige aprobación. Hasta entonces, no lo interpretes como asistencia confirmada. Esto aplica por separado a partidos y torneos.'),
    ('Torneo en preparación, iniciado o archivado', 'Un borrador permite preparar la competición. Iniciarla genera su recorrido deportivo. Archivar conserva la historia y la aparta de la lista habitual; no equivale a eliminar.'),
], gap=20)
finish()

# 07-45 Processes. Text is measured; the builder fails instead of clipping it.
for index, p in enumerate(PAGES, 1):
    y = start(p['title'], p['section'], p['intro'])
    y = paragraph(M, y, W-2*M, 'DÓNDE · '+p['route'], 9.6, CYAN, 'BodyB')
    y = paragraph(M, y+10, W-2*M, 'Antes de empezar: '+p['before'], 10.4, MUTED)
    y += 16
    body_top = y
    left_w = 316
    right_x = 385
    right_w = W-M-right_x
    for n, (title, body) in enumerate(p['steps'], 1):
        label(M, y+1, f'{n:02}', 10.2, VOLT, 'Code')
        y = paragraph(M+27, y, left_w-27, title, 11.4, WHITE, 'BodyB')
        y = paragraph(M+27, y+5, left_w-27, body, 10.7, MUTED, leading=14.2)
        y += 12
    y = paragraph(M, y+1, left_w, 'Qué ocurre después', 11, CYAN, 'BodyB')
    y = paragraph(M, y+6, left_w, p['result'], 10.6, MUTED, leading=14.2)
    screen_width = right_w - 30
    right_bottom = shot(p['screen'], right_x+(right_w-screen_width)/2, body_top, screen_width)
    right_bottom = paragraph(right_x, right_bottom+13, right_w,
                             'PANTALLA DE REFERENCIA\nDatos de demostración', 8.2, MUTED, leading=11.2)
    right_bottom = paragraph(right_x, right_bottom+17, right_w,
                             'Qué mirar', 10.7, WHITE, 'BodyB')
    right_bottom = paragraph(right_x, right_bottom+6, right_w,
                             p['look'], 9.6, MUTED, leading=13.2)
    note_y = max(y+12, right_bottom+12)
    info_block(M, note_y, W-2*M, 'TENÉ EN CUENTA', p['note'], size=10.1)
    finish()

# 46 Glossary
y = start('Glosario para leer las fichas', 'REFERENCIA RÁPIDA',
          'Los términos deportivos y de organización aparecen en varias pantallas. Esta referencia ayuda a distinguirlos.')
y = full_entries(y, [
    ('Grupo / Equipo / Plantel / Convocatoria', 'Grupo: comunidad de personas. Equipo: conjunto identificado con nombre y camiseta. Plantel: integrantes disponibles dentro de un contexto. Convocatoria: quienes participan en una fecha concreta.'),
    ('DEL / MED / DEF / POR', 'Delantero, mediocampista o volante, defensor y arquero. Son posiciones de juego. No deben confundirse con roles de administración ni con puestos de una clasificación.'),
    ('OVR', 'Valor global que resume el perfil deportivo. Para entenderlo, consultá atributos e historial. No equivale a una nota de un solo encuentro.'),
    ('RIT / TIR / PAS / REG / DEF / FIS', 'Ritmo, tiro, pase, regate, defensa y físico. DEF puede nombrar una posición o un atributo: el contexto de la ficha permite distinguirlos.'),
    ('Rating y cambios por atributo', 'El rating expresa una valoración de un partido. Los indicadores como PAS +4 o DEF -4 representan variaciones asociadas al atributo indicado; no son goles ni puntos de una liga.'),
    ('Figura / Dorsal / Titular / Suplente', 'Figura: reconocimiento destacado de la fecha. Dorsal: número de camiseta. Titular y suplente: condición del integrante en el equipo; no confirma por sí sola la asistencia a todas las fechas.'),
    ('Tabla / Cruce / Ronda / Desempate', 'Tabla: clasificación de una liga. Cruce: enfrentamiento entre dos equipos. Ronda: etapa de la copa. Desempate: resolución necesaria cuando los criterios o el marcador no definen un ganador.'),
], size=10.8, gap=16)
finish()

# 47 end to end
y = start('Una fecha completa, de principio a fin', 'EJEMPLO DE RECORRIDO',
          'Un ejemplo para conectar las herramientas. No es un partido real ni una secuencia obligatoria para todas las modalidades.')
y = full_entries(y, [
    ('1. El grupo prepara la convocatoria', 'El organizador comprueba el grupo activo y crea un partido. Si el horario no está resuelto, elige Consultar al grupo; si está acordado, carga fecha, hora y cancha.'),
    ('2. Cada persona confirma su situación', 'Los compañeros consultan el detalle, votan disponibilidad si corresponde y usan la inscripción o invitación prevista. El organizador comprueba cupos y equipos antes de jugar.'),
    ('3. El encuentro se coordina', 'El chat sirve para avisar llegada y aclarar acuerdos. El dato formal de hora, lugar y participantes se comprueba en el detalle. Los mensajes no modifican esos campos por sí solos.'),
    ('4. Se juega y se registran acciones', 'El organizador entra a Dirigir, inicia el juego y registra goles u otros eventos. Administra pausa, descanso y segundo tiempo, y revisa el marcador antes de finalizar.'),
    ('5. Cada participante deja su devolución', 'Quien tiene asignaciones entra a Evaluaciones, completa Tu partido y valora a sus compañeros. Revisa el resumen y confirma el envío.'),
    ('6. La fecha queda en la historia', 'El grupo consulta resultado, evolución, crónica y clips disponibles. Si el encuentro pertenece a una competición, se revisa también su tabla o avance de ronda.'),
], gap=20)
finish()

# 48 troubleshooting states
y = start('Cuando algo no aparece', 'DUDAS HABITUALES · 1 DE 2',
          'Empezá por comprobar contexto y estado. Un listado vacío y un error de carga no significan lo mismo.')
y = full_entries(y, [
    ('“No veo jugadores o equipos que antes estaban”', 'Comprobá el grupo activo y la cuenta del menú. Si estás en otro grupo, cambió el contexto de la lista. Volvé al correcto antes de crear fichas que ya existen.'),
    ('“Me avisaron de una evaluación, pero no la encuentro”', 'En Evaluaciones revisá Pendientes e Historial, actualizá y comprobá la cuenta participante. También revisá si el partido fue finalizado y si tenés asignaciones para él.'),
    ('“No aparece Dirigir o no puedo tocar el marcador”', 'Verificá quién es el organizador y en qué estado está el partido. Una persona puede consultar el vivo sin tener permiso para controlarlo.'),
    ('“No encuentro una copa o liga”', 'Revisá grupo, tipo de competición y la vista Archivadas. Archivar quita el torneo de la lista habitual y conserva su historia.'),
    ('“Explorar no muestra resultados”', 'Ampliá radio, zona, fechas o posición. Puede no haber jugadores disponibles o partidos públicos compatibles. Distinguí esa situación de un mensaje de error.'),
    ('“No veo una crónica, clip o progresión”', 'Revisá si hay contenido guardado y permisos para esa vista. No todos los partidos tienen videos o relato, y un perfil nuevo puede no tener suficientes registros de evolución.'),
], gap=20)
finish()

# 49 troubleshooting action
y = start('Cuando una acción no se completa', 'DUDAS HABITUALES · 2 DE 2',
          'Leé el mensaje y verificá qué quedó guardado antes de repetir. Así evitás duplicar mensajes, eventos o convocatorias.')
y = full_entries(y, [
    ('“Guardar tarda o no confirma”', 'Comprobá la conexión y esperá a que termine el estado de carga. Revisá el perfil o la lista correspondiente antes de repetir. Si aparece Reintentar, usalo después de leer el error.'),
    ('“No puedo usar cámara, galería o notificaciones”', 'La app necesita permisos del sistema. Si los rechazaste, revisá los ajustes del dispositivo. Habilitarlos no borra ni modifica tu grupo o tus resultados.'),
    ('“La evaluación no deja enviar”', 'Completá los mínimos del modo elegido: al menos tres etiquetas o una reseña de diez caracteres. Revisá todas las fichas asignadas y el resumen final. Si ya enviaste, consultá Historial.'),
    ('“La copa no permite iniciar”', 'Revisá organizador, estado y participantes. El sorteo requiere 2, 4, 8, 16 o 32 equipos; capacidad configurada y solicitudes pendientes no equivalen a participantes admitidos.'),
    ('“No puedo cerrar una liga o avanzar un cruce”', 'Comprobá que los partidos estén resueltos y sus resultados guardados. Un empate que requiere ganador necesita el desempate previsto; no cambies el marcador al azar.'),
    ('“Sigue fallando y necesito ayuda”', 'Anotá cuenta utilizada, grupo, nombre del partido o torneo, acción, mensaje de error y hora aproximada. Compartí una captura sin contraseña ni datos privados innecesarios. Esos datos permiten revisar el caso correcto.'),
], gap=20)
finish()

# 50 checklist + scope
y = start('Antes de dar la tarea por terminada', 'COMPROBACIÓN Y ALCANCE',
          'Una revisión final evita la mayoría de las confusiones entre lo que viste, lo que pediste y lo que quedó confirmado.')
y = full_entries(y, [
    ('Identidad y contexto', 'Estoy en la cuenta correcta y en el grupo correspondiente. Si modifico un equipo, partido o torneo, comprobé su nombre y mi permiso para administrarlo.'),
    ('Confirmaciones', 'Guardé el perfil; verifiqué el ingreso al partido; confirmé el horario cuando correspondía; revisé el envío de evaluaciones. No confundo una vista previa o un pedido con un cambio confirmado.'),
    ('Cierre deportivo', 'El resultado y los eventos están revisados. Si finalicé el encuentro, comprobé los accesos posteriores. En una competición, revisé también la tabla o el cuadro.'),
    ('Qué se mantiene fuera de esta guía', 'No se describen cobros, reservas de canchas, anuncios, transmisiones en video directo ni publicaciones sociales propias como funciones actuales. Tampoco se promete asistencia automática a un encuentro.'),
    ('Sobre las imágenes', 'Capturas de componentes de la app móvil con datos ficticios. Las fotografías de marca son ilustrativas. Las imágenes orientan: los nombres, números y estados de tu cuenta pueden ser diferentes.'),
    ('Edición y referencia', 'Guía preparada sobre la app móvil 1.0.33+34, revisión del 17 de noviembre de 2026. Un cambio posterior de versión puede modificar etiquetas o recorridos. La disponibilidad de servicios conectados y permisos también condiciona algunas acciones.'),
], gap=19)
finish()
assert PAGE == TOTAL, (PAGE, TOTAL)
c.save()
(TMP/'guide-layout-audit.json').write_text(json.dumps(AUDIT, ensure_ascii=False, indent=2), encoding='utf8')
print(f'Built {PAGE} A4 portrait pages: {OUT}')
