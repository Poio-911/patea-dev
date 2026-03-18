'use server';

import { getAdminDb } from '../../firebase/admin-init';
import { requireAuth } from '../../lib/auth/get-server-session';
import { logger } from '../../lib/logger';
import { Player } from '../../lib/types';
import { publishActivityAction } from './social-actions';

/**
 * Crea un nuevo jugador manual en Firestore usando el Admin SDK (evita problemas de permisos).
 */
export async function createManualPlayerAction(
    playerData: Partial<Player>,
    creatorUserId: string
) {
    try {
        const db = getAdminDb();

        // Validaciones básicas
        if (!playerData.name || !playerData.position || !playerData.groupId) {
            throw new Error('Faltan campos obligatorios para crear el jugador.');
        }

        // Calcular OVR si no viene (aunque AddPlayerDialog ya lo hace)
        const ovr = playerData.ovr || Math.round(
            ((playerData.pac || 0) + (playerData.sho || 0) + (playerData.pas || 0) + (playerData.dri || 0) + (playerData.def || 0) + (playerData.phy || 0)) / 6
        );

        const newPlayer = {
            ...playerData,
            ovr,
            ownerUid: creatorUserId,
            stats: {
                matchesPlayed: 0,
                goals: 0,
                assists: 0,
                averageRating: 0,
                yellowCards: 0,
                redCards: 0,
            },
            createdAt: new Date().toISOString(),
        };

        const docRef = await db.collection('players').add(newPlayer);

        logger.info('[createManualPlayerAction] Player created successfully', {
            playerId: docRef.id,
            playerName: playerData.name
        });

        // Publicar actividad social
        try {
            await publishActivityAction({
                type: 'player_created',
                userId: creatorUserId,
                metadata: {
                    playerName: playerData.name,
                    playerId: docRef.id,
                    position: playerData.position,
                    ovr: ovr
                }
            });
        } catch (socialError) {
            logger.warn('Failed to publish player creation activity:', { error: socialError });
        }

        return {
            success: true,
            id: docRef.id,
            message: 'Jugador creado correctamente.'
        };

    } catch (error: any) {
        logger.error('[createManualPlayerAction] Error creating player:', error, { creatorUserId });
        return {
            success: false,
            message: error.message || 'Error al crear el jugador en el servidor.'
        };
    }
}

export async function updatePlayerAction(
    playerId: string,
    playerData: Pick<Player, 'name' | 'position' | 'pac' | 'sho' | 'pas' | 'dri' | 'def' | 'phy'>
) {
    try {
        const userId = await requireAuth();
        const db = getAdminDb();
        const playerRef = db.collection('players').doc(playerId);
        const playerSnap = await playerRef.get();

        if (!playerSnap.exists) {
            return { success: false, message: 'Jugador no encontrado.' };
        }

        const existingPlayer = { id: playerSnap.id, ...playerSnap.data() } as Player;
        if (existingPlayer.ownerUid !== userId && existingPlayer.id !== userId) {
            return { success: false, message: 'No tienes permiso para editar este jugador.' };
        }

        const ovr = Math.round(
            (playerData.pac + playerData.sho + playerData.pas + playerData.dri + playerData.def + playerData.phy) / 6
        );

        await playerRef.update({
            ...playerData,
            ovr,
        });

        return { success: true };
    } catch (error: any) {
        logger.error('[updatePlayerAction] Error updating player:', error, { playerId });
        return { success: false, message: error.message || 'No se pudo actualizar el jugador.' };
    }
}
