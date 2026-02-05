/**
 * Script to fix player photos in matches by syncing with current player profiles
 */

import * as dotenv from 'dotenv';
import { getAdminDb } from '../src/firebase/admin-init';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function fixMatchPlayerPhotos() {
    try {
        console.log('🔧 Fixing player photos in matches...\n');

        const db = getAdminDb();

        // Get all matches
        const matchesSnapshot = await db.collection('matches').get();
        console.log(`📦 Found ${matchesSnapshot.size} matches\n`);

        // Get all players for reference (to avoid N+1 queries if possible, but for 30 players it's fine to cache)
        const playersSnapshot = await db.collection('players').get();
        const playersMap = new Map();
        playersSnapshot.forEach(doc => {
            playersMap.set(doc.id, doc.data());
        });
        console.log(`📦 Loaded ${playersMap.size} players for reference\n`);

        let updatedMatches = 0;

        for (const matchDoc of matchesSnapshot.docs) {
            const matchData = matchDoc.data();
            const matchId = matchDoc.id;
            let needsUpdate = false;

            // 1. Update match.players array
            const currentPlayers = matchData.players || [];
            const updatedPlayers = currentPlayers.map((mp: any) => {
                const playerProfile = playersMap.get(mp.uid);

                // If we have a profile and the photoURL is different (or missing in match but present in profile)
                if (playerProfile && playerProfile.photoURL && playerProfile.photoURL !== mp.photoURL) {
                    console.log(`   - Updating photo for ${mp.displayName} in match ${matchId}`);
                    needsUpdate = true;
                    return {
                        ...mp,
                        photoURL: playerProfile.photoURL
                    };
                }
                return mp;
            });

            // 2. Update match.teams array (if they contain embedded players with photos)
            // Note: MatchTeams.tsx uses match.players for lookup, but let's be thorough if teams replicate data
            const currentTeams = matchData.teams || [];
            const updatedTeams = currentTeams.map((team: any) => {
                if (!team.players) return team;

                let teamChanged = false;
                const updatedTeamPlayers = team.players.map((tp: any) => {
                    // Check if team players have embedded photoURL that needs update
                    // (Assuming tp has uid property)
                    if (tp.uid) {
                        const playerProfile = playersMap.get(tp.uid);
                        if (playerProfile && playerProfile.photoURL && playerProfile.photoURL !== tp.photoURL) {
                            // Only update if the team player object actually HAS a photoURL field structure
                            // If it's just a ref {uid, name}, adding photoURL might be safe or might be redundant
                            // based on Team type. But usually it's better to keep it consistent.
                            // However, looking at MatchTeams.tsx, it maps over team.players and fetches from match.players.
                            // So updating match.players (step 1) acts as the source of truth.
                            // But let's seeing if team.players has photoURL property currently.
                            if (tp.hasOwnProperty('photoURL')) {
                                teamChanged = true;
                                return { ...tp, photoURL: playerProfile.photoURL };
                            }
                        }
                    }
                    return tp;
                });

                if (teamChanged) {
                    needsUpdate = true;
                    return { ...team, players: updatedTeamPlayers };
                }
                return team;
            });

            if (needsUpdate) {
                await matchDoc.ref.update({
                    players: updatedPlayers,
                    teams: updatedTeams
                });
                console.log(`✅ Updated match: ${matchId}`);
                updatedMatches++;
            }
        }

        console.log('\n📊 Summary:');
        console.log(`   ✅ Matches updated: ${updatedMatches}`);
        console.log(`   📦 Total matches scanned: ${matchesSnapshot.size}`);

        process.exit(0);
    } catch (error: any) {
        console.error('\n❌ Error fixing match photos:', error);
        process.exit(1);
    }
}

fixMatchPlayerPhotos();
