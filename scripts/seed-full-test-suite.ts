
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

if (getApps().length === 0) {
    const s = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
    initializeApp({ credential: cert(s), projectId: s.project_id });
}

const db = getFirestore();

// Helper to pick random items from array
const sample = <T>(arr: T[], n: number) => {
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, n);
};

const getRandomScore = () => Math.floor(Math.random() * 5);

async function seedTestSuite() {
    console.log('🌱 SEEDING TEST SUITE (10 Matches)...');

    // 1. Get Group and Players
    // User Provided specific IDs
    const TARGET_GROUP_ID = 'Lo7Mz3sUg2PyRZDuCLbd'; // "Solo Futbol"
    const TARGET_ORGANIZER_ID = 'QYx3MCcrYRTJ1aYB24tQy0A2fmM2'; // Alvaro M.

    const INTERGROUP_OPPONENT_ID_LOCAL = 'IdmJCNEvwsCsDl9zzLLt'; // Opponent Group

    const groupId = TARGET_GROUP_ID;
    const groupOwnerId = TARGET_ORGANIZER_ID;

    console.log(`Using Target Group ID: ${groupId} (Solo Futbol)`);
    console.log(`Using Organizer ID: ${groupOwnerId} (Alvaro M.)`);

    // Fetch Group A Players
    const playersSnap = await db.collection('players').where('groupId', '==', groupId).get();
    const allPlayers = playersSnap.docs.map(d => {
        const data = d.data();
        return {
            id: d.id,
            ...data,
            name: data.name || 'Unknown',
            photoUrl: data.photoUrl || ''
        } as any;
    });

    // Fetch Group B Players (Opponent)
    const opponentPlayersSnap = await db.collection('players').where('groupId', '==', INTERGROUP_OPPONENT_ID_LOCAL).get();
    const opponentPlayers = opponentPlayersSnap.docs.map(d => {
        const data = d.data();
        return {
            id: d.id,
            ...data,
            name: data.name || 'Opponent',
            photoUrl: data.photoUrl || ''
        } as any;
    });

    // Create a lookup map for easy access to player details
    const playerMap = new Map<string, any>();
    [...allPlayers, ...opponentPlayers].forEach(p => playerMap.set(p.id, p));

    console.log(`Examples: Group A has ${allPlayers.length} players. Opponent Group B has ${opponentPlayers.length} players.`);

    if (allPlayers.length < 10) {
        console.warn('⚠️ Warning: Less than 10 players in group. Matches might be undersized.');
    }

    // 2. Ensure Teams Exist for "Team Matches"
    // Check for teams in this group
    let teamAId, teamBId;
    const teamsSnap = await db.collection('teams').where('groupId', '==', groupId).get();

    if (teamsSnap.size < 2) {
        console.log('Creating 2 default teams...');
        const teamARef = await db.collection('teams').add({
            name: 'Equipo Alpha',
            groupId,
            stats: { wins: 0, losses: 0, draws: 0, goalsFor: 0, goalsAgainst: 0 },
            colors: ['#FF0000', '#FFFFFF']
        });
        const teamBRef = await db.collection('teams').add({
            name: 'Equipo Beta',
            groupId,
            stats: { wins: 0, losses: 0, draws: 0, goalsFor: 0, goalsAgainst: 0 },
            colors: ['#0000FF', '#FFFFFF']
        });
        teamAId = teamARef.id;
        teamBId = teamBRef.id;
    } else {
        teamAId = teamsSnap.docs[0].id;
        teamBId = teamsSnap.docs[1].id;
    }

    // Fix: initializing teams with averageOVR to avoid frontend crash
    const calculateTeamOvr = (teamPlayers: any[]) => {
        if (!teamPlayers.length) return 0;
        return teamPlayers.reduce((sum, p) => sum + (p.ovr || 50), 0) / teamPlayers.length;
    };

    // 3. Define Match Generators
    const createMatch = async (type: string, title: string, teamMode: boolean = false, interGroup: boolean = false) => {
        let team1Players: any[] = [];
        let team2Players: any[] = [];
        let matchPlayers: any[] = [];

        if (interGroup) {
            // Team 1 from Group A
            team1Players = sample(allPlayers, 5);
            // Team 2 from Group B (Opponent)
            // If opponent has no players, fallback to Group A (but warn)
            if (opponentPlayers.length >= 5) {
                team2Players = sample(opponentPlayers, 5);
            } else {
                console.warn('⚠️ Opponent group has insufficient players! Using Group A players as filler.');
                team2Players = sample(allPlayers.filter(p => !team1Players.includes(p)), 5);
            }
            matchPlayers = [...team1Players, ...team2Players];
        } else {
            // Normal internal match
            matchPlayers = sample(allPlayers, 10);
            team1Players = matchPlayers.slice(0, 5);
            team2Players = matchPlayers.slice(5, 10);
        }

        const playerUids = matchPlayers.map(p => p.id);
        const team1Ovr = calculateTeamOvr(team1Players);
        const team2Ovr = calculateTeamOvr(team2Players);

        const matchData: any = {
            channelId: 'default-channel', // Dummy
            createdAt: new Date().toISOString(),
            date: new Date().toISOString(),
            groupId,
            location: 'Cancha Central',
            maxPlayers: 10,
            ownerUid: groupOwnerId,
            players: matchPlayers.map(p => ({
                uid: p.id,
                displayName: p.name,
                photoURL: p.photoUrl || '',
                ovr: p.ovr || 50,
                position: p.position || 'DEL'
            })),
            playerUids,
            status: 'completed', // Created as completed straight away
            title,
            type: interGroup ? 'intergroup_friendly' : type, // Fix: Correct type for Inter-Group
            // If team mode, assign teams
            teams: [
                {
                    id: teamMode ? teamAId : 'team1',
                    name: (interGroup) ? 'Equipo Local (Group A)' : (teamMode ? 'Equipo Alpha' : 'Equipo 1'),
                    players: team1Players.map(p => ({
                        uid: p.id,
                        displayName: p.name,
                        photoURL: p.photoUrl || '',
                        ovr: p.ovr || 50,
                        position: p.position || 'DEL'
                    })),
                    averageOVR: team1Ovr,
                    totalOVR: team1Ovr * team1Players.length
                },
                {
                    id: (interGroup) ? 'opponent_team_dummy' : (teamMode ? teamBId : 'team2'),
                    name: (interGroup) ? 'Equipo Visitante (Group B)' : (teamMode ? 'Equipo Beta' : 'Equipo 2'),
                    players: team2Players.map(p => ({
                        uid: p.id,
                        displayName: p.name,
                        photoURL: p.photoUrl || '',
                        ovr: p.ovr || 50,
                        position: p.position || 'DEL'
                    })),
                    averageOVR: team2Ovr,
                    totalOVR: team2Ovr * team2Players.length
                }
            ], // End teams
            finalScore: { team1: getRandomScore(), team2: getRandomScore() },
            finalizedAt: new Date().toISOString()
        };

        if (interGroup) {
            matchData.isInterGroup = true;
            matchData.teamAId = teamAId; // Dummy teams for Intergroup too
            matchData.teamBId = teamBId;
            // Ensure opponentGroupId is set if schema requires it, though strict adherence to 'intergroup_friendly' type is key
            matchData.opponentGroupId = INTERGROUP_OPPONENT_ID_LOCAL;
        }

        const matchRef = db.collection('matches').doc();
        await matchRef.set(matchData);
        console.log(`   > Match Created: ${title} (${matchRef.id})`);

        // ... (assignments generation) ...


        // 4. Generate Circular Assignments (2 per player) AND Prepare Submissions
        const assignmentsBatch = db.batch();
        const assignmentsRef = matchRef.collection('assignments');
        const shuffled = [...playerUids].sort(() => 0.5 - Math.random());
        const count = shuffled.length;

        const assignmentsMap: Record<string, string[]> = {}; // Evaluator -> Subjects
        const createdAssignments: { id: string; evaluatorId: string; subjectId: string }[] = [];

        for (let i = 0; i < count; i++) {
            const evaluatorId = shuffled[i];
            const subject1Id = shuffled[(i + 1) % count];
            const subject2Id = shuffled[(i + 2) % count];

            assignmentsMap[evaluatorId] = [subject1Id, subject2Id];

            [subject1Id, subject2Id].forEach(subId => {
                const ref = assignmentsRef.doc();
                const assignmentId = ref.id;
                createdAssignments.push({ id: assignmentId, evaluatorId, subjectId: subId });

                assignmentsBatch.set(ref, {
                    matchId: matchRef.id,
                    evaluatorId,
                    subjectId: subId,
                    status: 'completed', // Mark as completed since we are submitting
                    assignedAt: new Date().toISOString()
                });
            });
        }
        await assignmentsBatch.commit();

        // 5. Generate Pending Submissions (So user can process them)
        const submissionsBatch = db.batch();

        // Group assignments by evaluator
        const assignmentsByEvaluator: Record<string, typeof createdAssignments> = {};
        createdAssignments.forEach(a => {
            if (!assignmentsByEvaluator[a.evaluatorId]) assignmentsByEvaluator[a.evaluatorId] = [];
            assignmentsByEvaluator[a.evaluatorId].push(a);
        });

        for (const evaluatorId of Object.keys(assignmentsByEvaluator)) {
            const evaluatorAssignments = assignmentsByEvaluator[evaluatorId];
            const submissionRef = db.collection('evaluationSubmissions').doc();

            // Mock performance data
            const evaluatorGoals = Math.floor(Math.random() * 3);
            const evaluatorAssists = Math.floor(Math.random() * 2);

            const evaluations = evaluatorAssignments.map(assignment => {
                const subject = playerMap.get(assignment.subjectId);
                return {
                    assignmentId: assignment.id,
                    subjectId: assignment.subjectId,
                    displayName: subject?.name || 'Unknown',
                    photoURL: subject?.photoUrl || '',
                    position: subject?.position || 'DEL',
                    evaluationType: 'points',
                    rating: Math.floor(Math.random() * 5) + 6, // 6 to 10
                    performanceTags: [], // Empty for points mode
                    textDescription: '',
                    overrideNoNegative: false
                };
            });

            submissionsBatch.set(submissionRef, {
                evaluatorId,
                matchId: matchRef.id,
                submittedAt: new Date().toISOString(),
                submission: {
                    evaluatorGoals,
                    evaluatorAssists,
                    personalChronicle: '',
                    mvpVote: evaluatorAssignments[0].subjectId, // Vote for first subject
                    evaluations
                }
            });
        }

        await submissionsBatch.commit();
        console.log(`   > Created ${Object.keys(assignmentsByEvaluator).length} submissions for match ${matchRef.id}`);
    }

    // EXECUTE LOOPS
    console.log('--- Generating 3 MANUAL Matches ---');
    for (let i = 0; i < 3; i++) await createMatch('manual', `Partido Manual ${i + 1}`);

    console.log('--- Generating 3 COLLABORATIVE Matches ---');
    for (let i = 0; i < 3; i++) await createMatch('collaborative', `Partido Colaborativo ${i + 1}`);

    console.log('--- Generating 3 TEAM Matches ---');
    for (let i = 0; i < 3; i++) await createMatch('by_teams', `Partido Por Equipos ${i + 1}`, true);

    // Use the variable defined at the top scope
    console.log(`   (Targeting opponent group: ${INTERGROUP_OPPONENT_ID_LOCAL})`);
    await createMatch('friendly', `Partido Inter-Grupal`, true, true);

    console.log('✅ ALL MATCHES SEEDED SUCCESSFULLY');
}

seedTestSuite().catch(console.error);
