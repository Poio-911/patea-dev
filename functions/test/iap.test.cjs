const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync, verify } = require('node:crypto');
const iap = require('../lib/lib/iap');

const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const config = {
  issuerId: 'issuer-1',
  keyId: 'KEY123',
  privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }),
};
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jws = (payload) => `${b64u({ alg: 'ES256' })}.${b64u(payload)}.firma`;

test('el JWT de Apple es ES256 con los claims que pide la App Store Server API', () => {
  const token = iap.buildAppleJwt(config, 1_800_000_000);
  const [h, p, s] = token.split('.');
  const header = JSON.parse(Buffer.from(h, 'base64url'));
  const payload = JSON.parse(Buffer.from(p, 'base64url'));
  assert.deepEqual(header, { alg: 'ES256', kid: 'KEY123', typ: 'JWT' });
  assert.equal(payload.iss, 'issuer-1');
  assert.equal(payload.aud, 'appstoreconnect-v1');
  assert.equal(payload.bid, 'com.patea.app');
  assert.equal(payload.exp - payload.iat, 300);
  const ok = verify('sha256', Buffer.from(`${h}.${p}`), { key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(s, 'base64url'));
  assert.equal(ok, true, 'la firma tiene que ser r||s y verificarse con la clave pública');
});

test('prueba producción y cae al sandbox cuando Apple dice 404', async () => {
  const calls = [];
  const fetcher = async (url) => {
    calls.push(url);
    if (url.startsWith(iap.APPLE_PRODUCTION_URL)) return { status: 404, json: async () => ({}) };
    return { status: 200, json: async () => ({ signedTransactionInfo: jws({ transactionId: '123456', bundleId: 'com.patea.app', productId: 'com.patea.app.credits_15', type: 'Consumable', environment: 'Sandbox' }) }) };
  };
  const tx = await iap.fetchAppleTransaction('123456', config, fetcher);
  assert.equal(tx.environment, 'Sandbox');
  assert.equal(calls.length, 2);
  assert.ok(calls[0].includes('/inApps/v1/transactions/123456'));
});

test('un 401 en todos los entornos es un error de configuración, no "compra inexistente"', async () => {
  await assert.rejects(iap.fetchAppleTransaction('123456', config, async () => ({ status: 401, json: async () => ({}) })), /401/);
  const none = await iap.fetchAppleTransaction('123456', config, async () => ({ status: 404, json: async () => ({}) }));
  assert.equal(none, null);
});

test('solo entrega créditos si la compra es de esta app, de ese producto y no fue reembolsada', () => {
  const tx = { transactionId: '1', bundleId: 'com.patea.app', productId: 'com.patea.app.credits_5', type: 'Consumable' };
  assert.deepEqual(iap.checkPurchase(tx, 'com.patea.app.credits_5'), { ok: true, credits: 5 });
  assert.equal(iap.checkPurchase(null, 'com.patea.app.credits_5').ok, false);
  assert.equal(iap.checkPurchase({ ...tx, bundleId: 'otra.app' }, 'com.patea.app.credits_5').ok, false);
  assert.equal(iap.checkPurchase(tx, 'com.patea.app.credits_40').ok, false);
  assert.equal(iap.checkPurchase({ ...tx, revocationDate: 1 }, 'com.patea.app.credits_5').ok, false);
  assert.equal(iap.checkPurchase({ ...tx, type: 'Auto-Renewable Subscription' }, 'com.patea.app.credits_5').ok, false);
  const unknown = { ...tx, productId: 'com.patea.app.regalo' };
  assert.equal(iap.checkPurchase(unknown, 'com.patea.app.regalo').ok, false);
});

test('los créditos gratuitos se gastan antes que los comprados', () => {
  assert.deepEqual(iap.planCreditSpend(3, 10), { ok: true, useFree: true, usePurchased: false, remaining: 12 });
  assert.deepEqual(iap.planCreditSpend(0, 10), { ok: true, useFree: false, usePurchased: true, remaining: 9 });
  assert.deepEqual(iap.planCreditSpend(0, 1), { ok: true, useFree: false, usePurchased: true, remaining: 0 });
  assert.equal(iap.planCreditSpend(0, 0).ok, false);
  assert.equal(iap.planCreditSpend(0, undefined).ok, false);
});

test('un perfil sin tope de créditos gratuitos mantiene el comportamiento anterior', () => {
  assert.deepEqual(iap.planCreditSpend(undefined, 5), { ok: true, useFree: false, usePurchased: false, remaining: null });
});

test('si producción da 401 (app sin publicar) igual se consulta el sandbox', async () => {
  const fetcher = async (url) => url.startsWith(iap.APPLE_PRODUCTION_URL)
    ? { status: 401, json: async () => ({}) }
    : { status: 200, json: async () => ({ signedTransactionInfo: jws({ transactionId: '999999', bundleId: 'com.patea.app', productId: 'com.patea.app.credits_5', type: 'Consumable', environment: 'Sandbox' }) }) };
  const tx = await iap.fetchAppleTransaction('999999', config, fetcher);
  assert.equal(tx.environment, 'Sandbox');
});
