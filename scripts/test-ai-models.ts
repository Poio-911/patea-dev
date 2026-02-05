import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, cert, getApps, ServiceAccount } from 'firebase-admin/app';
import { config } from 'dotenv';
import { join } from 'path';

// 1. Load env first
config({ path: join(process.cwd(), '.env.local') });

if (getApps().length === 0) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        const s = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        initializeApp({ credential: cert(s as ServiceAccount), projectId: s.project_id });
    }
}

async function testModel(modelName: string) {
    console.log(`\n🧪 Testing model: ${modelName}`);
    try {
        const { getAI } = await import('../src/ai/genkit');
        // We need to bypass the flow ensuring we call generate directly to test model,
        // but generateMatchChronicleFlow uses 'prompt' helper which wraps generate.
        // It's easier to use the flow but override model? 
        // No, flow defines model.
        // We will invoke the Genkit instance directly if possible.

        const ai = getAI();
        const { generate } = await import('@genkit-ai/ai');
        // Note: genkit 0.9+ syntax might differ. 
        // src/ai/genkit.ts exports `ai` proxy.

        // Let's try defining a simple flow or prompting directly
        const response = await ai.generate({
            model: modelName,
            prompt: 'Say "Hello World"',
            config: { temperature: 0.1 }
        });

        console.log(`✅ Success! Response: ${response.text}`);
        return true;
    } catch (error: any) {
        console.error(`❌ Failed: ${error.message}`);
        // console.error(error);
        return false;
    }
}

async function runTests() {
    console.log("Checking available models...");

    const modelsToTest = [
        'googleai/gemini-1.5-flash',
        'googleai/gemini-1.5-flash-latest',
        'googleai/gemini-1.5-pro',
        'googleai/gemini-pro',
        'googleai/gemini-1.0-pro'
    ];

    for (const m of modelsToTest) {
        const success = await testModel(m);
        if (success) {
            console.log(`\n🎉 Found working model: ${m}`);
            break;
        }
    }
}

runTests().catch(console.error);
