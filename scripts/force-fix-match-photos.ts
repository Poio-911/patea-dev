
import * as dotenv from 'dotenv';
import { getAdminDb } from '../src/firebase/admin-init';

dotenv.config({ path: '.env.local' });

async function forceFixMatchPhotos() {
    try {
        console.log('🔧 Force fixing player photos in matches...\n');

        const db = getAdminDb();

        // 1. Load all players first for reference
        const playersSnapshot = await db.collection('players').get();
        const playersMap = new Map();
        playersSnapshot.forEach(doc => {
            const data = doc.data();
            // Ensure we have a valid photoURL to propagate
            if (data.photoURL) {
                playersMap.set(doc.id, data);
            }
        });
        console.log(`📦 Loaded ${playersMap.size} players with photos for reference\n`);

        // 2. Load all matches
        const matchesSnapshot = await db.collection('matches').get();
        console.log(`📦 Found ${matchesSnapshot.size} matches to scan\n`);

        let updatedMatches = 0;

        for (const matchDoc of matchesSnapshot.docs) {
            const matchData = matchDoc.data();
            const matchId = matchDoc.id;
            let needsUpdate = false;

            // --- Fix match.players ---
            const currentPlayers = matchData.players || [];
            const updatedPlayers = currentPlayers.map((mp: any) => {
                const playerProfile = playersMap.get(mp.uid); // mp.uid is standard

                // If match player lacks photo OR has empty photo, and we have a better one
                if (playerProfile && (!mp.photoURL || mp.photoURL === 'undefined')) {
                    // Only log if we are actually changing something substantial
                    if (playerProfile.photoURL !== mp.photoURL) {
                        // console.log(`   - Fix player ${mp.displayName} in match ${matchId}`); // noisy
                        needsUpdate = true;
                        return { ...mp, photoURL: playerProfile.photoURL };
                    }
                }
                // Case: photo exists but changed? Optional, but let's keep it synced
                if (playerProfile && playerProfile.photoURL && playerProfile.photoURL !== mp.photoURL) {
                    needsUpdate = true;
                    return { ...mp, photoURL: playerProfile.photoURL };
                }

                return mp;
            });

            // --- Fix match.teams ---
            const currentTeams = matchData.teams || [];
            const updatedTeams = currentTeams.map((team: any) => {
                if (!team.players) return team;

                let teamChanged = false;
                const updatedTeamPlayers = team.players.map((tp: any) => {
                    // Team players might use 'uid' or 'id' or 'playerId'. 
                    // Based on previous analysis: 'uid' is common in matches, 'playerId' in brackets.
                    // MatchTeams.tsx uses 'uid'.
                    const uid = tp.uid || tp.id || tp.playerId;

                    if (uid) {
                        const playerProfile = playersMap.get(uid);

                        if (playerProfile) {
                            // Check if update needed
                            if (!tp.photoURL || tp.photoURL === 'undefined' || tp.photoURL !== playerProfile.photoURL) {
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
                console.log(`✅ Fixed match: ${matchData.title} (${matchId})`);
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

forceFixMatchPhotos();
