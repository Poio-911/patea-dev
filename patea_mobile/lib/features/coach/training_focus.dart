import '../../core/models/player_model.dart';

/// Curated technical drills, selected locally from the saved attribute values.
/// No AI call, invented evaluation or promised attribute improvement.
class TrainingFocus {
  final String id;
  final String label;
  final int value;
  final String exercise;
  final String equipment;
  final List<String> steps;
  const TrainingFocus(
    this.id,
    this.label,
    this.value,
    this.exercise,
    this.equipment,
    this.steps,
  );
}

List<TrainingFocus> trainingFocusFor(PlayerModel p) {
  if (p.position.toUpperCase() == 'POR') {
    return [
      TrainingFocus(
        'def',
        'Estirada',
        p.def,
        'Alcance lateral',
        'Pelota y un compañero',
        [
          'Partí en posición de espera, con rodillas flexionadas.',
          'Tu compañero rueda la pelota a uno de tus lados, a poca distancia.',
          'Desplazate y recogé la pelota; alterná los lados sin tirarte al suelo.',
        ],
      ),
      TrainingFocus(
        'dri',
        'Reflejos',
        p.dri,
        'Recepción a una señal',
        'Pelota y un compañero',
        [
          'Colocate de frente a tu compañero, a unos pasos de distancia.',
          'Al escuchar su señal, recibí un lanzamiento suave a las manos.',
          'Devolvé la pelota y volvé a la posición de espera.',
        ],
      ),
      TrainingFocus(
        'sho',
        'Paradas',
        p.sho,
        'Blocaje bajo',
        'Pelota y un compañero',
        [
          'Pedile a tu compañero que ruede la pelota hacia vos.',
          'Colocate detrás de la trayectoria y recogela con ambas manos.',
          'Asegurá la pelota antes de devolverla.',
        ],
      ),
      TrainingFocus(
        'pac',
        'Velocidad',
        p.pac,
        'Pasos de ajuste',
        'Dos marcas y una pelota',
        [
          'Separá las marcas unos pasos y dejá la pelota en el centro.',
          'Movete con pasos cortos de una marca a la otra.',
          'Terminá frente a la pelota, en posición de espera.',
        ],
      ),
      TrainingFocus(
        'pas',
        'Saque',
        p.pas,
        'Salida a un objetivo',
        'Pelota y dos marcas',
        [
          'Armá una puerta con dos marcas frente a vos.',
          'Pasá la pelota con el pie buscando que cruce la puerta.',
          'Alterná ambos pies y priorizá la precisión.',
        ],
      ),
      TrainingFocus(
        'phy',
        'Posición',
        p.phy,
        'Cerrar el ángulo',
        'Pelota y un compañero',
        [
          'Ubicate entre la pelota y el centro del arco.',
          'Tu compañero mueve la pelota de un lado a otro sin rematar.',
          'Ajustá tu posición para seguir alineado con pelota y arco.',
        ],
      ),
    ];
  }
  return [
    TrainingFocus(
      'pac',
      'Ritmo',
      p.pac,
      'Cambios de ritmo con pelota',
      'Pelota y dos marcas',
      [
        'Separá dos marcas y conducí la pelota a paso cómodo.',
        'Alterná unos pasos cortos con una salida controlada.',
        'Frená la pelota al llegar a la marca y volvé con el otro pie.',
      ],
    ),
    TrainingFocus(
      'sho',
      'Tiro',
      p.sho,
      'Definición a un objetivo',
      'Pelota y un arco o dos marcas',
      [
        'Elegí una zona del arco como objetivo.',
        'Acomodá la pelota con un toque y rematá de forma controlada.',
        'Alterná perfiles y buscá precisión antes que potencia.',
      ],
    ),
    TrainingFocus(
      'pas',
      'Pase',
      p.pas,
      'Pase y perfil',
      'Pelota y una pared o un compañero',
      [
        'Hacé un pase corto con la cara interna del pie.',
        'Antes de recibir, mirá a un lado y perfilá el cuerpo.',
        'Controlá hacia ese lado y devolvé con el otro pie.',
      ],
    ),
    TrainingFocus(
      'dri',
      'Regate',
      p.dri,
      'Control entre marcas',
      'Pelota y dos marcas',
      [
        'Formá una puerta con dos marcas.',
        'Pasá con toques cortos, manteniendo la pelota cerca.',
        'Girate al salir y volvé usando el otro pie.',
      ],
    ),
    TrainingFocus(
      'def',
      'Defensa',
      p.def,
      'Perfil defensivo',
      'Pelota y un compañero',
      [
        'Tu compañero avanza despacio conduciendo la pelota.',
        'Acompañalo de costado, entre la pelota y el arco.',
        'Mantené la distancia sin cruzar los pies ni buscar el contacto.',
      ],
    ),
    TrainingFocus(
      'phy',
      'Físico',
      p.phy,
      'Equilibrio con pelota',
      'Una pelota',
      [
        'Llevá la pelota de un lado al otro con la planta del pie.',
        'Alterná apoyos sin perder el control.',
        'Sumá una pausa con la pelota detenida antes de cambiar de pie.',
      ],
    ),
  ];
}

TrainingFocus suggestedFocus(List<TrainingFocus> focuses) =>
    focuses.reduce((a, b) => a.value <= b.value ? a : b);
