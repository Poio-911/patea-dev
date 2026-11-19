/// Catálogo móvil: 42 etiquetas limpias (23 positivas y 19 negativas).
/// Las etiquetas positivas solo suman atributos y las negativas solo restan.
/// Coincide 1:1 con `functions/src/lib/performance-tags.ts`.
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

    // POR (8)
    PerformanceTagItem(
      id: 'el_pulpo',
      name: 'El Pulpo',
      description: 'Atajadón espectacular que salvó al equipo en un mano a mano.',
      impact: 'positive',
      positions: ['POR'],
      effects: {'def': 3, 'pac': 1},
    ),
    PerformanceTagItem(
      id: 'reflejos_felinos',
      name: 'Reflejos Felinos',
      description: 'Reacción felina a quemarropa en una fracción de segundo.',
      impact: 'positive',
      positions: ['POR'],
      effects: {'dri': 3, 'def': 1},
    ),
    PerformanceTagItem(
      id: 'achique_dominante',
      name: 'Achique Dominante',
      description: 'Salió rápido y ganó el duelo mano a mano ante el delantero.',
      impact: 'positive',
      positions: ['POR'],
      effects: {'pac': 2, 'def': 2},
    ),
    PerformanceTagItem(
      id: 'dueno_del_aire',
      name: 'Dueño del Aire',
      description: 'Descolgó centros y córners con total autoridad.',
      impact: 'positive',
      positions: ['POR'],
      effects: {'phy': 3, 'def': 1},
    ),
    PerformanceTagItem(
      id: 'distribucion_clave',
      name: 'Saque de Mariscal',
      description: 'Inició el ataque con un saque largo y preciso desde el fondo.',
      impact: 'positive',
      positions: ['POR'],
      effects: {'pas': 3, 'pac': 1},
    ),
    PerformanceTagItem(
      id: 'atajapenales',
      name: 'El Especialista',
      description: 'Adivinó la intención y atajó un remate decisivo.',
      impact: 'positive',
      positions: ['POR'],
      effects: {'def': 3, 'phy': 1},
    ),
    PerformanceTagItem(
      id: 'valla_invicta',
      name: 'Candado Puesto',
      description: 'Mantuvo el arco seguro con solvencia y máxima concentración.',
      impact: 'positive',
      positions: ['POR'],
      effects: {'def': 2, 'phy': 2},
    ),
    PerformanceTagItem(
      id: 'lider_del_fondo',
      name: 'Voz de Mando',
      description: 'Ordenó a la defensa en cada pelota parada y transmitió calma.',
      impact: 'positive',
      positions: ['POR'],
      effects: {'phy': 2, 'pas': 2},
    ),

    // DEF (4)
    PerformanceTagItem(
      id: 'muro_defensivo',
      name: 'Un Muro',
      description: 'Ganó todos los duelos individuales; impasable en su zona.',
      impact: 'positive',
      positions: ['DEF'],
      effects: {'def': 3, 'pac': 1},
    ),
    PerformanceTagItem(
      id: 'cierre_providencial',
      name: 'Cierre Providencial',
      description: 'Llegó con lo justo para barrer y evitar un gol cantado.',
      impact: 'positive',
      positions: ['DEF'],
      effects: {'def': 3, 'pac': 1},
    ),
    PerformanceTagItem(
      id: 'orden_defensivo',
      name: 'El Patrón',
      description: 'Ordenó la defensa, marcó los tiempos y anticipó jugadas.',
      impact: 'positive',
      positions: ['DEF'],
      effects: {'def': 2, 'pas': 2},
    ),
    PerformanceTagItem(
      id: 'cobertura_oportuna',
      name: 'El Bombero',
      description: 'Siempre atento para cubrir las espaldas de un compañero.',
      impact: 'positive',
      positions: ['DEF'],
      effects: {'def': 2, 'pac': 1},
    ),

    // MED (4)
    PerformanceTagItem(
      id: 'titiritero',
      name: 'El Titiritero',
      description: 'Manejó los hilos del mediocampo, todas las pelotas pasaron por él.',
      impact: 'positive',
      positions: ['MED'],
      effects: {'pas': 2, 'dri': 1},
    ),
    PerformanceTagItem(
      id: 'pase_filtrado',
      name: 'Pase Quirúrgico',
      description: 'Metió un pase filtrado que dejó a un compañero solo frente al arco.',
      impact: 'positive',
      positions: ['MED'],
      effects: {'pas': 3, 'dri': 1},
    ),
    PerformanceTagItem(
      id: 'recuperador',
      name: 'Recuperación y Salida',
      description: 'Robó la pelota limpio y empezó el ataque con criterio.',
      impact: 'positive',
      positions: ['MED'],
      effects: {'def': 2, 'pas': 1},
    ),
    PerformanceTagItem(
      id: 'cambio_frente',
      name: 'Cambio de Frente',
      description: 'Abrió la cancha con un pase largo y preciso de lado a lado.',
      impact: 'positive',
      positions: ['MED'],
      effects: {'pas': 2, 'phy': 1},
    ),

    // DEL (4)
    PerformanceTagItem(
      id: 'goleador_nato',
      name: 'Definió como los Dioses',
      description: 'Le quedó una y la mandó a guardar con clase y frialdad.',
      impact: 'positive',
      positions: ['DEL'],
      effects: {'sho': 3, 'dri': 1},
    ),
    PerformanceTagItem(
      id: 'endiablado',
      name: 'Gambeta Endiablada',
      description: 'Se sacó a dos o más rivales de encima con habilidad pura.',
      impact: 'positive',
      positions: ['DEL'],
      effects: {'dri': 3, 'pac': 1},
    ),
    PerformanceTagItem(
      id: 'terror_area',
      name: 'El Terror del Área',
      description: 'Se movió por todo el frente de ataque generando peligro constante.',
      impact: 'positive',
      positions: ['DEL'],
      effects: {'dri': 2, 'sho': 1},
    ),
    PerformanceTagItem(
      id: 'asistidor',
      name: 'Asistidor Serial',
      description: 'Puso pelotas de gol increíbles para sus compañeros.',
      impact: 'positive',
      positions: ['DEL'],
      effects: {'pas': 3, 'dri': 1},
    ),

    // ALL (3)
    PerformanceTagItem(
      id: 'garra_charrua',
      name: 'Corazón y Garra',
      description: 'No dio una pelota por perdida, puro huevo y sacrificio por el equipo.',
      impact: 'positive',
      positions: ['ALL'],
      effects: {'phy': 3},
    ),
    PerformanceTagItem(
      id: 'correcaminos',
      name: 'Correcaminos',
      description: 'Corrió por toda la cancha todo el partido; un pulmón extra.',
      impact: 'positive',
      positions: ['ALL'],
      effects: {'pac': 2, 'phy': 2},
    ),
    PerformanceTagItem(
      id: 'equipo_hombro',
      name: 'Se Puso el Equipo al Hombro',
      description: 'Apareció en los momentos difíciles y levantó el nivel de todos.',
      impact: 'positive',
      positions: ['ALL'],
      effects: {'phy': 2, 'pas': 1},
    ),

    // --- NEGATIVOS ---

    // POR (5)
    PerformanceTagItem(
      id: 'manos_manteca',
      name: 'Manos de Manteca',
      description: 'Se le escapó una pelota accesible que generó peligro.',
      impact: 'negative',
      positions: ['POR'],
      effects: {'def': -3},
    ),
    PerformanceTagItem(
      id: 'rebote_peligroso',
      name: 'Rebote al Medio',
      description: 'Dejó un rebote peligroso en el corazón del área.',
      impact: 'negative',
      positions: ['POR'],
      effects: {'def': -2, 'pac': -1},
    ),
    PerformanceTagItem(
      id: 'salio_en_falso',
      name: 'Cazó Mariposas',
      description: 'Salió a destiempo en un centro y quedó a mitad de camino.',
      impact: 'negative',
      positions: ['POR'],
      effects: {'phy': -3, 'def': -1},
    ),
    PerformanceTagItem(
      id: 'estatua',
      name: 'Quedó Atornillado',
      description: 'Tardó en reaccionar ante un disparo lejano.',
      impact: 'negative',
      positions: ['POR'],
      effects: {'dri': -3, 'def': -1},
    ),
    PerformanceTagItem(
      id: 'saque_descalibrado',
      name: 'Saque al Lateral',
      description: 'Regaló salidas claras por imprecisión desde el fondo.',
      impact: 'negative',
      positions: ['POR'],
      effects: {'pas': -3, 'sho': -1},
    ),

    // DEF (4)
    PerformanceTagItem(
      id: 'salio_tarde',
      name: 'Salió con el Diario',
      description: 'Midió mal el cruce, salió a destiempo y quedó pagando.',
      impact: 'negative',
      positions: ['DEF'],
      effects: {'def': -3, 'pac': -1},
    ),
    PerformanceTagItem(
      id: 'se_comio_amague',
      name: 'Se Comió el Amague',
      description: 'El delantero lo dejó parado con una finta simple.',
      impact: 'negative',
      positions: ['DEF'],
      effects: {'def': -2, 'pac': -2},
    ),
    PerformanceTagItem(
      id: 'perdio_marca',
      name: 'Perdió la Marca',
      description: 'Se le escapó su marca en una jugada clave.',
      impact: 'negative',
      positions: ['DEF'],
      effects: {'def': -2, 'pac': -1},
    ),
    PerformanceTagItem(
      id: 'falta_innecesaria',
      name: 'Llegó a Destiempo',
      description: 'Hizo una falta innecesaria en una zona peligrosa.',
      impact: 'negative',
      positions: ['DEF'],
      effects: {'def': -1, 'phy': -1},
    ),

    // MED (4)
    PerformanceTagItem(
      id: 'pase_al_rival',
      name: 'Pase al Rival',
      description: 'Dio un pase comprometido que generó un contraataque peligroso.',
      impact: 'negative',
      positions: ['MED'],
      effects: {'pas': -3},
    ),
    PerformanceTagItem(
      id: 'se_enamoro_pelota',
      name: 'Se Enamoró de la Pelota',
      description: 'Quiso gambetear a todos en vez de pasarla y la perdió.',
      impact: 'negative',
      positions: ['MED'],
      effects: {'dri': -2, 'pas': -2},
    ),
    PerformanceTagItem(
      id: 'abuso_pelotazo',
      name: 'Abusó del Pelotazo',
      description: 'Reventó la pelota para arriba sin buscar un compañero.',
      impact: 'negative',
      positions: ['MED'],
      effects: {'pas': -2, 'sho': -1},
    ),
    PerformanceTagItem(
      id: 'desconectado',
      name: 'Espectador de Lujo',
      description: 'No participó; estuvo desconectado del ritmo del juego.',
      impact: 'negative',
      positions: ['MED'],
      effects: {'pac': -2, 'phy': -2},
    ),

    // DEL (4)
    PerformanceTagItem(
      id: 'se_comio_elefante',
      name: 'Se Comió un Elefante',
      description: 'Le erró a un gol hecho, abajo del arco.',
      impact: 'negative',
      positions: ['DEL'],
      effects: {'sho': -3},
    ),
    PerformanceTagItem(
      id: 'lento_definiendo',
      name: 'Más Lento que un Desfile',
      description: 'Se demoró una vida en definir y le robaron la pelota.',
      impact: 'negative',
      positions: ['DEL'],
      effects: {'pac': -2, 'sho': -1},
    ),
    PerformanceTagItem(
      id: 'sin_presion_arriba',
      name: 'No Presionó Arriba',
      description: 'Dejó salir cómodo al rival sin presionar la salida.',
      impact: 'negative',
      positions: ['DEL'],
      effects: {'def': -2, 'pac': -1},
    ),
    PerformanceTagItem(
      id: 'decision_mal',
      name: 'Decidió Mal',
      description: 'Eligió pegarle sin ángulo cuando tenía un compañero solo.',
      impact: 'negative',
      positions: ['DEL'],
      effects: {'sho': -2, 'pas': -1},
    ),

    // ALL (2)
    PerformanceTagItem(
      id: 'se_escondio',
      name: 'Se Escondió del Juego',
      description: 'No se mostró como opción de pase, caminó la cancha.',
      impact: 'negative',
      positions: ['ALL'],
      effects: {'phy': -1, 'pac': -1},
    ),
    PerformanceTagItem(
      id: 'control_cemento',
      name: 'Control de Cemento',
      description: 'No pudo parar una pelota fácil y se le fue larga.',
      impact: 'negative',
      positions: ['ALL'],
      effects: {'dri': -2, 'pac': -1},
    ),
  ];

  static List<PerformanceTagItem> getTagsForPosition(String position) {
    return allTags
        .where(
          (t) =>
              t.positions.contains('ALL') ||
              t.positions.contains(position.toUpperCase()),
        )
        .toList();
  }
}
