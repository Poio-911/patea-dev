package com.patea.android.data.repository

import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.patea.android.data.model.Player
import kotlinx.coroutines.tasks.await
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository for Player data operations
 * 
 * Handles all Firestore operations for players.
 * Provides a clean API for ViewModels to interact with data.
 * 
 * Equivalent to Firebase hooks + server actions in web version.
 */
@Singleton
class PlayersRepository @Inject constructor(
    private val firestore: FirebaseFirestore
) {

    private val playersCollection = firestore.collection("players")

    /**
     * Get real-time query for players in a group
     * 
     * Returns a Query that can be used with addSnapshotListener
     * for real-time updates.
     * 
     * Equivalent to:
     * const playersRef = collection(db, 'players');
     * const q = query(playersRef, where('groupId', '==', groupId));
     */
    fun getPlayersRealtime(groupId: String): Query {
        return playersCollection
            .whereEqualTo("groupId", groupId)
            .orderBy("name")
    }

    /**
     * Get players once (no real-time updates)
     */
    suspend fun getPlayers(groupId: String): Result<List<Player>> {
        return try {
            val snapshot = playersCollection
                .whereEqualTo("groupId", groupId)
                .orderBy("name")
                .get()
                .await()

            val players = snapshot.documents.mapNotNull { doc ->
                doc.toObject(Player::class.java)?.copy(id = doc.id)
            }

            Result.success(players)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Get a single player by ID
     */
    suspend fun getPlayerById(playerId: String): Result<Player?> {
        return try {
            val doc = playersCollection.document(playerId).get().await()
            val player = doc.toObject(Player::class.java)?.copy(id = doc.id)
            Result.success(player)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Create a new player
     * 
     * Equivalent to:
     * const docRef = await addDoc(collection(db, 'players'), playerData);
     */
    suspend fun createPlayer(player: Player): Result<String> {
        return try {
            val docRef = playersCollection.add(player).await()
            Result.success(docRef.id)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Update an existing player
     * 
     * Equivalent to:
     * await updateDoc(doc(db, 'players', playerId), updates);
     */
    suspend fun updatePlayer(playerId: String, updates: Map<String, Any>): Result<Unit> {
        return try {
            playersCollection.document(playerId).update(updates).await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Delete a player
     * 
     * Equivalent to:
     * await deleteDoc(doc(db, 'players', playerId));
     */
    suspend fun deletePlayer(playerId: String): Result<Unit> {
        return try {
            playersCollection.document(playerId).delete().await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Search players by name
     */
    suspend fun searchPlayers(groupId: String, query: String): Result<List<Player>> {
        return try {
            // Firestore doesn't support full-text search natively
            // This is a simple implementation that fetches all and filters
            // For production, consider using Algolia or similar
            
            val snapshot = playersCollection
                .whereEqualTo("groupId", groupId)
                .get()
                .await()

            val players = snapshot.documents
                .mapNotNull { doc ->
                    doc.toObject(Player::class.java)?.copy(id = doc.id)
                }
                .filter { player ->
                    player.name.contains(query, ignoreCase = true)
                }

            Result.success(players)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Get players by position
     */
    suspend fun getPlayersByPosition(
        groupId: String,
        position: PlayerPosition
    ): Result<List<Player>> {
        return try {
            val snapshot = playersCollection
                .whereEqualTo("groupId", groupId)
                .whereEqualTo("position", position.name)
                .get()
                .await()

            val players = snapshot.documents.mapNotNull { doc ->
                doc.toObject(Player::class.java)?.copy(id = doc.id)
            }

            Result.success(players)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Get top players by OVR
     */
    suspend fun getTopPlayers(groupId: String, limit: Int = 10): Result<List<Player>> {
        return try {
            val snapshot = playersCollection
                .whereEqualTo("groupId", groupId)
                .orderBy("ovr", Query.Direction.DESCENDING)
                .limit(limit.toLong())
                .get()
                .await()

            val players = snapshot.documents.mapNotNull { doc ->
                doc.toObject(Player::class.java)?.copy(id = doc.id)
            }

            Result.success(players)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Update player photo URL
     */
    suspend fun updatePlayerPhoto(playerId: String, photoUrl: String): Result<Unit> {
        return updatePlayer(playerId, mapOf("photoUrl" to photoUrl))
    }

    /**
     * Update player attributes
     */
    suspend fun updatePlayerAttributes(
        playerId: String,
        pac: Int? = null,
        sho: Int? = null,
        pas: Int? = null,
        dri: Int? = null,
        def: Int? = null,
        phy: Int? = null
    ): Result<Unit> {
        val updates = mutableMapOf<String, Any>()
        pac?.let { updates["pac"] = it }
        sho?.let { updates["sho"] = it }
        pas?.let { updates["pas"] = it }
        dri?.let { updates["dri"] = it }
        def?.let { updates["def"] = it }
        phy?.let { updates["phy"] = it }

        // Recalculate OVR
        if (updates.isNotEmpty()) {
            // Get current player to calculate new OVR
            return try {
                val player = getPlayerById(playerId).getOrNull()
                if (player != null) {
                    val newOvr = calculateOvr(
                        pac = pac ?: player.pac,
                        sho = sho ?: player.sho,
                        pas = pas ?: player.pas,
                        dri = dri ?: player.dri,
                        def = def ?: player.def,
                        phy = phy ?: player.phy
                    )
                    updates["ovr"] = newOvr
                    updatePlayer(playerId, updates)
                } else {
                    Result.failure(Exception("Player not found"))
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }

        return Result.success(Unit)
    }

    /**
     * Calculate OVR from attributes
     * 
     * Simple average for now, can be weighted by position later
     */
    private fun calculateOvr(
        pac: Int,
        sho: Int,
        pas: Int,
        dri: Int,
        def: Int,
        phy: Int
    ): Int {
        return ((pac + sho + pas + dri + def + phy) / 6.0).toInt()
    }
}
