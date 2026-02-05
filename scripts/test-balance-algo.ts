
interface PlayerSimple {
    id: string;
    teamId: string;
}

// Fisher-Yates Shuffle
function shuffle<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function generateAssignments(players: PlayerSimple[]) {
    const assignments: { evaluatorId: string; subjectId: string }[] = [];
    const incomingCounts: Record<string, number> = {};

    // Initialize counts
    players.forEach(p => incomingCounts[p.id] = 0);

    // Shuffle evaluators to avoid deterministic bias
    const evaluators = shuffle(players);

    for (const evaluator of evaluators) {
        // 1. Define candidates (everyone except self)
        let candidates = players.filter(p => p.id !== evaluator.id);

        // 2. Sort candidates by:
        //    a. Incoming Count (Ascending) -> PRIMARY: STARVE THE RICH
        //    b. Is Teammate (Descending)   -> SECONDARY: PREFER TEAMMATES
        //    c. Random                     -> TERTIARY: VARIETY

        candidates.sort((a, b) => {
            // Primary: Starvation
            const countDiff = incomingCounts[a.id] - incomingCounts[b.id];
            if (countDiff !== 0) return countDiff;

            // Secondary: Teammate Priority
            const aIsTeammate = a.teamId === evaluator.teamId;
            const bIsTeammate = b.teamId === evaluator.teamId;

            if (aIsTeammate && !bIsTeammate) return -1;
            if (!aIsTeammate && bIsTeammate) return 1;

            // Tertiary: Random
            return 0.5 - Math.random();
        });

        // 3. Pick top 2
        // CHECK: What if someone already is 'full' (>=2)? 
        // In a perfect world, we shouldn't pick them if others are available.
        // But the sort puts them at the bottom, so we effectively skip them unless forced.

        const selected = candidates.slice(0, 2);

        selected.forEach(subject => {
            incomingCounts[subject.id]++;
            assignments.push({
                evaluatorId: evaluator.id,
                subjectId: subject.id
            });
        });
    }

    return { assignments, incomingCounts };
}

// --- TEST RUNNER ---
function runTest() {
    console.log("🧪 Testing Balanced Assignment Algorithm...\n");

    // 1. Setup 10 Players (5 Team A, 5 Team B)
    const players: PlayerSimple[] = [];
    for (let i = 0; i < 5; i++) players.push({ id: `A${i}`, teamId: 'A' });
    for (let i = 0; i < 5; i++) players.push({ id: `B${i}`, teamId: 'B' });

    console.log(`Players: ${players.length}`);

    // 2. Run Algorithm
    const result = generateAssignments(players);

    // 3. Analyze
    console.log(`\nTotal Assignments: ${result.assignments.length}`);

    // Check distribution
    const min = Math.min(...Object.values(result.incomingCounts));
    const max = Math.max(...Object.values(result.incomingCounts));

    console.log(`Incoming Counts Range: [${min}, ${max}]`);
    console.log("Details:", result.incomingCounts);

    if (min === 2 && max === 2) {
        console.log("\n✅ PERFECT BALANCE ACHIEVED!");
    } else {
        console.log("\n❌ BALANCE FAILED (Range ! [2,2])");
    }

    // Check Teammate Preference (Just for info)
    let teammateEvals = 0;
    result.assignments.forEach(a => {
        const ev = players.find(p => p.id === a.evaluatorId)!;
        const sub = players.find(p => p.id === a.subjectId)!;
        if (ev.teamId === sub.teamId) teammateEvals++;
    });
    console.log(`Teammate Preference: ${teammateEvals}/${result.assignments.length} (${Math.round(teammateEvals / result.assignments.length * 100)}%)`);
}

runTest();
