/**
 * Migration Script: Fix Cup Bracket nextMatchNumber
 *
 * This script fixes the nextMatchNumber calculation in existing cup brackets.
 * The old formula generated 0 for the first match of each round, causing
 * the "No next match defined" error during winner advancement.
 *
 * Run this script with: npm run migrate:cups
 *
 * Requirements:
 * - FIREBASE_SERVICE_ACCOUNT_KEY environment variable must be set in .env.local
 * - NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET environment variable must be set
 */

import { initializeApp, cert, getApps, ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from 'dotenv';
import { join } from 'path';

// Load environment variables
config({ path: join(process.cwd(), '.env.local') });

// Types
interface BracketMatch {
    id: string;
    round: string;
    matchNumber: number;
    team1Id?: string;
    team1Name?: string;
    team1Jersey?: any;
    team2Id?: string;
    team2Name?: string;
    team2Jersey?: any;
    winnerId?: string;
    matchId?: string;
    nextMatchNumber?: number;
}

interface Cup {
    id: string;
    bracket: BracketMatch[];
    [key: string]: any;
}

// Initialize Firebase Admin
function initializeFirebaseAdmin() {
    if (getApps().length === 0) {
        // Explicitly disable emulator to force production connection
        delete process.env.FIRESTORE_EMULATOR_HOST;
        delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
        delete process.env.FIREBASE_STORAGE_EMULATOR_HOST;

        const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
        if (!rawServiceAccount) {
            throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set in .env.local');
        }

        const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
        if (!storageBucket) {
            throw new Error('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET environment variable is not set in .env.local');
        }

        try {
            const serviceAccount = JSON.parse(rawServiceAccount);
            console.log('[Migration] Service account parsed. Project ID:', serviceAccount.project_id);
            console.log('[Migration] Connecting to PRODUCTION Firestore (emulators disabled)');

            initializeApp({
                credential: cert(serviceAccount as ServiceAccount),
                projectId: serviceAccount.project_id,
                storageBucket: storageBucket,
            });

            console.log('[Migration] Firebase Admin initialized successfully');
        } catch (error: any) {
            console.error('[Migration] Failed to parse service account:', error.message);
            throw new Error('Could not initialize Firebase Admin SDK. Check your .env.local file.');
        }
    }
    return getFirestore();
}

/**
 * Recalculate nextMatchNumber for all bracket matches
 * Formula: Math.ceil((matchNumber) / 2)
 * Example: matches 1 & 2 → match 1, matches 3 & 4 → match 2
 */
function fixBracketNextMatchNumbers(bracket: BracketMatch[]): BracketMatch[] {
    const rounds = ['round_of_32', 'round_of_16', 'round_of_8', 'semifinals', 'final'];
    const roundOrder: { [key: string]: number } = {
        'round_of_32': 0,
        'round_of_16': 1,
        'round_of_8': 2,
        'semifinals': 3,
        'final': 4,
    };

    return bracket.map(match => {
        const currentRoundIndex = roundOrder[match.round];

        // If final, no next match
        if (match.round === 'final' || currentRoundIndex === undefined) {
            const { nextMatchNumber, ...rest } = match;
            return rest as BracketMatch;
        }

        // Calculate correct nextMatchNumber
        const correctNextMatchNumber = Math.ceil(match.matchNumber / 2);

        return {
            ...match,
            nextMatchNumber: correctNextMatchNumber,
        };
    });
}

/**
 * Migrate all cups in Firestore
 */
async function migrateCupBrackets() {
    const db = initializeFirebaseAdmin();

    console.log('[Migration] Starting cup bracket migration...\n');

    try {
        // Get all cups
        const cupsSnapshot = await db.collection('cups').get();

        if (cupsSnapshot.empty) {
            console.log('[Migration] No cups found in database');
            return;
        }

        console.log(`[Migration] Found ${cupsSnapshot.size} cups\n`);

        let migratedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const cupDoc of cupsSnapshot.docs) {
            const cup = { id: cupDoc.id, ...cupDoc.data() } as Cup;

            console.log(`[Migration] Processing cup: ${cup.name || cup.id}`);

            // Check if cup has a bracket
            if (!cup.bracket || !Array.isArray(cup.bracket)) {
                console.log(`  ⚠️  Skipping - No bracket found`);
                skippedCount++;
                continue;
            }

            // Check if bracket needs migration (has any nextMatchNumber === 0)
            const hasInvalidNextMatch = cup.bracket.some(
                match => match.nextMatchNumber === 0
            );

            if (!hasInvalidNextMatch) {
                console.log(`  ✓ Skipping - Bracket already correct`);
                skippedCount++;
                continue;
            }

            try {
                // Fix the bracket
                const fixedBracket = fixBracketNextMatchNumbers(cup.bracket);

                // Log changes
                console.log(`  → Fixing ${cup.bracket.length} bracket matches`);
                cup.bracket.forEach((oldMatch, index) => {
                    const newMatch = fixedBracket[index];
                    if (oldMatch.nextMatchNumber !== newMatch.nextMatchNumber) {
                        console.log(
                            `    Match ${oldMatch.matchNumber} (${oldMatch.round}): ` +
                            `${oldMatch.nextMatchNumber} → ${newMatch.nextMatchNumber || 'none'}`
                        );
                    }
                });

                // Update Firestore
                await db.collection('cups').doc(cup.id).update({
                    bracket: fixedBracket,
                    migratedAt: new Date().toISOString(),
                });

                console.log(`  ✅ Successfully migrated\n`);
                migratedCount++;

            } catch (error: any) {
                console.error(`  ❌ Error migrating cup: ${error.message}\n`);
                errorCount++;
            }
        }

        // Summary
        console.log('\n========================================');
        console.log('Migration Complete');
        console.log('========================================');
        console.log(`Total cups: ${cupsSnapshot.size}`);
        console.log(`✅ Migrated: ${migratedCount}`);
        console.log(`⚠️  Skipped: ${skippedCount}`);
        console.log(`❌ Errors: ${errorCount}`);
        console.log('========================================\n');

    } catch (error: any) {
        console.error('[Migration] Fatal error:', error.message);
        throw error;
    }
}

// Run migration
if (require.main === module) {
    migrateCupBrackets()
        .then(() => {
            console.log('[Migration] Script completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('[Migration] Script failed:', error);
            process.exit(1);
        });
}

export { migrateCupBrackets, fixBracketNextMatchNumbers };
