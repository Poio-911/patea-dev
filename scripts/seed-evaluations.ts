import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

if (getApps().length === 0) {
    const s = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
    initializeApp({ credential: cert(s), projectId: s.project_id });
}

type TagEffect = {
    attribute: 'pac' | 'sho' | 'pas' | 'dri' | 'def' | 'phy';
    change: number;
};

type PerformanceTag = {
    id: string;
    name: string;
    description: string;
    effects: TagEffect[];
    impact: 'positive' | 'negative' | 'neutral';
    positions: ('DEL' | 'MED' | 'DEF' | 'POR' | 'ALL')[];
};

const performanceTagsDb: PerformanceTag[] = [
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
    {
        id: 'no_bajo_a_marcar',
        name: 'No Bajó a Marcar',
        description: 'Se quedó en ataque y no colaboró en la marca ni presión.',
        effects: [{ attribute: 'def', change: -2 }, { attribute: 'phy', change: -1 }],
        impact: 'negative',
        positions: ['DEL', 'MED']
    },
    {
        id: 'no_presiono_arriba',
        name: 'No Presionó Arriba',
        description: 'Dejó salir cómodo al rival sin presionar la salida.',
        effects: [{ attribute: 'def', change: -1 }, { attribute: 'pac', change: -1 }],
        impact: 'negative',
        positions: ['DEL']
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

type PlayerPosition = 'DEL' | 'MED' | 'DEF' | 'POR';

interface Player {
    id: string;
    name: string;
    position: PlayerPosition;
    photoURL?: string;
    ownerUid: string;
}

interface Assignment {
    id: string;
    evaluatorId: string;
    subjectId: string;
    status: string;
}

// Gaussian random number generator (Box-Muller transform)
function gaussianRandom(mean: number, stdDev: number): number {
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return z0 * stdDev + mean;
}

// Generate realistic rating (bell curve centered at 7)
function generateRating(): number {
    const rating = gaussianRandom(7, 1.5);
    return Math.max(1, Math.min(10, Math.round(rating)));
}

// Shuffle array
function shuffle<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Select random tags for a position
function selectRandomTags(position: PlayerPosition, count: number): PerformanceTag[] {
    // Filter tags relevant for position
    const relevantTags = performanceTagsDb.filter((tag: PerformanceTag) =>
        tag.positions.includes(position) || tag.positions.includes('ALL')
    );

    // 70% positive, 30% negative
    const positiveTags = relevantTags.filter((t: PerformanceTag) =>
        t.effects && t.effects.some((e: any) => e.change > 0)
    );
    const negativeTags = relevantTags.filter((t: PerformanceTag) =>
        t.effects && t.effects.some((e: any) => e.change < 0)
    );

    const numPositive = Math.ceil(count * 0.7);
    const numNegative = count - numPositive;

    const selected = [
        ...shuffle(positiveTags).slice(0, numPositive),
        ...shuffle(negativeTags).slice(0, numNegative)
    ];

    return shuffle(selected).slice(0, count);
}

// Generate match stats (goals, assists)
function generateMatchStats(players: Player[], teams: any[]) {
    const stats: Record<string, { goals: number; assists: number }> = {};

    // Initialize all players
    players.forEach(p => {
        stats[p.id] = { goals: 0, assists: 0 };
    });

    if (!teams || teams.length < 2) {
        // Just assign goals randomly to any player if no teams
        const totalGoals = Math.floor(Math.random() * 8) + 4;
        for (let i = 0; i < totalGoals; i++) {
            const scorer = players[Math.floor(Math.random() * players.length)];
            if (scorer) stats[scorer.id].goals++;
        }
        return stats;
    }

    // Generate goals per team (2-5 goals each)
    teams.forEach(team => {
        const teamGoals = Math.floor(Math.random() * 4) + 2; // 2-5 goals
        const teamPlayers = players.filter(p => team.players.some((tp: any) => tp.uid === p.id));

        // Distribute goals (DEL more likely)
        for (let i = 0; i < teamGoals; i++) {
            const delanteros = teamPlayers.filter(p => p.position === 'DEL' || p.position === 'MED');
            const otros = teamPlayers.filter(p => p.position === 'DEF' || p.position === 'POR');

            let scorer: Player;
            // Robust selection (80% DEL/MED)
            if (delanteros.length > 0 && Math.random() > 0.2) {
                scorer = delanteros[Math.floor(Math.random() * delanteros.length)];
            } else if (otros.length > 0) {
                scorer = otros[Math.floor(Math.random() * otros.length)];
            } else {
                // If no attackers and no 'others' (e.g. only GK or empty), pick anyone
                if (teamPlayers.length > 0) {
                    scorer = teamPlayers[Math.floor(Math.random() * teamPlayers.length)];
                } else {
                    console.warn(`   ⚠️ Warning: No players found for team. Skipping goal generation.`);
                    continue;
                }
            }

            if (!scorer) continue;

            stats[scorer.id].goals++;

            // 60% chance of assist
            if (Math.random() > 0.4) {
                const assisters = teamPlayers.filter(p => p.id !== scorer.id && p.position !== 'POR');
                if (assisters.length > 0) {
                    const assister = assisters[Math.floor(Math.random() * assisters.length)];
                    stats[assister.id].assists++;
                }
            }
        }
    });

    return stats;
}

async function seedEvaluations(matchId: string) {
    const db = getFirestore();

    console.log('\n🌱 SEEDING EVALUATIONS');
    console.log('═'.repeat(60));
    console.log(`Match ID: ${matchId}\n`);

    // 1. Load match
    const matchDoc = await db.doc(`matches/${matchId}`).get();
    if (!matchDoc.exists) {
        console.log('❌ Match not found');
        return;
    }

    const match = { id: matchDoc.id, ...matchDoc.data() } as any;

    if (match.status !== 'completed' && match.status !== 'evaluated') {
        console.log(`❌ Match status is "${match.status}", must be "completed" or "evaluated"`);
        return;
    }

    console.log(`✅ Match: ${match.title}`);
    console.log(`   Status: ${match.status}`);
    console.log(`   Players: ${match.playerUids?.length || 0}`);

    // 2. Load assignments
    const assignmentsSnap = await db.collection(`matches/${matchId}/assignments`).get();
    const assignments: Assignment[] = assignmentsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    } as Assignment));

    console.log(`   Assignments: ${assignments.length}\n`);

    if (assignments.length === 0) {
        console.log('❌ No assignments found. Match needs to be finalized first.');
        return;
    }

    // 3. Load players
    const playerDocs = await Promise.all(
        match.playerUids.map((uid: string) => db.doc(`players/${uid}`).get())
    );

    const players: Player[] = playerDocs
        .filter(doc => doc.exists)
        .map(doc => ({ id: doc.id, ...doc.data() } as Player));

    console.log('👥 Players:');
    players.forEach(p => console.log(`   - ${p.name} (${p.position})`));
    console.log('');

    // 4. Check for existing submissions
    const existingSubmissions = await db.collection('evaluationSubmissions')
        .where('matchId', '==', matchId)
        .get();

    if (!existingSubmissions.empty) {
        console.log(`⚠️  Found ${existingSubmissions.size} existing submissions. Delete them first? (y/n)`);
        console.log('   Continuing anyway...\n');
    }

    // 5. Generate match stats
    console.log('📊 Generating match stats...');
    let matchStats;
    try {
        matchStats = generateMatchStats(players, match.teams);
        console.log('   Stats generated successfully');
    } catch (error) {
        console.log('   ❌ Error generating stats:', error);
        return;
    }

    let totalGoals = 0;
    let totalAssists = 0;
    Object.entries(matchStats).forEach(([playerId, stats]) => {
        const player = players.find(p => p.id === playerId);
        if (stats.goals > 0 || stats.assists > 0) {
            console.log(`   ${player?.name}: ${stats.goals}G ${stats.assists}A`);
            totalGoals += stats.goals;
            totalAssists += stats.assists;
        }
    });
    console.log(`   Total: ${totalGoals} goals, ${totalAssists} assists\n`);

    // 6. Select random MVP
    console.log('🏆 Selecting MVP...');
    const mvpCandidates = players.filter(p => {
        const stats = matchStats[p.id];
        return stats.goals > 0 || stats.assists > 0 || Math.random() > 0.7;
    });
    const mvp = mvpCandidates.length > 0
        ? mvpCandidates[Math.floor(Math.random() * mvpCandidates.length)]
        : players[Math.floor(Math.random() * players.length)];

    console.log(`   MVP: ${mvp.name}\n`);

    // 7. Generate evaluations for ALL players (Simulate everyone evaluates)
    // The user expects full coverage: "si todos evaluan 2 veces todos deben de tener 2 evaluaciones"
    const evaluators = players;
    console.log(`📝 Generating evaluations for ${evaluators.length} players (Real + AI)...\n`);

    let submissionsCreated = 0;

    try {
        for (const evaluator of evaluators) {
            console.log(`   Processing ${evaluator.name}...`);
            const myAssignments = assignments.filter(a => a.evaluatorId === evaluator.id);

            if (myAssignments.length === 0) {
                console.log(`   ⚠️  ${evaluator.name}: No assignments`);
                continue;
            }

            const evaluations = myAssignments.map(assignment => {
                const subject = players.find(p => p.id === assignment.subjectId);
                if (!subject) {
                    console.log(`   ⚠️  Assignment ${assignment.id} SKIPPED: Subject ${assignment.subjectId} not found in players list.`);
                    return null;
                }

                // 50/50 points vs tags
                const usePoints = Math.random() > 0.5;

                if (usePoints) {
                    // POINTS evaluation
                    return {
                        assignmentId: assignment.id,
                        subjectId: subject.id,
                        displayName: subject.name,
                        photoUrl: subject.photoURL || '',
                        position: subject.position,
                        evaluationType: 'points',
                        rating: generateRating(),
                        performanceTags: [] // Could add some tags optionally
                    };
                } else {
                    // TAGS evaluation
                    const numTags = 3; // Exactly 3 tags per new rules
                    const tags = selectRandomTags(subject.position, numTags);

                    return {
                        assignmentId: assignment.id,
                        subjectId: subject.id,
                        displayName: subject.name,
                        photoUrl: subject.photoURL || '',
                        position: subject.position,
                        evaluationType: 'tags',
                        performanceTags: tags
                    };
                }
            }).filter(Boolean);

            // Create submission
            const goals = matchStats[evaluator.id].goals;
            const assists = matchStats[evaluator.id].assists;

            // Richer chronicles
            const winTemplates = [
                "¡Qué partido ganamos! Dejé el alma.",
                "Partido durísimo pero nos llevamos los 3 puntos.",
                "Jugué bien, aunque terminé muerto.",
                "Eminencia se jugó todo, gran equipo.",
                "Ganamos a lo Peñarol, sufriendo."
            ];
            const goalTemplates = [
                "¡Mojé! Qué lindo hacer goles.",
                "El arco se me abrió hoy, por suerte.",
                "Gol y victoria, noche redonda.",
                "La mandé a guardar, como corresponde."
            ];
            const genericTemplates = [
                "Partido parejo, se corrió mucho.",
                "Me faltó aire pero cumplí.",
                "Buen picado, divertido.",
                "Terminé con los gemelos cargados.",
                "Hay que mejorar la defensa para la próxima."
            ];

            let chronicle = "";
            if (goals > 0) {
                chronicle = goalTemplates[Math.floor(Math.random() * goalTemplates.length)];
            } else if (Math.random() > 0.5) {
                chronicle = winTemplates[Math.floor(Math.random() * winTemplates.length)];
            } else {
                chronicle = genericTemplates[Math.floor(Math.random() * genericTemplates.length)];
            }

            // Add some funny generic suffix randomly
            if (Math.random() > 0.7) chronicle += " ¡Vamo arriba!";

            const submission = {
                evaluatorId: evaluator.id,
                matchId: matchId,
                submittedAt: new Date().toISOString(),
                submission: {
                    evaluatorGoals: goals,
                    evaluatorAssists: assists,
                    personalChronicle: chronicle,
                    mvpVote: mvp.id,
                    evaluations: evaluations
                }
            };

            await db.collection('evaluationSubmissions').add(submission);
            submissionsCreated++;

            const pointsCount = evaluations.filter((e: any) => e.evaluationType === 'points').length;
            const tagsCount = evaluations.filter((e: any) => e.evaluationType === 'tags').length;

            console.log(`   ✅ ${evaluator.name}: ${evaluations?.length} evaluations (${pointsCount} points, ${tagsCount} tags)`);
        }
    } catch (error) {
        console.log('\n❌ Error creating submissions:', error);
        console.log('Stack:', (error as any).stack);
    }

    console.log('');
    console.log('═'.repeat(60));
    console.log(`✅ Created ${submissionsCreated} evaluation submissions`);
    console.log('');
    console.log('⏳ Submissions will be auto-processed every 15 seconds');
    console.log('   Check the organizer panel to monitor progress');
    console.log('   Then finalize evaluations to update OVRs');
    console.log('═'.repeat(60));
}

// Run with match ID from command line or hardcoded
const matchId = process.argv[2] || 'WBm27E7Whk42gvZJWqcJ';
seedEvaluations(matchId).catch(error => {
    console.error('\n❌ Fatal error:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
}).finally(() => process.exit(0));
