import { initializeApp, cert, getApps, ServiceAccount } from 'firebase-admin/app';
import { getFirestore, WriteBatch } from 'firebase-admin/firestore';
import { config } from 'dotenv';
import { join } from 'path';

// Cargar variables de entorno desde .env.local
config({ path: join(process.cwd(), '.env.local') });

// Inicializar Firebase Admin
function initializeFirebaseAdmin() {
  if (getApps().length === 0) {
    // Explicitly disable emulator to force production connection
    delete process.env.FIRESTORE_EMULATOR_HOST;
    delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
    delete process.env.FIREBASE_STORAGE_EMULATOR_HOST;

    const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!rawServiceAccount) {
      console.error('❌ FIREBASE_SERVICE_ACCOUNT_KEY no encontrada en .env.local');
      console.log('\n📝 Asegúrate de tener un archivo .env.local con:');
      console.log('   FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}');
      process.exit(1);
    }

    try {
      const serviceAccountJson = JSON.parse(rawServiceAccount);
      console.log('✅ Service account cargado. Project ID:', serviceAccountJson.project_id);

      initializeApp({
        credential: cert(serviceAccountJson as ServiceAccount),
        projectId: serviceAccountJson.project_id,
      });

      console.log('✅ Firebase Admin inicializado\n');
    } catch (e: any) {
      console.error('❌ Error al parsear FIREBASE_SERVICE_ACCOUNT_KEY:', e.message);
      console.log('   Asegúrate de que sea un JSON válido');
      process.exit(1);
    }
  }
}

// Inicializar
initializeFirebaseAdmin();
const db = getFirestore();

// Constantes
const BATCH_SIZE = 500; // Firestore permite máximo 500 operaciones por batch

// Función para borrar una colección completa
async function deleteCollection(collectionPath: string): Promise<number> {
  const collectionRef = db.collection(collectionPath);
  let totalDeleted = 0;

  while (true) {
    const snapshot = await collectionRef.limit(BATCH_SIZE).get();

    if (snapshot.empty) {
      break;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    totalDeleted += snapshot.size;
    console.log(`   Borrados ${totalDeleted} documentos de ${collectionPath}...`);
  }

  return totalDeleted;
}

// Función para borrar subcolecciones de todos los documentos de una colección
async function deleteSubcollections(
  parentCollectionPath: string,
  subcollectionNames: string[]
): Promise<number> {
  const parentRef = db.collection(parentCollectionPath);
  let totalDeleted = 0;

  const snapshot = await parentRef.get();
  console.log(`   Encontrados ${snapshot.size} documentos en ${parentCollectionPath}`);

  for (const doc of snapshot.docs) {
    for (const subcollectionName of subcollectionNames) {
      const subcollectionPath = `${parentCollectionPath}/${doc.id}/${subcollectionName}`;
      const deleted = await deleteCollection(subcollectionPath);
      if (deleted > 0) {
        console.log(`   ✓ Borrados ${deleted} docs de ${subcollectionPath}`);
        totalDeleted += deleted;
      }
    }
  }

  return totalDeleted;
}

// Función para resetear stats de jugadores
async function resetPlayerStats(): Promise<number> {
  const playersRef = db.collection('players');
  const snapshot = await playersRef.get();
  let totalUpdated = 0;

  console.log(`   Encontrados ${snapshot.size} jugadores`);

  // Procesar en batches
  const docs = snapshot.docs;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = docs.slice(i, i + BATCH_SIZE);

    for (const doc of chunk) {
      batch.update(doc.ref, {
        'stats.matchesPlayed': 0,
        'stats.goals': 0,
        'stats.assists': 0,
        'stats.averageRating': 0,
      });
      totalUpdated++;
    }

    await batch.commit();
    console.log(`   Actualizados ${Math.min(i + BATCH_SIZE, docs.length)}/${docs.length} jugadores...`);
  }

  return totalUpdated;
}

// Función para borrar historial OVR de jugadores
async function deleteOvrHistory(): Promise<number> {
  return await deleteSubcollections('players', ['ovrHistory']);
}

// Función para borrar notificaciones de usuarios
async function deleteUserNotifications(): Promise<number> {
  return await deleteSubcollections('users', ['notifications']);
}

// Función principal de limpieza
async function cleanDatabase() {
  console.log('🧹 LIMPIEZA DE BASE DE DATOS FIRESTORE');
  console.log('=====================================\n');
  console.log('⚠️  ATENCIÓN: Este script borrará datos de prueba.\n');
  console.log('📋 Colecciones a BORRAR:');
  console.log('   - matches (con subcolecciones)');
  console.log('   - evaluations');
  console.log('   - evaluationSubmissions');
  console.log('   - socialActivities');
  console.log('   - notifications (subcolección de users)');
  console.log('   - ovrHistory (subcolección de players)\n');
  console.log('📋 Colecciones a MANTENER:');
  console.log('   - users (sin notifications)');
  console.log('   - groups');
  console.log('   - players (con stats reseteados)\n');
  console.log('=====================================\n');

  const stats = {
    matches: 0,
    matchSubcollections: 0,
    evaluations: 0,
    evaluationSubmissions: 0,
    socialActivities: 0,
    userNotifications: 0,
    ovrHistory: 0,
    playersReset: 0,
  };

  // 1. Borrar subcolecciones de matches primero
  console.log('📦 [1/8] Borrando subcolecciones de matches...');
  stats.matchSubcollections = await deleteSubcollections('matches', [
    'assignments',
    'selfEvaluations',
    'processedSubmissions',
  ]);
  console.log(`   ✅ Total: ${stats.matchSubcollections} documentos\n`);

  // 2. Borrar colección matches
  console.log('📦 [2/8] Borrando colección matches...');
  stats.matches = await deleteCollection('matches');
  console.log(`   ✅ Total: ${stats.matches} documentos\n`);

  // 3. Borrar colección evaluations
  console.log('📦 [3/8] Borrando colección evaluations...');
  stats.evaluations = await deleteCollection('evaluations');
  console.log(`   ✅ Total: ${stats.evaluations} documentos\n`);

  // 4. Borrar colección evaluationSubmissions
  console.log('📦 [4/8] Borrando colección evaluationSubmissions...');
  stats.evaluationSubmissions = await deleteCollection('evaluationSubmissions');
  console.log(`   ✅ Total: ${stats.evaluationSubmissions} documentos\n`);

  // 5. Borrar colección socialActivities
  console.log('📦 [5/8] Borrando colección socialActivities...');
  stats.socialActivities = await deleteCollection('socialActivities');
  console.log(`   ✅ Total: ${stats.socialActivities} documentos\n`);

  // 6. Borrar notificaciones de usuarios
  console.log('📦 [6/8] Borrando notificaciones de usuarios...');
  stats.userNotifications = await deleteUserNotifications();
  console.log(`   ✅ Total: ${stats.userNotifications} documentos\n`);

  // 7. Borrar historial OVR de jugadores
  console.log('📦 [7/8] Borrando historial OVR de jugadores...');
  stats.ovrHistory = await deleteOvrHistory();
  console.log(`   ✅ Total: ${stats.ovrHistory} documentos\n`);

  // 8. Resetear stats de jugadores
  console.log('📦 [8/8] Reseteando stats de jugadores...');
  stats.playersReset = await resetPlayerStats();
  console.log(`   ✅ Total: ${stats.playersReset} jugadores actualizados\n`);

  // Resumen final
  console.log('=====================================');
  console.log('📊 RESUMEN DE LIMPIEZA');
  console.log('=====================================');
  console.log(`   Matches borrados:           ${stats.matches}`);
  console.log(`   Subcolecciones de matches:  ${stats.matchSubcollections}`);
  console.log(`   Evaluations borradas:       ${stats.evaluations}`);
  console.log(`   EvaluationSubmissions:      ${stats.evaluationSubmissions}`);
  console.log(`   Social activities:          ${stats.socialActivities}`);
  console.log(`   Notificaciones usuarios:    ${stats.userNotifications}`);
  console.log(`   Historial OVR:              ${stats.ovrHistory}`);
  console.log(`   Jugadores reseteados:       ${stats.playersReset}`);
  console.log('-------------------------------------');
  const totalDeleted =
    stats.matches +
    stats.matchSubcollections +
    stats.evaluations +
    stats.evaluationSubmissions +
    stats.socialActivities +
    stats.userNotifications +
    stats.ovrHistory;
  console.log(`   TOTAL DOCUMENTOS BORRADOS:  ${totalDeleted}`);
  console.log('=====================================\n');

  // Verificación
  console.log('✅ VERIFICACIÓN:');
  const usersCount = (await db.collection('users').count().get()).data().count;
  const groupsCount = (await db.collection('groups').count().get()).data().count;
  const playersCount = (await db.collection('players').count().get()).data().count;
  const matchesCount = (await db.collection('matches').count().get()).data().count;

  console.log(`   - Usuarios existentes: ${usersCount}`);
  console.log(`   - Grupos existentes: ${groupsCount}`);
  console.log(`   - Jugadores existentes: ${playersCount}`);
  console.log(`   - Partidos restantes: ${matchesCount}`);

  if (matchesCount === 0) {
    console.log('\n✅ Base de datos limpia correctamente!');
  } else {
    console.log('\n⚠️  Aún quedan partidos en la base de datos');
  }
}

// Ejecutar script
cleanDatabase()
  .then(() => {
    console.log('\n🎉 Script completado!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error en el script:', error);
    process.exit(1);
  });
