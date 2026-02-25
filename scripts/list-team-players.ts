import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
}

import { getAdminDb } from '../src/firebase/admin-init';

async function listTeamPlayers(matchId: string) {
    const db = getAdminDb();
    const matchDoc = await db.collection('matches').doc(matchId).get();
    if (!matchDoc.exists) return;

    const match = matchDoc.data()!;
    console.log(`Match: ${match.title}`);

    if (match.teams) {
        match.teams.forEach((team: any, idx: number) => {
            console.log(`\nTeam ${idx + 1}: ${team.name}`);
            console.log(`Average OVR: ${team.averageOVR}`);
            if (team.players) {
                team.players.forEach((p: any) => {
                    console.log(`- ${p.displayName} (${p.uid}) [${p.position}] OVR: ${p.ovr}`);
                });
            } else {
                console.log('No players in field "players" of team object');
            }
            if (team.playerUids) {
                console.log(`Player UIDs: ${team.playerUids.join(', ')}`);
            }
        });
    } else {
        console.log('No teams found in match document');
    }

    console.log('\nTop-level players array length:', match.players?.length);
}

const matchId = process.argv[2] || 'I3OjfKZv3hoRFSP5q0ce';
listTeamPlayers(matchId).catch(console.error);
