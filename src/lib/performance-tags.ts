
export type TagEffect = {
    attribute: 'pac' | 'sho' | 'pas' | 'dri' | 'def' | 'phy';
    change: number;
};

export type PerformanceTag = {
    id: string;
    name: string;
    description: string;
    effects: TagEffect[];
    impact: 'positive' | 'negative' | 'neutral';
    positions: ('DEL' | 'MED' | 'DEF' | 'POR' | 'ALL')[];
};

export const performanceTagsDb: PerformanceTag[] = [
    // --- POSITIVE TAGS ---

    // GOALKEEPING
    {
        id: 'atajadon_espectacular',
        name: 'El Pulpo',
        description: 'Atajadón espectacular que salvó al equipo en un mano a mano o remate a quemarropa.',
        effects: [{ attribute: 'def', change: 3 }],
        impact: 'positive',
        positions: ['POR']
    },
    {
        id: 'achique_valiente',
        name: 'Achique Valiente',
        description: 'Salió a cortar rápido y bien ante el delantero, ganando el duelo.',
        effects: [{ attribute: 'pac', change: 2 }, { attribute: 'def', change: 1 }],
        impact: 'positive',
        positions: ['POR']
    },
    {
        id: 'seguridad_de_arcos',
        name: 'Dueño del Área',
        description: 'Mostró gran seguridad en los centros, descolgando todas las pelotas.',
        effects: [{ attribute: 'phy', change: 2 }, { attribute: 'def', change: 1 }],
        impact: 'positive',
        positions: ['POR']
    },
    {
        id: 'saque_rapido',
        name: 'Saque de Mariscal',
        description: 'Inició un contraataque letal con un saque largo y preciso con la mano o el pie.',
        effects: [{ attribute: 'pas', change: 2 }],
        impact: 'positive',
        positions: ['POR']
    },

    // DEFENDING
    {
        id: 'cierre_providencial',
        name: 'Cierre Providencial',
        description: 'Llegó con lo justo para barrer y evitar un gol cantado.',
        effects: [{ attribute: 'def', change: 3 }, { attribute: 'pac', change: 1 }],
        impact: 'positive',
        positions: ['DEF', 'MED']
    },
    {
        id: 'impasable_mano_a_mano',
        name: 'Un Muro',
        description: 'Ganó todos los duelos individuales, impasable en el mano a mano.',
        effects: [{ attribute: 'def', change: 3 }],
        impact: 'positive',
        positions: ['DEF']
    },
    {
        id: 'ladron_guante_blanco',
        name: 'Ladrón de Guante Blanco',
        description: 'Recuperó la pelota con un quite limpio, elegante y sin falta.',
        effects: [{ attribute: 'def', change: 2 }, { attribute: 'dri', change: -1 }],
        impact: 'positive',
        positions: ['DEF', 'MED']
    },
    {
        id: 'patron_de_la_defensa',
        name: 'El Patrón',
        description: 'Ordenó la defensa, marcó los tiempos y anticipó las jugadas del rival.',
        effects: [{ attribute: 'def', change: 2 }, { attribute: 'pas', change: 1 }],
        impact: 'positive',
        positions: ['DEF']
    },
    {
        id: 'impune_por_arriba',
        name: 'Impune por Arriba',
        description: 'Ganó todas de cabeza, tanto en defensa como en ataque.',
        effects: [{ attribute: 'def', change: 2 }, { attribute: 'phy', change: 1 }],
        impact: 'positive',
        positions: ['DEF', 'MED']
    },
    {
        id: 'cobertura_perfecta',
        name: 'El Bombero',
        description: 'Siempre estuvo atento para cubrir las espaldas de un compañero.',
        effects: [{ attribute: 'def', change: 2 }, { attribute: 'pac', change: 1 }],
        impact: 'positive',
        positions: ['DEF', 'MED']
    },

    // MIDFIELD & PASSING
    {
        id: 'pase_quirurgico',
        name: 'Pase Quirúrgico',
        description: 'Metió un pase filtrado que dejó a un compañero solo frente al arco.',
        effects: [{ attribute: 'pas', change: 3 }, { attribute: 'dri', change: 1 }],
        impact: 'positive',
        positions: ['MED', 'DEL']
    },
    {
        id: 'titiritero',
        name: 'El Titiritero',
        description: 'Manejó los hilos del mediocampo, todas las pelotas pasaron por él.',
        effects: [{ attribute: 'pas', change: 2 }, { attribute: 'dri', change: 1 }],
        impact: 'positive',
        positions: ['MED']
    },
    {
        id: 'pausa_y_vision',
        name: 'La Pisó y Pensó',
        description: 'Hizo la pausa justa, levantó la cabeza y eligió la mejor opción.',
        effects: [{ attribute: 'pas', change: 2 }],
        impact: 'positive',
        positions: ['MED', 'DEF']
    },
    {
        id: 'tractorcito',
        name: 'Un Tractorcito',
        description: 'Aguantó la pelota de espaldas, usando el cuerpo para protegerla.',
        effects: [{ attribute: 'phy', change: 3 }, { attribute: 'dri', change: 1 }],
        impact: 'positive',
        positions: ['DEL', 'MED']
    },
    {
        id: 'cambio_de_frente',
        name: 'Cambio de Frente Magistral',
        description: 'Abrió la cancha con un pase largo y preciso de lado a lado.',
        effects: [{ attribute: 'pas', change: 2 }],
        impact: 'positive',
        positions: ['MED', 'DEF']
    },
    {
        id: 'recuperacion_y_salida',
        name: 'Recuperación y Salida',
        description: 'Robó una pelota clave y empezó el ataque con un buen pase.',
        effects: [{ attribute: 'def', change: 1 }, { attribute: 'pas', change: 1 }],
        impact: 'positive',
        positions: ['MED', 'DEF']
    },

    // ATTACKING & DRIBBLING
    {
        id: 'la_colgo_del_angulo',
        name: 'La Colgó del Ángulo',
        description: 'Remate perfecto, al ángulo, inatajable para el arquero.',
        effects: [{ attribute: 'sho', change: 3 }, { attribute: 'dri', change: 1 }],
        impact: 'positive',
        positions: ['DEL', 'MED']
    },
    {
        id: 'gambeta_endiablada',
        name: 'Gambeta Endiablada',
        description: 'Se sacó a dos o más rivales de encima con habilidad pura.',
        effects: [{ attribute: 'dri', change: 3 }, { attribute: 'pac', change: 1 }],
        impact: 'positive',
        positions: ['DEL', 'MED']
    },
    {
        id: 'definio_como_dioses',
        name: 'Definió como los Dioses',
        description: 'Le quedó una y la mandó a guardar con clase y frialdad.',
        effects: [{ attribute: 'sho', change: 3 }],
        impact: 'positive',
        positions: ['DEL']
    },
    {
        id: 'terror_del_area',
        name: 'El Terror del Área',
        description: 'Se movió por todo el frente de ataque, generando peligro constante.',
        effects: [{ attribute: 'dri', change: 2 }, { attribute: 'sho', change: 1 }],
        impact: 'positive',
        positions: ['DEL']
    },
    {
        id: 'asistidor_serial',
        name: 'Asistidor Serial',
        description: 'No hizo el gol, pero puso una pelota de gol increíble a un compañero.',
        effects: [{ attribute: 'pas', change: 3 }],
        impact: 'positive',
        positions: ['DEL', 'MED']
    },
    {
        id: 'pura_potencia',
        name: 'Pura Potencia',
        description: 'Sacó un bombazo de afuera del área que casi rompe el arco.',
        effects: [{ attribute: 'sho', change: 2 }, { attribute: 'phy', change: 1 }],
        impact: 'positive',
        positions: ['ALL']
    },
    {
        id: 'cano_de_lujo',
        name: 'Tiró un Caño',
        description: 'Le tiró un caño humillante y productivo a un rival.',
        effects: [{ attribute: 'dri', change: 2 }],
        impact: 'positive',
        positions: ['ALL']
    },

    // GENERAL / ATTITUDE
    {
        id: 'correcaminos',
        name: 'Correcaminos',
        description: 'Corrió por toda la cancha los 90 minutos, un pulmón extra.',
        effects: [{ attribute: 'pac', change: 2 }, { attribute: 'phy', change: 2 }],
        impact: 'positive',
        positions: ['ALL']
    },
    {
        id: 'garra_charrua',
        name: 'Corazón y Garra',
        description: 'No dio una pelota por perdida, puro huevo y sacrificio por el equipo.',
        effects: [{ attribute: 'phy', change: 3 }],
        impact: 'positive',
        positions: ['ALL']
    },
    {
        id: 'equipo_al_hombro',
        name: 'Se Puso el Equipo al Hombro',
        description: 'Apareció en los momentos difíciles y levantó el nivel de todos.',
        effects: [{ attribute: 'phy', change: 1 }, { attribute: 'pas', change: 1 }, { attribute: 'sho', change: 1 }],
        impact: 'positive',
        positions: ['ALL']
    },
    {
        id: 'cumplidor_tactico',
        name: 'Cumplidor Táctico',
        description: 'Hizo exactamente lo que el equipo necesitaba, sin lujos pero efectivo.',
        effects: [{ attribute: 'pas', change: 1 }, { attribute: 'def', change: 1 }],
        impact: 'positive',
        positions: ['ALL']
    },

    // --- NEGATIVE TAGS ---

    // GOALKEEPING
    {
        id: 'manos_de_manteca',
        name: 'Manos de Manteca',
        description: 'Se le escapó una pelota fácil que terminó en gol o peligro.',
        effects: [{ attribute: 'def', change: -3 }],
        impact: 'negative',
        positions: ['POR']
    },
    {
        id: 'estatua_de_sal',
        name: 'Estatua de Sal',
        description: 'No salió a cortar un centro o a achicar en un mano a mano.',
        effects: [{ attribute: 'def', change: -2 }, { attribute: 'pac', change: -1 }],
        impact: 'negative',
        positions: ['POR']
    },
    {
        id: 'rebote_al_medio',
        name: 'Dio Rebote al Medio',
        description: 'Dejó un rebote peligroso en el medio del área.',
        effects: [{ attribute: 'def', change: -2 }],
        impact: 'negative',
        positions: ['POR']
    },

    // DEFENDING
    {
        id: 'salio_con_el_diario',
        name: 'Salió con el Diario',
        description: 'Midió mal el cruce, salió a destiempo y quedó pagando en una jugada.',
        effects: [{ attribute: 'def', change: -3 }, { attribute: 'pac', change: -1 }],
        impact: 'negative',
        positions: ['DEF']
    },
    {
        id: 'se_comio_el_amague',
        name: 'Se Comió el Amague',
        description: 'El delantero lo dejó parado con una finta simple.',
        effects: [{ attribute: 'def', change: -2 }, { attribute: 'pac', change: -1 }],
        impact: 'negative',
        positions: ['DEF']
    },
    {
        id: 'perdio_la_marca',
        name: 'Perdió la Marca',
        description: 'Se le escapó su marca en una jugada clave que terminó en peligro.',
        effects: [{ attribute: 'def', change: -2 }],
        impact: 'negative',
        positions: ['DEF']
    },
    {
        id: 'falta_innecesaria',
        name: 'Llegó a Destiempo',
        description: 'Hizo una falta innecesaria en una zona peligrosa.',
        effects: [{ attribute: 'def', change: -1 }, { attribute: 'phy', change: -1 }],
        impact: 'negative',
        positions: ['DEF', 'MED']
    },
    {
        id: 'regalo_un_corner',
        name: 'Regaló un Córner',
        description: 'La sacó mal por el fondo cuando podía controlarla.',
        effects: [{ attribute: 'def', change: -1 }],
        impact: 'negative',
        positions: ['DEF', 'POR']
    },

    // MIDFIELD & PASSING
    {
        id: 'pase_al_rival',
        name: 'Pase al Rival',
        description: 'Dio un pase comprometido que generó un contraataque peligroso.',
        effects: [{ attribute: 'pas', change: -3 }],
        impact: 'negative',
        positions: ['MED', 'DEF']
    },
    {
        id: 'se_enamoro_de_la_pelota',
        name: 'Se Enamoró de la Pelota',
        description: 'Quiso gambetear a todos en vez de pasarla y la terminó perdiendo.',
        effects: [{ attribute: 'dri', change: -2 }, { attribute: 'pas', change: -1 }],
        impact: 'negative',
        positions: ['MED', 'DEL']
    },
    {
        id: 'abuso_del_pelotazo',
        name: 'Abusó del Pelotazo',
        description: 'Reventó la pelota para arriba sin buscar un compañero.',
        effects: [{ attribute: 'pas', change: -2 }],
        impact: 'negative',
        positions: ['DEF', 'MED']
    },
    {
        id: 'control_de_cemento',
        name: 'Control de Cemento',
        description: 'No pudo parar una pelota fácil y se le fue larga.',
        effects: [{ attribute: 'dri', change: -2 }],
        impact: 'negative',
        positions: ['ALL']
    },
    {
        id: 'la_perdio_en_salida',
        name: 'La Perdió en Salida',
        description: 'Cometió un error no forzado saliendo desde el fondo con la pelota.',
        effects: [{ attribute: 'pas', change: -1 }, { attribute: 'def', change: -1 }],
        impact: 'negative',
        positions: ['DEF', 'MED']
    },

    // ATTACKING & DRIBBLING
    {
        id: 'se_comio_un_elefante',
        name: 'Se Comió un Elefante',
        description: 'Le erró a un gol hecho, abajo del arco o sin arquero.',
        effects: [{ attribute: 'sho', change: -3 }],
        impact: 'negative',
        positions: ['DEL', 'MED']
    },
    {
        id: 'la_mando_a_la_tribuna',
        name: 'La Mandó a la Tribuna',
        description: 'Le pegó horrible al arco y la pelota terminó en cualquier lado.',
        effects: [{ attribute: 'sho', change: -2 }],
        impact: 'negative',
        positions: ['ALL']
    },
    {
        id: 'lento_para_definir',
        name: 'Más Lento que un Desfile',
        description: 'Se demoró una vida en definir y le robaron la pelota.',
        effects: [{ attribute: 'pac', change: -1 }, { attribute: 'sho', change: -1 }],
        impact: 'negative',
        positions: ['DEL']
    },
    {
        id: 'decision_incorrecta',
        name: 'Decidió Mal',
        description: 'Tenía un compañero solo para pasarla pero eligió pegarle al arco sin ángulo.',
        effects: [{ attribute: 'pas', change: -1 }, { attribute: 'sho', change: -1 }],
        impact: 'negative',
        positions: ['DEL', 'MED']
    },
    {
        id: 'centro_a_nadie',
        name: 'Centro a Nadie',
        description: 'Tiró un centro sin mirar y no había ningún compañero en el área.',
        effects: [{ attribute: 'pas', change: -2 }],
        impact: 'negative',
        positions: ['MED', 'DEF']
    },

    // GENERAL / ATTITUDE
    {
        id: 'se_canso',
        name: 'Se Acalambró a los 10',
        description: 'No tuvo resto físico para aguantar el ritmo del partido.',
        effects: [{ attribute: 'phy', change: -3 }],
        impact: 'negative',
        positions: ['ALL']
    },
    {
        id: 'proteston',
        name: 'Protestó Todo',
        description: 'Se dedicó más a discutir con el juez o los rivales que a jugar.',
        effects: [{ attribute: 'phy', change: -1 }],
        impact: 'negative',
        positions: ['ALL']
    },
    {
        id: 'se_escondio',
        name: 'Se Escondió del Juego',
        description: 'No se mostró como opción de pase, caminó la cancha.',
        effects: [{ attribute: 'phy', change: -1 }, { attribute: 'pac', change: -1 }],
        impact: 'negative',
        positions: ['ALL']
    },
    {
        id: 'miro_el_partido_de_adentro',
        name: 'Espectador de Lujo',
        description: 'No participó, estuvo desconectado y no influyó en el juego.',
        effects: [{ attribute: 'pac', change: -1 }, { attribute: 'phy', change: -2 }],
        impact: 'negative',
        positions: ['ALL']
    }
];
