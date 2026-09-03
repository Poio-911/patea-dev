import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import { createHash } from 'crypto';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

/**
 * Callable equivalente a generateTeamsAction + generate-balanced-teams.ts (Genkit)
 * de la webapp (src/lib/actions/server-actions.ts, src/ai/flows/generate-balanced-teams.ts).
 * Se reimplementa acá (en vez de reusar Genkit) porque Genkit vive en el proyecto Next.js;
 * se llama a Gemini directamente con el MISMO prompt, modelo, jerseys por defecto y
 * colección de cache ('ai_cache') para mantener paridad de comportamiento y costo con la web.
 */

export const GOOGLE_GENAI_API_KEY = defineSecret('GOOGLE_GENAI_API_KEY');

const MODEL_NAME = 'gemini-3.1-pro-preview';

type InputPlayer = {
  uid: string;
  displayName: string;
  position: string;
  ovr: number;
};

type OutputTeam = {
  name: string;
  players: (InputPlayer & { photoURL?: string })[];
  totalOVR: number;
  averageOVR: number;
  suggestedFormation: string;
  tags: string[];
  jersey?: { type: string; primaryColor: string; secondaryColor: string };
};

type OutputPayload = {
  teams: OutputTeam[];
  balanceMetrics: { ovrDifference: number; fairnessPercentage: number };
};

const DEFAULT_JERSEYS: Record<string, { type: string; primaryColor: string; secondaryColor: string }> = {
  'Con chaleco': { type: 'plain', primaryColor: '#F97316', secondaryColor: '#EA580C' },
  'Sin chaleco': { type: 'plain', primaryColor: '#1E3A8A', secondaryColor: '#1E40AF' },
};

const RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    teams: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING },
          players: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                uid: { type: SchemaType.STRING },
                displayName: { type: SchemaType.STRING },
                position: { type: SchemaType.STRING },
                ovr: { type: SchemaType.NUMBER },
              },
              required: ['uid', 'displayName', 'position', 'ovr'],
            },
          },
          totalOVR: { type: SchemaType.NUMBER },
          averageOVR: { type: SchemaType.NUMBER },
          suggestedFormation: { type: SchemaType.STRING },
          tags: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        },
        required: ['name', 'players', 'totalOVR', 'averageOVR', 'suggestedFormation', 'tags'],
      },
    },
    balanceMetrics: {
      type: SchemaType.OBJECT,
      properties: {
        ovrDifference: { type: SchemaType.NUMBER },
        fairnessPercentage: { type: SchemaType.NUMBER },
      },
      required: ['ovrDifference', 'fairnessPercentage'],
    },
  },
  required: ['teams', 'balanceMetrics'],
};

function buildPrompt(players: InputPlayer[], teamCount: number): string {
  const list = players.map(p => `- Nombre: ${p.displayName}, Puesto: ${p.position}, OVR: ${p.ovr}`).join('\n');
  return `Sos un DT experto en fútbol amateur del Río de la Plata, de esos que saben armar los equipos para el picado de los sábados.

Con esta lista de jugadores, con sus puestos y valoraciones (OVR), tu laburo es armar ${teamCount} equipos que queden lo más parejos posible. Simplemente nombrálos "Equipo 1" y "Equipo 2".

La lista de jugadores es esta:

${list}

Para cada equipo que armes, tenés que:
1.  **Asignarle un nombre simple como "Equipo 1" o "Equipo 2".**
2.  **Sugerir una formación táctica** según la cantidad de jugadores (ej: para un fútbol 5, un "1-2-1" o "2-1-1").
3.  **Tirar 2 o 3 etiquetas tácticas** que describan al equipo (ej: "Ataque Rápido", "Defensa de Hierro", "Control del Mediocampo", "Sin Golero Fijo" si no hay un 'POR').
4.  Intentá que la diferencia de OVR total entre el equipo más fuerte y el más débil sea la menor posible.
5.  Calculá el OVR total y el promedio para cada equipo.
6.  Calculá las métricas de equilibrio: la diferencia absoluta en el OVR promedio y un porcentaje de "justicia" (100% es un partido totalmente parejo).

Asegurate de que la respuesta sea un JSON válido y que siga estrictamente el esquema de salida.
`;
}

function cacheKeyFor(input: unknown): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora, igual que la web (ttlHours: 1)

export const generateBalancedTeams = onCall(
  { region: 'us-central1', secrets: [GOOGLE_GENAI_API_KEY], timeoutSeconds: 120 },
  async (request): Promise<OutputPayload> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Debés iniciar sesión para generar equipos.');
    }

    const players = request.data?.players as InputPlayer[] | undefined;
    const teamCount = (request.data?.teamCount as number | undefined) ?? 2;

    if (!players || players.length < 2) {
      throw new HttpsError('invalid-argument', 'Se necesitan al menos 2 jugadores para generar equipos.');
    }

    return generateBalancedTeamsCore(players, teamCount);
  }
);

/**
 * Lógica core, sin el wrapper onCall/auth — para que otras Cloud Functions
 * (ej. `finishMatch`, que necesita generar equipos si el partido no los tiene
 * todavía, igual que `finishMatchAction` en la web) puedan reusarla en
 * proceso en vez de hacer una llamada HTTP a sí mismas.
 */
export async function generateBalancedTeamsCore(
  players: InputPlayer[],
  teamCount = 2
): Promise<OutputPayload> {
  console.log('[generateBalancedTeams] start', { playerCount: players.length, teamCount });

    const cacheInput = {
      players: players.map(p => ({ uid: p.uid, displayName: p.displayName, ovr: p.ovr, position: p.position })),
      teamCount,
    };
    const cacheKey = cacheKeyFor(cacheInput);
    const db = admin.firestore();
    const cacheRef = db.collection('ai_cache').doc(cacheKey);

    let output: OutputPayload;

    console.log('[generateBalancedTeams] checking cache', cacheKey.substring(0, 8));
    const cached = await cacheRef.get();
    console.log('[generateBalancedTeams] cache checked, exists=', cached.exists);
    if (cached.exists) {
      const entry = cached.data() as { result: OutputPayload; timestamp: number };
      if (Date.now() - entry.timestamp < CACHE_TTL_MS) {
        output = entry.result;
        await cacheRef.set({ hitCount: admin.firestore.FieldValue.increment(1) }, { merge: true });
        console.log('[generateBalancedTeams] cache HIT, returning');
        return applyJerseysAndPhotos(output, players, db);
      }
    }

    console.log('[generateBalancedTeams] cache MISS, calling Gemini', MODEL_NAME);
    const genAI = new GoogleGenerativeAI(GOOGLE_GENAI_API_KEY.value());
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA as never,
      },
    });

    const prompt = buildPrompt(players, teamCount);
    console.log('[generateBalancedTeams] prompt built, length=', prompt.length);
    const result = await model.generateContent(prompt);
    console.log('[generateBalancedTeams] Gemini responded');
    const text = result.response.text();
    console.log('[generateBalancedTeams] response text length=', text.length);

    try {
      output = JSON.parse(text) as OutputPayload;
    } catch {
      throw new HttpsError('internal', 'La IA no devolvió un JSON válido para los equipos.');
    }

    if (!output?.teams || output.teams.length < 2) {
      throw new HttpsError('internal', 'La IA no pudo generar los equipos correctamente.');
    }
    console.log('[generateBalancedTeams] output parsed OK, teams=', output.teams.length);

    await cacheRef.set({
      result: output,
      timestamp: Date.now(),
      category: 'team-balancing',
      hitCount: 0,
    });

  return applyJerseysAndPhotos(output, players, db);
}

async function applyJerseysAndPhotos(
  output: OutputPayload,
  originalPlayers: InputPlayer[],
  db: admin.firestore.Firestore
): Promise<OutputPayload> {
  // Asignar aleatoriamente "Con chaleco" / "Sin chaleco" + su jersey por defecto,
  // igual que generate-balanced-teams.ts en la web.
  const teamNames = ['Con chaleco', 'Sin chaleco'];
  const shuffled = teamNames.sort(() => 0.5 - Math.random());
  output.teams[0].name = shuffled[0];
  output.teams[1].name = shuffled[1];
  output.teams[0].jersey = DEFAULT_JERSEYS[shuffled[0]];
  output.teams[1].jersey = DEFAULT_JERSEYS[shuffled[1]];

  // Re-adjuntar uid/foto reales por si la IA los alteró (mismo fallback que generateTeamsAction).
  const uids = originalPlayers.map(p => p.uid).filter(Boolean);
  const photoMap = new Map<string, string>();
  if (uids.length > 0) {
    const refs = uids.map(uid => db.collection('players').doc(uid));
    const docs = await db.getAll(...refs);
    docs.forEach(doc => {
      if (doc.exists) {
        const data = doc.data();
        photoMap.set(doc.id, data?.photoUrl || data?.photoURL || '');
      }
    });
  }

  for (const team of output.teams) {
    for (const player of team.players) {
      const original =
        originalPlayers.find(p => p.displayName === player.displayName && p.position === player.position) ||
        originalPlayers.find(p => p.displayName === player.displayName);
      if (original) {
        player.uid = original.uid;
        player.photoURL = photoMap.get(original.uid) || '';
      }
    }
  }

  return output;
}
