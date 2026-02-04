/**
 * Script para analizar el flujo completo de una copa
 * Ejecutar DESPUÉS de crear una copa pero ANTES de iniciarla
 */

import { initializeApp, cert, getApps, ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

if (getApps().length === 0) {
    const s = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
    initializeApp({ credential: cert(s as ServiceAccount), projectId: s.project_id });
}

const db = getFirestore();

async function analyzeCupFlow() {
    console.log('🔍 Analyzing Cup Flow\n');
    console.log('='.repeat(60));

    try {
        // 1. Find the most recent cup
        const cupsSnap = await db.collection('cups')
            .orderBy('createdAt', 'desc')
            .limit(1)
            .get();

        if (cupsSnap.empty) {
            console.log('❌ No cups found');
            return;
        }

        const cupDoc = cupsSnap.docs[0];
        const cup = { id: cupDoc.id, ...cupDoc.data() } as any;

        console.log(`\n📋 CUP DETAILS`);
        console.log(`   ID: ${cup.id}`);
        console.log(`   Name: ${cup.name}`);
        console.log(`   Status: ${cup.status}`);
        console.log(`   Teams: ${cup.teams?.length || 0}`);
        console.log(`   Has Bracket: ${!!cup.bracket}`);

        if (cup.bracket) {
            console.log(`\n🏆 BRACKET ANALYSIS`);
            console.log(`   Total matches in bracket: ${cup.bracket.length}`);
            console.log(`   Current Round: ${cup.currentRound || 'N/A'}`);

            // Group by round
            const rounds = ['round_of_32', 'round_of_16', 'round_of_8', 'semifinals', 'final'];
            for (const round of rounds) {
                const roundMatches = cup.bracket.filter((m: any) => m.round === round);
                if (roundMatches.length > 0) {
                    console.log(`\n   ${round.toUpperCase()}:`);
                    roundMatches.forEach((m: any) => {
                        console.log(`      Match ${m.matchNumber}: ${m.team1Name || 'TBD'} vs ${m.team2Name || 'TBD'}`);
                        console.log(`         - Bracket ID: ${m.id}`);
                        console.log(`         - Match ID: ${m.matchId || 'NOT CREATED'}`);
                        console.log(`         - Winner: ${m.winnerId || 'N/A'}`);
                        console.log(`         - Next Match: ${m.nextMatchNumber || 'N/A'}`);
                        if (m.finalScore) {
                            console.log(`         - Score: ${m.finalScore.team1} - ${m.finalScore.team2}`);
                        }
                    });
                }
            }
        }

        // 2. Find matches associated with this cup
        const matchesSnap = await db.collection('matches')
            .where('leagueInfo.leagueId', '==', cup.id)
            .get();

        console.log(`\n📊 MATCHES COLLECTION`);
        console.log(`   Total matches created: ${matchesSnap.size}`);

        if (matchesSnap.size > 0) {
            matchesSnap.docs.forEach(doc => {
                const match = { id: doc.id, ...doc.data() } as any;
                console.log(`\n   Match: ${match.title}`);
                console.log(`      - ID: ${match.id}`);
                console.log(`      - Status: ${match.status}`);
                console.log(`      - Teams: ${match.participantTeamIds?.join(', ')}`);
                if (match.finalScore) {
                    console.log(`      - Score: ${match.finalScore.team1} - ${match.finalScore.team2}`);
                }
            });
        }

        // 3. Check teams
        if (cup.teams && cup.teams.length > 0) {
            console.log(`\n👥 TEAMS`);
            const teamsSnap = await db.collection('teams')
                .where('__name__', 'in', cup.teams.slice(0, 10))
                .get();

            teamsSnap.docs.forEach(doc => {
                const team = { id: doc.id, ...doc.data() } as any;
                console.log(`   - ${team.name} (${team.id}): ${team.members?.length || 0} players`);
            });
        }

        console.log('\n' + '='.repeat(60));
        console.log('✅ ANALYSIS COMPLETE\n');

        // Diagnostic checks
        console.log('🔧 DIAGNOSTIC CHECKS:');

        if (cup.status === 'draft') {
            console.log('   ⚠️  Cup is in DRAFT status - bracket not generated yet');
            console.log('   ➡️  Click "Iniciar" to generate bracket');
        } else if (cup.status === 'in_progress') {
            if (!cup.bracket || cup.bracket.length === 0) {
                console.log('   ❌ Cup is in_progress but has NO BRACKET!');
            } else {
                const firstRoundMatches = cup.bracket.filter((m: any) => m.round === cup.bracket[0].round);
                const matchesWithIds = firstRoundMatches.filter((m: any) => m.matchId);
                console.log(`   📌 First round has ${matchesWithIds.length}/${firstRoundMatches.length} matches created`);

                if (matchesWithIds.length === 0) {
                    console.log('   ⚠️  No matches created yet - click on bracket matches to create them');
                }
            }
        }

    } catch (error) {
        console.error('❌ Error:', error);
        throw error;
    }
}

analyzeCupFlow()
    .then(() => {
        console.log('Analysis complete');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Analysis failed:', error);
        process.exit(1);
    });
