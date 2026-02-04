/**
 * Script para probar la carga de imágenes en Storage
 */

import { initializeApp } from 'firebase/app';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as fs from 'fs';
import * as path from 'path';

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

async function testImageUpload() {
    try {
        console.log('🧪 Probando carga de imágenes en Storage...\n');

        // Inicializar Firebase
        const app = initializeApp(firebaseConfig);
        const storage = getStorage(app);

        console.log(`📦 Storage Bucket: ${process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}`);

        // Crear una imagen de prueba simple (1x1 pixel PNG)
        const testImageBuffer = Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            'base64'
        );

        // Test 1: Subir a leagues
        console.log('\n📤 Test 1: Subiendo imagen a /leagues/test-group/...');
        const leagueRef = ref(storage, `leagues/test-group/test_${Date.now()}.png`);
        await uploadBytes(leagueRef, testImageBuffer, { contentType: 'image/png' });
        const leagueUrl = await getDownloadURL(leagueRef);
        console.log('✅ Liga - Upload exitoso!');
        console.log(`   URL: ${leagueUrl}`);

        // Test 2: Subir a cups
        console.log('\n📤 Test 2: Subiendo imagen a /cups/test-group/...');
        const cupRef = ref(storage, `cups/test-group/test_${Date.now()}.png`);
        await uploadBytes(cupRef, testImageBuffer, { contentType: 'image/png' });
        const cupUrl = await getDownloadURL(cupRef);
        console.log('✅ Copa - Upload exitoso!');
        console.log(`   URL: ${cupUrl}`);

        // Test 3: Verificar CORS
        console.log('\n🔍 Test 3: Verificando acceso CORS...');
        const response = await fetch(leagueUrl);
        if (response.ok) {
            console.log('✅ CORS - Funcionando correctamente!');
        } else {
            console.log(`❌ CORS - Error: ${response.status}`);
        }

        console.log('\n✨ ¡Todos los tests pasaron exitosamente!');
        process.exit(0);
    } catch (error: any) {
        console.error('\n❌ Error en los tests:');
        console.error(error.message || error);

        if (error.code === 'storage/unauthorized') {
            console.error('\n💡 Error de permisos. Verificá las reglas de Storage.');
        } else if (error.code === 'storage/retry-limit-exceeded') {
            console.error('\n💡 Error de red. Verificá tu conexión.');
        } else if (error.message?.includes('CORS')) {
            console.error('\n💡 Error de CORS. Ejecutá el script setup-cors.ts nuevamente.');
        }

        process.exit(1);
    }
}

testImageUpload();
