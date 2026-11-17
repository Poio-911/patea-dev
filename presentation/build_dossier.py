"""Build the Patea Game dossier from current Flutter demonstration captures."""
from pathlib import Path
from xml.sax.saxutils import escape
import json
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor, Color
from reportlab.lib.utils import ImageReader
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/pdf/Patea_Game_Producto_y_Oportunidades.pdf'
TMP=ROOT/'tmp/pdfs'; AS=TMP/'assets'; FONTS=ROOT/'patea_mobile/google_fonts'
W,H=841.89,595.28
BG='#0B0E13'; CARD='#181D25'; VOLT='#CCFF33'; WHITE='#F8FAFC'; MUTED='#B3BDCC'; LINE='#47536B'; CYAN='#00E6D2'
for face,file in [('Space','SpaceGrotesk-Regular.ttf'),('SpaceB','SpaceGrotesk-Bold.ttf'),('Body','Outfit-Regular.ttf'),('BodyB','Outfit-SemiBold.ttf'),('Anton','Anton-Regular.ttf'),('Condensed','BarlowCondensed-SemiBold.ttf'),('Code','SourceCodePro-Regular.ttf'),('Lora','Lora-Regular.ttf')]:
    pdfmetrics.registerFont(TTFont(face,str(FONTS/file)))
PAGES=[]; AUDIT=[]
class DossierCanvas(canvas.Canvas):
    def __init__(self,*a,**kw):
        super().__init__(*a,**kw); self.saved=[]
    def showPage(self):
        self.saved.append(dict(self.__dict__)); self._startPage()
    def save(self):
        count=len(self.saved)
        for state in self.saved:
            self.__dict__.update(state)
            self.setStrokeColor(HexColor('#26303D')); self.setLineWidth(.4); self.line(42,34,W-42,34)
            self.setFillColor(HexColor(MUTED)); self.setFont('Body',8)
            self.drawString(42,20,'PATEÁ  /  PRODUCTO, IDENTIDAD Y OPORTUNIDADES  /  NOVIEMBRE 2026')
            self.setFont('Code',8); self.drawRightString(W-42,20,f'{self._pageNumber:02d} / {count:02d}')
            super().showPage()
        super().save()
c=DossierCanvas(str(OUT),pagesize=(W,H),pageCompression=1)
c.setTitle('Pateá - Game: producto, identidad y oportunidades')
c.setAuthor('Pateá'); c.setSubject('Identidad Game, funcionalidades actuales, ampliaciones y oportunidades comerciales')

def box(x,y,w,h,color=CARD,r=12,stroke=None):
    c.setFillColor(HexColor(color)); c.setStrokeColor(HexColor(stroke or color)); c.roundRect(x,H-y-h,w,h,r,fill=1,stroke=bool(stroke))
def line(x,y,x2,y2,color=LINE,width=.5):
    c.setStrokeColor(HexColor(color)); c.setLineWidth(width); c.line(x,H-y,x2,H-y2)
def txt(x,y,s,size=12,color=WHITE,font='Body'):
    c.setFillColor(HexColor(color)); c.setFont(font,size); c.drawString(x,H-y-size*.82,s)
def para(x,y,w,s,size=11.5,color=WHITE,font='Body',leading=None):
    style=ParagraphStyle('p',fontName=font,fontSize=size,leading=leading or size*1.4,textColor=HexColor(color),spaceAfter=0)
    p=Paragraph(escape(s).replace('\n','<br/>'),style); _,h=p.wrap(w,1000)
    if y+h>H-42:
        raise ValueError(f'Text overflow on page {len(PAGES)}: {s[:70]} at {y+h}')
    AUDIT.append({'page':len(PAGES),'x':x,'y':y,'w':w,'h':h,'text':s})
    p.drawOn(c,x,H-y-h); return y+h
def photo(name,x,y,w,h):
    p=AS/(name+'.jpg')
    if not p.exists(): p=TMP/name
    im=Image.open(p); iw,ih=im.size; scale=max(w/iw,h/ih); dw,dh=iw*scale,ih*scale
    c.saveState(); q=c.beginPath(); q.rect(x,H-y-h,w,h); c.clipPath(q,stroke=0,fill=0)
    c.drawImage(str(p),x+(w-dw)/2,H-y-h+(h-dh)/2,width=dw,height=dh,mask='auto'); c.restoreState()
def mark(x,y,size=26):
    c.drawImage(str(TMP/'patea-mark.png'),x,H-y-size,width=size,height=size,mask='auto')
def brand(x,y,size=25):
    mark(x,y,size); txt(x+size+7,y+1,'Pateá',size*.92,WHITE,'SpaceB')
def page(title,kind='ACTUAL',subtitle=None):
    PAGES.append(title); c.setFillColor(HexColor(BG)); c.rect(0,0,W,H,stroke=0,fill=1)
    brand(42,23,24); txt(W-215,30,kind,8.5,VOLT if kind=='ACTUAL' else CYAN if 'PROPUESTA' in kind else MUTED,'Code')
    txt(42,79,title,27,WHITE,'SpaceB')
    if subtitle: para(42,117,W-84,subtitle,11,MUTED)
    c.saveState(); c.setStrokeColor(HexColor('#141A22')); c.setLineWidth(.65)
    c.rect(W-210,48,170,126,stroke=1,fill=0); c.line(W-125,48,W-125,174); c.circle(W-125,111,19,stroke=1,fill=0); c.restoreState()
def end(): c.showPage()
def phone(name,x,y=169,h=365):
    w=h*.45; box(x-4,y-4,w+8,h+8,'#2A3341',15)
    c.saveState(); q=c.beginPath(); q.roundRect(x,H-y-h,w,h,11); c.clipPath(q,stroke=0,fill=0)
    c.drawImage(str(AS/(name+'.jpg')),x,H-y-h,width=w,height=h,mask='auto'); c.restoreState(); return w
def bullet(x,y,w,title,body):
    line(x,y+6,x+9,y+6,VOLT,2)
    y=para(x+17,y-3,w-17,title,12.5,WHITE,'BodyB'); y=para(x+17,y+5,w-17,body,11,MUTED)
    return y+19
def feature(title,sub,shots,items,note='Interfaz actual · datos de demostración'):
    page(title,'ACTUAL',sub); y=169
    for head,body in items: y=bullet(42,y,331,head,body)
    if len(shots)==2:
        phone(shots[0],422); phone(shots[1],615)
    else: phone(shots[0],525,h=368)
    txt(422,544,note,8,MUTED); end()
def tiles(items,y=166,columns=3,h=155):
    gap=15; w=(W-84-gap*(columns-1))/columns
    for i,(label,title,body) in enumerate(items):
        x=42+(i%columns)*(w+gap); top=y+(i//columns)*(h+16)
        box(x,top,w,h); txt(x+17,top+17,label,9,VOLT,'Code')
        bottom=para(x+17,top+40,w-34,title,17,WHITE,'SpaceB')
        text_bottom=para(x+17,max(top+82,bottom+13),w-34,body,11,MUTED)
        if text_bottom>top+h-9:
            raise ValueError(f'Tile overflow on page {len(PAGES)}: {title}')
def table(headers,rows,widths,y=167,rowh=47,size=10):
    x=42
    for header,w in zip(headers,widths):
        txt(x+10,y+10,header,9,VOLT,'BodyB'); x+=w
    line(42,y+32,W-42,y+32,LINE); top=y+40
    for row in rows:
        x=42
        for v,w in zip(row,widths):
            para(x+10,top,w-20,v,size,MUTED if x>42 else WHITE,'Body' if x>42 else 'BodyB'); x+=w
        line(42,top+rowh-8,W-42,top+rowh-8,'#252D3A'); top+=rowh

# 01
PAGES.append('Pateá: producto, identidad y oportunidades')
photo('patea_matchday',0,0,W,H)
c.setFillColor(Color(.02,.04,.06,alpha=.74)); c.rect(0,0,W,H,stroke=0,fill=1)
box(0,0,410,H,BG,0); brand(42,35,45)
txt(42,151,'TU FÚTBOL.',49,WHITE,'Anton'); txt(42,210,'CON HISTORIA.',49,VOLT,'Anton')
para(44,291,320,'Organizar el partido. Vivirlo en equipo. Volver por la próxima fecha.',18,WHITE,'Space')
para(44,404,305,'Identidad Game, experiencia actual y posibilidades de crecimiento.',13,MUTED)
txt(44,491,'DOSSIER DE PRODUCTO Y OPORTUNIDADES',9,VOLT,'Code')
txt(44,514,'Referencia móvil 1.0.33+34 · Noviembre de 2026',10,MUTED)
phone('profile',485,127,372); phone('live',650,177,335); end()

# 02
page('Un lugar para todo lo que pasa alrededor del partido','VISIÓN','Una experiencia continua para jugadores, capitanes, grupos y organizadores.')
photo('patea_groups',42,171,327,280)
para(398,174,360,'Del mensaje disperso a una experiencia que queda.',24,WHITE,'SpaceB')
y=264
for a,b in [('Antes','Coordinar la convocatoria, completar el plantel y armar los equipos.'),('Durante','Seguir el marcador, registrar las jugadas y conversar dentro del partido.'),('Después','Evaluar, recordar la fecha y ver cómo evoluciona cada jugador.')]:
    y=bullet(398,y,355,a,b)
para(42,480,740,'La propuesta combina utilidad organizativa con identidad deportiva: una razón para usarla y otra para querer volver.',17,WHITE,'Space'); end()

# 03
page('Game: una identidad que se reconoce','REFERENCIA VISUAL','Carbón, acento volt, información clara y fotografía de fútbol amateur.')
colors=[('Volt','#CCFF33','Acciones y selección'),('Carbón','#0B0E13','Fondo principal'),('Tarjeta','#181D25','Superficies'),('Superficie','#29303D','Controles y capas'),('Texto','#F8FAFC','Lectura principal'),('Secundario','#B3BDCC','Contexto y apoyo')]
for i,(n,col,role) in enumerate(colors):
    x=42+i*126; box(x,171,112,79,col,10,LINE if col==BG else None)
    txt(x,266,n,12,WHITE,'BodyB'); txt(x,287,col,9.5,MUTED,'Code'); para(x,309,112,role,10,MUTED)
box(42,378,356,122); brand(61,400,40)
para(61,459,310,'Marca oficial: símbolo en movimiento y nombre siempre legible.',11,MUTED)
para(432,385,355,'Cada color tiene una función.',18,WHITE,'SpaceB')
para(432,425,355,'El ámbar destaca el OVR y el mejor atributo. Rojo, violeta, azul y naranja distinguen delantero, volante, defensor y arquero. Los estados se acompañan de texto.',11.5,MUTED)
for i,col in enumerate(['#F47171','#B87BF4','#7BB8F4','#F7B26E']): box(432+i*53,492,38,8,col,3)
end()

# 04
page('Tipografía e iconos con función','REFERENCIA VISUAL','La personalidad deportiva se concentra en titulares, cifras y camisetas; los controles conservan legibilidad.')
fonts=[('Space Grotesk','SpaceB','Tu próxima fecha','Títulos, acciones y números.'),('Outfit','Body','Que se entienda de un vistazo.','Texto de interfaz y lectura cotidiana.'),('Anton','Anton','4 - 2','Marcadores y piezas deportivas grandes.'),('Barlow Condensed','Condensed','LOS QUE SALEN A LA CANCHA','Nombres y espacio acotado.'),('Source Code Pro','Code','DEL   OVR 82   21:00','Siglas y datos breves alineados.'),('Lora','Lora','La jugada que quedó.','Relato y lectura editorial.')]
for i,(name,font,sample,role) in enumerate(fonts):
    x=42+(i%3)*257; top=166+(i//3)*126; txt(x,top,name,11,VOLT,'BodyB')
    txt(x,top+27,sample,15 if i!=2 else 25,WHITE,font); para(x,top+60,235,role,10.5,MUTED)
line(42,432,W-42,432)
for i,(name,label) in enumerate(zip(['soccer-field','shirt-sport','ball-football','map-search','clipboard-check'],['Panel','Jugadores','Partidos','Explorar','Evaluaciones'])):
    x=58+i*153; c.drawImage(str(TMP/(name+'.png')),x,H-459-30,width=30,height=30,mask='auto')
    txt(x+41,466,label,11,WHITE,'BodyB')
para(42,516,750,'SVG originales de Tabler deportivo. Mismo trazo y proporción; el color comunica la selección.',10,MUTED); end()

# 05
page('Imágenes y movimiento al servicio del fútbol','REFERENCIA VISUAL','La estética Game es editorial y cercana: personas, canchas y momentos de grupo.')
for i,(name,label) in enumerate([('patea_locker_room','El grupo'),('patea_indoor','La cancha'),('patea_league','El encuentro')]):
    x=42+i*257; photo(name,x,165,241,158); txt(x,336,label,14,WHITE,'BodyB')
for i,(title,body) in enumerate([('Fotografía contextual','Portadas y escenas de sección. Los formularios se apoyan en superficies legibles.'),('Movimiento breve','Selección, transiciones y confirmaciones; el movimiento reducido se respeta.'),('Jerarquía y contraste','Acentos contenidos, tipografía de ancho normal en acciones y fondos tonales.')]):
    x=42+i*257; para(x,390,235,title,14,WHITE,'BodyB'); para(x,422,235,body,11,MUTED)
txt(42,532,'Imágenes de marca ilustrativas; no acreditan partidos, usuarios ni acuerdos comerciales.',8.5,MUTED); end()

# 06
page('La experiencia actual, de punta a punta','ACTUAL','El núcleo móvil une identidad, organización, juego y memoria del grupo.')
tiles([('01','Identidad','Cuenta, perfil, retrato, posición, OVR, atributos e historial.'),('02','Organización','Grupos, equipos, camisetas, planteles y convocatoria.'),('03','Partido','Creación, horario definido o por consulta, equipos y estados.'),('04','En vivo','Cancha, marcador, reloj, eventos, chat y clips asociados.'),('05','Progresión','Evaluaciones, devoluciones, estadísticas, ranking y práctica.'),('06','Competencia','Ligas, copas, fechas, tabla, cruces e inscripciones.')],h=164)
end()

feature('Una identidad para entrar a la cancha','El perfil conecta la cuenta, el jugador y su grupo.',['login','edit_profile'],[
    ('Acceso y recuperación','Registro e inicio de sesión con correo o Google, con recuperación de contraseña.'),
    ('Tu ficha personal','Nombre, posición y foto editables; retrato deportivo asistido por IA mediante créditos.'),
    ('Una experiencia propia','Modo Game y Claro, introducción guiada y elección del grupo activo.'),
    ('Volver cuando importa','Notificaciones para convocatorias, actividad y evaluaciones pendientes.')])

# 07-17
feature('Panel: lo importante de tu fútbol primero','Un punto de regreso para la actividad propia y la del grupo.',['panel','panel_live'],[
    ('Mi fútbol y el grupo','Próxima convocatoria, último partido y acceso a lo que requiere atención.'),
    ('El partido activo tiene prioridad','Marcador y estado visibles, con entrada directa para seguirlo en vivo.'),
    ('Contexto del plantel','Grupo activo, jugadores, partidos y figuras a partir de los datos guardados.'),
    ('Navegación deportiva','Cancha, camiseta, pelota, mapa con lupa y evaluaciones en cinco accesos.')])
feature('Jugadores: una ficha con identidad y recorrido','El perfil convierte la participación del grupo en una historia deportiva visible.',['players','profile'],[
    ('Ficha y OVR','Retrato, posición y seis atributos; el valor máximo se destaca dentro de la ficha.'),
    ('Perfil y edición','Nombre, bio, nacionalidad, pie hábil, foto y encuadre; retrato con IA sujeto a créditos y servicio.'),
    ('Trayectoria','Partidos, goles, asistencias, valoración e historial de cambios del jugador.'),
    ('Plantel real y manual','Se distinguen los perfiles registrados y los jugadores cargados para organizar encuentros.')])
feature('Grupos y equipos: la organización del cuadro','La pertenencia tiene una estructura propia, con planteles y camisetas.',['groups','team'],[
    ('Crear y participar','Gestión de grupos, invitación por código y selección del grupo activo.'),
    ('Equipos identificables','Nombre, camiseta y diseño de colores; acceso al detalle de cada plantel.'),
    ('Convocados y dorsales','Jugadores, condición de titular o suplente y números de camiseta.'),
    ('Acciones por rol','La administración se habilita para quienes gestionan el grupo o el equipo.')])
feature('Armar un partido sin rehacer todo cada vez','Tres caminos: plantel elegido, inscripción colaborativa o equipos ya formados.',['create_match','matches'],[
    ('Formatos de juego','Selección de fútbol 5, 7 u 11 y capacidad según la convocatoria.'),
    ('Horario y lugar','Fecha, hora y dirección; alternativa de consultar el horario al grupo.'),
    ('Equilibrio deportivo','Generación asistida de equipos con nivel y posiciones, seguida de revisión del organizador.'),
    ('Convocatoria que evoluciona','Cupos, altas, bajas y reorganización sin duplicar jugadores.')])
feature('Detalle del partido: un centro de información','Una ficha compartida desde la planificación hasta el resultado.',['match_detail','planning'],[
    ('Contexto completo','Estado, equipos, jugadores, lugar y horario reunidos en la misma vista.'),
    ('Planificar en grupo','Consulta de horarios y votaciones; el clima aporta contexto cuando hay datos disponibles.'),
    ('Completar el encuentro','Inscripciones, solicitudes e invitaciones con comprobación de cupos y permisos.'),
    ('Coordinar sin salir','Chat del partido y acceso a acciones habilitadas según el estado del encuentro.')])
feature('Dirigir: la cancha como protagonista','La experiencia en vivo reúne el juego y su registro en una sola pantalla.',['live','chat'],[
    ('Cancha y jugadores','Retratos, nombres, posición y OVR sobre el campo.'),
    ('Marcador y reloj','Control de tiempo, pausa, descanso y resultado durante el encuentro.'),
    ('Eventos del partido','Carga de goles, asistencias y tarjetas; consulta de línea de tiempo y estadísticas.'),
    ('Registro consistente','El servidor controla permisos y evita repetir eventos por reintentos o modificar un partido cerrado.')])
feature('Evaluaciones que alimentan la progresión','El cierre del partido abre el recorrido de evaluación y devolución.',['evaluations','evaluate'],[
    ('Pendientes visibles','Bandeja de evaluaciones y asignaciones vinculadas a los partidos finalizados.'),
    ('Puntos y etiquetas','Calificación y comportamientos de juego; se conserva el contexto de cada evaluado.'),
    ('Privacidad de las devoluciones','Se respeta el anonimato y la visibilidad prevista para cada evaluación.'),
    ('Evolución registrada','Resultados, cambios por atributo e historial de OVR quedan asociados al recorrido del jugador.')])
feature('Después de jugar, la fecha sigue viva','El partido deja resultados, comentarios, recuerdos y una próxima razón para volver.',['story','progression'],[
    ('La figura y la planilla','Goles, asistencias, valoraciones y cambios por atributo en el historial.'),
    ('Crónica asistida por IA','Relato generado a partir del contexto del partido, eventos y testimonios disponibles.'),
    ('Clips de la fecha','Carga y reproducción de videos cortos asociados al minuto y, opcionalmente, a un jugador.'),
    ('Progresión a lo largo del tiempo','Visualización del OVR y sus cambios a través de los partidos evaluados.')])
feature('Ligas: cada fecha mueve la tabla','Organización de un campeonato con partidos reales, posiciones y cierre.',['league','league_table'],[
    ('Calendario y formato','Hasta 16 equipos, todos contra todos, ida o ida y vuelta; frecuencia semanal o quincenal.'),
    ('Tabla conectada','Puntos configurables, diferencia de goles y goles a favor a partir de resultados confirmados.'),
    ('Mi equipo y sus fechas','Próximo encuentro, plantel, calendario y datos individuales registrados.'),
    ('Campeón e historial','Cierre del organizador cuando se resuelve la competencia; archivo sin perder resultados.')])
feature('Copas: del sorteo al campeón','La llave se conecta al ciclo de vida real de los encuentros.',['cup','cup_bracket'],[
    ('Sorteo o cabezas por nivel','Cuadros de 2, 4, 8, 16 o 32 equipos; los cruces iniciales crean partidos reales.'),
    ('Avance de rondas','El resultado confirmado define clasificados; el siguiente partido se prepara cuando hay rivales.'),
    ('Empates resueltos','Ganador por penales separado del marcador del encuentro.'),
    ('Gestión de participantes','Inscripciones públicas, aprobación del organizador y planteles de equipos registrados.')])
feature('Explorar: encontrar con quién y dónde jugar','La búsqueda conecta disponibilidad, cercanía y necesidades concretas de los encuentros.',['explore','explore_matches'],[
    ('Encontrar jugadores','Zona, distancia, posición y disponibilidad publicada; invitar a un partido propio con cupo.'),
    ('Encontrar partidos','Búsqueda de encuentros públicos y solicitud para sumarse con revisión previa.'),
    ('Disponibilidad personal','Publicación de zona y horarios; buscar no modifica automáticamente la disponibilidad.'),
    ('Revisión antes de confirmar','Destino de invitación, cupo y estado de solicitud visibles para evitar acciones repetidas.')])

# 18
page('Más motivos para volver entre una fecha y otra','ACTUAL','Ranking, práctica y actividad complementan el núcleo de organización y partido.')
for x,name in zip([94,351,608],['ranking','coach','community']): phone(name,x,172,302)
for x,t,b in [(42,'Ranking del plantel','Clasificaciones por distintas métricas, con empates respetados.'),(299,'Mi entrenamiento','Objetivos y ejercicios sugeridos a partir de los atributos guardados.'),(556,'Comunidad','Lectura de actividad vinculada al recorrido deportivo del grupo.')]:
    para(x,490,235,t,12.5,WHITE,'BodyB'); para(x,512,235,b,9.5,MUTED)
end()

# 19
page('Qué está integrado y qué queda por ampliar','ALCANCE ACTUAL','La interfaz actual no equivale a que todas las extensiones comerciales estén activas.')
table(['Área','Disponible en el móvil','Ampliación posible'],[
    ('Cuenta y perfil','Email/Google, edición, foto, encuadre, retrato con IA y créditos.','Paquetes de personalización y cobro de créditos.'),
    ('Grupos y partidos','Grupos, equipos, camisetas, cupos, planificación y equipos equilibrados.','Reservas de canchas, cobros y control de asistencia.'),
    ('En vivo y memoria','Reloj, eventos, chat, clips, estadísticas, crónica y devoluciones.','Transmisión, highlights automáticos y exportación social.'),
    ('Competencias','Fechas, tabla, llave, participantes, solicitudes y campeón.','Árbitros, sanciones, sedes y reglamentos avanzados.'),
    ('Descubrimiento','Jugadores/partidos por zona, horarios y solicitudes.','Recomendación, reputación y oferta comercial de canchas.'),
    ('Relación y progreso','Notificaciones, ranking, atributos, ejercicios y lectura de actividad.','Comunidad participativa y entrenamiento conversacional.')
],[127,315,315],rowh=53,size=10)
para(42,540,745,'Reservas, suscripciones, pauta y acuerdos comerciales se presentan como propuestas, no como servicios ya comercializados.',9,MUTED); end()

# 20
page('Una evolución con prioridades claras','PROPUESTA','Organizar el crecimiento por valor entregado y condiciones de implementación.')
tiles([('PRIMER HORIZONTE','Consolidar el hábito','Instrumentar el recorrido, mejorar activación, calidad de datos y retención por grupo.'),('SEGUNDO HORIZONTE','Validar disposición a pagar','Probar herramientas premium de organización y patrocinio local con pocos aliados.'),('TERCER HORIZONTE','Conectar oferta y demanda','Sumar reservas, operación de canchas, torneos de terceros y una red comercial medible.')],h=205)
para(42,415,750,'Cada horizonte depende de evidencia del anterior.',23,WHITE,'SpaceB')
para(42,459,720,'El calendario y el presupuesto deben surgir de pilotos, alcance y capacidad operativa. La secuencia propuesta no representa compromisos de desarrollo ni fechas de lanzamiento.',12,MUTED)
end()

# 21
page('Funciones que pueden ampliar la propuesta','PROPUESTA','Un catálogo de crecimiento para jugadores, organizadores y aliados.')
tiles([('ORGANIZAR','Cobros y reservas','Señas, división del costo, turnos recurrentes, lista de espera y recordatorios de asistencia.'),('COMPETIR','Torneos más completos','Sedes, árbitros, sanciones, reglamentos, pases libres y fases mixtas.'),('RECORDAR','Contenido compartible','Placas de resultados, mejores jugadas, álbumes y resúmenes exportables.'),('MEJORAR','Entrenamiento ampliado','Planes, objetivos, seguimiento y asistencia conversacional con controles de calidad.'),('CONECTAR','Comunidad activa','Publicaciones, reacciones, reportes, reputación y mecanismos de moderación.'),('OPERAR','Herramientas para aliados','Paneles de canchas y ligas, reportes agregados, facturación e integraciones.')],h=164)
end()

# 22
page('Dónde puede construirse valor económico','PROPUESTA COMERCIAL','La oportunidad es monetizar herramientas, servicios y contexto deportivo recurrente.')
table(['Línea','Quién paga','Valor que recibe'],[
    ('Organización premium','Capitanes, grupos, ligas e instituciones.','Más capacidad, herramientas de gestión, reportes y automatización.'),
    ('Patrocinio directo','Canchas, marcas y comercios vinculados al fútbol.','Presencia contextual en fechas, torneos y contenidos del grupo.'),
    ('Reservas y servicios','Canchas y proveedores; según el acuerdo.','Consultas y reservas atribuibles, operación y acceso a demanda local.'),
    ('Personalización','Jugadores o equipos.','Retratos, diseños y piezas adicionales, con costo de uso controlado.'),
    ('Licenciamiento B2B','Complejos, ligas e instituciones.','Una experiencia propia de organización y competencia.'),
    ('Publicidad de red','Anunciantes a través de una red publicitaria.','Alcance medible como complemento cuando haya escala suficiente.')
],[155,255,347],rowh=52,size=10.4)
end()

# 23
page('Publicidad que acompañe el recorrido','PROPUESTA COMERCIAL','Espacios contextualizados, identificados como publicidad y separados de las acciones críticas.')
table(['Ubicación propuesta','Formato y ejemplo','Qué medir'],[
    ('Panel / Explorar','Tarjeta nativa: cancha aliada o servicio cercano.','Impresiones visibles, clics y consultas.'),
    ('Último partido / Crónica','Patrocinio de la fecha o de la figura del encuentro.','Lecturas, alcance y accesos a la propuesta.'),
    ('Liga / Copa','Presentación del torneo y presencia de un patrocinador.','Grupos y participantes alcanzados; exposición por fecha.'),
    ('Contenido y perfil','Personalización patrocinada o beneficio opcional.','Uso del beneficio y retención, con consentimiento cuando corresponda.'),
    ('Momentos opcionales','Anuncio recompensado para un extra cosmético o de contenido.','Aceptación voluntaria, finalización y recompensa entregada.')
],[163,365,229],rowh=59,size=10.5)
para(42,520,750,'Criterio de producto: proteger Dirigir, el envío de evaluaciones y las decisiones de inscripción. El rendimiento deportivo no se compra.',11,WHITE,'BodyB')
end()

# 24
page('Cómo podría verse una integración comercial','EJEMPLOS CONCEPTUALES','Tres piezas de muestra. No representan anuncios activos ni acuerdos con marcas.')
for i,(tag,title,body,cta,photoName) in enumerate([
    ('PUBLICIDAD · CANCHA ALIADA','Tu próxima fecha, más cerca','Información de un complejo y una propuesta para el grupo.','Consultar disponibilidad','patea_ready_pitch'),
    ('PATROCINIO · FECHA','La figura de esta jornada','Una marca acompaña el contenido, con identificación visible.','Conocer el beneficio','patea_matchday'),
    ('PATROCINIO · TORNEO','Copa del grupo','Presentación y calendario con espacio para un aliado de temporada.','Ver propuesta del aliado','patea_competitions')]):
    x=42+i*257; box(x,171,241,334); photo(photoName,x+1,172,239,129)
    txt(x+15,315,tag,7.5,CYAN,'Code'); para(x+15,340,210,title,19,WHITE,'SpaceB')
    para(x+15,394,210,body,11,MUTED); box(x+15,459,210,28,VOLT,8); txt(x+25,467,cta,9,'#141926','BodyB')
para(42,523,740,'La identificación comercial debe ser visible. La imagen y el anuncio no deben confundirse con resultados, mensajes o solicitudes de jugadores.',10,MUTED)
end()

# 25
page('Paquetes comerciales que se pueden validar','PROPUESTA COMERCIAL','Empezar con oferta simple y evidencia de valor antes de ampliar inventario.')
tiles([('LOCAL','Aliado del barrio','Presencia contextual en una zona o grupo de canchas. Reporte de consultas y campañas por período.'),('COMPETENCIA','Aliado de una copa','Marca asociada a una competencia y sus contenidos: apertura, fechas y cierre.'),('RECURRENTE','Red de grupos o ligas','Acuerdo para varias comunidades, con cobertura, límites de frecuencia y medición agregada.')],h=207)
para(42,418,740,'Qué se vende: un contexto claro y un resultado medible.',21,WHITE,'SpaceB')
para(42,460,735,'Cobertura, período, ubicación, frecuencia, contenido y reporte deben quedar definidos. Los precios se validan con pilotos y demanda real; no se asumen tarifas de mercado ni campañas vendidas.',12,MUTED)
end()

# 26
page('Premium, servicios y personalización','PROPUESTA COMERCIAL','La base gratuita puede generar hábito; las herramientas adicionales deben justificar el pago.')
tiles([('JUGADOR','Personalización y contenido','Retratos extra, piezas para compartir y opciones de presentación. El OVR sigue asociado al juego.'),('GRUPO','Equipo Pro','Más herramientas de organización, reportes, exportación, automatizaciones y control administrativo.'),('ORGANIZADOR','Operación de torneos','Gestión ampliada de competencias, temporadas, sedes, comunicación y documentación.')],h=205)
para(42,418,750,'Separar beneficios digitales de servicios presenciales.',21,WHITE,'SpaceB')
para(42,461,735,'Los cobros digitales y las reservas físicas requieren recorridos distintos, validación de políticas de tiendas y definición de comisiones, impuestos y devoluciones. El checkout comercial todavía debe implementarse. [S4-S5]',11.5,MUTED)
end()

# 27
page('Economía: un ejemplo para discutir supuestos','SIMULACIÓN ILUSTRATIVA','Cifras hipotéticas en US$ por mes. No son ingresos actuales, ventas comprometidas ni una previsión.')
table(['Hipótesis','Cálculo mensual','Ingreso bruto'],[
    ('Plan de organización','300 grupos activos supuestos; 10% contrataría a US$10.','30 x 10 = US$300'),
    ('Patrocinios locales','5 acuerdos hipotéticos a US$100 cada uno.','5 x 100 = US$500'),
    ('Comisión por reservas','100 reservas x US$30 de ticket x 8% de comisión.','US$240'),
    ('TOTAL DEL EJERCICIO','US$800 de líneas recurrentes + US$240 transaccionales.','US$1.040')
],[180,400,177],rowh=62,size=11)
para(42,478,740,'No es margen ni beneficio neto.',16,WHITE,'SpaceB')
para(42,509,738,'Falta descontar infraestructura, IA, video, comisiones de cobro/tiendas, impuestos, soporte, adquisición y devoluciones. Las tasas, precios y volúmenes son supuestos a validar.',10.5,MUTED)
end()

# 28
page('Qué hace sostenible el modelo','PROPUESTA DE MEDICIÓN','El valor económico se valida en cohortes y operación, no sólo en descargas o impresiones.')
tiles([('PRODUCTO','Retención por grupo','Grupos que organizan una nueva fecha, participación recurrente y finalización de evaluaciones.'),('COMERCIAL','Conversión y renovación','Planes contratados, ingresos recurrentes y sponsors que repiten con resultados verificables.'),('OPERACIÓN','Costo de servir','Infraestructura, generación con IA, almacenamiento de clips, soporte y costos de cobro.')],h=187)
for i,(t,b) in enumerate([('Margen de contribución','Ingresos menos costos variables atribuibles.'),('Recuperación de adquisición','Costo de captar una cuenta / contribución mensual de esa cuenta.'),('Valor en el tiempo','Retención observada y contribución por cohorte, sin asumir permanencia ilimitada.')]):
    x=42+i*257; para(x,403,238,t,13.5,WHITE,'BodyB'); para(x,438,238,b,11,MUTED)
end()

# 29
page('Una entrada al mercado desde comunidades reales','PILOTO PROPUESTO','Concentrar la actividad en un entorno local para aprender antes de expandir.')
photo('patea_urban_court',42,166,320,313)
for y,t,b in [(169,'Activar a quien organiza','Capitanes y referentes como punto de entrada: un grupo activo trae un recorrido completo.'),(271,'Aliarse con espacios de juego','Canchas y organizadores pueden conectar convocatorias, torneos y primeras propuestas comerciales.'),(373,'Medir repetición y disposición a pagar','Comparar uso, retención y valor percibido antes de abrir una operación comercial más grande.')]:
    bullet(397,y,354,t,b)
para(42,506,744,'Piloto orientativo: 3 canchas, 10 grupos y 6 semanas. Es un diseño de validación, no tracción existente.',11,VOLT,'BodyB')
end()

# 30
page('Condiciones para convertir la oportunidad en negocio','PROPUESTA DE EJECUCIÓN','Una base de producto ya construida, con etapas comerciales y operativas por validar.')
tiles([('EXPERIENCIA','Continuidad y calidad','Instrumentación, pruebas de recorrido, soporte, moderación y tratamiento de casos incompletos.'),('COMERCIALIZACIÓN','Oferta y cobros','Precio, contratos, facturación, pagos, devoluciones y operación de aliados.'),('PAUTA Y DATOS','Consentimiento y medición','Identificación de anuncios, controles de frecuencia, privacidad y validación de políticas aplicables.')],h=201)
para(42,412,749,'Uso recurrente y monetización contextual.',22,WHITE,'SpaceB')
para(42,462,735,'La publicidad nativa y recompensada tiene soporte técnico disponible para Flutter; integrarla requiere implementación, configuración y revisión. No hay pauta activa acreditada en esta referencia. [S1-S3]',11.5,MUTED)
end()

# 31
page('Pateá puede crecer desde lo que ya conecta','VISIÓN','Grupo, cancha, partido y memoria deportiva como una misma experiencia.')
photo('patea_league',42,169,757,223)
para(42,419,715,'Una herramienta para organizar. Una identidad para pertenecer. Un contexto para construir servicios.',24,WHITE,'SpaceB')
para(42,506,740,'El siguiente paso es validar repetición de uso, valor percibido y una primera oferta comercial con comunidades concretas.',12,MUTED)
end()

# 32
page('Fuentes y alcance de esta presentación','NOTAS DE LECTURA','Referencia de producto: Flutter 1.0.33+34, revisada el 17 de noviembre de 2026.')
para(42,168,352,'Cómo leer las imágenes',14,WHITE,'BodyB')
para(42,197,352,'Las pantallas provienen de los componentes actuales de la app con datos de demostración. Fotografías de marca ilustrativas. Las cifras de fichas, planteles y marcadores no son métricas de tracción ni evidencia de clientes.',11,MUTED)
para(42,300,352,'Actual frente a propuesto',14,WHITE,'BodyB')
para(42,329,352,'ACTUAL describe funciones integradas en el código móvil y sus servicios revisados. No implica auditoría integral de producción, distribución pública, tracción ni monetización validada. Las ampliaciones, anuncios, paquetes y cifras comerciales están identificados como propuestas o simulaciones.',11,MUTED)
para(42,456,352,'Identidad y derechos',14,WHITE,'BodyB')
para(42,485,352,'Marca y recursos de Pateá; fuentes tipográficas abiertas y SVG de Tabler con licencia MIT. Se conserva la licencia de los iconos en los recursos del proyecto.',10.5,MUTED)
sources=[
    ('S1','Google AdMob: anuncios nativos','https://developers.google.com/admob/flutter/native'),
    ('S2','Google AdMob: anuncios recompensados','https://developers.google.com/admob/flutter/rewarded'),
    ('S3','Google AdMob: opciones de privacidad','https://developers.google.com/admob/flutter/privacy'),
    ('S4','Apple: App Review Guidelines','https://developer.apple.com/app-store/review/guidelines/'),
    ('S5','Google Play: política de pagos','https://support.google.com/googleplay/android-developer/answer/9858738'),
    ('S6','Tabler: familia de iconos','https://tabler.io/icons')]
y=169
for key,label,url in sources:
    txt(426,y,key,9,VOLT,'Code'); para(456,y-1,335,label,10.5,WHITE,'BodyB')
    h=para(456,y+19,331,url,8.5,MUTED); c.linkURL(url,(454,H-h-2,798,H-y+2),relative=0); y=h+18
end()
c.save()
(TMP/'layout-audit.json').write_text(json.dumps({'pages':PAGES,'text_boxes':AUDIT},ensure_ascii=False,indent=2),encoding='utf8')
print('Built',len(PAGES),'pages:',OUT)
