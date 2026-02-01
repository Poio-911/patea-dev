package com.patea.android.data.model

import android.os.Parcelable
import com.google.firebase.firestore.DocumentId
import com.google.firebase.firestore.PropertyName
import kotlinx.parcelize.Parcelize

/**
 * Player model - Migrated from TypeScript types.ts
 * 
 * Represents a football player with attributes, stats, and metadata.
 * Used across the app for player management, matches, and evaluations.
 */
@Parcelize
data class Player(
    @DocumentId
    val id: String = "",
    
    val name: String = "",
    
    val position: PlayerPosition = PlayerPosition.MED,
    
    // Overall rating (calculated from attributes)
    val ovr: Int = 50,
    
    // Attributes (0-99)
    val pac: Int = 50,  // Pace
    val sho: Int = 50,  // Shooting
    val pas: Int = 50,  // Passing
    val dri: Int = 50,  // Dribbling
    val def: Int = 50,  // Defending
    val phy: Int = 50,  // Physical
    
    @PropertyName("photoUrl")
    val photoUrl: String? = null,
    
    val stats: PlayerStats = PlayerStats(),
    
    @PropertyName("ownerUid")
    val ownerUid: String = "",
    
    @PropertyName("groupId")
    val groupId: String? = null,
    
    // Credit system for AI image generation
    @PropertyName("cardGenerationCredits")
    val cardGenerationCredits: Int? = null,
    
    @PropertyName("lastCreditReset")
    val lastCreditReset: String? = null,  // ISO 8601 string
    
    @PropertyName("totalCreditsPurchased")
    val totalCreditsPurchased: Int? = null,
    
    @PropertyName("lastPurchaseDate")
    val lastPurchaseDate: String? = null,  // ISO 8601 string
    
    // Photo crop settings
    @PropertyName("cropPosition")
    val cropPosition: CropPosition? = null,
    
    @PropertyName("cropZoom")
    val cropZoom: Double? = null,
    
    // Team association
    val jersey: Jersey? = null,
    
    @PropertyName("teamId")
    val teamId: String? = null
) : Parcelable {
    
    /**
     * Get OVR level category for UI styling
     */
    fun getOvrLevel(): OvrLevel {
        return when {
            ovr >= 85 -> OvrLevel.ELITE
            ovr >= 75 -> OvrLevel.GOLD
            ovr >= 65 -> OvrLevel.SILVER
            else -> OvrLevel.BRONZE
        }
    }
    
    /**
     * Get display name (fallback to "Jugador" if empty)
     */
    fun getDisplayName(): String {
        return name.ifEmpty { "Jugador" }
    }
    
    /**
     * Check if player has available credits
     */
    fun hasAvailableCredits(): Boolean {
        return (cardGenerationCredits ?: 0) > 0
    }
}

/**
 * Player position enum
 */
enum class PlayerPosition {
    POR,  // Portero (Goalkeeper)
    DEF,  // Defensa (Defender)
    MED,  // Mediocampista (Midfielder)
    DEL;  // Delantero (Forward)
    
    fun getDisplayName(): String {
        return when (this) {
            POR -> "Portero"
            DEF -> "Defensa"
            MED -> "Mediocampista"
            DEL -> "Delantero"
        }
    }
}

/**
 * OVR level categories for UI styling
 */
enum class OvrLevel {
    BRONZE,
    SILVER,
    GOLD,
    ELITE
}

/**
 * Player statistics
 */
@Parcelize
data class PlayerStats(
    val matchesPlayed: Int = 0,
    val goals: Int = 0,
    val assists: Int = 0,
    val yellowCards: Int = 0,
    val redCards: Int = 0,
    val averageRating: Double = 0.0,
    val wins: Int = 0,
    val draws: Int = 0,
    val losses: Int = 0
) : Parcelable {
    
    /**
     * Calculate win percentage
     */
    fun getWinPercentage(): Double {
        if (matchesPlayed == 0) return 0.0
        return (wins.toDouble() / matchesPlayed.toDouble()) * 100
    }
}

/**
 * Crop position for player photo
 */
@Parcelize
data class CropPosition(
    val x: Double = 0.0,
    val y: Double = 0.0
) : Parcelable

/**
 * Jersey configuration
 */
@Parcelize
data class Jersey(
    val type: JerseyType = JerseyType.PLAIN,
    val primaryColor: String = "#000000",
    val secondaryColor: String = "#FFFFFF",
    val pattern: JerseyPattern? = null
) : Parcelable

enum class JerseyType {
    PLAIN,
    STRIPED,
    HALVES,
    DIAGONAL,
    CUSTOM
}

enum class JerseyPattern {
    VERTICAL_STRIPES,
    HORIZONTAL_STRIPES,
    DIAGONAL_STRIPES,
    CHECKERED,
    SOLID
}
