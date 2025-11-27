import { initializeApp, cert, getApps, ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
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

// Paquetes de créditos a crear
const creditPackages = [
  {
    id: 'package_10',
    credits: 10,
    price: 500,
    title: 'Paquete Básico',
    description: '10 generaciones de IA',
    popular: false,
    discountPercentage: 0,
  },
  {
    id: 'package_25',
    credits: 25,
    price: 1000,
    title: 'Paquete Intermedio',
    description: '25 generaciones de IA',
    popular: true, // Marcado como popular
    discountPercentage: 20,
  },
  {
    id: 'package_50',
    credits: 50,
    price: 1750,
    title: 'Paquete Avanzado',
    description: '50 generaciones de IA',
    popular: false,
    discountPercentage: 30,
  },
  {
    id: 'package_100',
    credits: 100,
    price: 3000,
    title: 'Paquete Premium',
    description: '100 generaciones de IA',
    popular: false,
    discountPercentage: 40,
  },
];

async function initCreditPackages() {
  console.log('🚀 Iniciando creación de paquetes de créditos...\n');

  for (const pkg of creditPackages) {
    try {
      const docRef = db.collection('creditPackages').doc(pkg.id);
      await docRef.set(pkg);

      console.log(`✅ Creado: ${pkg.title}`);
      console.log(`   - Créditos: ${pkg.credits}`);
      console.log(`   - Precio: $${pkg.price}`);
      console.log(`   - Descuento: ${pkg.discountPercentage}%`);
      console.log(`   - Popular: ${pkg.popular ? 'Sí' : 'No'}\n`);
    } catch (error) {
      console.error(`❌ Error creando ${pkg.title}:`, error);
    }
  }

  console.log('✅ Todos los paquetes de créditos fueron creados exitosamente!');
  console.log('\n📦 Resumen:');
  console.log(`   - Total de paquetes: ${creditPackages.length}`);
  console.log(`   - Precio mínimo: $${Math.min(...creditPackages.map(p => p.price))}`);
  console.log(`   - Precio máximo: $${Math.max(...creditPackages.map(p => p.price))}`);
  console.log(`   - Créditos totales disponibles: ${creditPackages.reduce((sum, p) => sum + p.credits, 0)}`);
}

// Ejecutar script
initCreditPackages()
  .then(() => {
    console.log('\n🎉 Script completado!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error en el script:', error);
    process.exit(1);
  });
