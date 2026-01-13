package com.patea.android.ui.players

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.patea.android.data.model.Player
import com.patea.android.data.repository.PlayersRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * ViewModel for Players screen
 * 
 * Manages player list state, real-time updates from Firestore,
 * and player operations (create, update, delete).
 * 
 * Equivalent to React hooks + Context in web version.
 */
@HiltViewModel
class PlayersViewModel @Inject constructor(
    private val repository: PlayersRepository
) : ViewModel() {

    // UI State
    private val _uiState = MutableStateFlow<PlayersUiState>(PlayersUiState.Loading)
    val uiState: StateFlow<PlayersUiState> = _uiState.asStateFlow()

    // Players list
    private val _players = MutableStateFlow<List<Player>>(emptyList())
    val players: StateFlow<List<Player>> = _players.asStateFlow()

    // Selected group ID
    private val _selectedGroupId = MutableStateFlow<String?>(null)
    val selectedGroupId: StateFlow<String?> = _selectedGroupId.asStateFlow()

    // Search query
    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    // Filtered players based on search
    val filteredPlayers: StateFlow<List<Player>> = combine(
        _players,
        _searchQuery
    ) { players, query ->
        if (query.isBlank()) {
            players
        } else {
            players.filter { player ->
                player.name.contains(query, ignoreCase = true)
            }
        }
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = emptyList()
    )

    // Firestore listener
    private var playersListener: ListenerRegistration? = null

    init {
        // Load players when ViewModel is created
        // In real app, groupId would come from user session
    }

    /**
     * Load players for a specific group with real-time updates
     * 
     * Equivalent to useCollection hook in React
     */
    fun loadPlayers(groupId: String) {
        _selectedGroupId.value = groupId
        _uiState.value = PlayersUiState.Loading

        // Remove previous listener if exists
        playersListener?.remove()

        // Setup real-time listener
        playersListener = repository.getPlayersRealtime(groupId)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    _uiState.value = PlayersUiState.Error(error.message ?: "Error desconocido")
                    return@addSnapshotListener
                }

                if (snapshot != null) {
                    val playersList = snapshot.documents.mapNotNull { doc ->
                        doc.toObject(Player::class.java)?.copy(id = doc.id)
                    }
                    _players.value = playersList
                    _uiState.value = if (playersList.isEmpty()) {
                        PlayersUiState.Empty
                    } else {
                        PlayersUiState.Success
                    }
                }
            }
    }

    /**
     * Create a new player
     */
    fun createPlayer(player: Player, onSuccess: () -> Unit, onError: (String) -> Unit) {
        viewModelScope.launch {
            _uiState.value = PlayersUiState.Loading
            
            repository.createPlayer(player)
                .onSuccess {
                    _uiState.value = PlayersUiState.Success
                    onSuccess()
                }
                .onFailure { exception ->
                    _uiState.value = PlayersUiState.Error(exception.message ?: "Error al crear jugador")
                    onError(exception.message ?: "Error al crear jugador")
                }
        }
    }

    /**
     * Update an existing player
     */
    fun updatePlayer(playerId: String, updates: Map<String, Any>, onSuccess: () -> Unit, onError: (String) -> Unit) {
        viewModelScope.launch {
            repository.updatePlayer(playerId, updates)
                .onSuccess { onSuccess() }
                .onFailure { exception ->
                    onError(exception.message ?: "Error al actualizar jugador")
                }
        }
    }

    /**
     * Delete a player
     */
    fun deletePlayer(playerId: String, onSuccess: () -> Unit, onError: (String) -> Unit) {
        viewModelScope.launch {
            repository.deletePlayer(playerId)
                .onSuccess { onSuccess() }
                .onFailure { exception ->
                    onError(exception.message ?: "Error al eliminar jugador")
                }
        }
    }

    /**
     * Update search query
     */
    fun updateSearchQuery(query: String) {
        _searchQuery.value = query
    }

    /**
     * Get player by ID
     */
    fun getPlayerById(playerId: String): Player? {
        return _players.value.find { it.id == playerId }
    }

    /**
     * Sort players by different criteria
     */
    fun sortPlayers(sortBy: PlayerSortBy) {
        _players.value = when (sortBy) {
            PlayerSortBy.NAME -> _players.value.sortedBy { it.name }
            PlayerSortBy.OVR_DESC -> _players.value.sortedByDescending { it.ovr }
            PlayerSortBy.OVR_ASC -> _players.value.sortedBy { it.ovr }
            PlayerSortBy.POSITION -> _players.value.sortedBy { it.position }
        }
    }

    /**
     * Filter players by position
     */
    fun filterByPosition(position: PlayerPosition?) {
        // Implementation would update a filter state
        // and combine with search query
    }

    override fun onCleared() {
        super.onCleared()
        // Clean up Firestore listener
        playersListener?.remove()
    }
}

/**
 * UI State for Players screen
 */
sealed class PlayersUiState {
    object Loading : PlayersUiState()
    object Success : PlayersUiState()
    object Empty : PlayersUiState()
    data class Error(val message: String) : PlayersUiState()
}

/**
 * Sort options for players
 */
enum class PlayerSortBy {
    NAME,
    OVR_DESC,
    OVR_ASC,
    POSITION
}
