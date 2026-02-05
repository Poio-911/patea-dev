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

// Mock input data
const mockInput = {
    matchTitle: "Partido de Prueba",
    team1Name: "Equipo A",
    team1Score: 3,
    team2Name: "Equipo B",
    team2Score: 2,
    mvp: {
        name: "Lionel Messi",
        reason: "Hizo 3 goles"
    },
    keyEvents: [
        { minute: 10, type: "Goal" as const, playerName: "Lionel Messi", description: "Golazo de tiro libre" },
        { minute: 45, type: "KeyPlay" as const, playerName: "Dibú Martínez", description: "Atajada espectacular" }
    ],
    playerChronicles: [
        { playerName: "Lionel Messi", chronicle: "Fue un partido difícil pero pudimos ganar.", position: "DEL" }
    ],
    topPerformanceTags: [
        { playerName: "Lionel Messi", tagName: "Francotirador", tagDescription: "Precisión letal", impact: "positive" as const }
    ]
};

async function testFlow() {
    console.log("Testing Genkit Flow with model: googleai/gemini-1.5-flash (Updated)");
    try {
        // 2. Dynamic import after env is loaded
        const { generateMatchChronicleFlow } = await import('../src/ai/flows/generate-match-chronicle');

        const result = await generateMatchChronicleFlow(mockInput);
        console.log("✅ Success!");
        console.log(JSON.stringify(result, null, 2));
    } catch (error: any) {
        console.error("❌ Failed:");
        console.error(error);
        if (error.status) console.error("Status:", error.status);
        if (error.details) console.error("Details:", error.details);
    }
}

testFlow().catch(console.error);
