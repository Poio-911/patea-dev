
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// --- Configuration ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load service account (mirrored from other scripts)
const serviceAccountPath = path.join(__dirname, '../mil-disculpis-firebase-adminsdk-fbsvc-5d1f71eeb1.json');
if (!fs.existsSync(serviceAccountPath)) {
    console.error('ERROR: service-account.json not found at', serviceAccountPath);
    process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

if (!getApps().length) {
    initializeApp({
        credential: cert(serviceAccount),
        storageBucket: 'mil-disculpis.firebasestorage.app'
    });
    console.log('🔥 Firebase Admin initialized');
}

const db = getFirestore();

// --- Data Constants ---
const TEAM_NAMES = [
    "Los Rayos", "Tigres FC", "Águilas Doradas", "Huracán", "Furia Roja",
    "Atlético Central", "Sportivo Norte", "Inter del Barrio", "Real Cósmico", "Defensores",
    "Unión y Fuerza", "Estudiantes", "Alianza Lima", "Boca Juniors", "River Plate", "Independiente"
];

const JERSEY_TYPES = ['plain', 'vertical', 'band', 'chevron', 'thirds', 'lines'];
const COLORS = ['#DC2626', '#2563EB', '#16A34A', '#EAB308', '#171717', '#FFFFFF', '#7C3AED', '#EA580C'];

// --- Helper Functions ---
function getRandomItem(arr: any[]) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomColor() {
    return getRandomItem(COLORS);
}

function assignDorsal(usedNumbers: Set<number>): number {
    let candidate = 1;
    while (usedNumbers.has(candidate)) {
        candidate++;
    }
    return candidate;
}

async function seed() {
    console.log('🌱 Starting Seed Process...');

    try {
        // 1. Fetch Users
        console.log('Fetching users...');
        const usersSnapshot = await db.collection('users').limit(50).get();
        const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (users.length === 0) {
            console.error('❌ No users found! Please register some users in the app first.');
            return;
        }
        console.log(`✅ Found ${users.length} users.`);

        // TARGET OWNER (Requested by user)
        const TARGET_OWNER_UID = 'dRYXgsJ1Joa28L69MV9kFRpWfxC3';

        // Find valid group ID from users or fallback
        let groupId = 'seed-group-id';
        if (users.length > 0) {
            const owner = users.find((u: any) => u.id === TARGET_OWNER_UID);
            groupId = (owner as any)?.activeGroupId || (users[0] as any).activeGroupId || 'seed-group-id';
        }

        console.log(`Using owner: ${TARGET_OWNER_UID}, Group: ${groupId}`);

        // 2. Create Teams
        console.log('Creating 16 Teams...');
        const teamIds: string[] = [];
        const teamRefs: FirebaseFirestore.DocumentReference[] = [];

        for (const name of TEAM_NAMES) {
            const usedNumbers = new Set<number>();

            // Select 5-11 random players
            const teamPlayers = users
                .sort(() => 0.5 - Math.random())
                .slice(0, Math.floor(Math.random() * 6) + 5);

            const members = teamPlayers.map(p => {
                const num = assignDorsal(usedNumbers);
                usedNumbers.add(num);
                return {
                    playerId: p.id,
                    number: num,
                    status: 'titular'
                };
            });

            const teamData = {
                name,
                groupId, // Assuming single group environment for simplicity
                jersey: {
                    type: getRandomItem(JERSEY_TYPES),
                    primaryColor: getRandomColor(),
                    secondaryColor: getRandomColor()
                },
                members,
                createdBy: TARGET_OWNER_UID,
                createdAt: new Date().toISOString()
            };

            const teamRef = await db.collection('teams').add(teamData);
            teamIds.push(teamRef.id);
            teamRefs.push(teamRef);
            console.log(`   > Created team: ${name} (${teamRef.id})`);
        }

        // 3. Create League (10 Teams)
        console.log('Creating League...');
        const leagueTeams = teamIds.slice(0, 10);

        // Resolve standings asynchronously properly using Promise.all
        const standings = await Promise.all(leagueTeams.map(async (tid, i) => {
            const teamDoc = await teamRefs[i].get();
            const teamData = teamDoc.data();
            return {
                teamId: tid,
                teamName: TEAM_NAMES[i],
                teamJersey: teamData?.jersey,
                position: i + 1,
                matchesPlayed: 0,
                wins: 0,
                draws: 0,
                losses: 0,
                goalsFor: 0,
                goalsAgainst: 0,
                goalDifference: 0,
                points: 0
            };
        }));

        const leagueData = {
            name: 'Liga Apertura 2026',
            format: 'round_robin',
            status: 'draft', // DRAFT STATUS - To allow manual start
            ownerUid: TARGET_OWNER_UID,
            groupId,
            isPublic: true,
            teams: leagueTeams,
            createdAt: new Date().toISOString(),
            matchFrequency: 'weekly',
            matchDayOfWeek: 6, // Sabado
            matchTime: '16:00',
            standings
        };

        const leagueRef = await db.collection('leagues').add(leagueData);
        console.log(`✅ League created: ${leagueRef.id}`);

        // 4. Create Cup (16 Teams)
        console.log('Creating Cup...');
        const cupData = {
            name: 'Copa de Campeones',
            format: 'single_elimination',
            status: 'draft', // DRAFT STATUS - To allow manual start
            ownerUid: TARGET_OWNER_UID,
            groupId,
            isPublic: true,
            teams: teamIds, // All 16 teams
            createdAt: new Date().toISOString(),
            currentRound: 'round_of_16',
            seedingType: 'random'
        };

        const cupRef = await db.collection('cups').add(cupData);
        console.log(`✅ Cup created: ${cupRef.id}`);

        console.log('✨ Seed complete! You can now browse Competitions and START them as organizer.');

    } catch (error) {
        console.error('❌ Error seeding data:', error);
    }
}

seed();
