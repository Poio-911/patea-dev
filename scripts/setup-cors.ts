/**
 * Script simple para configurar CORS - solo necesita las credenciales que ya tenés
 */

import * as dotenv from 'dotenv';
import { Storage } from '@google-cloud/storage';

// Cargar variables de entorno
dotenv.config({ path: '.env.local' });

async function configureCORS() {
    try {
        console.log('🔧 Configurando CORS en Firebase Storage...\n');

        // Obtener credenciales del service account
        const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

        if (!serviceAccountKey) {
            throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY no está configurado en .env.local');
        }

        // Parsear las credenciales
        const credentials = JSON.parse(serviceAccountKey);

        // Inicializar Storage con las credenciales
        const storage = new Storage({
            projectId: credentials.project_id,
            credentials: credentials
        });

        const bucketName = 'mil-disculpis.firebasestorage.app';
        const bucket = storage.bucket(bucketName);

        console.log(`📦 Bucket: ${bucketName}`);

        // Configuración CORS
        const corsConfiguration = [
            {
                origin: ['*'],
                method: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD'],
                maxAgeSeconds: 3600,
                responseHeader: [
                    'Content-Type',
                    'Authorization',
                    'Content-Length',
                    'User-Agent',
                    'X-Requested-With',
                    'Access-Control-Allow-Origin'
                ]
            }
        ];

        console.log('\n📋 Aplicando configuración CORS...');

        // Aplicar configuración CORS
        await bucket.setCorsConfiguration(corsConfiguration);

        console.log('\n✅ ¡CORS configurado exitosamente!');
        console.log('\nConfiguración aplicada:');
        console.log(JSON.stringify(corsConfiguration, null, 2));

        // Verificar configuración
        const [metadata] = await bucket.getMetadata();
        console.log('\n🔍 Verificación - CORS actual:');
        if (metadata.cors) {
            console.log(JSON.stringify(metadata.cors, null, 2));
        } else {
            console.log('No se pudo verificar CORS, pero debería estar aplicado.');
        }

        console.log('\n✨ ¡Listo! Ahora podés probar:');
        console.log('   1. Subir/editar foto de perfil');
        console.log('   2. Generar imagen con IA');

        process.exit(0);
    } catch (error: any) {
        console.error('\n❌ Error configurando CORS:');
        console.error(error.message || error);

        if (error.code === 7) {
            console.error('\n💡 Error de permisos. Asegurate de que el service account tenga permisos de Storage Admin.');
        }

        process.exit(1);
    }
}

configureCORS();
