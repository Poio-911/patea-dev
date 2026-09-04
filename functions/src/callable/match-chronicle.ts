import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

/**
 * Crónica del partido con IA.
 *
 * Port de `generateMatchChronicleAction` (src/lib/actions/server-actions.ts:636)
 * más el flow de Genkit `generate-match-chronicle.ts`. Se reimplementa acá, con
 * el MISMO prompt palabra por palabra, porque Genkit vive dentro del proyecto
 * Next y no se puede importar desde Functions — igual criterio que
 * `generate-balanced-teams.ts`.
 *
 * La materia prima ya se venía juntando hace rato y no la consumía nadie: el
 * formulario de evaluación —web y móvil— guarda `personalChronicle` y
 * `mvpVote` en `matches/{id}/selfEvaluations`, y las etiquetas de rendimiento
 * quedan en `evaluations`. Todo eso entraba a Firestore y moría ahí.
 */

export const GOOGLE_GENAI_API_KEY = defineSecret('GOOGLE_GENAI_API_KEY');

const MODEL_NAME = 'gemini-3.1-pro-preview';

const RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    headline: { type: SchemaType.STRING },
    story: { type: SchemaType.STRING },
    playerVoices: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          playerName: { type: SchemaType.STRING },
          quote: { type: SchemaType.STRING },
        },
        required: ['playerName', 'quote'],
      },
    },
  },
  required: ['headline', 'story'],
} as const;

type ChronicleInput = {
  matchTitle: string;
  matchLocation?: string;
  team1Name: string;
  team1Score: number;
  team2Name: string;
  team2Score: number;
  keyEvents: { minute: number; playerName: string; description: string }[];
  mvp: { name: string; reason: string };
  playerChronicles?: { playerName: string; chronicle: string; position: string }[];
  topPerformanceTags?: { playerName: string; tagName: string; tagDescription: string }[];
};

/**
 * El prompt es el mismo de `src/ai/flows/generate-match-chronicle.ts`. Allá los
 * datos se inyectan con Handlebars; acá se arman a mano porque no hay Genkit.
 * Si se toca el de la web, hay que tocar este.
 */
function buildPrompt(input: ChronicleInput): string {
  const lines: string[] = [];

  lines.push(`
    Sos un cronista deportivo rioplatense (mitad Roberto Fontanarrosa, mitad Eduardo Galeano, con una pizca del humor de "La Mesa de los Galanes"). Escribís crónicas épicas y literarias para partidos de fútbol amateur de amigos en Uruguay.
    Tu objetivo es transformar un picadito de fútbol 5 o 7 en una gesta heroica, un drama humano o una comedia de enredos, narrado desde el mostrador de un bar o al costado de la canchita.

    CONTEXTO:
    - Estás en Uruguay. Hablás en rioplatense (voseo uruguayo: tenés, venís, andá).
    - **PROHIBIDO USAR LA PALABRA "BO"**. Está terminantemente vetada para evitar que suenes artificial. Usá vocabulario rico: "botija", "fiera", "loco", "ñeri", "maestro", "crack", "rústico", "salado", "imponente", "se picó", "vamo arriba".

    DATOS DEL PARTIDO:
    - Partido: ${input.matchTitle}`);

  if (input.matchLocation) {
    lines.push(`    - Ubicación / Cancha: ${input.matchLocation}`);
  }

  lines.push(`    - Resultado: ${input.team1Name} ${input.team1Score} - ${input.team2Score} ${input.team2Name}
    - MVP: ${input.mvp.name} (${input.mvp.reason})`);

  if (input.playerChronicles?.length) {
    lines.push(`
    TESTIMONIOS REALES (Crónicas de los Jugadores):`);
    for (const pc of input.playerChronicles) {
      lines.push(`    - ${pc.playerName}: "${pc.chronicle}"`);
    }
  }

  if (input.topPerformanceTags?.length) {
    lines.push(`
    HITOS TÁCTICOS Y TÉCNICOS (Etiquetas de rendimiento):`);
    for (const t of input.topPerformanceTags) {
      lines.push(`    - ${t.playerName}: ${t.tagName} (${t.tagDescription})`);
    }
  }

  lines.push(`
    EVENTOS DESTACADOS:`);
  for (const e of input.keyEvents) {
    lines.push(`    - ${e.playerName}: ${e.description}`);
  }

  lines.push(`
    INSTRUCCIONES ESTRUCTURALES:

    1. **Título (headline)**: Un título literario, de doble sentido, exagerado o irónico. Que suene a cuento o a titular de diario antiguo. (Ej: "La sinfonía inconclusa del mediocampo", "Más patadas que en un clásico de los 80", "El día que [Nombre] se disfrazó de Francescoli").

    2. **Apertura de la historia (story)**:
       - **NO empieces hablando del clima** a menos que sea vital para la trama.
       - Arrancá "in media res" (en medio de la acción). Mencioná la ubicación del partido si te la pasaron, dándole un toque épico de barrio.
       - BAUTIZÁ A LOS EQUIPOS: **IGNORÁ POR COMPLETO LOS NOMBRES ORIGINALES SI SON 'Con Chaleco', 'Sin Chaleco', 'Equipo 1', etc.** Bajo ninguna circunstancia uses la palabra "Chaleco" como nombre del cuadro. Inventales apodos épicos basados en los jugadores de este partido (ej: "La banda de [Nombre MVP]", "Los rústicos comandados por [Nombre]", "Los liristas de amarillo").

    3. **Cuerpo de la historia (story - INTEGRAR TODO)**:
       - **Construí una narrativa**: ¿Fue una paliza táctica? ¿Un partido trabado y sucio? ¿Un ida y vuelta sin medio campo? Definí el "alma" del partido.
       - **Usá los Hitos (Etiquetas)**: Transformá el dato frío en literatura. Si alguien es "Muralla", hablá de "la aduana infranqueable que armó en el fondo". Si fue "Leñador", "repartió cariño para todo el barrio".
       - **INTEGRÁ LOS TESTIMONIOS (CRUCIAL)**: No tires las citas de los jugadores al final. **Metelas en el medio de la narración**. Si un jugador dijo "Estaba ahogado a los 5 minutos", escribí algo como: *"El vértigo inicial rompió el mediocampo; tanto así que, como confesaría exhausto [Nombre del jugador] al costado del tejido: '[Cita textual o parafraseada]'."*

    4. **Voces del Vestuario (playerVoices)**:
       - Es OBLIGATORIO que incluyas una cita para cada uno de los jugadores que dejaron su testimonio en la sección "TESTIMONIOS REALES". El usuario quiere verlos a TODOS. Si ya usaste un testimonio en el cuerpo del texto, repetí la frase más picante o representativa acá.

    REGLAS ESTILÍSTICAS DE ORO:
    - ❌ **CERO "BO"**. La IA que escriba "bo" será enviada a jugar a la B.
    - ❌ **CERO CHALECOS**: Olvidate de "El equipo Con Chaleco". Son "Los comandados por...", "La escuadra de...". Si decís "Chalecos", perdés.
    - ✅ **Literatura de Potrero**: Usá la metáfora y la exageración. El fútbol no se juega, se sufre y se goza.
    - ❌ **Nada de "cancha de papi" o "zapatillas"**. Es "la canchita", "los championes", "los botines".

    FORMATO DE SALIDA JSON (Estricto):
    - headline: string
    - story: string (Un relato fluido de unos 4 o 5 párrafos bien armados)
    - playerVoices: array de objetos { playerName: string, quote: string }
  `);

  return lines.join('\n');
}

export const generateMatchChronicle = onCall(
  { region: 'us-central1', secrets: [GOOGLE_GENAI_API_KEY], timeoutSeconds: 120 },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Debés iniciar sesión.');

    const matchId = String(request.data?.matchId ?? '');
    if (!matchId) throw new HttpsError('invalid-argument', 'Falta el partido.');
    const force = request.data?.force === true;

    const db = admin.firestore();
    const matchRef = db.doc(`matches/${matchId}`);
    const matchSnap = await matchRef.get();
    if (!matchSnap.exists) throw new HttpsError('not-found', 'Partido no encontrado.');

    const match = matchSnap.data() as Record<string, any>;

    // Una crónica ya escrita no se vuelve a pedir: el partido no cambia más y
    // cada generación cuesta. `force` existe para regenerarla a mano.
    if (!force && match.chronicle) {
      return { chronicle: match.chronicle, cached: true };
    }

    const teams = Array.isArray(match.teams) ? match.teams : [];
    if (match.status !== 'evaluated' || teams.length < 2) {
      throw new HttpsError(
        'failed-precondition',
        'La crónica se escribe recién cuando el partido está evaluado.'
      );
    }

    // Sólo los que jugaron pueden pedirla.
    const playerUids: string[] = Array.isArray(match.playerUids) ? match.playerUids : [];
    if (match.ownerUid !== request.auth.uid && !playerUids.includes(request.auth.uid)) {
      throw new HttpsError('permission-denied', 'Solo quienes jugaron pueden pedir la crónica.');
    }

    const [evalsSnap, selfEvalsSnap] = await Promise.all([
      db.collection('evaluations').where('matchId', '==', matchId).get(),
      db.collection(`matches/${matchId}/selfEvaluations`).get(),
    ]);

    const evaluations = evalsSnap.docs.map((d) => d.data() as Record<string, any>);
    const selfEvaluations = selfEvalsSnap.docs.map((d) => d.data() as Record<string, any>);

    // Nombres: primero los del propio partido, que es lo que vio la gente.
    const playersMap = new Map<string, string>();
    for (const p of (match.players ?? []) as Record<string, any>[]) {
      if (p?.uid) playersMap.set(p.uid, p.displayName ?? 'Jugador');
    }
    for (const team of teams) {
      for (const p of (team.players ?? []) as Record<string, any>[]) {
        if (p?.uid && !playersMap.has(p.uid)) playersMap.set(p.uid, p.displayName ?? 'Jugador');
      }
    }

    const nameOf = (id?: string) => (id && playersMap.get(id)) || 'Jugador';

    const goalsByPlayer = new Map<string, number>();
    const assistsByPlayer = new Map<string, number>();
    for (const ev of selfEvaluations) {
      const pid = String(ev.playerId ?? '');
      if (!pid) continue;
      goalsByPlayer.set(pid, (goalsByPlayer.get(pid) ?? 0) + (Number(ev.goals) || 0));
      assistsByPlayer.set(pid, (assistsByPlayer.get(pid) ?? 0) + (Number(ev.assists) || 0));
    }

    const finalScore = match.finalScore as { team1?: number; team2?: number } | undefined;
    let team1Score = Number(finalScore?.team1 ?? 0);
    let team2Score = Number(finalScore?.team2 ?? 0);
    if (finalScore?.team1 === undefined || finalScore?.team2 === undefined) {
      team1Score = 0;
      team2Score = 0;
      for (const p of (teams[0].players ?? []) as Record<string, any>[]) {
        team1Score += goalsByPlayer.get(p.uid) ?? 0;
      }
      for (const p of (teams[1].players ?? []) as Record<string, any>[]) {
        team2Score += goalsByPlayer.get(p.uid) ?? 0;
      }
    }

    // Eventos: los reales del partido en vivo primero; si no hay, se arma algo
    // con los goles y asistencias autoreportados, para que el cronista tenga
    // de dónde agarrarse.
    const keyEvents: { minute: number; playerName: string; description: string }[] = [];
    for (const e of (match.events ?? []) as Record<string, any>[]) {
      if (keyEvents.length >= 8) break;
      const minute = Number(e.minute) || 0;
      const who = String(e.playerName || nameOf(e.playerId));
      if (e.type === 'goal') {
        const assist = e.assistName ? `, asistido por ${e.assistName}` : '';
        keyEvents.push({ minute, playerName: who, description: `Gol${assist}.` });
      } else if (e.type === 'card') {
        keyEvents.push({
          minute,
          playerName: who,
          description: e.cardType === 'red' ? 'Se fue expulsado.' : 'Vio la amarilla.',
        });
      } else if (e.type === 'substitution') {
        keyEvents.push({
          minute,
          playerName: String(e.playerInName || who),
          description: `Entró por ${e.playerOutName ?? 'un compañero'}.`,
        });
      }
    }

    if (keyEvents.length === 0) {
      for (const [pid, goals] of goalsByPlayer) {
        if (goals > 0) {
          keyEvents.push({
            minute: 0,
            playerName: nameOf(pid),
            description: goals === 1 ? 'Hizo un gol.' : `Hizo ${goals} goles.`,
          });
        }
      }
      for (const [pid, assists] of assistsByPlayer) {
        if (assists > 0) {
          keyEvents.push({
            minute: 0,
            playerName: nameOf(pid),
            description: assists === 1 ? 'Dio una asistencia.' : `Dio ${assists} asistencias.`,
          });
        }
      }
    }

    if (keyEvents.length === 0) {
      keyEvents.push({
        minute: 0,
        playerName: 'El partido',
        description: 'Partido parejo, sin acciones destacadas registradas.',
      });
    }

    // MVP: primero el que quedó guardado en el partido (los votos de los
    // jugadores), y si no, el de mejor calificación.
    let mvpId = String(match.bestPlayerId ?? '');
    let mvpReason = 'por ser el más votado del partido';
    if (!mvpId) {
      let best = 0;
      for (const ev of evaluations) {
        const r = Number(ev.rating) || 0;
        if (r > best) {
          best = r;
          mvpId = String(ev.playerId ?? '');
        }
      }
      mvpReason = `por su rendimiento excepcional y una calificación de ${best}`;
    }

    const playerChronicles = selfEvaluations
      .filter((se) => typeof se.personalChronicle === 'string' && se.personalChronicle.trim())
      .map((se) => ({
        playerName: nameOf(se.playerId),
        chronicle: String(se.personalChronicle).trim(),
        position: String(
          ((match.players ?? []) as Record<string, any>[]).find((p) => p.uid === se.playerId)
            ?.position ?? 'MED'
        ),
      }));

    const topPerformanceTags = evaluations
      .flatMap((e) =>
        ((e.performanceTags ?? []) as Record<string, any>[]).map((tag) => ({
          playerName: nameOf(e.playerId),
          tagName: String(tag.name ?? ''),
          tagDescription: String(tag.description ?? ''),
          impact: String(tag.impact ?? ''),
        }))
      )
      .filter((t) => t.impact === 'positive' || t.impact === 'negative')
      .slice(0, 10);

    const input: ChronicleInput = {
      matchTitle: String(match.title ?? 'Partido'),
      matchLocation:
        typeof match.location === 'object' ? match.location?.name : match.location,
      team1Name: String(teams[0].name ?? 'Equipo 1'),
      team1Score,
      team2Name: String(teams[1].name ?? 'Equipo 2'),
      team2Score,
      keyEvents,
      mvp: { name: nameOf(mvpId) === 'Jugador' ? 'El equipo' : nameOf(mvpId), reason: mvpReason },
      playerChronicles: playerChronicles.length ? playerChronicles : undefined,
      topPerformanceTags: topPerformanceTags.length ? topPerformanceTags : undefined,
    };

    const genAI = new GoogleGenerativeAI(GOOGLE_GENAI_API_KEY.value());
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA as never,
      },
    });

    let chronicle: Record<string, unknown>;
    try {
      const result = await model.generateContent(buildPrompt(input));
      chronicle = JSON.parse(result.response.text());
    } catch (err) {
      throw new HttpsError('internal', `La IA no pudo escribir la crónica: ${err}`);
    }

    await matchRef.update({
      chronicle,
      chronicleGeneratedAt: new Date().toISOString(),
    });

    return { chronicle, cached: false };
  }
);
