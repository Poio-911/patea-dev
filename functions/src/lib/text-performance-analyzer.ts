import * as admin from 'firebase-admin';
import { GoogleGenAI, ThinkingLevel, Type as SchemaType } from '@google/genai';
import { HttpsError } from 'firebase-functions/v2/https';

const MODEL_NAME = 'gemini-3.1-flash-lite';
const VALID_ATTRS = new Set(['pac', 'sho', 'pas', 'dri', 'def', 'phy']);
const VALID_POSITIONS = new Set(['DEL', 'MED', 'DEF', 'POR']);

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

export function buildTextPerformancePrompt(input: {
  text: string;
  playerPosition: string;
  playerName: string;
}): string {
  return `Sos un analista de fútbol amateur en Uruguay. Analizá el siguiente comentario sobre el rendimiento de ${input.playerName} (posición: ${input.playerPosition}) en un partido:

"${input.text}"

Basándote en este comentario, determiná qué ATRIBUTOS deben cambiar y en cuánto.

Atributos disponibles:
- pac: Velocidad/Ritmo (sprints, velocidad, aceleración)
- sho: Tiro/Disparo (goles, remates, definición, potencia de tiro)
- pas: Pase (precisión de pases, visión, asistencias, distribución)
- dri: Regate/Dribling (control de balón, gambetas, habilidad técnica)
- def: Defensa (marcaje, recuperación, intercepciones, cierres)
- phy: Físico (fuerza, resistencia, aguante, duelos aéreos)

Reglas:
- Extraé entre 1 y 4 cambios de atributos (sin repetir atributos)
- Cada cambio debe ser entero entre -3 y +3 (distinto de 0)
- Si el comentario menciona algo POSITIVO → cambio positivo (+1 a +3)
- Si menciona algo NEGATIVO → cambio negativo (-1 a -3)
- Intensidad: "muy bueno/excelente/destacado" → +2 o +3; "bueno/bien" → +1; "mal/flojo" → -1; "muy mal/pésimo" → -2 o -3
- Priorizá atributos relevantes para la posición (${input.playerPosition})
- Generá un resumen MUY BREVE (1 frase en español rioplatense) del rendimiento.
- Evaluá tu confianza (0 a 1): alta si el texto es claro y específico, baja si es ambiguo.`;
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
  if (!Array.isArray(parsed.attributeChanges) || parsed.attributeChanges.length === 0) {
    throw new Error('Sin cambios de atributos.');
  }

  const seen = new Set<string>();
  const attributeChanges: AttributeChange[] = [];
  for (const item of parsed.attributeChanges) {
    if (!item || typeof item !== 'object') continue;
    const attr = String(item.attribute ?? '').toLowerCase();
    if (!VALID_ATTRS.has(attr) || seen.has(attr)) continue;
    const rawChange = Number(item.change);
    if (!Number.isFinite(rawChange)) continue;
    const clamped = Math.max(-3, Math.min(3, Math.round(rawChange)));
    if (clamped === 0) continue;
    const reason = typeof item.reason === 'string' && item.reason.trim()
      ? item.reason.trim()
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

  const rawConf = Number(parsed.confidence);
  const confidence = Number.isFinite(rawConf) ? Math.max(0, Math.min(1, rawConf)) : 0.7;

  return {
    attributeChanges,
    confidence,
    summary: parsed.summary.trim(),
  };
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

  const genAI = new GoogleGenAI({
    vertexai: true,
    project: process.env.GCLOUD_PROJECT || admin.app().options.projectId,
    location: 'global',
  });

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
