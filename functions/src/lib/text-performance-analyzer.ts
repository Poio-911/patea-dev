import { createHash } from 'crypto';
import * as admin from 'firebase-admin';
import { GoogleGenAI, ThinkingLevel, Type as SchemaType } from '@google/genai';
import { HttpsError } from 'firebase-functions/v2/https';

const MODEL_NAME = 'gemini-3.1-flash-lite';
const VALID_ATTRS = new Set(['pac', 'sho', 'pas', 'dri', 'def', 'phy']);
const VALID_POSITIONS = new Set(['DEL', 'MED', 'DEF', 'POR']);
const MAX_AUDIO_BYTES = 2 * 1024 * 1024;
const ALLOWED_AUDIO_EXT = /\.(m4a|aac|mp4|webm|ogg|mp3|wav)$/i;

export type AttributeChange = {
  attribute: 'pac' | 'sho' | 'pas' | 'dri' | 'def' | 'phy';
  change: number;
  reason: string;
};

export type TextPerformanceResult = {
  attributeChanges: AttributeChange[];
  confidence: number;
  summary: string;
};

export type AudioPerformanceResult = TextPerformanceResult & {
  transcript: string;
};

const RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    attributeChanges: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          attribute: {
            type: SchemaType.STRING,
            enum: ['pac', 'sho', 'pas', 'dri', 'def', 'phy'],
          },
          change: { type: SchemaType.INTEGER },
          reason: { type: SchemaType.STRING },
        },
        required: ['attribute', 'change', 'reason'],
      },
    },
    confidence: { type: SchemaType.NUMBER },
    summary: { type: SchemaType.STRING },
  },
  required: ['attributeChanges', 'confidence', 'summary'],
} as const;

const AUDIO_RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    transcript: { type: SchemaType.STRING },
    attributeChanges: RESPONSE_SCHEMA.properties.attributeChanges,
    confidence: { type: SchemaType.NUMBER },
    summary: { type: SchemaType.STRING },
  },
  required: ['transcript', 'attributeChanges', 'confidence', 'summary'],
} as const;

export function hashEvaluationInput(value: string): string {
  return createHash('sha256').update(value.trim()).digest('hex');
}

/**
 * Valida que una ruta de audio pertenezca estrictamente a
 * `evaluation-audios/{matchId}/{evaluatorId}/{filename}`.
 */
export function isValidEvaluationAudioPath(
  audioPath: unknown,
  matchId: string,
  evaluatorId: string,
): audioPath is string {
  if (typeof audioPath !== 'string') return false;
  const trimmed = audioPath.trim();
  if (!trimmed || trimmed.length > 240 || trimmed.includes('..')) return false;
  const expectedPrefix = `evaluation-audios/${matchId}/${evaluatorId}/`;
  if (!trimmed.startsWith(expectedPrefix)) return false;
  const fileName = trimmed.slice(expectedPrefix.length);
  if (!fileName || fileName.includes('/')) return false;
  return ALLOWED_AUDIO_EXT.test(fileName);
}

const ATTRIBUTE_RULES_TEXT = `Atributos disponibles:
- pac: Velocidad/Ritmo (sprints, velocidad, aceleración)
- sho: Tiro/Disparo (goles, remates, definición, potencia de tiro)
- pas: Pase (precisión de pases, visión, asistencias, distribución)
- dri: Regate/Dribling (control de balón, gambetas, habilidad técnica)
- def: Defensa (marcaje, recuperación, intercepciones, cierres, atajadas en arqueros)
- phy: Físico (fuerza, resistencia, aguante, duelos aéreos)

Reglas:
- Extraé entre 1 y 4 cambios de atributos (sin repetir atributos)
- Cada cambio debe ser entero entre -3 y +3 (distinto de 0)
- Si el comentario menciona algo POSITIVO → cambio positivo (+1 a +3)
- Si menciona algo NEGATIVO → cambio negativo (-1 a -3)
- Intensidad: "muy bueno/excelente/destacado" → +2 o +3; "bueno/bien" → +1; "mal/flojo" → -1; "muy mal/pésimo" → -2 o -3`;

export function buildTextPerformancePrompt(input: {
  text: string;
  playerPosition: string;
  playerName: string;
}): string {
  return `Sos un analista de fútbol amateur en Uruguay. Analizá el siguiente comentario sobre el rendimiento de ${input.playerName} (posición: ${input.playerPosition}) en un partido:

"${input.text}"

Basándote en este comentario, determiná qué ATRIBUTOS deben cambiar y en cuánto.

${ATTRIBUTE_RULES_TEXT}
- Priorizá atributos relevantes para la posición (${input.playerPosition})
- Generá un resumen MUY BREVE (1 frase en español rioplatense, tono neutro y sin delatar quién habla) del rendimiento.
- Evaluá tu confianza (0 a 1): alta si el texto es claro y específico, baja si es ambiguo.`;
}

export function buildAudioPerformancePrompt(input: {
  playerPosition: string;
  playerName: string;
}): string {
  return `Sos un analista de fútbol amateur en Uruguay. Escuchá esta nota de voz sobre el rendimiento de ${input.playerName} (posición: ${input.playerPosition}) en un partido.

Tareas:
1. Transcribí fielmente lo que dice la persona en español rioplatense dentro del campo "transcript" (máximo 500 caracteres). Si el audio está en silencio, sólo tiene ruido o es incomprensible, devolvé "transcript": "".
2. Basándote en lo que dijo, determiná qué ATRIBUTOS deben cambiar y en cuánto.

${ATTRIBUTE_RULES_TEXT}
- Priorizá atributos relevantes para la posición (${input.playerPosition})
- Generá "summary": un resumen MUY BREVE (1 frase en español rioplatense, redactado de forma neutra sin copiar muletillas ni delatar a quien habla) del rendimiento.
- Evaluá "confidence" (0 a 1): alta si el comentario es claro y específico, baja si es ambiguo.`;
}

function parseAttributeChangesList(rawList: unknown): AttributeChange[] {
  if (!Array.isArray(rawList) || rawList.length === 0) {
    throw new Error('Sin cambios de atributos.');
  }
  const seen = new Set<string>();
  const attributeChanges: AttributeChange[] = [];
  for (const item of rawList) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const attr = String(rec.attribute ?? '').toLowerCase();
    if (!VALID_ATTRS.has(attr) || seen.has(attr)) continue;
    const rawChange = Number(rec.change);
    if (!Number.isFinite(rawChange)) continue;
    const clamped = Math.max(-3, Math.min(3, Math.round(rawChange)));
    if (clamped === 0) continue;
    const reason =
      typeof rec.reason === 'string' && rec.reason.trim()
        ? rec.reason.trim()
        : 'Mencionado en la reseña.';
    seen.add(attr);
    attributeChanges.push({
      attribute: attr as AttributeChange['attribute'],
      change: clamped,
      reason,
    });
    if (attributeChanges.length >= 4) break;
  }
  if (attributeChanges.length === 0) {
    throw new Error('No se encontraron cambios de atributos válidos.');
  }
  return attributeChanges;
}

export function parseTextPerformance(
  rawText: string | undefined,
  finishReason: string | undefined,
): TextPerformanceResult {
  if (finishReason !== 'STOP') {
    throw new Error('Respuesta incompleta del análisis.');
  }
  const parsed = JSON.parse(rawText || '');
  if (!parsed || Array.isArray(parsed) || typeof parsed.summary !== 'string' || !parsed.summary.trim()) {
    throw new Error('Formato de análisis inválido.');
  }
  const attributeChanges = parseAttributeChangesList(parsed.attributeChanges);
  const rawConf = Number(parsed.confidence);
  const confidence = Number.isFinite(rawConf) ? Math.max(0, Math.min(1, rawConf)) : 0.7;

  return {
    attributeChanges,
    confidence,
    summary: parsed.summary.trim(),
  };
}

export function parseAudioPerformance(
  rawText: string | undefined,
  finishReason: string | undefined,
): AudioPerformanceResult {
  if (finishReason !== 'STOP') {
    throw new Error('Respuesta incompleta del análisis de audio.');
  }
  const parsed = JSON.parse(rawText || '');
  if (!parsed || Array.isArray(parsed)) {
    throw new Error('Formato de análisis de audio inválido.');
  }
  const transcript = typeof parsed.transcript === 'string'
    ? parsed.transcript.trim().slice(0, 500)
    : '';
  if (transcript.length < 5) {
    throw new HttpsError(
      'invalid-argument',
      'No pudimos escuchar un comentario claro en el audio. Probá grabando de nuevo.',
    );
  }
  if (typeof parsed.summary !== 'string' || !parsed.summary.trim()) {
    throw new Error('Resumen faltante en análisis de audio.');
  }
  const attributeChanges = parseAttributeChangesList(parsed.attributeChanges);
  const rawConf = Number(parsed.confidence);
  const confidence = Number.isFinite(rawConf) ? Math.max(0, Math.min(1, rawConf)) : 0.7;

  return {
    transcript,
    attributeChanges,
    confidence,
    summary: parsed.summary.trim(),
  };
}

function createVertexClient(): GoogleGenAI {
  return new GoogleGenAI({
    vertexai: true,
    project: process.env.GCLOUD_PROJECT || admin.app().options.projectId,
    location: 'global',
  });
}

export async function analyzeTextPerformanceCore(input: {
  text: string;
  playerPosition: string;
  playerName: string;
}): Promise<TextPerformanceResult> {
  const cleanText = input.text.trim();
  if (cleanText.length < 10 || cleanText.length > 500) {
    throw new HttpsError('invalid-argument', 'La reseña debe tener entre 10 y 500 caracteres.');
  }
  const pos = VALID_POSITIONS.has(input.playerPosition.toUpperCase())
    ? input.playerPosition.toUpperCase()
    : 'MED';
  const name = input.playerName.trim() || 'Jugador';

  const genAI = createVertexClient();
  const result = await genAI.models.generateContent({
    model: MODEL_NAME,
    contents: buildTextPerformancePrompt({
      text: cleanText,
      playerPosition: pos,
      playerName: name,
    }),
    config: {
      maxOutputTokens: 1024,
      thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      httpOptions: { timeout: 60000 },
    },
  });

  return parseTextPerformance(result.text, result.candidates?.[0]?.finishReason);
}

export async function analyzeAudioPerformanceCore(input: {
  audioBuffer: Buffer;
  mimeType: string;
  playerPosition: string;
  playerName: string;
}): Promise<AudioPerformanceResult> {
  if (!input.audioBuffer || input.audioBuffer.length < 256) {
    throw new HttpsError('invalid-argument', 'El audio está vacío o es demasiado corto.');
  }
  if (input.audioBuffer.length > MAX_AUDIO_BYTES) {
    throw new HttpsError('invalid-argument', 'El audio supera el tamaño máximo permitido (2 MB).');
  }
  const cleanMime = (input.mimeType || 'audio/mp4').split(';')[0].trim().toLowerCase();
  if (!cleanMime.startsWith('audio/')) {
    throw new HttpsError('invalid-argument', 'El archivo no tiene formato de audio válido.');
  }
  const pos = VALID_POSITIONS.has(input.playerPosition.toUpperCase())
    ? input.playerPosition.toUpperCase()
    : 'MED';
  const name = input.playerName.trim() || 'Jugador';

  const genAI = createVertexClient();
  const result = await genAI.models.generateContent({
    model: MODEL_NAME,
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: cleanMime,
              data: input.audioBuffer.toString('base64'),
            },
          },
          {
            text: buildAudioPerformancePrompt({
              playerPosition: pos,
              playerName: name,
            }),
          },
        ],
      },
    ],
    config: {
      maxOutputTokens: 1536,
      thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
      responseMimeType: 'application/json',
      responseSchema: AUDIO_RESPONSE_SCHEMA,
      httpOptions: { timeout: 60000 },
    },
  });

  return parseAudioPerformance(result.text, result.candidates?.[0]?.finishReason);
}
