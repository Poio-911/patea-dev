import type { Metadata } from 'next';
import { ContactLine, LegalPage } from '@/components/legal-page';

export const metadata: Metadata = {
  title: 'Términos de uso · Pateá',
  description: 'Reglas de uso de Pateá, contenido de la comunidad y moderación.',
};

export default function TerminosPage() {
  return (
    <LegalPage title="Términos de uso">
      <p>
        Al crear una cuenta o usar Pateá aceptás estos términos y la{' '}
        <a className="underline" href="/privacidad">política de privacidad</a>. Si no estás de acuerdo, no uses la app.
      </p>

      <h2>Tu cuenta</h2>
      <p>
        Sos responsable de tu cuenta y de lo que se haga con ella. Tenés que dar datos verdaderos y tener al menos
        13 años. Podés eliminar tu cuenta cuando quieras desde el menú de tu usuario.
      </p>

      <h2>Contenido y conducta</h2>
      <p>Lo que publicás (texto, fotos, clips, notas de voz, comentarios, evaluaciones) es tu responsabilidad. No está permitido:</p>
      <ul>
        <li>Contenido ofensivo, discriminatorio, violento, sexual o que acose o amenace a otras personas.</li>
        <li>Publicar datos personales de terceros sin su permiso, ni hacerte pasar por otra persona.</li>
        <li>Spam, engaños o usar la app para fines ilegales.</li>
        <li>Contenido que no es tuyo o que infringe derechos de otras personas.</li>
      </ul>
      <p>
        No toleramos contenido abusivo. Podés <strong>denunciar</strong> publicaciones, comentarios y personas, y{' '}
        <strong>bloquear</strong> a quien no quieras ver. Revisamos las denuncias y, si corresponde, quitamos el
        contenido y suspendemos o eliminamos las cuentas involucradas, normalmente dentro de las 24 horas.
      </p>

      <h2>Funciones de inteligencia artificial</h2>
      <p>
        Algunas funciones generan imágenes o textos con inteligencia artificial. Pueden contener errores y no
        reemplazan tu criterio. Usarlas implica que el contenido necesario se procese con proveedores externos, como
        se explica en la política de privacidad.
      </p>

      <h2>Deporte y responsabilidad</h2>
      <p>
        Pateá organiza y registra partidos, pero no los supervisa. Jugar al fútbol implica riesgos físicos y
        participás bajo tu propia responsabilidad. No nos hacemos responsables por lesiones, daños, disputas entre
        jugadores ni por lo que ocurra en los lugares donde se juegue.
      </p>

      <h2>Disponibilidad</h2>
      <p>Hacemos lo posible por que la app funcione siempre, pero puede tener interrupciones o cambios. Podemos modificar o retirar funciones.</p>

      <h2>Propiedad intelectual</h2>
      <p>
        La app, su diseño y su marca son de sus titulares. Vos conservás los derechos de lo que publicás y nos das
        permiso para mostrarlo dentro de la app a las personas con las que lo compartís.
      </p>

      <h2>Ley aplicable</h2>
      <p>Estos términos se rigen por las leyes de la República Oriental del Uruguay.</p>

      <h2>Contacto</h2>
      <ContactLine />
    </LegalPage>
  );
}
