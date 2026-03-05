const { config } = require('dotenv');
const { join } = require('path');

// Load env
config({ path: join(process.cwd(), '.env.local') });

// Lazy import to get initialized AI
const { getAI } = require('../src/ai/genkit');

async function listModels() {
    try {
        const ai = getAI();
        // Since ai is a proxy to genkit instance, we can't easily list from it without knowing the registry structure
        // But usually we can check what's registered
        console.log('Genkit instance keys:', Object.keys(ai));

        // In newer Genkit, we might need a specific way to list models if they aren't exposed directly
        // Usually providers register models with IDs.

        // Let's try to just run a dummy prompt with a known model to see if it even works, 
        // and catch the error if it provides a list of valid models.
        try {
            await ai.generate({
                model: 'googleai/non-existent-model',
                prompt: 'hi'
            });
        } catch (e) {
            console.log('Error output (might contain valid models):', e.message);
        }

    } catch (e) {
        console.error('Crash:', e);
    }
}

listModels().then(() => process.exit(0));
