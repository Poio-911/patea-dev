const { config } = require('dotenv');
const { join } = require('path');

// Load env
config({ path: join(process.cwd(), '.env.local') });

async function listModels() {
    try {
        const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error('No API Key found in .env.local');
            return;
        }

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();

        if (data.models) {
            console.log('Available models:');
            data.models.forEach(m => {
                console.log(`- ${m.name}`);
            });
        } else {
            console.log('No models found or error:', JSON.stringify(data, null, 2));
        }

    } catch (e) {
        console.error('Crash:', e);
    }
}

listModels().then(() => process.exit(0));
