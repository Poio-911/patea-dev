import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
if (!getApps().length) initializeApp({ credential: cert(sa as any), projectId: sa.project_id });
const db = getFirestore();

const GROUP_ID = 'Lo7Mz3sUg2PyRZDuCLbd';
const OWNER_UID = '4Hjt7RpO28Trff70J2Z6YMSJshx1'; // José P.

const RESTORE_PLAYER_IDS = [
    "4Hjt7RpO28Trff70J2Z6YMSJshx1",
    "QYx3MCcrYRTJ1aYB24tQy0A2fmM2",
    "njH0OBBrmzSWOeoXamHUZyxavLv1",
    "qrVOXyawztZBtTg7i6md6Opbt5H2",
    "dRYXgsJ1Joa28L69MV9kFRpWfxC3",
    "3xcfOetChgYB4ax6oh3w5zzd2w82",
    "EFKPK6vDW4WrEosD6UrFRDGMG543",
    "N7GKXwOa4vVeap4emu23x8jn8wF2",
    "7LRVMYdOI8Sm9gahfBkh5rbVENt1",
    "JAn8pNSZoNP7rWWyZJD1gCFBC5t2",
    "ThnL7xnxVENfjiXEYIhbADPRSaj2",
    "gKe0DNivhfVeAi36OV1qGzkXpM63",
    "wjmYHQfbqvMPF0w8oSi2ee9GDd92",
    "SiUe8fV0ksWYDOsILRJSoIn2hdW2",
    "FZgnsSDMi4PBkI5jNORjYZm0zY32"
];

const MONTEVIDEO_VENUES = [
    { name: 'Canchas del Prado', address: 'Av. Agraciada, Frente al Rosedal, Montevideo', lat: -34.8631, lng: -56.2045, placeId: 'mvdo_1' },
    { name: 'Carrasco Polo Club', address: 'Cno. Brig. Gral. J. Servando Gómez, Montevideo', lat: -34.8712, lng: -56.0711, placeId: 'mvdo_2' },
    { name: 'Complejo Suarez', address: 'Bvr. José Batlle y Ordóñez, Montevideo', lat: -34.8510, lng: -56.1750, placeId: 'mvdo_3' }
];

async function main() {
    console.log('--- 1. Limpiando partidos fallidos ---');
    const oldMatches = await db.collection('matches').where('groupId', '==', GROUP_ID).get();
    if (!oldMatches.empty) {
        const batch = db.batch();
        oldMatches.docs.forEach(doc => {
            batch.delete(doc.ref);
            console.log(`Borrando partido mal generado: ${doc.id}`);
        });
        await batch.commit();
        console.log(`✅ ${oldMatches.size} partidos eliminados.`);
    }

    console.log(`\n--- 2. Restaurando ${RESTORE_PLAYER_IDS.length} jugadores al grupo ---`);
    // Ensure the ghost user is NOT here, only the 15 valid
    const roles: any = {};
    RESTORE_PLAYER_IDS.forEach(pid => {
        roles[pid] = pid === OWNER_UID ? 'admin' : 'member';
    });

    await db.collection('groups').doc(GROUP_ID).update({
        playerIds: RESTORE_PLAYER_IDS,
        members: RESTORE_PLAYER_IDS,
        memberRoles: roles
    });
    console.log('✅ Grupo restaurado exitosamente.');


    const validPlayers = [];
    for (const pid of RESTORE_PLAYER_IDS) {
        const pSnap = await db.collection('players').doc(pid).get();
        if (pSnap.exists) validPlayers.push({ id: pSnap.id, ...pSnap.data() } as any);
    }

    validPlayers.sort((a, b) => a.id.localeCompare(b.id));

    console.log(`\n--- 3. Creando 3 Partidos PRÓXIMOS ---`);

    const matchSetups = [
        validPlayers.slice(0, 10),
        validPlayers.slice(5, 15),
        [...validPlayers.slice(0, 5), ...validPlayers.slice(10, 15)]
    ];

    const matchConfigs = [
        { title: 'Picadito Próximo', daysOffset: 2, venue: MONTEVIDEO_VENUES[0] },
        { title: 'Clásico del Domingo', daysOffset: 5, venue: MONTEVIDEO_VENUES[1] },
        { title: 'Torneo 5v5', daysOffset: 7, venue: MONTEVIDEO_VENUES[2] },
    ];

    for (let i = 0; i < 3; i++) {
        const playersForMatch = matchSetups[i];
        const cfg = matchConfigs[i];

        // Split into 2 teams
        const team1Players = playersForMatch.slice(0, 5);
        const team2Players = playersForMatch.slice(5, 10);

        const date = new Date();
        date.setDate(date.getDate() + cfg.daysOffset);
        date.setHours(20, 0, 0, 0);

        const matchRef = db.collection('matches').doc();

        // Flat players array for global match metadata
        const flatPlayers = playersForMatch.map(p => ({
            uid: p.id,
            displayName: p.name || 'Jugador',
            ovr: p.ovr || 50,
            position: p.position || 'MED',
            photoURL: p.photoURL || p.photoUrl || ''
        }));

        // Explicitly add 'position' to prevent Next.js React component crash
        const mapToTeamPlayer = (p: any) => ({
            uid: p.id,
            name: p.name || 'Jugador',
            photoURL: p.photoURL || p.photoUrl || null,
            position: p.position || 'MED',
            ovr: p.ovr || 50
        });

        const matchData: any = {
            id: matchRef.id,
            title: cfg.title,
            date: date.toISOString().split('T')[0],
            time: '20:00',
            status: 'upcoming',
            ownerUid: OWNER_UID,
            groupId: GROUP_ID,
            isPublic: false,
            type: 'manual',
            matchSize: 10,
            location: cfg.venue,
            players: flatPlayers,
            playerUids: playersForMatch.map(p => p.id),
            teams: [
                {
                    id: 'team1',
                    name: 'Blancos',
                    color: 'White',
                    players: team1Players.map(mapToTeamPlayer)
                },
                {
                    id: 'team2',
                    name: 'Oscuros',
                    color: 'Black',
                    players: team2Players.map(mapToTeamPlayer)
                }
            ]
        };

        await matchRef.set(matchData);
        console.log(`✅ Partido Creado: "${cfg.title}" (${matchRef.id}) [upcoming] - Cancha: ${cfg.venue.name}`);
    }

    console.log('\n🎉 ¡Listo! Partidos próximos creados sin errores.');
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
