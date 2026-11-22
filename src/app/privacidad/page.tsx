import type { Metadata } from 'next';
import { ContactLine, LegalPage } from '@/components/legal-page';

export const metadata: Metadata = {
  title: 'Política de privacidad · Pateá',
  description: 'Qué datos usa Pateá, para qué, con quién se comparten y cómo borrarlos.',
};

export default function PrivacidadPage() {
  return (
    <LegalPage title="Política de privacidad">
      <p>
        Pateá es una aplicación para organizar partidos de fútbol entre amigos: grupos, equipos, resultados,
        evaluaciones entre jugadores y una comunidad social. Esta política explica qué datos tratamos y qué
        podés hacer con ellos.
      </p>

      <h2>Qué datos recopilamos</h2>
      <ul>
        <li><strong>Cuenta:</strong> correo electrónico, nombre y foto (si entrás con Google o Apple, los que esos servicios nos comparten).</li>
        <li><strong>Perfil de jugador:</strong> posición, atributos, estadísticas, partidos jugados y evaluaciones que recibís.</li>
        <li><strong>Contenido que creás:</strong> grupos, equipos, partidos, publicaciones, comentarios, encuestas, clips de video y notas de voz de evaluaciones.</li>
        <li><strong>Ubicación aproximada o precisa, solo mientras usás la app y si lo permitís:</strong> para mostrarte partidos y jugadores cerca.</li>
        <li><strong>Cámara, fotos y micrófono, solo si lo permitís:</strong> para tu foto de jugador, clips del partido y notas de voz.</li>
        <li><strong>Identificador de notificaciones:</strong> un token del dispositivo para enviarte avisos de partidos e invitaciones.</li>
        <li><strong>Datos técnicos:</strong> informes de fallos y estadísticas de uso de la app, para encontrar errores y mejorarla.</li>
      </ul>

      <h2>Para qué los usamos</h2>
      <ul>
        <li>Hacer funcionar la app: grupos, partidos, evaluaciones, rankings y comunidad.</li>
        <li>Enviarte notificaciones que pediste o que son necesarias (recordatorios, invitaciones).</li>
        <li>Generar contenido con inteligencia artificial cuando lo pedís (por ejemplo la foto de tu carta o el análisis de una evaluación).</li>
        <li>Detectar errores, prevenir abusos y mejorar la app.</li>
      </ul>
      <p>No vendemos tus datos y no los usamos para publicidad ni para seguirte en otras apps.</p>

      <h2>Con quién se comparten</h2>
      <ul>
        <li><strong>Otras personas de la app:</strong> tu nombre, foto, estadísticas y publicaciones son visibles para tus grupos y, según el caso, para la comunidad. Tus evaluaciones a otros jugadores son anónimas hasta que aceptes revelar tu identidad.</li>
        <li><strong>Proveedores que procesan datos por nosotros:</strong> Google (Firebase: autenticación, base de datos, almacenamiento, notificaciones y fallos; y Google Gemini para las funciones de inteligencia artificial). Si entrás con Apple, Apple procesa ese inicio de sesión.</li>
      </ul>
      <p>Cuando usás funciones de inteligencia artificial, se envían a Google el contenido necesario (por ejemplo tu foto o el texto de una evaluación) para generar el resultado.</p>

      <h2>Cuánto tiempo los guardamos</h2>
      <p>
        Mientras tengas la cuenta. Si la eliminás, borramos tu perfil, tu jugador, tus publicaciones, comentarios,
        fotos y notificaciones. Los partidos y evaluaciones de otras personas se conservan, pero tu nombre y tu foto
        pasan a figurar como &quot;Jugador eliminado&quot;.
      </p>

      <h2>Tus derechos y cómo eliminar tu cuenta</h2>
      <p>
        Podés acceder a tus datos, corregirlos o pedir su eliminación, según la Ley 18.331 de protección de datos
        personales de Uruguay. Para eliminar tu cuenta entrá a la app, abrí el menú de tu usuario y elegí
        &quot;Eliminar mi cuenta&quot;. Es inmediato y no se puede deshacer.
      </p>
      <ContactLine />

      <h2>Menores</h2>
      <p>Pateá no está dirigida a menores de 13 años y no recopilamos a sabiendas datos de ellos.</p>

      <h2>Cambios</h2>
      <p>Si cambiamos esta política, actualizaremos la fecha de arriba y, si el cambio es importante, te avisaremos en la app.</p>
    </LegalPage>
  );
}
