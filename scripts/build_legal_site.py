"""Genera el sitio estático de Pateá (landing + páginas legales).

Se publica en el sitio de Firebase Hosting `patea-app` (https://patea-app.web.app).
Estética Game: los colores salen de `patea_mobile/lib/core/theme/patea_colors.dart`
(PateaColors.game), las tipografías son las de la app (Anton, Space Grotesk,
Outfit y Source Code Pro) y la imagen es la de marca `patea_matchday`.

    python scripts/build_legal_site.py
    firebase deploy --only hosting --config firebase.legal.json --project mil-disculpis

El contenido legal vive en este archivo: se edita acá y se regenera, no a mano
en `legal-site/`.
"""

from __future__ import annotations

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "legal-site"
APP = ROOT / "patea_mobile"

UPDATED = "22 de noviembre de 2026"
SITE = "https://patea-app.web.app"

CSS = """
:root {
  --bg: #0B0E13; --card: #181D25; --card-2: #29303D; --border: #2A3342;
  --text: #F8FAFC; --muted: #B3BDCC; --volt: #CCFF33; --on-volt: #141926;
  --accent: #00E6D2; --link: #CCFF33; --shadow: 0 1px 0 rgba(255,255,255,.04) inset;
  --hero-veil: linear-gradient(90deg, #0B0E13 0%, rgba(11,14,19,.92) 38%, rgba(11,14,19,.35) 100%);
}
@media (prefers-color-scheme: light) {
  :root {
    --bg: #F6F8FB; --card: #FFFFFF; --card-2: #EEF2F7; --border: #D8DFEA;
    --text: #0F172A; --muted: #4B5870; --volt: #CCFF33; --on-volt: #141926;
    --accent: #0A7F74; --link: #1D4ED8; --shadow: 0 1px 2px rgba(15,23,42,.06);
    --hero-veil: linear-gradient(90deg, #F6F8FB 0%, rgba(246,248,251,.94) 40%, rgba(246,248,251,.3) 100%);
  }
}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0; background: var(--bg); color: var(--text);
  font: 400 16px/1.65 "Outfit", system-ui, -apple-system, "Segoe UI", sans-serif;
}
a { color: var(--link); text-underline-offset: 3px; }
.wrap { width: min(100% - 32px, 960px); margin-inline: auto; }
.narrow { width: min(100% - 32px, 760px); margin-inline: auto; }

header.top { border-bottom: 1px solid var(--border); }
header.top .wrap { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-block: 16px; }
.brand { display: inline-flex; align-items: center; gap: 10px; color: var(--text); text-decoration: none;
  font: 700 24px/1 "Space Grotesk", sans-serif; letter-spacing: -.01em; }
.brand img { width: 30px; height: 30px; }
nav.main { display: flex; flex-wrap: wrap; gap: 4px 18px; }
nav.main a { color: var(--muted); text-decoration: none; font: 500 14px/1 "Space Grotesk", sans-serif; padding: 8px 0;
  border-bottom: 2px solid transparent; }
nav.main a:hover, nav.main a[aria-current="page"] { color: var(--text); border-bottom-color: var(--volt); }

.eyebrow { font: 500 12px/1 "Source Code Pro", ui-monospace, monospace; letter-spacing: .14em; text-transform: uppercase; color: var(--accent); }
h1.display { font: 400 clamp(40px, 8vw, 72px)/1.02 "Anton", Impact, sans-serif; text-transform: uppercase; margin: 14px 0 0; letter-spacing: .005em; }
h1.display em { font-style: normal; color: var(--volt); }
@media (prefers-color-scheme: light) { h1.display em { display: inline-block; margin-top: .1em; background: var(--volt); color: var(--on-volt); padding: .02em .14em 0; line-height: 1.05; } }
.lead { color: var(--muted); font-size: 18px; max-width: 34em; }

.hero { position: relative; overflow: hidden; border-bottom: 1px solid var(--border); }
.hero::before { content: ""; position: absolute; inset: 0; background: url("/assets/matchday.webp") center right / cover no-repeat; }
.hero::after { content: ""; position: absolute; inset: 0; background: var(--hero-veil); }
.hero .wrap { position: relative; z-index: 1; padding-block: clamp(56px, 12vw, 132px); }
.hero .lead { margin: 22px 0 0; }
.cta { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 30px; }
.btn { display: inline-flex; align-items: center; min-height: 46px; padding: 0 22px; border-radius: 12px; text-decoration: none;
  font: 700 15px/1 "Space Grotesk", sans-serif; border: 1px solid var(--border); color: var(--text); background: var(--card); }
.btn.primary { background: var(--volt); color: var(--on-volt); border-color: var(--volt); }
.btn:hover { filter: brightness(1.08); }

.grid { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); padding-block: 40px 8px; }
.card { background: var(--card); border: 1px solid var(--border); border-radius: 18px; padding: 22px 22px 24px; box-shadow: var(--shadow); }
.card .num { font: 500 12px/1 "Source Code Pro", ui-monospace, monospace; color: var(--accent); letter-spacing: .08em; }
.card h2, .card h3 { font: 700 20px/1.25 "Space Grotesk", sans-serif; margin: 14px 0 8px; letter-spacing: -.01em; }
.card p { margin: 0; color: var(--muted); font-size: 15px; }

main.doc { padding-block: 44px 72px; }
.doc .intro { margin-top: 18px; color: var(--muted); font-size: 17px; }
.updated { margin-top: 18px; font: 500 12px/1 "Source Code Pro", ui-monospace, monospace; color: var(--muted); letter-spacing: .06em; }
.sections { display: grid; gap: 14px; margin-top: 34px; }
.sections .card h2 { margin-top: 12px; }
.sections .card p { color: var(--text); opacity: .9; font-size: 16px; margin-top: 10px; }
.sections .card p:first-of-type { margin-top: 0; }
.sections ul { margin: 12px 0 0; padding: 0; list-style: none; display: grid; gap: 10px; }
.sections li { position: relative; padding-left: 20px; font-size: 16px; }
.sections li::before { content: ""; position: absolute; left: 0; top: .62em; width: 8px; height: 8px; border-radius: 2px; background: var(--volt); }
.sections li strong { color: var(--text); }
.note { margin-top: 28px; padding: 14px 18px; border-left: 3px solid var(--volt); background: var(--card); border-radius: 0 12px 12px 0; color: var(--muted); font-size: 14px; }
.steps { counter-reset: s; }
.steps li { counter-increment: s; padding-left: 40px; }
.steps li::before { content: counter(s); width: 26px; height: 26px; top: 0; border-radius: 8px; background: var(--volt); color: var(--on-volt);
  font: 700 13px/26px "Space Grotesk", sans-serif; text-align: center; }

footer.bottom { border-top: 1px solid var(--border); padding-block: 28px; color: var(--muted); font-size: 14px; }
footer.bottom .wrap { display: flex; flex-wrap: wrap; gap: 10px 24px; justify-content: space-between; align-items: center; }
footer.bottom a { color: var(--muted); }
footer.bottom .mono { font: 500 12px/1 "Source Code Pro", ui-monospace, monospace; letter-spacing: .08em; text-transform: uppercase; }
:focus-visible { outline: 2px solid var(--volt); outline-offset: 3px; border-radius: 4px; }
@media (max-width: 560px) {
  header.top .wrap { flex-direction: column; align-items: flex-start; gap: 4px; padding-block: 12px 4px; }
  nav.main { gap: 0 16px; width: 100%; }
  .brand { font-size: 22px; }
}
"""

FONTS = (
    "https://fonts.googleapis.com/css2?family=Anton&family=Outfit:wght@400;500;600"
    "&family=Space+Grotesk:wght@500;600;700&family=Source+Code+Pro:wght@500&display=swap"
)

NAV = [
    ("/", "Inicio"),
    ("/privacidad/", "Privacidad"),
    ("/terminos/", "Términos"),
    ("/eliminar-cuenta/", "Eliminar cuenta"),
]


def page(*, path: str, title: str, description: str, body: str, hero: str = "") -> str:
    current = ' aria-current="page"'
    nav = "".join(
        f'<a href="{href}"{current if href == path else ""}>{label}</a>'
        for href, label in NAV
    )
    return f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{description}">
<meta name="color-scheme" content="dark light">
<meta name="theme-color" content="#0B0E13">
<link rel="icon" href="/assets/logo.svg" type="image/svg+xml">
<link rel="canonical" href="{SITE}{path}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="{FONTS}">
<link rel="stylesheet" href="/assets/style.css">
</head>
<body>
<header class="top"><div class="wrap">
<a class="brand" href="/"><img src="/assets/logo.svg" alt="" width="30" height="30">Pateá</a>
<nav class="main" aria-label="Principal">{nav}</nav>
</div></header>
{hero}{body}
<footer class="bottom"><div class="wrap">
<span class="mono">Pateá · Tu fútbol, con historia</span>
<span><a href="/privacidad/">Privacidad</a> · <a href="/terminos/">Términos</a> · <a href="/eliminar-cuenta/">Eliminar cuenta</a></span>
</div></footer>
</body>
</html>
"""


def cards(sections: list[tuple[str, str]]) -> str:
    out = []
    for i, (title, html) in enumerate(sections, 1):
        out.append(
            f'<section class="card"><span class="num">{i:02d}</span><h2>{title}</h2>{html}</section>'
        )
    return '<div class="sections">' + "".join(out) + "</div>"


def doc(eyebrow: str, h1: str, intro: str, sections, note: str = "") -> str:
    note_html = f'<p class="note">{note}</p>' if note else ""
    return f"""<main class="doc"><div class="narrow">
<span class="eyebrow">{eyebrow}</span>
<h1 class="display">{h1}</h1>
<p class="intro">{intro}</p>
<p class="updated">ÚLTIMA ACTUALIZACIÓN · {UPDATED.upper()}</p>
{cards(sections)}
{note_html}
</div></main>"""


CONTACT = (
    "<p>Podés ejercer estos derechos desde la propia app y, para cualquier otra consulta, "
    "usar los datos de contacto que figuran en la ficha de Pateá en la tienda de aplicaciones.</p>"
)

PRIVACIDAD = doc(
    "Legal",
    "Política de <em>privacidad</em>",
    "Pateá es una aplicación para organizar partidos de fútbol entre amigos: grupos, equipos, resultados, "
    "evaluaciones entre jugadores y una comunidad social. Esto es lo que hacemos con tus datos y lo que podés hacer con ellos.",
    [
        ("Qué datos recopilamos", """<ul>
<li><strong>Cuenta:</strong> correo electrónico, nombre y foto (si entrás con Google o Apple, los que esos servicios nos comparten).</li>
<li><strong>Perfil de jugador:</strong> posición, atributos, estadísticas, partidos jugados y evaluaciones que recibís.</li>
<li><strong>Contenido que creás:</strong> grupos, equipos, partidos, publicaciones, comentarios, encuestas, clips de video y notas de voz de evaluaciones.</li>
<li><strong>Ubicación, solo mientras usás la app y si lo permitís:</strong> para mostrarte partidos y jugadores cerca.</li>
<li><strong>Cámara, fotos y micrófono, solo si lo permitís:</strong> para tu foto de jugador, clips del partido y notas de voz.</li>
<li><strong>Identificador de notificaciones:</strong> un token del dispositivo para enviarte avisos de partidos e invitaciones.</li>
<li><strong>Datos técnicos:</strong> informes de fallos y estadísticas de uso, para encontrar errores y mejorar la app.</li></ul>"""),
        ("Para qué los usamos", """<ul>
<li>Hacer funcionar la app: grupos, partidos, evaluaciones, rankings y comunidad.</li>
<li>Enviarte las notificaciones que pediste o que son necesarias (recordatorios, invitaciones).</li>
<li>Generar contenido con inteligencia artificial cuando lo pedís, por ejemplo la foto de tu carta o el análisis de una evaluación.</li>
<li>Detectar errores, prevenir abusos y mejorar la app.</li></ul>
<p>No vendemos tus datos y no los usamos para publicidad ni para seguirte en otras apps.</p>"""),
        ("Con quién se comparten", """<ul>
<li><strong>Otras personas de la app:</strong> tu nombre, foto, estadísticas y publicaciones son visibles para tus grupos y, según el caso, para la comunidad. Tus evaluaciones a otros jugadores son anónimas hasta que aceptes revelar tu identidad.</li>
<li><strong>Proveedores que procesan datos por nosotros:</strong> Google (Firebase: autenticación, base de datos, almacenamiento, notificaciones y fallos; y Google Gemini para las funciones de inteligencia artificial). Si entrás con Apple, Apple procesa ese inicio de sesión.</li></ul>
<p>Cuando usás funciones de inteligencia artificial, se envía a Google el contenido necesario (por ejemplo tu foto o el texto de una evaluación) para generar el resultado.</p>"""),
        ("Cuánto tiempo los guardamos", """<p>Mientras tengas la cuenta. Si la eliminás, borramos tu perfil, tu jugador, tus publicaciones, comentarios, fotos y notificaciones. Los partidos y evaluaciones de otras personas se conservan, pero tu nombre y tu foto pasan a figurar como «Jugador eliminado».</p>"""),
        ("Tus derechos", """<p>Podés acceder a tus datos, corregirlos o pedir su eliminación, según la Ley 18.331 de protección de datos personales de Uruguay. Para eliminar tu cuenta mirá <a href="/eliminar-cuenta/">cómo hacerlo</a>: es inmediato y no se puede deshacer.</p>""" + CONTACT),
        ("Menores", "<p>Pateá no está dirigida a menores de 13 años y no recopilamos a sabiendas datos de ellos.</p>"),
        ("Cambios", "<p>Si cambiamos esta política, actualizaremos la fecha de arriba y, si el cambio es importante, te avisaremos en la app.</p>"),
    ],
)

TERMINOS = doc(
    "Legal",
    "Términos de <em>uso</em>",
    "Al crear una cuenta o usar Pateá aceptás estos términos y la <a href=\"/privacidad/\">política de privacidad</a>. "
    "Si no estás de acuerdo, no uses la app.",
    [
        ("Tu cuenta", "<p>Sos responsable de tu cuenta y de lo que se haga con ella. Tenés que dar datos verdaderos y tener al menos 13 años. Podés eliminar tu cuenta cuando quieras, desde el menú de tu usuario.</p>"),
        ("Contenido y conducta", """<p>Lo que publicás (texto, fotos, clips, notas de voz, comentarios, evaluaciones) es tu responsabilidad. No está permitido:</p>
<ul>
<li>Contenido ofensivo, discriminatorio, violento, sexual o que acose o amenace a otras personas.</li>
<li>Publicar datos personales de terceros sin su permiso, o hacerte pasar por otra persona.</li>
<li>Spam, engaños o usar la app para fines ilegales.</li>
<li>Contenido que no es tuyo o que infringe derechos de otras personas.</li></ul>"""),
        ("Denuncias y moderación", "<p>No toleramos contenido abusivo. Podés <strong>denunciar</strong> publicaciones, comentarios y personas, y <strong>bloquear</strong> a quien no quieras ver. Revisamos las denuncias y, si corresponde, quitamos el contenido y suspendemos o eliminamos las cuentas involucradas, normalmente dentro de las 24 horas.</p>"),
        ("Inteligencia artificial", "<p>Algunas funciones generan imágenes o textos con inteligencia artificial. Pueden contener errores y no reemplazan tu criterio. Usarlas implica que el contenido necesario se procese con proveedores externos, como se explica en la política de privacidad.</p>"),
        ("Deporte y responsabilidad", "<p>Pateá organiza y registra partidos, pero no los supervisa. Jugar al fútbol implica riesgos físicos y participás bajo tu propia responsabilidad. No nos hacemos responsables por lesiones, daños, disputas entre jugadores ni por lo que ocurra en los lugares donde se juegue.</p>"),
        ("Disponibilidad", "<p>Hacemos lo posible por que la app funcione siempre, pero puede tener interrupciones o cambios. Podemos modificar o retirar funciones.</p>"),
        ("Propiedad intelectual", "<p>La app, su diseño y su marca son de sus titulares. Vos conservás los derechos de lo que publicás y nos das permiso para mostrarlo dentro de la app a las personas con las que lo compartís.</p>"),
        ("Ley aplicable", "<p>Estos términos se rigen por las leyes de la República Oriental del Uruguay.</p>"),
    ],
)

ELIMINAR = doc(
    "Tus datos",
    "Eliminar mi <em>cuenta</em>",
    "Podés borrar tu cuenta y tus datos personales en cualquier momento, sin escribirnos ni esperar: se hace desde la app y es inmediato.",
    [
        ("Cómo hacerlo", """<ul class="steps">
<li>Abrí Pateá e iniciá sesión.</li>
<li>Tocá tu foto para abrir el menú de tu usuario.</li>
<li>Elegí <strong>Eliminar mi cuenta</strong> y leé el aviso.</li>
<li>Confirmá con tu contraseña, o con Apple o Google según cómo entraste.</li></ul>"""),
        ("Qué se borra", """<ul>
<li>Tu perfil y tu jugador (atributos, estadísticas y foto).</li>
<li>Tus publicaciones, comentarios y seguimientos.</li>
<li>Tus fotos, clips y notas de voz.</li>
<li>Tus notificaciones y el identificador de tu dispositivo.</li></ul>"""),
        ("Qué se conserva", """<p>Los partidos y las evaluaciones de otras personas son historial compartido: se conservan, pero tu nombre y tu foto pasan a figurar como «Jugador eliminado». Si creaste un grupo y hay más integrantes, queda a cargo de otra persona del grupo; si eras la única persona, el grupo se elimina.</p>"""),
        ("Si entraste con Apple", "<p>Además de borrar tus datos, se revoca el permiso que le diste a Pateá en tu cuenta de Apple.</p>"),
    ],
    note="Esta acción no se puede deshacer. Si más adelante querés volver, tendrás que crear una cuenta nueva.",
)

HERO = """<section class="hero"><div class="wrap">
<span class="eyebrow">Fútbol entre amigos</span>
<h1 class="display">Tu fútbol.<br><em>Con historia.</em></h1>
<p class="lead">Organizar el partido. Vivirlo en equipo. Volver por la próxima fecha.</p>
<div class="cta"><a class="btn primary" href="/privacidad/">Política de privacidad</a><a class="btn" href="/terminos/">Términos de uso</a></div>
</div></section>"""

INDEX = """<main><div class="wrap">
<div class="grid">
<div class="card"><span class="num">01</span><h3>Armá el partido</h3><p>Grupos, equipos, camisetas, planteles y convocatoria, sin planillas ni chats interminables.</p></div>
<div class="card"><span class="num">02</span><h3>Jugalo en vivo</h3><p>Marcador, eventos, chat y clips del partido, todo en un mismo lugar.</p></div>
<div class="card"><span class="num">03</span><h3>Quedá en la historia</h3><p>Evaluaciones, estadísticas, rankings y la memoria del grupo, fecha tras fecha.</p></div>
</div>
<p class="note" style="margin-block:28px 72px">Tus datos son tuyos: podés <a href="/eliminar-cuenta/">eliminar tu cuenta</a> cuando quieras, desde la app.</p>
</div></main>"""

NOT_FOUND = """<main class="doc"><div class="narrow">
<span class="eyebrow">Error 404</span>
<h1 class="display">Fuera de <em>cancha</em></h1>
<p class="intro">Esta página no existe. Volvé al <a href="/">inicio</a>.</p>
</div></main>"""


def write(rel: str, content: str) -> None:
    target = OUT / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8", newline="\n")


def main() -> None:
    # Se vacía la carpeta pero no se borra ella misma: en Windows falla si algún
    # servidor de prueba la tiene abierta.
    OUT.mkdir(exist_ok=True)
    for child in OUT.iterdir():
        shutil.rmtree(child) if child.is_dir() else child.unlink()
    (OUT / "assets").mkdir(parents=True)
    write("assets/style.css", CSS.strip() + "\n")

    logo = (APP / "assets/icons/logo_patea.svg").read_text(encoding="utf-8")
    write("assets/logo.svg", logo.replace("currentColor", "#CCFF33"))
    shutil.copyfile(APP / "assets/brand/patea_matchday.webp", OUT / "assets/matchday.webp")

    write("index.html", page(path="/", title="Pateá · Tu fútbol, con historia",
        description="Pateá: organizá el partido, viví el juego en equipo y quedá en la historia del grupo.", body=INDEX, hero=HERO))
    write("privacidad/index.html", page(path="/privacidad/", title="Política de privacidad · Pateá",
        description="Qué datos usa Pateá, para qué, con quién se comparten y cómo borrarlos.", body=PRIVACIDAD))
    write("terminos/index.html", page(path="/terminos/", title="Términos de uso · Pateá",
        description="Reglas de uso de Pateá, contenido de la comunidad y moderación.", body=TERMINOS))
    write("eliminar-cuenta/index.html", page(path="/eliminar-cuenta/", title="Eliminar mi cuenta · Pateá",
        description="Cómo eliminar tu cuenta de Pateá y qué datos se borran.", body=ELIMINAR))
    write("404.html", page(path="/404.html", title="Página no encontrada · Pateá",
        description="Página no encontrada.", body=NOT_FOUND))
    print("OK ->", OUT)


if __name__ == "__main__":
    main()
