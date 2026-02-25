import { getAdminDb } from '../src/firebase/admin-init';
import { FieldValue } from 'firebase-admin/firestore';

async function seedAiEvaluations(matchId: string) {
    const db = getAdminDb();
    const matchRef = db.collection('matches').doc(matchId);

    console.log(`[seed] Starting AI Evaluation Seed for match ${matchId}...`);

    try {
        const matchSnap = await matchRef.get();
        if (!matchSnap.exists) {
            console.error(`[seed] Match ${matchId} not found.`);
            return;
        }

        const match = matchSnap.data() as any;
        const players = match.players || [];
        const playerUids = match.playerUids || [];

        if (players.length === 0) {
            console.error(`[seed] Match has no players.`);
            return;
        }

        console.log(`[seed] Found ${players.length} players. Seeding evaluations...`);

        const uniqueChronicles = [
            "Fue un partido de ida y vuelta, me sentí muy cómodo dominando el mediocampo.",
            "No paré de correr en todo el encuentro, el sacrificio valió la pena para la victoria.",
            "Lástima que no se nos dio el resultado, pero a nivel personal me voy conforme con mi entrega.",
            "Meter ese gol en los últimos minutos fue una descarga de adrenalina pura.",
            "Me tocó bailar con la más difícil marcando al delantero de ellos, pero cumplí con creces.",
            "El equipo se mostró muy sólido y yo pude aportar mi granito de arena en la distribución.",
            "Siento que me faltó un poco de precisión en los pases, pero físicamente estuve a tope.",
            "Qué lindo es volver a las canchas y sentirse así de bien con la pelota en los pies.",
            "Hoy la suerte no estuvo de mi lado frente al arco, pero seguiremos intentando.",
            "Una victoria trabajada donde cada uno de nosotros dejó todo lo que tenía.",
            "Me voy caliente por el resultado final, merecíamos mucho más por lo propuesto.",
            "Fisicamente me sentí imparable, ganando duelos y proyectándome al ataque.",
            "Hoy me tocó ser el socio de todos, buscando siempre la mejor opción de descarga.",
            "Defender estos colores siempre es un orgullo, hoy dejamos la vida en cada pelota.",
            "El ambiente estuvo picante pero supimos mantener la calma y jugar al fútbol.",
            "Me sorprendió mi propia velocidad hoy, llegué a cierres que parecían imposibles.",
            "La magia estuvo presente en un par de jugadas, aunque faltó el toque final.",
            "Un partido para el olvido en lo grupal, pero rescató mi perseverancia individual.",
            "Hacer el trabajo sucio también tiene su recompensa, recuperé muchísimas pelotas.",
            "Sentí que el arco estaba cerrado para mí, pero asistí en dos ocasiones claves.",
            "Desde el fondo traté de ordenar todo, la voz de mando es fundamental en estos partidos.",
            "Me divertí muchísimo, más allá de la competencia, se respira buen fútbol.",
            "El césped estaba rápido y eso benefició mi juego de toques cortos y precisos.",
            "Un duelo personal con el defensa rival que me hizo sacar lo mejor de mi juego físico.",
            "Terminé cansadísimo pero con la satisfacción del deber cumplido tras el pitazo final.",
            "Hoy el equipo fue una orquesta y yo traté de no desentonar en mi zona.",
            "Faltó puntería pero sobró actitud, a seguir metiéndole para el próximo.",
            "Me sentí el dueño del área hoy, descolgando centros y dando seguridad.",
            "Los minutos finales fueron eternos, pero supimos aguantar el resultado.",
            "Cada pase que daba sentía que rompía una línea rival, estuve muy lúcido."
        ];

        // Shuffle chronicles
        const shuffledChronicles = [...uniqueChronicles].sort(() => Math.random() - 0.5);

        const aiSummaries = [
            "Mostró una visión de juego excepcional, rompiendo líneas con pases precisos y una lectura táctica impecable.",
            "Un muro defensivo infranqueable. Su capacidad de anticipación evitó múltiples situaciones de gol claras.",
            "Velocidad explosiva por las bandas. Su regate corto y desborde constante descolocaron a la defensa rival.",
            "Eficiencia pura en la definición. Aprovechó sus oportunidades demostrando una frialdad notable en el área.",
            "Dominio total del ritmo del partido. Distribuyó el juego con inteligencia y mantuvo la posesión bajo presión.",
            "Gran despliegue físico y sacrificio defensivo. Su presión alta forzó numerosos errores en la salida contraria.",
            "Seguridad absoluta bajo los tres palos. Sus reflejos en el mano a mano fueron determinantes para el resultado.",
            "Creatividad en espacios reducidos. Inventó jugadas donde no había opciones, conectando líneas eficientemente.",
            "Liderazgo natural en la zaga. Organizó a sus compañeros y mostró una firmeza aérea envidiable.",
            "Oportunismo y buen posicionamiento. Siempre estuvo en el lugar correcto para interceptar o finalizar jugadas."
        ];

        const attributes = ['pac', 'sho', 'pas', 'dri', 'def', 'phy'];

        const batch = db.batch();

        for (let i = 0; i < players.length; i++) {
            const player = players[i];
            const uid = player.uid;

            // 1. Create Assignments if they don't exist
            const assignmentId = `asgn_${matchId}_${uid}`;
            const assignmentRef = db.collection('evaluationAssignments').doc(assignmentId);
            batch.set(assignmentRef, {
                id: assignmentId,
                matchId,
                evaluatorId: 'system-seed', // Or a random player
                subjectId: uid,
                status: 'completed',
                createdAt: FieldValue.serverTimestamp()
            }, { merge: true });

            // 2. Create Evaluation
            const evaluationId = `eval_${matchId}_${uid}`;
            const evaluationRef = db.collection('evaluations').doc(evaluationId);

            const randomSummary = aiSummaries[Math.floor(Math.random() * aiSummaries.length)];
            const numChanges = Math.floor(Math.random() * 2) + 1; // 1 to 2 changes
            const aiAttributeChanges = [];
            const usedAttrs = new Set();

            for (let j = 0; j < numChanges; j++) {
                let attr;
                do {
                    attr = attributes[Math.floor(Math.random() * attributes.length)];
                } while (usedAttrs.has(attr));
                usedAttrs.add(attr);

                aiAttributeChanges.push({
                    attribute: attr,
                    change: Math.random() > 0.2 ? 1 : -1, // mostly positive
                    reason: 'Rendimiento destacado en este partido'
                });
            }

            batch.set(evaluationRef, {
                id: evaluationId,
                assignmentId,
                playerId: uid,
                evaluatorId: 'system-ai',
                matchId,
                rating: Math.floor(Math.random() * 4) + 6, // 6 to 9
                goals: Math.floor(Math.random() * 2),
                assists: Math.floor(Math.random() * 2),
                aiSummary: randomSummary,
                aiAttributeChanges,
                aiConfidence: 0.85 + (Math.random() * 0.1),
                evaluatedAt: new Date().toISOString(),
                status: 'completed'
            });

            // 3. Create SelfEvaluation
            const selfEvalId = `self_${matchId}_${uid}`;
            const selfEvalRef = matchRef.collection('selfEvaluations').doc(uid);
            batch.set(selfEvalRef, {
                id: selfEvalId,
                playerId: uid,
                matchId,
                goals: Math.floor(Math.random() * 2),
                assists: Math.floor(Math.random() * 2),
                personalChronicle: shuffledChronicles[i % shuffledChronicles.length],
                reportedAt: new Date().toISOString()
            });
        }

        // 4. Update match document
        batch.update(matchRef, {
            status: 'completed',
            evaluationsGenerated: true,
            finalStatsGenerated: true,
            updatedAt: FieldValue.serverTimestamp()
        });

        await batch.commit();
        console.log(`[seed] Successfully seeded ${players.length} evaluations and self-evaluations for match ${matchId}.`);

    } catch (error) {
        console.error(`[seed] Error:`, error);
    }
}

const matchId = 'sAul42BOyTjYph06xFds';
seedAiEvaluations(matchId).then(() => process.exit(0));
