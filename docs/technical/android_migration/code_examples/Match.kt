package com.patea.android.data.model

import android.os.Parcelable
import com.google.firebase.firestore.DocumentId
import com.google.firebase.firestore.PropertyName
import kotlinx.parcelize.Parcelize

/**
 * Match model - Migrated from TypeScript types.ts
 * 
 * Represents a football match with all its details, teams, players, and metadata.
 */
@Parcelize
data class Match(
    @DocumentId
    val id: String = "",
    
    val title: String = "",
    
    val date: String = "",  // ISO 8601 date string
    
    val time: String = "",  // Format: "19:00 hs"
    
    val location: MatchLocation = MatchLocation(),
    
    val type: MatchType = MatchType.MANUAL,
    
    @PropertyName("matchSize")
    val matchSize: Int = 22,  // 10, 14, or 22
    
    val players: List<MatchPlayer> = emptyList(),
    
    @PropertyName("playerUids")
    val playerUids: List<String> = emptyList(),
    
    val teams: List<Team> = emptyList(),
    
    val status: MatchStatus = MatchStatus.UPCOMING,
    
    @PropertyName("ownerUid")
    val ownerUid: String = "",
    
    @PropertyName("groupId")
    val groupId: String = "",
    
    @PropertyName("finalScore")
    val finalScore: FinalScore? = null,
    
    @PropertyName("goalScorers")
    val goalScorers: List<MatchGoalScorer> = emptyList(),
    
    val cards: List<MatchCard> = emptyList(),
    
    @PropertyName("participantTeamIds")
    val participantTeamIds: List<String> = emptyList(),
    
    @PropertyName("leagueInfo")
    val leagueInfo: LeagueInfo? = null,
    
    val weather: WeatherInfo? = null,
    
    @PropertyName("createdAt")
    val createdAt: String = "",  // ISO 8601 string
    
    @PropertyName("updatedAt")
    val updatedAt: String? = null
) : Parcelable {
    
    /**
     * Check if match is full
     */
    fun isFull(): Boolean {
        return players.size >= matchSize
    }
    
    /**
     * Check if user is in match
     */
    fun isUserInMatch(userId: String): Boolean {
        return playerUids.contains(userId)
    }
    
    /**
     * Get match type label for UI
     */
    fun getTypeLabel(): String {
        return when (type) {
            MatchType.MANUAL -> "Manual"
            MatchType.COLLABORATIVE -> "Colaborativo"
            MatchType.BY_TEAMS -> "Por Equipos"
            MatchType.LEAGUE -> "Liga"
            MatchType.CUP -> "Copa"
            MatchType.LEAGUE_FINAL -> "Final de Liga"
            MatchType.INTERGROUP_FRIENDLY -> "Amistoso Intergrupal"
        }
    }
    
    /**
     * Get status label for UI
     */
    fun getStatusLabel(): String {
        return when (status) {
            MatchStatus.UPCOMING -> "Próximo"
            MatchStatus.ACTIVE -> "Activo"
            MatchStatus.COMPLETED -> "Finalizado"
            MatchStatus.EVALUATED -> "Evaluado"
        }
    }
}

/**
 * Match type enum
 */
enum class MatchType {
    MANUAL,
    COLLABORATIVE,
    BY_TEAMS,
    INTERGROUP_FRIENDLY,
    LEAGUE,
    CUP,
    LEAGUE_FINAL
}

/**
 * Match status enum
 */
enum class MatchStatus {
    UPCOMING,
    ACTIVE,
    COMPLETED,
    EVALUATED
}

/**
 * Match player (simplified player info for match context)
 */
@Parcelize
data class MatchPlayer(
    val uid: String = "",
    val displayName: String = "",
    val ovr: Int = 50,
    val position: PlayerPosition = PlayerPosition.MED,
    val photoUrl: String = "",
    val teamId: String? = null
) : Parcelable

/**
 * Team in a match
 */
@Parcelize
data class Team(
    val id: String = "",
    val name: String = "",
    val players: List<MatchPlayer> = emptyList(),
    val totalOVR: Int = 0,
    val averageOVR: Double = 0.0,
    val jersey: Jersey = Jersey()
) : Parcelable

/**
 * Match location
 */
@Parcelize
data class MatchLocation(
    val name: String = "",
    val address: String = "",
    val lat: Double = 0.0,
    val lng: Double = 0.0,
    val placeId: String = ""
) : Parcelable

/**
 * Final score
 */
@Parcelize
data class FinalScore(
    val team1: Int = 0,
    val team2: Int = 0
) : Parcelable

/**
 * Goal scorer
 */
@Parcelize
data class MatchGoalScorer(
    val playerId: String = "",
    val playerName: String = "",
    val teamId: String = ""
) : Parcelable

/**
 * Match card (yellow/red)
 */
@Parcelize
data class MatchCard(
    val playerId: String = "",
    val playerName: String = "",
    val teamId: String = "",
    val cardType: CardType = CardType.YELLOW
) : Parcelable

enum class CardType {
    YELLOW,
    RED
}

/**
 * League/Cup information
 */
@Parcelize
data class LeagueInfo(
    val leagueId: String = "",
    val round: Int = 0
) : Parcelable

/**
 * Weather information
 */
@Parcelize
data class WeatherInfo(
    val temperature: Double = 0.0,
    val condition: String = "",
    val icon: String = "",
    val humidity: Int = 0,
    val windSpeed: Double = 0.0,
    val precipitation: Int = 0
) : Parcelable
