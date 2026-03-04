
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

    // POR (3)
    {
        id: 'el_pulpo',
        name: 'El Pulpo',
        description: 'Atajadón espectacular que salvó al equipo. El esfuerzo explosivo lo dejó a media máquina.',
        effects: [{ attribute: 'def', change: 3 }, { attribute: 'pac', change: 1 }, { attribute: 'phy', change: -1 }],
        impact: 'positive',
        positions: ['POR']
    },
    {
        id: 'achique_dominante',
        name: 'Achique Dominante',
        description: 'Salió rápido y ganó el duelo ante el delantero. Arriesgar la posición tuvo su costo.',
        effects: [{ attribute: 'pac', change: 2 }, { attribute: 'def', change: 2 }, { attribute: 'dri', change: -1 }],
        impact: 'positive',
        positions: ['POR']
    },
    {
        id: 'distribucion_clave',
        name: 'Saque de Mariscal',
        description: 'Inició el ataque con un saque largo y preciso. Arriesgó al distribuir desde el fondo.',
        effects: [{ attribute: 'pas', change: 2 }, { attribute: 'pac', change: 1 }, { attribute: 'def', change: -1 }],
        impact: 'positive',
        positions: ['POR']
    },

    // DEF (4)
    {
        id: 'muro_defensivo',
        name: 'Un Muro',
        description: 'Ganó todos los duelos individuales. Impasable en su zona pero nunca subió a atacar.',
        effects: [{ attribute: 'def', change: 3 }, { attribute: 'pac', change: 1 }, { attribute: 'sho', change: -1 }],
        impact: 'positive',
        positions: ['DEF']
    },
    {
        id: 'cierre_providencial',
        name: 'Cierre Providencial',
        description: 'Llegó con lo justo para barrer y evitar un gol. Forzó el cierre pero quedó en evidencia.',
        effects: [{ attribute: 'def', change: 2 }, { attribute: 'pac', change: 2 }, { attribute: 'dri', change: -1 }],
        impact: 'positive',
        positions: ['DEF']
    },
    {
        id: 'orden_defensivo',
        name: 'El Patrón',
        description: 'Ordenó la defensa y anticipó jugadas. Líder defensivo que nunca llegó a rematar.',
        effects: [{ attribute: 'def', change: 2 }, { attribute: 'pas', change: 2 }, { attribute: 'sho', change: -1 }],
        impact: 'positive',
        positions: ['DEF']
    },
    {
        id: 'cobertura_oportuna',
        name: 'El Bombero',
        description: 'Siempre estuvo cubriendo las espaldas de un compañero. No atacó nunca.',
        effects: [{ attribute: 'def', change: 2 }, { attribute: 'pac', change: 1 }, { attribute: 'sho', change: -1 }],
        impact: 'positive',
        positions: ['DEF']
    },

    // MED (4)
    {
        id: 'titiritero',
        name: 'El Titiritero',
        description: 'Manejó los hilos del mediocampo. Tanto que se olvidó de volver a defender.',
        effects: [{ attribute: 'pas', change: 2 }, { attribute: 'dri', change: 2 }, { attribute: 'def', change: -1 }],
        impact: 'positive',
        positions: ['MED']
    },
    {
        id: 'pase_filtrado',
        name: 'Pase Quirúrgico',
        description: 'Metió un pase que dejó a un compañero solo. Gran creador pero no destructor.',
        effects: [{ attribute: 'pas', change: 3 }, { attribute: 'dri', change: 1 }, { attribute: 'def', change: -1 }],
        impact: 'positive',
        positions: ['MED']
    },
    {
        id: 'recuperador',
        name: 'Recuperación y Salida',
        description: 'Robó la pelota limpio y empezó el ataque. No llegó a rematar en todo el partido.',
        effects: [{ attribute: 'def', change: 2 }, { attribute: 'pas', change: 1 }, { attribute: 'sho', change: -1 }],
        impact: 'positive',
        positions: ['MED']
    },
    {
        id: 'cambio_frente',
        name: 'Cambio de Frente',
        description: 'Abrió la cancha con un pase largo y preciso. Los pases cortos no fueron su fuerte.',
        effects: [{ attribute: 'pas', change: 2 }, { attribute: 'phy', change: 1 }, { attribute: 'dri', change: -1 }],
        impact: 'positive',
        positions: ['MED']
    },

    // DEL (4)
    {
        id: 'goleador_nato',
        name: 'Definió como los Dioses',
        description: 'Le quedó una y la mandó a guardar. Puro ataque: nunca bajó a defender.',
        effects: [{ attribute: 'sho', change: 3 }, { attribute: 'dri', change: 1 }, { attribute: 'def', change: -2 }],
        impact: 'positive',
        positions: ['DEL']
    },
    {
        id: 'endiablado',
        name: 'Gambeta Endiablada',
        description: 'Se sacó a dos o tres rivales con habilidad pura. Los múltiples dribles le costaron energía.',
        effects: [{ attribute: 'dri', change: 3 }, { attribute: 'pac', change: 1 }, { attribute: 'phy', change: -1 }],
        impact: 'positive',
        positions: ['DEL']
    },
    {
        id: 'terror_area',
        name: 'El Terror del Área',
        description: 'Se movió por todo el frente generando peligro. Nunca volvió a ayudar en defensa.',
        effects: [{ attribute: 'dri', change: 2 }, { attribute: 'sho', change: 1 }, { attribute: 'def', change: -1 }],
        impact: 'positive',
        positions: ['DEL']
    },
    {
        id: 'asistidor',
        name: 'Asistidor Serial',
        description: 'Puso pelotas de gol increíbles a sus compañeros. Eligió el pase cuando podía definir.',
        effects: [{ attribute: 'pas', change: 3 }, { attribute: 'sho', change: -1 }, { attribute: 'def', change: -1 }],
        impact: 'positive',
        positions: ['DEL']
    },

    // ALL (3)
    {
        id: 'garra_charrua',
        name: 'Corazón y Garra',
        description: 'No dio una pelota por perdida, puro sacrificio. El físico tapó la falta de técnica.',
        effects: [{ attribute: 'phy', change: 3 }, { attribute: 'pac', change: 1 }, { attribute: 'dri', change: -2 }],
        impact: 'positive',
        positions: ['ALL']
    },
    {
        id: 'correcaminos',
        name: 'Correcaminos',
        description: 'Corrió por toda la cancha sin parar. Tanto que le costó la precisión.',
        effects: [{ attribute: 'pac', change: 2 }, { attribute: 'phy', change: 2 }, { attribute: 'dri', change: -1 }],
        impact: 'positive',
        positions: ['ALL']
    },
    {
        id: 'equipo_hombro',
        name: 'Se Puso el Equipo al Hombro',
        description: 'Apareció en los momentos difíciles y levantó a todos. Sacrificó su juego individual.',
        effects: [{ attribute: 'phy', change: 2 }, { attribute: 'pas', change: 1 }, { attribute: 'dri', change: -1 }],
        impact: 'positive',
        positions: ['ALL']
    },

    // --- NEGATIVE TAGS ---

    // POR (2)
    {
        id: 'manos_manteca',
        name: 'Manos de Manteca',
        description: 'Se le escapó una pelota fácil. Tuvo que correr a recuperar posición.',
        effects: [{ attribute: 'def', change: -3 }, { attribute: 'pac', change: 1 }],
        impact: 'negative',
        positions: ['POR']
    },
    {
        id: 'rebote_peligroso',
        name: 'Rebote al Medio',
        description: 'Dejó un rebote peligroso en el área. Mala decisión pero al menos intentó algo.',
        effects: [{ attribute: 'def', change: -2 }, { attribute: 'pac', change: -1 }, { attribute: 'pas', change: 1 }],
        impact: 'negative',
        positions: ['POR']
    },

    // DEF (4)
    {
        id: 'salio_tarde',
        name: 'Salió con el Diario',
        description: 'Midió mal el cruce y quedó pagando. Al menos comunica bien la defensa.',
        effects: [{ attribute: 'def', change: -3 }, { attribute: 'pas', change: 1 }],
        impact: 'negative',
        positions: ['DEF']
    },
    {
        id: 'se_comio_amague',
        name: 'Se Comió el Amague',
        description: 'El delantero lo dejó parado con una finta. Lección aprendida: ya sabe gambetear.',
        effects: [{ attribute: 'def', change: -2 }, { attribute: 'pac', change: -2 }, { attribute: 'dri', change: 1 }],
        impact: 'negative',
        positions: ['DEF']
    },
    {
        id: 'perdio_marca',
        name: 'Perdió la Marca',
        description: 'Se le escapó su marca en una jugada clave. Se proyectó mal pensando en atacar.',
        effects: [{ attribute: 'def', change: -2 }, { attribute: 'pac', change: -1 }, { attribute: 'sho', change: 1 }],
        impact: 'negative',
        positions: ['DEF']
    },
    {
        id: 'falta_innecesaria',
        name: 'Llegó a Destiempo',
        description: 'Hizo una falta innecesaria en zona peligrosa. Fue agresivo pero con mal timing.',
        effects: [{ attribute: 'def', change: -1 }, { attribute: 'phy', change: -2 }, { attribute: 'pac', change: 1 }],
        impact: 'negative',
        positions: ['DEF']
    },

    // MED (4)
    {
        id: 'pase_al_rival',
        name: 'Pase al Rival',
        description: 'Dio un pase comprometido que generó un contraataque. Error garrafal pero fue activo.',
        effects: [{ attribute: 'pas', change: -3 }, { attribute: 'def', change: -1 }, { attribute: 'phy', change: 1 }],
        impact: 'negative',
        positions: ['MED']
    },
    {
        id: 'se_enamoro_pelota',
        name: 'Se Enamoró de la Pelota',
        description: 'Quiso gambetear a todos y la perdió. Al menos corrió a recuperarla.',
        effects: [{ attribute: 'dri', change: -2 }, { attribute: 'pas', change: -2 }, { attribute: 'pac', change: 1 }],
        impact: 'negative',
        positions: ['MED']
    },
    {
        id: 'abuso_pelotazo',
        name: 'Abusó del Pelotazo',
        description: 'Reventó la pelota para arriba sin ideas. Sin criterio pero activo físicamente.',
        effects: [{ attribute: 'pas', change: -2 }, { attribute: 'sho', change: -1 }, { attribute: 'phy', change: 1 }],
        impact: 'negative',
        positions: ['MED']
    },
    {
        id: 'desconectado',
        name: 'Espectador de Lujo',
        description: 'No participó, estuvo desconectado del juego. Al menos mantuvo la posición.',
        effects: [{ attribute: 'pac', change: -2 }, { attribute: 'phy', change: -2 }, { attribute: 'def', change: 1 }],
        impact: 'negative',
        positions: ['MED']
    },

    // DEL (4)
    {
        id: 'se_comio_elefante',
        name: 'Se Comió un Elefante',
        description: 'Le erró a un gol hecho. La frustración al menos lo hizo correr más.',
        effects: [{ attribute: 'sho', change: -3 }, { attribute: 'pac', change: 1 }],
        impact: 'negative',
        positions: ['DEL']
    },
    {
        id: 'lento_definiendo',
        name: 'Más Lento que un Desfile',
        description: 'Se demoró en definir y le robaron la pelota. Sin velocidad pero batalló con el físico.',
        effects: [{ attribute: 'pac', change: -2 }, { attribute: 'sho', change: -1 }, { attribute: 'phy', change: 1 }],
        impact: 'negative',
        positions: ['DEL']
    },
    {
        id: 'sin_presion_arriba',
        name: 'No Presionó Arriba',
        description: 'Dejó salir cómodo al rival sin presionar. Se quedó fresco para atacar.',
        effects: [{ attribute: 'def', change: -2 }, { attribute: 'pac', change: -1 }, { attribute: 'sho', change: 1 }],
        impact: 'negative',
        positions: ['DEL']
    },
    {
        id: 'decision_mal',
        name: 'Decidió Mal',
        description: 'Eligió pegarle sin ángulo cuando tenía un compañero solo. Al menos intentó algo propio.',
        effects: [{ attribute: 'sho', change: -2 }, { attribute: 'pas', change: -1 }, { attribute: 'dri', change: 1 }],
        impact: 'negative',
        positions: ['DEL']
    },

    // ALL (2)
    {
        id: 'se_escondio',
        name: 'Se Escondió del Juego',
        description: 'No se mostró como opción, caminó la cancha. Al menos estuvo en posición.',
        effects: [{ attribute: 'phy', change: -2 }, { attribute: 'pac', change: -1 }, { attribute: 'def', change: 1 }],
        impact: 'negative',
        positions: ['ALL']
    },
    {
        id: 'control_cemento',
        name: 'Control de Cemento',
        description: 'No pudo parar una pelota fácil. Al menos lo intentó con actitud física.',
        effects: [{ attribute: 'dri', change: -2 }, { attribute: 'pac', change: -1 }, { attribute: 'phy', change: 1 }],
        impact: 'negative',
        positions: ['ALL']
    },
];
