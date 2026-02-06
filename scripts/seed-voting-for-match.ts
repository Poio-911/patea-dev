
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

if (getApps().length === 0) {
    const s = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
    initializeApp({ credential: cert(s), projectId: s.project_id });
}

const db = getFirestore();

// --- Types & Helpers from seed-evaluations.ts ---

type TagEffect = { attribute: 'pac' | 'sho' | 'pas' | 'dri' | 'def' | 'phy'; change: number; };

type PerformanceTag = {
    id: string;
    name: string;
    description: string;
    effects: TagEffect[];
    impact: 'positive' | 'negative' | 'neutral';
    positions: ('DEL' | 'MED' | 'DEF' | 'POR' | 'ALL')[];
    // We only need the structure, not the full DB, but let's grab the DB too for `selectRandomTags`
};

// Simplified tag DB for seeding (subset of full DB to save space, or full if preferred. Using full structure but condensed for script)
const performanceTagsDb: PerformanceTag[] = [
    // Positive
    { id: 'atajadon_espectacular', name: 'El Pulpo', description: 'Atajadón', effects: [{ attribute: 'def', change: 3 }], impact: 'positive', positions: ['POR'] },
    { id: 'cierre_providencial', name: 'Cierre Providencial', description: 'Cierre', effects: [{ attribute: 'def', change: 3 }, { attribute: 'pac', change: 1 }], impact: 'positive', positions: ['DEF', 'MED'] },
    { id: 'pase_quirurgico', name: 'Pase Quirúrgico', description: 'Pase', effects: [{ attribute: 'pas', change: 3 }, { attribute: 'dri', change: 1 }], impact: 'positive', positions: ['MED', 'DEL'] },
    { id: 'la_colgo_del_angulo', name: 'La Colgó del Ángulo', description: 'Golazo', effects: [{ attribute: 'sho', change: 3 }, { attribute: 'dri', change: 1 }], impact: 'positive', positions: ['DEL', 'MED'] },
    { id: 'correcaminos', name: 'Correcaminos', description: 'Corrió', effects: [{ attribute: 'pac', change: 2 }, { attribute: 'phy', change: 2 }], impact: 'positive', positions: ['ALL'] },
    // Negative
    { id: 'manos_de_manteca', name: 'Manos de Manteca', description: 'Error', effects: [{ attribute: 'def', change: -3 }], impact: 'negative', positions: ['POR'] },
    { id: 'salio_con_el_diario', name: 'Salió con el Diario', description: 'Error', effects: [{ attribute: 'def', change: -3 }, { attribute: 'pac', change: -1 }], impact: 'negative', positions: ['DEF'] },
    { id: 'pase_al_rival', name: 'Pase al Rival', description: 'Error', effects: [{ attribute: 'pas', change: -3 }], impact: 'negative', positions: ['MED', 'DEF'] },
    { id: 'se_comio_un_elefante', name: 'Se Comió un Elefante', description: 'Error', effects: [{ attribute: 'sho', change: -3 }], impact: 'negative', positions: ['DEL', 'MED'] },
    { id: 'se_canso', name: 'Se Acalambró', description: 'Cansado', effects: [{ attribute: 'phy', change: -3 }], impact: 'negative', positions: ['ALL'] }
];

// Gaussian random number generator (Box-Muller transform)
function gaussianRandom(mean: number, stdDev: number): number {
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return z0 * stdDev + mean;
}

// Generate realistic rating (bell curve centered at 7)
function generateRating(): number {
    const rating = gaussianRandom(7, 1.5);
    return Math.max(1, Math.min(10, Math.round(rating)));
}

// Select random tags for a position
function selectRandomTags(position: string, count: number): PerformanceTag[] {
    const pos = position as 'DEL' | 'MED' | 'DEF' | 'POR'; // Cast safely
    const relevantTags = performanceTagsDb.filter((tag) =>
        tag.positions.includes(pos) || tag.positions.includes('ALL')
    );
    // 70% positive, 30% negative
    const positiveTags = relevantTags.filter(t => t.impact === 'positive');
    const negativeTags = relevantTags.filter(t => t.impact === 'negative');

    const numPositive = Math.ceil(count * 0.7);
    const numNegative = count - numPositive;

    const selected = [
        ...sample(positiveTags, numPositive),
        ...sample(negativeTags, numNegative)
    ];

    return sample(selected, count);
}


// Helper to pick random items
const sample = <T>(arr: T[], n: number) => {
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, n);
};

async function seedVotingForMatch(matchId: string) {
    console.log(`\n🌱 SEEDING VOTING FOR MATCH: ${matchId}`);

    const matchRef = db.collection('matches').doc(matchId);
    const matchSnap = await matchRef.get();

    if (!matchSnap.exists) {
        console.error(`❌ Match ${matchId} not found!`);
        return;
    }

    const matchData = matchSnap.data();
    console.log(`   > Match: ${matchData?.title} (${matchData?.date})`);

    // 1. Fetch Assignments
    // The user said "YA asignadas", so we expect assignments to exist.
    const assignmentsSnap = await matchRef.collection('assignments').get();

    let assignments = [];

    if (assignmentsSnap.empty) {
        console.warn(`⚠️ No assignments found for match ${matchId}. Generating new assignments...`);

        const playerUids = matchData?.players?.map((p: any) => p.uid) || matchData?.playerUids || [];
        if (playerUids.length < 2) {
            console.error('❌ Not enough players to generate assignments.');
            return;
        }

        const assignmentsBatch = db.batch();
        const assignmentsRef = matchRef.collection('assignments');
        const shuffled = [...playerUids].sort(() => 0.5 - Math.random());
        const count = shuffled.length;

        for (let i = 0; i < count; i++) {
            const evaluatorId = shuffled[i];
            const subject1Id = shuffled[(i + 1) % count];
            const subject2Id = shuffled[(i + 2) % count]; // 2 per player

            [subject1Id, subject2Id].forEach(subId => {
                const ref = assignmentsRef.doc();
                const assignmentData = {
                    matchId: matchId,
                    evaluatorId,
                    subjectId: subId,
                    status: 'pending', // Will be updated to completed later
                    assignedAt: new Date().toISOString()
                };
                assignmentsBatch.set(ref, assignmentData);
                assignments.push({ id: ref.id, ...assignmentData });
            });
        }
        await assignmentsBatch.commit();
        console.log(`   > Generated ${assignments.length} new assignments.`);
    } else {
        assignments = assignmentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
    }
    const assignmentsByEvaluator: Record<string, any[]> = {};

    assignments.forEach(a => {
        if (!assignmentsByEvaluator[a.evaluatorId]) assignmentsByEvaluator[a.evaluatorId] = [];
        assignmentsByEvaluator[a.evaluatorId].push(a);
    });

    // 3. Fetch Players involved (to get names/photos for the submission form data)
    // We can get them from the match player list usually
    const matchPlayers = matchData?.players || [];
    const playerMap = new Map<string, any>();
    matchPlayers.forEach((p: any) => playerMap.set(p.uid, p));

    // 4. Create Submissions
    const batch = db.batch();
    let submissionCount = 0;

    for (const evaluatorId of Object.keys(assignmentsByEvaluator)) {
        const myAssignments = assignmentsByEvaluator[evaluatorId];

        // Check if submission already exists?
        // Ideally yes, but for seeding we might just overwrite or create new.
        // Let's check query.
        const existingSubSnap = await db.collection('evaluationSubmissions')
            .where('matchId', '==', matchId)
            .where('evaluatorId', '==', evaluatorId)
            .get();

        if (!existingSubSnap.empty) {
            console.log(`   > Submission for evaluator ${evaluatorId} already exists. Skipping.`);
            continue;
        }

        const submissionRef = db.collection('evaluationSubmissions').doc();

        const evaluations = myAssignments.map(assignment => {
            const subjectId = assignment.subjectId;
            const subject = playerMap.get(subjectId);

            // 50/50 points vs tags
            const usePoints = Math.random() > 0.5;

            if (usePoints) {
                // POINTS evaluation
                return {
                    assignmentId: assignment.id,
                    subjectId: subjectId,
                    displayName: subject?.displayName || subject?.name || 'Unknown',
                    photoURL: subject?.photoURL || subject?.photoUrl || '',
                    position: subject?.position || 'DEL',
                    evaluationType: 'points',
                    rating: generateRating(),
                    performanceTags: [],
                    textDescription: '',
                    overrideNoNegative: false
                };
            } else {
                // TAGS evaluation
                const numTags = 3;
                const tags = selectRandomTags(subject?.position || 'DEL', numTags);

                return {
                    assignmentId: assignment.id,
                    subjectId: subjectId,
                    displayName: subject?.displayName || subject?.name || 'Unknown',
                    photoURL: subject?.photoURL || subject?.photoUrl || '',
                    position: subject?.position || 'DEL',
                    evaluationType: 'tags',
                    performanceTags: tags,
                    textDescription: ''
                };
            }
        });

        // Update assignments to completed
        myAssignments.forEach(a => {
            const aRef = matchRef.collection('assignments').doc(a.id);
            batch.update(aRef, { status: 'completed' });
        });

        // Create Submission
        batch.set(submissionRef, {
            evaluatorId,
            matchId,
            submittedAt: new Date().toISOString(),
            submission: {
                evaluatorGoals: 0, // Mock
                evaluatorAssists: 0, // Mock
                personalChronicle: '',
                mvpVote: myAssignments.length > 0 ? myAssignments[0].subjectId : null,
                evaluations
            }
        });
        submissionCount++;
    }

    await batch.commit();
    console.log(`✅ Created ${submissionCount} submissions for match ${matchId}`);
}

async function run() {
    // Read IDs from args
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.error('Usage: npx ts-node scripts/seed-voting-for-match.ts <MATCH_ID_1> <MATCH_ID_2> ...');
        process.exit(1);
    }

    for (const id of args) {
        await seedVotingForMatch(id);
    }
}

run().catch(console.error);
