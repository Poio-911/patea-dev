# Integración con Cloud Functions (AI Flows) - Android

## Descripción General

Los 12 flujos de IA de Genkit se ejecutan en el servidor y se exponen como Cloud Functions HTTP callable. La app Android los llama usando el Firebase Functions SDK.

---

## Setup de Cloud Functions

### Paso 1: Crear Cloud Functions HTTP Callable

En el proyecto Firebase (backend), crear funciones HTTP callable para cada flujo de IA:

```typescript
// functions/src/ai-flows.ts
import { onCall } from 'firebase-functions/v2/https';
import { generateBalancedTeams } from './ai/flows/generate-balanced-teams';
import { suggestPlayerImprovements } from './ai/flows/suggest-player-improvements';
import { generateMatchChronicle } from './ai/flows/generate-match-chronicle';

// Generate Balanced Teams
export const generateBalancedTeamsCallable = onCall(async (request) => {
  const { players } = request.data;
  
  // Validate authentication
  if (!request.auth) {
    throw new Error('Unauthorized');
  }

  try {
    const result = await generateBalancedTeams({ players });
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Suggest Player Improvements
export const suggestPlayerImprovementsCallable = onCall(async (request) => {
  const { playerId, groupId } = request.data;
  
  if (!request.auth) {
    throw new Error('Unauthorized');
  }

  try {
    const result = await suggestPlayerImprovements({ playerId, groupId });
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Generate Match Chronicle
export const generateMatchChronicleCallable = onCall(async (request) => {
  const { matchId } = request.data;
  
  if (!request.auth) {
    throw new Error('Unauthorized');
  }

  try {
    const result = await generateMatchChronicle({ matchId });
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
```

---

## Implementación en Android

### Paso 1: Crear API Interface

```kotlin
// data/remote/CloudFunctionsApi.kt
package com.patea.android.data.remote

import com.google.firebase.functions.FirebaseFunctions
import com.google.firebase.functions.ktx.functions
import com.google.firebase.ktx.Firebase
import com.patea.android.data.model.Player
import com.patea.android.data.model.Team
import kotlinx.coroutines.tasks.await
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class CloudFunctionsApi @Inject constructor(
    private val functions: FirebaseFunctions
) {

    /**
     * Generate balanced teams using AI
     * 
     * Equivalent to:
     * const result = await generateTeamsAction(players);
     */
    suspend fun generateBalancedTeams(players: List<Player>): Result<GenerateTeamsResponse> {
        return try {
            // Prepare data
            val data = hashMapOf(
                "players" to players.map { player ->
                    hashMapOf(
                        "id" to player.id,
                        "name" to player.name,
                        "position" to player.position.name,
                        "ovr" to player.ovr,
                        "pac" to player.pac,
                        "sho" to player.sho,
                        "pas" to player.pas,
                        "dri" to player.dri,
                        "def" to player.def,
                        "phy" to player.phy
                    )
                }
            )

            // Call Cloud Function
            val result = functions
                .getHttpsCallable("generateBalancedTeamsCallable")
                .call(data)
                .await()

            // Parse response
            val response = result.data as Map<*, *>
            if (response["success"] == true) {
                val teamsData = response["data"] as Map<*, *>
                val teams = parseTeamsFromResponse(teamsData)
                Result.success(GenerateTeamsResponse(teams))
            } else {
                val error = response["error"] as? String ?: "Unknown error"
                Result.failure(Exception(error))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Get player improvement suggestions using AI
     */
    suspend fun suggestPlayerImprovements(
        playerId: String,
        groupId: String
    ): Result<PlayerSuggestionsResponse> {
        return try {
            val data = hashMapOf(
                "playerId" to playerId,
                "groupId" to groupId
            )

            val result = functions
                .getHttpsCallable("suggestPlayerImprovementsCallable")
                .call(data)
                .await()

            val response = result.data as Map<*, *>
            if (response["success"] == true) {
                val suggestionsData = response["data"] as Map<*, *>
                val suggestions = parseSuggestionsFromResponse(suggestionsData)
                Result.success(PlayerSuggestionsResponse(suggestions))
            } else {
                val error = response["error"] as? String ?: "Unknown error"
                Result.failure(Exception(error))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Generate match chronicle using AI
     */
    suspend fun generateMatchChronicle(matchId: String): Result<MatchChronicleResponse> {
        return try {
            val data = hashMapOf("matchId" to matchId)

            val result = functions
                .getHttpsCallable("generateMatchChronicleCallable")
                .call(data)
                .await()

            val response = result.data as Map<*, *>
            if (response["success"] == true) {
                val chronicleData = response["data"] as Map<*, *>
                val chronicle = parseChronicleFromResponse(chronicleData)
                Result.success(MatchChronicleResponse(chronicle))
            } else {
                val error = response["error"] as? String ?: "Unknown error"
                Result.failure(Exception(error))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Get match day forecast (weather + AI insights)
     */
    suspend fun getMatchDayForecast(
        matchId: String,
        location: MatchLocation
    ): Result<MatchForecastResponse> {
        return try {
            val data = hashMapOf(
                "matchId" to matchId,
                "location" to hashMapOf(
                    "lat" to location.lat,
                    "lng" to location.lng,
                    "name" to location.name
                )
            )

            val result = functions
                .getHttpsCallable("getMatchDayForecastCallable")
                .call(data)
                .await()

            val response = result.data as Map<*, *>
            if (response["success"] == true) {
                val forecastData = response["data"] as Map<*, *>
                val forecast = parseForecastFromResponse(forecastData)
                Result.success(MatchForecastResponse(forecast))
            } else {
                val error = response["error"] as? String ?: "Unknown error"
                Result.failure(Exception(error))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // Helper parsing functions
    private fun parseTeamsFromResponse(data: Map<*, *>): List<Team> {
        val team1Data = data["team1"] as Map<*, *>
        val team2Data = data["team2"] as Map<*, *>

        return listOf(
            parseTeamFromMap(team1Data),
            parseTeamFromMap(team2Data)
        )
    }

    private fun parseTeamFromMap(data: Map<*, *>): Team {
        val playersData = data["players"] as List<*>
        val players = playersData.map { playerMap ->
            val p = playerMap as Map<*, *>
            MatchPlayer(
                uid = p["uid"] as String,
                displayName = p["displayName"] as String,
                ovr = (p["ovr"] as Number).toInt(),
                position = PlayerPosition.valueOf(p["position"] as String),
                photoUrl = p["photoUrl"] as? String ?: ""
            )
        }

        return Team(
            id = data["id"] as? String ?: "",
            name = data["name"] as String,
            players = players,
            totalOVR = (data["totalOVR"] as Number).toInt(),
            averageOVR = (data["averageOVR"] as Number).toDouble()
        )
    }

    private fun parseSuggestionsFromResponse(data: Map<*, *>): PlayerSuggestions {
        return PlayerSuggestions(
            strengths = (data["strengths"] as? List<*>)?.map { it as String } ?: emptyList(),
            weaknesses = (data["weaknesses"] as? List<*>)?.map { it as String } ?: emptyList(),
            recommendations = (data["recommendations"] as? List<*>)?.map { it as String } ?: emptyList(),
            focusAreas = (data["focusAreas"] as? List<*>)?.map { it as String } ?: emptyList()
        )
    }

    private fun parseChronicleFromResponse(data: Map<*, *>): MatchChronicle {
        return MatchChronicle(
            title = data["title"] as String,
            summary = data["summary"] as String,
            highlights = (data["highlights"] as? List<*>)?.map { it as String } ?: emptyList(),
            mvp = data["mvp"] as? String,
            keyMoments = (data["keyMoments"] as? List<*>)?.map { it as String } ?: emptyList()
        )
    }

    private fun parseForecastFromResponse(data: Map<*, *>): MatchForecast {
        val weatherData = data["weather"] as Map<*, *>
        return MatchForecast(
            weather = WeatherInfo(
                temperature = (weatherData["temperature"] as Number).toDouble(),
                condition = weatherData["condition"] as String,
                icon = weatherData["icon"] as String,
                humidity = (weatherData["humidity"] as Number).toInt(),
                windSpeed = (weatherData["windSpeed"] as Number).toDouble(),
                precipitation = (weatherData["precipitation"] as Number).toInt()
            ),
            aiInsights = (data["insights"] as? List<*>)?.map { it as String } ?: emptyList(),
            recommendations = (data["recommendations"] as? List<*>)?.map { it as String } ?: emptyList()
        )
    }
}

// Response models
data class GenerateTeamsResponse(val teams: List<Team>)
data class PlayerSuggestionsResponse(val suggestions: PlayerSuggestions)
data class MatchChronicleResponse(val chronicle: MatchChronicle)
data class MatchForecastResponse(val forecast: MatchForecast)

data class PlayerSuggestions(
    val strengths: List<String>,
    val weaknesses: List<String>,
    val recommendations: List<String>,
    val focusAreas: List<String>
)

data class MatchChronicle(
    val title: String,
    val summary: String,
    val highlights: List<String>,
    val mvp: String?,
    val keyMoments: List<String>
)

data class MatchForecast(
    val weather: WeatherInfo,
    val aiInsights: List<String>,
    val recommendations: List<String>
)
```

---

### Paso 2: Usar en ViewModel

```kotlin
// ui/matches/CreateMatchViewModel.kt
@HiltViewModel
class CreateMatchViewModel @Inject constructor(
    private val cloudFunctionsApi: CloudFunctionsApi,
    private val playersRepository: PlayersRepository
) : ViewModel() {

    private val _generatingTeams = MutableStateFlow(false)
    val generatingTeams = _generatingTeams.asStateFlow()

    private val _generatedTeams = MutableStateFlow<List<Team>?>(null)
    val generatedTeams = _generatedTeams.asStateFlow()

    /**
     * Generate balanced teams using AI
     */
    fun generateTeams(players: List<Player>) {
        viewModelScope.launch {
            _generatingTeams.value = true

            cloudFunctionsApi.generateBalancedTeams(players)
                .onSuccess { response ->
                    _generatedTeams.value = response.teams
                    _generatingTeams.value = false
                }
                .onFailure { exception ->
                    _generatingTeams.value = false
                    // Handle error
                    Log.e("CreateMatchViewModel", "Error generating teams", exception)
                }
        }
    }
}
```

---

### Paso 3: Usar en UI

```kotlin
// ui/matches/CreateMatchScreen.kt
@Composable
fun CreateMatchScreen(
    viewModel: CreateMatchViewModel = hiltViewModel()
) {
    val generatingTeams by viewModel.generatingTeams.collectAsState()
    val generatedTeams by viewModel.generatedTeams.collectAsState()

    Column {
        // ... other UI elements

        Button(
            onClick = { viewModel.generateTeams(selectedPlayers) },
            enabled = !generatingTeams && selectedPlayers.size >= 10
        ) {
            if (generatingTeams) {
                CircularProgressIndicator(
                    modifier = Modifier.size(16.dp),
                    color = MaterialTheme.colorScheme.onPrimary
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text("Generando equipos...")
            } else {
                Icon(Icons.Default.AutoAwesome, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Generar Equipos con IA")
            }
        }

        // Show generated teams
        generatedTeams?.let { teams ->
            TeamsPreview(teams = teams)
        }
    }
}
```

---

## Ventajas de este Enfoque

✅ **Sin lógica de IA en el cliente**: App Android solo hace llamadas HTTP  
✅ **Reutilización 100%**: Mismos flujos de IA que la web  
✅ **Seguridad**: API keys de Gemini nunca expuestas  
✅ **Mantenimiento**: Cambios en IA solo en backend  
✅ **Escalabilidad**: Cloud Functions escalan automáticamente  

---

## Testing

```kotlin
// test/CloudFunctionsApiTest.kt
class CloudFunctionsApiTest {
    @Test
    fun `generateBalancedTeams returns teams`() = runTest {
        val api = CloudFunctionsApi(mockFunctions)
        val players = listOf(/* test players */)

        val result = api.generateBalancedTeams(players)

        assertTrue(result.isSuccess)
        assertEquals(2, result.getOrNull()?.teams?.size)
    }
}
```

---

## Notas Importantes

1. **Timeout**: Cloud Functions tienen timeout de 60s por defecto. Para flujos de IA largos, aumentar a 300s.
2. **Retry**: Implementar retry logic para llamadas que fallen por timeout.
3. **Caché**: Considerar cachear respuestas de IA que no cambien frecuentemente.
4. **Cost**: Cada llamada a Cloud Function tiene costo. Monitorear uso en Firebase Console.
