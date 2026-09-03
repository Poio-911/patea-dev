/**
 * Verifica las reglas de Firestore desplegadas ejecutando, con el SDK CLIENTE
 * (o sea, sujeto a reglas), exactamente las consultas que hace la web real.
 *
 * Objetivo doble:
 *  1) Que nada que la app necesita se haya roto al sacar el comodín.
 *  2) Que lo que ANTES se filtraba por el comodín ahora efectivamente falle.
 */
import { initializeApp } from 'firebase/app';
import {
  getFirestore, collection, collectionGroup, query, where, orderBy, limit,
  getDocs, doc, getDoc,
} from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { config } from 'dotenv';

config({ path: '.env.local' });

// La key de la web está restringida por referrer y Node no manda ninguno
// (`auth/requests-from-referer-<empty>-are-blocked`), así que este script usa
// una key propia limitada a identitytoolkit + securetoken + firestore.
//
// No otorga privilegios por sí sola: se autentica igual con usuario y
// contraseña, y lo que decide qué puede leer son las reglas — que es
// justamente lo que este script comprueba.
const API_KEY = process.env.VERIFY_RULES_API_KEY;
if (!API_KEY) {
  console.error('Falta VERIFY_RULES_API_KEY en .env.local');
  process.exit(1);
}

const app = initializeApp({
  apiKey: API_KEY,
  authDomain: 'mil-disculpis.firebaseapp.com',
  projectId: 'mil-disculpis',
  storageBucket: 'mil-disculpis.firebasestorage.app',
  messagingSenderId: '5614567933',
  appId: '1:5614567933:web:6d7b7dde5f994c36861994',
});

const db = getFirestore(app);
const auth = getAuth(app);

const PASS = [];
const FAIL = [];

async function shouldAllow(name, fn) {
  try {
    await fn();
    PASS.push(`OK   permitido  ${name}`);
  } catch (e) {
    FAIL.push(`FALLA  se rompió  ${name} -> ${e.code || e.message}`);
  }
}

async function shouldDeny(name, fn) {
  try {
    await fn();
    FAIL.push(`FUGA   sigue accesible  ${name}`);
  } catch (e) {
    if (String(e.code || '').includes('permission-denied')) {
      PASS.push(`OK   bloqueado  ${name}`);
    } else {
      FAIL.push(`?    error raro  ${name} -> ${e.code || e.message}`);
    }
  }
}

const cred = await signInWithEmailAndPassword(auth, 'briseida@test.com', '123456');
const uid = cred.user.uid;
console.log(`Sesión iniciada como ${uid}\n`);

// ── Lo que la app NECESITA que siga funcionando ──────────────────────────
await shouldAllow('players where groupId', async () => {
  const g = await getDoc(doc(db, 'users', uid));
  const gid = g.data()?.activeGroupId;
  await getDocs(query(collection(db, 'players'), where('groupId', '==', gid), orderBy('ovr', 'desc'), limit(20)));
});
await shouldAllow('matches where groupId + date', async () => {
  const g = await getDoc(doc(db, 'users', uid));
  const gid = g.data()?.activeGroupId;
  await getDocs(query(collection(db, 'matches'), where('groupId', '==', gid), orderBy('date', 'desc'), limit(20)));
});
await shouldAllow('evaluations where playerId (perfil de OTRO jugador)', () =>
  getDocs(query(collection(db, 'evaluations'), where('playerId', '==', 'cualquier-otro'), orderBy('evaluatedAt', 'desc'), limit(20))));
await shouldAllow('evaluationSubmissions where evaluatorId == yo', () =>
  getDocs(query(collection(db, 'evaluationSubmissions'), where('evaluatorId', '==', uid))));
await shouldAllow('collectionGroup assignments where evaluatorId', () =>
  getDocs(query(collectionGroup(db, 'assignments'), where('evaluatorId', '==', uid), where('status', '==', 'pending'))));
await shouldAllow('collectionGroup invitations where playerId', () =>
  getDocs(query(collectionGroup(db, 'invitations'), where('playerId', '==', uid), where('status', '==', 'pending'))));
await shouldAllow('collectionGroup selfEvaluations', () =>
  getDocs(query(collectionGroup(db, 'selfEvaluations'), limit(5))));
await shouldAllow('follows where followerId', () =>
  getDocs(query(collection(db, 'follows'), where('followerId', '==', uid))));
await shouldAllow('playerAchievements where playerId', () =>
  getDocs(query(collection(db, 'playerAchievements'), where('playerId', '==', uid))));
await shouldAllow('teamAvailabilityPosts where createdBy', () =>
  getDocs(query(collection(db, 'teamAvailabilityPosts'), where('createdBy', '==', uid), orderBy('date', 'asc'))));
await shouldAllow('teams / groups / leagues / cups / venues / availablePlayers', async () => {
  for (const c of ['teams', 'groups', 'leagues', 'cups', 'venues', 'availablePlayers']) {
    await getDocs(query(collection(db, c), limit(1)));
  }
});
await shouldAllow('feedActivities orderBy createdAt', () =>
  getDocs(query(collection(db, 'feedActivities'), orderBy('createdAt', 'desc'), limit(5))));
await shouldAllow('mis notificaciones (subcolección propia)', () =>
  getDocs(query(collection(db, 'users', uid, 'notifications'), orderBy('createdAt', 'desc'), limit(5))));

// ── Lo que ANTES filtraba el comodín y ahora debe estar cerrado ──────────
await shouldDeny('ai_cache (declarado if false, antes accesible)', () =>
  getDocs(query(collection(db, 'ai_cache'), limit(1))));
await shouldDeny('creditTransactions de cualquiera', () =>
  getDocs(query(collection(db, 'creditTransactions'), limit(1))));
await shouldDeny('evaluationSubmissions de OTROS (sin filtro por evaluatorId)', () =>
  getDocs(query(collection(db, 'evaluationSubmissions'), limit(1))));
await shouldDeny('systemLogs', () =>
  getDocs(query(collection(db, 'systemLogs'), limit(1))));
await shouldDeny('healthConnections (datos de salud)', () =>
  getDocs(query(collection(db, 'healthConnections'), limit(1))));
await shouldDeny('tokens FCM de otro usuario', () =>
  getDocs(query(collection(db, 'users', 'OTRO_UID_CUALQUIERA', 'fcmTokens'), limit(1))));
await shouldDeny('notificaciones de otro usuario', () =>
  getDocs(query(collection(db, 'users', 'OTRO_UID_CUALQUIERA', 'notifications'), limit(1))));
await shouldDeny('colección inventada (el comodín la habría permitido)', () =>
  getDocs(query(collection(db, 'coleccionQueNoExisteEnLasReglas'), limit(1))));

console.log(PASS.join('\n'));
if (FAIL.length) {
  console.log('\n──────── PROBLEMAS ────────');
  console.log(FAIL.join('\n'));
}
console.log(`\nResultado: ${PASS.length} OK, ${FAIL.length} problemas`);
process.exit(FAIL.length ? 1 : 0);
