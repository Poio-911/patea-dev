import { createPrivateKey, sign as cryptoSign } from 'crypto';

/**
 * Compras integradas de la App Store: catálogo y validación con la
 * App Store Server API.
 *
 * Los créditos de IA son un bien digital, así que en iOS tienen que venderse con
 * compras integradas (guideline 3.1.1). Nunca se otorgan créditos por lo que diga
 * la app: el servidor le pregunta a Apple por la transacción y recién ahí suma.
 */

export const BUNDLE_ID = 'com.patea.app';

/** Producto de App Store Connect → créditos de IA que entrega. */
export const CREDIT_PRODUCTS: Readonly<Record<string, number>> = {
  'com.patea.app.credits_5': 5,
  'com.patea.app.credits_15': 15,
  'com.patea.app.credits_40': 40,
};

export interface AppleIapConfig {
  issuerId: string;
  keyId: string;
  privateKey: string;
}

export interface AppleTransaction {
  transactionId: string;
  originalTransactionId?: string;
  bundleId: string;
  productId: string;
  type?: string;
  environment?: string;
  revocationDate?: number;
  purchaseDate?: number;
}

const b64url = (input: Buffer | string): string =>
  Buffer.from(input).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

/** Decodifica el payload de un JWS sin verificar la firma (ver `fetchAppleTransaction`). */
export function decodeJwsPayload<T = Record<string, unknown>>(jws: string): T {
  const parts = jws.split('.');
  if (parts.length !== 3) throw new Error('JWS inválido');
  const json = Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  return JSON.parse(json) as T;
}

/**
 * JWT ES256 para autenticar contra la App Store Server API. Dura 5 minutos.
 * Apple entrega la clave en PKCS#8 (.p8) y pide la firma en formato r||s, no DER.
 */
export function buildAppleJwt(config: AppleIapConfig, nowSeconds = Math.floor(Date.now() / 1000)): string {
  const header = { alg: 'ES256', kid: config.keyId, typ: 'JWT' };
  const payload = {
    iss: config.issuerId,
    iat: nowSeconds,
    exp: nowSeconds + 300,
    aud: 'appstoreconnect-v1',
    bid: BUNDLE_ID,
  };
  const data = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const key = createPrivateKey(config.privateKey);
  const signature = cryptoSign('sha256', Buffer.from(data), { key, dsaEncoding: 'ieee-p1363' });
  return `${data}.${b64url(signature)}`;
}

export const APPLE_PRODUCTION_URL = 'https://api.storekit.itunes.apple.com';
export const APPLE_SANDBOX_URL = 'https://api.storekit-sandbox.itunes.apple.com';

type Fetcher = (url: string, init: { headers: Record<string, string> }) => Promise<{
  status: number;
  json: () => Promise<any>;
}>;

/**
 * Pide a Apple los datos de una transacción. Prueba producción y, si Apple dice
 * que no existe ahí, el sandbox (App Review y los testers compran en sandbox con
 * el mismo binario de producción).
 *
 * Esa respuesta llega directo de Apple por TLS, así que no hace falta validar la
 * cadena de certificados del JWS (la propia documentación de Apple lo permite).
 */
export async function fetchAppleTransaction(
  transactionId: string,
  config: AppleIapConfig,
  fetcher: Fetcher = fetch as unknown as Fetcher,
): Promise<AppleTransaction | null> {
  const jwt = buildAppleJwt(config);
  for (const base of [APPLE_PRODUCTION_URL, APPLE_SANDBOX_URL]) {
    const response = await fetcher(`${base}/inApps/v1/transactions/${encodeURIComponent(transactionId)}`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    if (response.status === 404) continue;
    if (response.status === 401) throw new Error('Apple rechazó las credenciales de compras (401).');
    if (response.status !== 200) throw new Error(`Apple respondió ${response.status}.`);
    const body = await response.json();
    if (typeof body?.signedTransactionInfo !== 'string') throw new Error('Respuesta de Apple inesperada.');
    return decodeJwsPayload<AppleTransaction>(body.signedTransactionInfo);
  }
  return null;
}

export type PurchaseCheck = { ok: true; credits: number } | { ok: false; reason: string };

/** Qué tiene que cumplir una transacción de Apple para entregar créditos. */
export function checkPurchase(tx: AppleTransaction | null, claimedProductId: string): PurchaseCheck {
  if (!tx) return { ok: false, reason: 'Apple no encontró la compra.' };
  if (tx.bundleId !== BUNDLE_ID) return { ok: false, reason: 'La compra es de otra app.' };
  if (tx.productId !== claimedProductId) return { ok: false, reason: 'La compra no coincide con el producto.' };
  if (tx.revocationDate) return { ok: false, reason: 'La compra fue reembolsada.' };
  if (tx.type && tx.type !== 'Consumable') return { ok: false, reason: 'Tipo de compra inesperado.' };
  const credits = CREDIT_PRODUCTS[tx.productId];
  if (!credits) return { ok: false, reason: 'Producto desconocido.' };
  return { ok: true, credits };
}

/**
 * Consumo de créditos: primero los gratuitos del mes, después los comprados.
 * Los comprados no vencen ni los pisa el reinicio mensual.
 */
export function planCreditSpend(free: unknown, purchased: unknown):
  | { ok: true; useFree: boolean; usePurchased: boolean; remaining: number | null }
  | { ok: false } {
  // Un perfil sin el campo (muy viejo) no tiene tope: se mantiene el comportamiento anterior.
  if (typeof free !== 'number') return { ok: true, useFree: false, usePurchased: false, remaining: null };
  const bought = typeof purchased === 'number' && purchased > 0 ? purchased : 0;
  if (free > 0) return { ok: true, useFree: true, usePurchased: false, remaining: free - 1 + bought };
  if (bought > 0) return { ok: true, useFree: false, usePurchased: true, remaining: bought - 1 };
  return { ok: false };
}
