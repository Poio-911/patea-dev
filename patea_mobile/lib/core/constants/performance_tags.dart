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
    // POSITIVOS - POR
    PerformanceTagItem(
      id: 'el_pulpo',
      name: 'El Pulpo',
      description: 'Atajadón espectacular que salvó al equipo.',
      impact: 'positive',
      positions: ['POR'],
      effects: {'def': 3, 'pac': 1, 'phy': -1},
    ),
    PerformanceTagItem(
      id: 'achique_dominante',
      name: 'Achique Dominante',
      description: 'Salió rápido y ganó el mano a mano ante el delantero.',
      impact: 'positive',
      positions: ['POR'],
      effects: {'pac': 2, 'def': 2, 'dri': -1},
    ),

    // POSITIVOS - DEF
    PerformanceTagItem(
      id: 'muro_defensivo',
      name: 'Un Muro',
      description: 'Ganó todos los duelos individuales. Impasable en su zona.',
      impact: 'positive',
      positions: ['DEF'],
      effects: {'def': 3, 'pac': 1, 'sho': -1},
    ),
    PerformanceTagItem(
      id: 'cierre_providencial',
      name: 'Cierre Providencial',
      description: 'Llegó con lo justo para barrer y evitar un gol cantado.',
      impact: 'positive',
      positions: ['DEF'],
      effects: {'def': 2, 'pac': 2, 'dri': -1},
    ),

    // POSITIVOS - MED
    PerformanceTagItem(
      id: 'titiritero',
      name: 'El Titiritero',
      description: 'Manejó los hilos y el ritmo del partido.',
      impact: 'positive',
      positions: ['MED'],
      effects: {'pas': 2, 'dri': 2, 'def': -1},
    ),
    PerformanceTagItem(
      id: 'pase_filtrado',
      name: 'Pase Quirúrgico',
      description: 'Metió una asistencia perfecta dejando solo al delantero.',
      impact: 'positive',
      positions: ['MED'],
      effects: {'pas': 3, 'dri': 1, 'def': -1},
    ),

    // POSITIVOS - DEL
    PerformanceTagItem(
      id: 'goleador_nato',
      name: 'Definió como los Dioses',
      description: 'Resolvió jugadas difíciles y metió goles claves.',
      impact: 'positive',
      positions: ['DEL'],
      effects: {'sho': 3, 'dri': 1, 'def': -1},
    ),
    PerformanceTagItem(
      id: 'gambeta_endiablada',
      name: 'Gambeta Endiablada',
      description: 'Dejó a los rivales pagando en el uno contra uno.',
      impact: 'positive',
      positions: ['DEL'],
      effects: {'dri': 3, 'pac': 1, 'pas': -1},
    ),

    // POSITIVOS - GENERALES
    PerformanceTagItem(
      id: 'correcaminos',
      name: 'Correcaminos',
      description: 'Velocidad pura y despliegue físico por toda la cancha.',
      impact: 'positive',
      positions: ['ALL', 'DEL', 'MED', 'DEF', 'POR'],
      effects: {'pac': 3, 'phy': 2},
    ),
    PerformanceTagItem(
      id: 'puro_corazon',
      name: 'Corazón y Garra',
      description: 'No dio ninguna pelota por perdida. Puro empuje.',
      impact: 'positive',
      positions: ['ALL', 'DEL', 'MED', 'DEF', 'POR'],
      effects: {'phy': 3, 'def': 1},
    ),

    // NEGATIVOS
    PerformanceTagItem(
      id: 'manos_manteca',
      name: 'Manos de Manteca',
      description: 'Se le escapó una pelota fácil que costó caro.',
      impact: 'negative',
      positions: ['POR'],
      effects: {'def': -3, 'phy': -1},
    ),
    PerformanceTagItem(
      id: 'perdio_marca',
      name: 'Perdió la Marca',
      description: 'Se durmió en la cobertura y dejó libre al atacante.',
      impact: 'negative',
      positions: ['DEF'],
      effects: {'def': -3, 'pac': -1},
    ),
    PerformanceTagItem(
      id: 'pase_al_rival',
      name: 'Pase al Rival',
      description: 'Regaló pelotas en salida que generaron peligro.',
      impact: 'negative',
      positions: ['MED'],
      effects: {'pas': -3, 'dri': -1},
    ),
    PerformanceTagItem(
      id: 'se_comio_elefante',
      name: 'Se Comió un Elefante',
      description: 'Desperdició goles insólitos abajo del arco.',
      impact: 'negative',
      positions: ['DEL'],
      effects: {'sho': -3, 'pac': -1},
    ),
  ];

  static List<PerformanceTagItem> getTagsForPosition(String position) {
    return allTags.where((t) => t.positions.contains('ALL') || t.positions.contains(position.toUpperCase())).toList();
  }
}
