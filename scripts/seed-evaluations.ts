import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, cert, getApps, ServiceAccount } from 'firebase-admin/app';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

if (getApps().length === 0) {
    const s = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
    initializeApp({ credential: cert(s as ServiceAccount), projectId: s.project_id });
}

// Import performance tags
import { performanceTagsDb, type PerformanceTag } from '../src/lib/performance-tags';

type PlayerPosition = 'DEL' | 'MED' | 'DEF' | 'POR';

interface Player {
    id: string;
    name: string;
    position: PlayerPosition;
    photoURL?: string;
    ownerUid: string;
}

interface Assignment {
    id: string;
    evaluatorId: string;
    subjectId: string;
    status: string;
}

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

// Shuffle array
function shuffle<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Select random tags for a position
function selectRandomTags(position: PlayerPosition, count: number): PerformanceTag[] {
    // Filter tags relevant for position
    const relevantTags = performanceTagsDb.filter((tag: PerformanceTag) =>
        tag.positions.includes(position) || tag.positions.includes('ALL')
    );

    // 70% positive, 30% negative
    const positiveTags = relevantTags.filter((t: PerformanceTag) =>
        t.effects && t.effects.some((e: any) => e.change > 0)
    );
    const negativeTags = relevantTags.filter((t: PerformanceTag) =>
        t.effects && t.effects.some((e: any) => e.change < 0)
    );

    const numPositive = Math.ceil(count * 0.7);
    const numNegative = count - numPositive;

    const selected = [
        ...shuffle(positiveTags).slice(0, numPositive),
        ...shuffle(negativeTags).slice(0, numNegative)
    ];

    return shuffle(selected).slice(0, count);
}

// Generate match stats (goals, assists)
function generateMatchStats(players: Player[], teams: any[]) {
    const stats: Record<string, { goals: number; assists: number }> = {};

    // Initialize all players
    players.forEach(p => {
        stats[p.id] = { goals: 0, assists: 0 };
    });

    // Generate goals per team (2-5 goals each)
    teams.forEach(team => {
        const teamGoals = Math.floor(Math.random() * 4) + 2; // 2-5 goals
        const teamPlayers = players.filter(p => team.players.some((tp: any) => tp.uid === p.id));

        // Distribute goals (DEL more likely)
        for (let i = 0; i < teamGoals; i++) {
            const delanteros = teamPlayers.filter(p => p.position === 'DEL' || p.position === 'MED');
            const otros = teamPlayers.filter(p => p.position === 'DEF' || p.position === 'POR');

            let scorer: Player;
            // Robust selection (80% DEL/MED)
            if (delanteros.length > 0 && Math.random() > 0.2) {
                scorer = delanteros[Math.floor(Math.random() * delanteros.length)];
            } else if (otros.length > 0) {
                scorer = otros[Math.floor(Math.random() * otros.length)];
            } else {
                // If no attackers and no 'others' (e.g. only GK or empty), pick anyone
                if (teamPlayers.length > 0) {
                    scorer = teamPlayers[Math.floor(Math.random() * teamPlayers.length)];
                } else {
                    console.warn(`   ⚠️ Warning: No players found for team. Skipping goal generation.`);
                    continue;
                }
            }

            if (!scorer) continue;

            stats[scorer.id].goals++;

            // 60% chance of assist
            if (Math.random() > 0.4) {
                const assisters = teamPlayers.filter(p => p.id !== scorer.id && p.position !== 'POR');
                if (assisters.length > 0) {
                    const assister = assisters[Math.floor(Math.random() * assisters.length)];
                    stats[assister.id].assists++;
                }
            }
        }
    });

    return stats;
}

async function seedEvaluations(matchId: string) {
    const db = getFirestore();

    console.log('\n🌱 SEEDING EVALUATIONS');
    console.log('═'.repeat(60));
    console.log(`Match ID: ${matchId}\n`);

    // 1. Load match
    const matchDoc = await db.doc(`matches/${matchId}`).get();
    if (!matchDoc.exists) {
        console.log('❌ Match not found');
        return;
    }

    const match = { id: matchDoc.id, ...matchDoc.data() } as any;

    if (match.status !== 'completed' && match.status !== 'evaluated') {
        console.log(`❌ Match status is "${match.status}", must be "completed" or "evaluated"`);
        return;
    }

    console.log(`✅ Match: ${match.title}`);
    console.log(`   Status: ${match.status}`);
    console.log(`   Players: ${match.playerUids?.length || 0}`);

    // 2. Load assignments
    const assignmentsSnap = await db.collection(`matches/${matchId}/assignments`).get();
    const assignments: Assignment[] = assignmentsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    } as Assignment));

    console.log(`   Assignments: ${assignments.length}\n`);

    if (assignments.length === 0) {
        console.log('❌ No assignments found. Match needs to be finalized first.');
        return;
    }

    // 3. Load players
    const playerDocs = await Promise.all(
        match.playerUids.map((uid: string) => db.doc(`players/${uid}`).get())
    );

    const players: Player[] = playerDocs
        .filter(doc => doc.exists)
        .map(doc => ({ id: doc.id, ...doc.data() } as Player));

    console.log('👥 Players:');
    players.forEach(p => console.log(`   - ${p.name} (${p.position})`));
    console.log('');

    // 4. Check for existing submissions
    const existingSubmissions = await db.collection('evaluationSubmissions')
        .where('matchId', '==', matchId)
        .get();

    if (!existingSubmissions.empty) {
        console.log(`⚠️  Found ${existingSubmissions.size} existing submissions. Delete them first? (y/n)`);
        console.log('   Continuing anyway...\n');
    }

    // 5. Generate match stats
    console.log('📊 Generating match stats...');
    let matchStats;
    try {
        matchStats = generateMatchStats(players, match.teams);
        console.log('   Stats generated successfully');
    } catch (error) {
        console.log('   ❌ Error generating stats:', error);
        return;
    }

    let totalGoals = 0;
    let totalAssists = 0;
    Object.entries(matchStats).forEach(([playerId, stats]) => {
        const player = players.find(p => p.id === playerId);
        if (stats.goals > 0 || stats.assists > 0) {
            console.log(`   ${player?.name}: ${stats.goals}G ${stats.assists}A`);
            totalGoals += stats.goals;
            totalAssists += stats.assists;
        }
    });
    console.log(`   Total: ${totalGoals} goals, ${totalAssists} assists\n`);

    // 6. Select random MVP
    console.log('🏆 Selecting MVP...');
    const mvpCandidates = players.filter(p => {
        const stats = matchStats[p.id];
        return stats.goals > 0 || stats.assists > 0 || Math.random() > 0.7;
    });
    const mvp = mvpCandidates.length > 0
        ? mvpCandidates[Math.floor(Math.random() * mvpCandidates.length)]
        : players[Math.floor(Math.random() * players.length)];

    console.log(`   MVP: ${mvp.name}\n`);

    // 7. Generate evaluations for ALL players (Simulate everyone evaluates)
    // The user expects full coverage: "si todos evaluan 2 veces todos deben de tener 2 evaluaciones"
    const evaluators = players;
    console.log(`📝 Generating evaluations for ${evaluators.length} players (Real + AI)...\n`);

    let submissionsCreated = 0;

    try {
        for (const evaluator of evaluators) {
            console.log(`   Processing ${evaluator.name}...`);
            const myAssignments = assignments.filter(a => a.evaluatorId === evaluator.id);

            if (myAssignments.length === 0) {
                console.log(`   ⚠️  ${evaluator.name}: No assignments`);
                continue;
            }

            const evaluations = myAssignments.map(assignment => {
                const subject = players.find(p => p.id === assignment.subjectId);
                if (!subject) {
                    console.log(`   ⚠️  Assignment ${assignment.id} SKIPPED: Subject ${assignment.subjectId} not found in players list.`);
                    return null;
                }

                // 50/50 points vs tags
                const usePoints = Math.random() > 0.5;

                if (usePoints) {
                    // POINTS evaluation
                    return {
                        assignmentId: assignment.id,
                        subjectId: subject.id,
                        displayName: subject.name,
                        photoUrl: subject.photoURL || '',
                        position: subject.position,
                        evaluationType: 'points',
                        rating: generateRating(),
                        performanceTags: [] // Could add some tags optionally
                    };
                } else {
                    // TAGS evaluation
                    const numTags = 3; // Exactly 3 tags per new rules
                    const tags = selectRandomTags(subject.position, numTags);

                    return {
                        assignmentId: assignment.id,
                        subjectId: subject.id,
                        displayName: subject.name,
                        photoUrl: subject.photoURL || '',
                        position: subject.position,
                        evaluationType: 'tags',
                        performanceTags: tags
                    };
                }
            }).filter(Boolean);

            // Create submission
            const goals = matchStats[evaluator.id].goals;
            const assists = matchStats[evaluator.id].assists;

            // Richer chronicles
            const winTemplates = [
                "¡Qué partido ganamos! Dejé el alma.",
                "Partido durísimo pero nos llevamos los 3 puntos.",
                "Jugué bien, aunque terminé muerto.",
                "Eminencia se jugó todo, gran equipo.",
                "Ganamos a lo Peñarol, sufriendo."
            ];
            const goalTemplates = [
                "¡Mojé! Qué lindo hacer goles.",
                "El arco se me abrió hoy, por suerte.",
                "Gol y victoria, noche redonda.",
                "La mandé a guardar, como corresponde."
            ];
            const genericTemplates = [
                "Partido parejo, se corrió mucho.",
                "Me faltó aire pero cumplí.",
                "Buen picado, divertido.",
                "Terminé con los gemelos cargados.",
                "Hay que mejorar la defensa para la próxima."
            ];

            let chronicle = "";
            if (goals > 0) {
                chronicle = goalTemplates[Math.floor(Math.random() * goalTemplates.length)];
            } else if (Math.random() > 0.5) {
                chronicle = winTemplates[Math.floor(Math.random() * winTemplates.length)];
            } else {
                chronicle = genericTemplates[Math.floor(Math.random() * genericTemplates.length)];
            }

            // Add some funny generic suffix randomly
            if (Math.random() > 0.7) chronicle += " ¡Vamo arriba!";

            const submission = {
                evaluatorId: evaluator.id,
                matchId: matchId,
                submittedAt: new Date().toISOString(),
                submission: {
                    evaluatorGoals: goals,
                    evaluatorAssists: assists,
                    personalChronicle: chronicle,
                    mvpVote: mvp.id,
                    evaluations: evaluations
                }
            };

            console.log(`   Creating submission for ${evaluator.name}...`);
            await db.collection('evaluationSubmissions').add(submission);
            submissionsCreated++;

            const pointsCount = evaluations.filter((e: any) => e.evaluationType === 'points').length;
            const tagsCount = evaluations.filter((e: any) => e.evaluationType === 'tags').length;

            console.log(`   ✅ ${evaluator.name}: ${evaluations.length} evaluations (${pointsCount} points, ${tagsCount} tags)`);
        }
    } catch (error) {
        console.log('\n❌ Error creating submissions:', error);
        console.log('Stack:', (error as any).stack);
    }

    console.log('');
    console.log('═'.repeat(60));
    console.log(`✅ Created ${submissionsCreated} evaluation submissions`);
    console.log('');
    console.log('⏳ Submissions will be auto-processed every 15 seconds');
    console.log('   Check the organizer panel to monitor progress');
    console.log('   Then finalize evaluations to update OVRs');
    console.log('═'.repeat(60));
}

// Run with match ID from command line or hardcoded
const matchId = process.argv[2] || 'WBm27E7Whk42gvZJWqcJ';
seedEvaluations(matchId).catch(error => {
    console.error('\n❌ Fatal error:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
}).finally(() => process.exit(0));
