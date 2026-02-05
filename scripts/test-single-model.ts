import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, cert, getApps, ServiceAccount } from 'firebase-admin/app';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

if (getApps().length === 0) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        const s = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        initializeApp({ credential: cert(s as ServiceAccount), projectId: s.project_id });
    }
}

async function runTest() {
    const modelName = 'googleai/gemini-1.5-flash-latest';
    console.log(`\n🧪 Testing model: ${modelName}`);
    try {
        const { getAI } = await import('../src/ai/genkit');
        const ai = getAI();
        const { generate } = await import('@genkit-ai/ai');

        const response = await ai.generate({
            model: modelName,
            prompt: 'Say "Hello World"',
            config: { temperature: 0.1 }
        });

        console.log(`✅ Success! Response: ${response.text}`);
    } catch (error: any) {
        console.error(`❌ Failed: ${error.message}`);
        if (error.details) console.error("Details:", error.details);
    }
}

runTest().catch(console.error);
