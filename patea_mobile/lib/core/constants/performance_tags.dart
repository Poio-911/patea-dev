/// Port 1:1 de src/lib/performance-tags.ts — 34 tags (18 positivos, 16
/// negativos). El listado anterior tenía solo 16 tags inventados/incompletos
/// (bug preexistente, encontrado al portar la Sección 8 Evaluaciones); esto
/// importa porque `getRandomTagsForPosition` en la web arma el pool mostrado
/// al evaluador tomando 6 positivos + 4 negativos al azar por posición, y con
/// menos de 6/4 disponibles ese muestreo quedaba corto o repetido.
class PerformanceTagItem {
  final String id;
  final String name;
  final String description;
  final String impact; // positive, negative
  final List<String> positions; // DEL, MED, DEF, POR, ALL
  final Map<String, int> effects; // pac, sho, pas, dri, def, phy

  const PerformanceTagItem({
    required this.id,
    required this.name,
    required this.description,
    required this.impact,
    required this.positions,
    required this.effects,
  });
}

class PerformanceTagsData {
  static const List<PerformanceTagItem> allTags = [
    // --- POSITIVOS ---

    // POR (3)
    PerformanceTagItem(
      id: 'el_pulpo',
      name: 'El Pulpo',
      description: 'Atajadón espectacular que salvó al equipo. El esfuerzo explosivo lo dejó a media máquina.',
      impact: 'positive',
      positions: ['POR'],
      effects: {'def': 3, 'pac': 1, 'phy': -1},
    ),
    PerformanceTagItem(
      id: 'achique_dominante',
      name: 'Achique Dominante',
      description: 'Salió rápido y ganó el duelo ante el delantero. Arriesgar la posición tuvo su costo.',
      impact: 'positive',
      positions: ['POR'],
      effects: {'pac': 2, 'def': 2, 'dri': -1},
    ),
    PerformanceTagItem(
      id: 'distribucion_clave',
      name: 'Saque de Mariscal',
      description: 'Inició el ataque con un saque largo y preciso. Arriesgó al distribuir desde el fondo.',
      impact: 'positive',
      positions: ['POR'],
      effects: {'pas': 2, 'pac': 1, 'def': -1},
    ),

    // DEF (4)
    PerformanceTagItem(
      id: 'muro_defensivo',
      name: 'Un Muro',
      description: 'Ganó todos los duelos individuales. Impasable en su zona pero nunca subió a atacar.',
      impact: 'positive',
      positions: ['DEF'],
      effects: {'def': 3, 'pac': 1, 'sho': -1},
    ),
    PerformanceTagItem(
      id: 'cierre_providencial',
      name: 'Cierre Providencial',
      description: 'Llegó con lo justo para barrer y evitar un gol. Forzó el cierre pero quedó en evidencia.',
      impact: 'positive',
      positions: ['DEF'],
      effects: {'def': 2, 'pac': 2, 'dri': -1},
    ),
    PerformanceTagItem(
      id: 'orden_defensivo',
      name: 'El Patrón',
      description: 'Ordenó la defensa y anticipó jugadas. Líder defensivo que nunca llegó a rematar.',
      impact: 'positive',
      positions: ['DEF'],
      effects: {'def': 2, 'pas': 2, 'sho': -1},
    ),
    PerformanceTagItem(
      id: 'cobertura_oportuna',
      name: 'El Bombero',
      description: 'Siempre estuvo cubriendo las espaldas de un compañero. No atacó nunca.',
      impact: 'positive',
      positions: ['DEF'],
      effects: {'def': 2, 'pac': 1, 'sho': -1},
    ),

    // MED (4)
    PerformanceTagItem(
      id: 'titiritero',
      name: 'El Titiritero',
      description: 'Manejó los hilos del mediocampo. Tanto que se olvidó de volver a defender.',
      impact: 'positive',
      positions: ['MED'],
      effects: {'pas': 2, 'dri': 2, 'def': -1},
    ),
    PerformanceTagItem(
      id: 'pase_filtrado',
      name: 'Pase Quirúrgico',
      description: 'Metió un pase que dejó a un compañero solo. Gran creador pero no destructor.',
      impact: 'positive',
      positions: ['MED'],
      effects: {'pas': 3, 'dri': 1, 'def': -1},
    ),
    PerformanceTagItem(
      id: 'recuperador',
      name: 'Recuperación y Salida',
      description: 'Robó la pelota limpio y empezó el ataque. No llegó a rematar en todo el partido.',
      impact: 'positive',
      positions: ['MED'],
      effects: {'def': 2, 'pas': 1, 'sho': -1},
    ),
    PerformanceTagItem(
      id: 'cambio_frente',
      name: 'Cambio de Frente',
      description: 'Abrió la cancha con un pase largo y preciso. Los pases cortos no fueron su fuerte.',
      impact: 'positive',
      positions: ['MED'],
      effects: {'pas': 2, 'phy': 1, 'dri': -1},
    ),

    // DEL (4)
    PerformanceTagItem(
      id: 'goleador_nato',
      name: 'Definió como los Dioses',
      description: 'Le quedó una y la mandó a guardar. Puro ataque: nunca bajó a defender.',
      impact: 'positive',
      positions: ['DEL'],
      effects: {'sho': 3, 'dri': 1, 'def': -2},
    ),
    PerformanceTagItem(
      id: 'endiablado',
      name: 'Gambeta Endiablada',
      description: 'Se sacó a dos o tres rivales con habilidad pura. Los múltiples dribles le costaron energía.',
      impact: 'positive',
      positions: ['DEL'],
      effects: {'dri': 3, 'pac': 1, 'phy': -1},
    ),
    PerformanceTagItem(
      id: 'terror_area',
      name: 'El Terror del Área',
      description: 'Se movió por todo el frente generando peligro. Nunca volvió a ayudar en defensa.',
      impact: 'positive',
      positions: ['DEL'],
      effects: {'dri': 2, 'sho': 1, 'def': -1},
    ),
    PerformanceTagItem(
      id: 'asistidor',
      name: 'Asistidor Serial',
      description: 'Puso pelotas de gol increíbles a sus compañeros. Eligió el pase cuando podía definir.',
      impact: 'positive',
      positions: ['DEL'],
      effects: {'pas': 3, 'sho': -1, 'def': -1},
    ),

    // ALL (3)
    PerformanceTagItem(
      id: 'garra_charrua',
      name: 'Corazón y Garra',
      description: 'No dio una pelota por perdida, puro sacrificio. El físico tapó la falta de técnica.',
      impact: 'positive',
      positions: ['ALL'],
      effects: {'phy': 3, 'pac': 1, 'dri': -2},
    ),
    PerformanceTagItem(
      id: 'correcaminos',
      name: 'Correcaminos',
      description: 'Corrió por toda la cancha sin parar. Tanto que le costó la precisión.',
      impact: 'positive',
      positions: ['ALL'],
      effects: {'pac': 2, 'phy': 2, 'dri': -1},
    ),
    PerformanceTagItem(
      id: 'equipo_hombro',
      name: 'Se Puso el Equipo al Hombro',
      description: 'Apareció en los momentos difíciles y levantó a todos. Sacrificó su juego individual.',
      impact: 'positive',
      positions: ['ALL'],
      effects: {'phy': 2, 'pas': 1, 'dri': -1},
    ),

    // --- NEGATIVOS ---

    // POR (2)
    PerformanceTagItem(
      id: 'manos_manteca',
      name: 'Manos de Manteca',
      description: 'Se le escapó una pelota fácil. Tuvo que correr a recuperar posición.',
      impact: 'negative',
      positions: ['POR'],
      effects: {'def': -3, 'pac': 1},
    ),
    PerformanceTagItem(
      id: 'rebote_peligroso',
      name: 'Rebote al Medio',
      description: 'Dejó un rebote peligroso en el área. Mala decisión pero al menos intentó algo.',
      impact: 'negative',
      positions: ['POR'],
      effects: {'def': -2, 'pac': -1, 'pas': 1},
    ),

    // DEF (4)
    PerformanceTagItem(
      id: 'salio_tarde',
      name: 'Salió con el Diario',
      description: 'Midió mal el cruce y quedó pagando. Al menos comunica bien la defensa.',
      impact: 'negative',
      positions: ['DEF'],
      effects: {'def': -3, 'pas': 1},
    ),
    PerformanceTagItem(
      id: 'se_comio_amague',
      name: 'Se Comió el Amague',
      description: 'El delantero lo dejó parado con una finta. Lección aprendida: ya sabe gambetear.',
      impact: 'negative',
      positions: ['DEF'],
      effects: {'def': -2, 'pac': -2, 'dri': 1},
    ),
    PerformanceTagItem(
      id: 'perdio_marca',
      name: 'Perdió la Marca',
      description: 'Se le escapó su marca en una jugada clave. Se proyectó mal pensando en atacar.',
      impact: 'negative',
      positions: ['DEF'],
      effects: {'def': -2, 'pac': -1, 'sho': 1},
    ),
    PerformanceTagItem(
      id: 'falta_innecesaria',
      name: 'Llegó a Destiempo',
      description: 'Hizo una falta innecesaria en zona peligrosa. Fue agresivo pero con mal timing.',
      impact: 'negative',
      positions: ['DEF'],
      effects: {'def': -1, 'phy': -2, 'pac': 1},
    ),

    // MED (4)
    PerformanceTagItem(
      id: 'pase_al_rival',
      name: 'Pase al Rival',
      description: 'Dio un pase comprometido que generó un contraataque. Error garrafal pero fue activo.',
      impact: 'negative',
      positions: ['MED'],
      effects: {'pas': -3, 'def': -1, 'phy': 1},
    ),
    PerformanceTagItem(
      id: 'se_enamoro_pelota',
      name: 'Se Enamoró de la Pelota',
      description: 'Quiso gambetear a todos y la perdió. Al menos corrió a recuperarla.',
      impact: 'negative',
      positions: ['MED'],
      effects: {'dri': -2, 'pas': -2, 'pac': 1},
    ),
    PerformanceTagItem(
      id: 'abuso_pelotazo',
      name: 'Abusó del Pelotazo',
      description: 'Reventó la pelota para arriba sin ideas. Sin criterio pero activo físicamente.',
      impact: 'negative',
      positions: ['MED'],
      effects: {'pas': -2, 'sho': -1, 'phy': 1},
    ),
    PerformanceTagItem(
      id: 'desconectado',
      name: 'Espectador de Lujo',
      description: 'No participó, estuvo desconectado del juego. Al menos mantuvo la posición.',
      impact: 'negative',
      positions: ['MED'],
      effects: {'pac': -2, 'phy': -2, 'def': 1},
    ),

    // DEL (4)
    PerformanceTagItem(
      id: 'se_comio_elefante',
      name: 'Se Comió un Elefante',
      description: 'Le erró a un gol hecho. La frustración al menos lo hizo correr más.',
      impact: 'negative',
      positions: ['DEL'],
      effects: {'sho': -3, 'pac': 1},
    ),
    PerformanceTagItem(
      id: 'lento_definiendo',
      name: 'Más Lento que un Desfile',
      description: 'Se demoró en definir y le robaron la pelota. Sin velocidad pero batalló con el físico.',
      impact: 'negative',
      positions: ['DEL'],
      effects: {'pac': -2, 'sho': -1, 'phy': 1},
    ),
    PerformanceTagItem(
      id: 'sin_presion_arriba',
      name: 'No Presionó Arriba',
      description: 'Dejó salir cómodo al rival sin presionar. Se quedó fresco para atacar.',
      impact: 'negative',
      positions: ['DEL'],
      effects: {'def': -2, 'pac': -1, 'sho': 1},
    ),
    PerformanceTagItem(
      id: 'decision_mal',
      name: 'Decidió Mal',
      description: 'Eligió pegarle sin ángulo cuando tenía un compañero solo. Al menos intentó algo propio.',
      impact: 'negative',
      positions: ['DEL'],
      effects: {'sho': -2, 'pas': -1, 'dri': 1},
    ),

    // ALL (2)
    PerformanceTagItem(
      id: 'se_escondio',
      name: 'Se Escondió del Juego',
      description: 'No se mostró como opción, caminó la cancha. Al menos estuvo en posición.',
      impact: 'negative',
      positions: ['ALL'],
      effects: {'phy': -2, 'pac': -1, 'def': 1},
    ),
    PerformanceTagItem(
      id: 'control_cemento',
      name: 'Control de Cemento',
      description: 'No pudo parar una pelota fácil. Al menos lo intentó con actitud física.',
      impact: 'negative',
      positions: ['ALL'],
      effects: {'dri': -2, 'pac': -1, 'phy': 1},
    ),
  ];

  static List<PerformanceTagItem> getTagsForPosition(String position) {
    return allTags.where((t) => t.positions.contains('ALL') || t.positions.contains(position.toUpperCase())).toList();
  }
}
