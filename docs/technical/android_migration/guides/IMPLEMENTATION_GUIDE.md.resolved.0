# Guía de Implementación Paso a Paso - Pateá Android

## 📋 Índice
1. [Setup Inicial del Proyecto](#1-setup-inicial-del-proyecto)
2. [Configuración de Firebase](#2-configuración-de-firebase)
3. [Dependency Injection con Hilt](#3-dependency-injection-con-hilt)
4. [Navegación](#4-navegación)
5. [Autenticación](#5-autenticación)
6. [Implementación de Features](#6-implementación-de-features)
7. [Testing](#7-testing)
8. [Deployment](#8-deployment)

---

## 1. Setup Inicial del Proyecto

### Paso 1.1: Crear Proyecto en Android Studio

```bash
# Abrir Android Studio
# File > New > New Project
# Seleccionar "Empty Activity" con Compose
# Package name: com.patea.android
# Minimum SDK: API 26 (Android 8.0)
# Language: Kotlin
# Build configuration language: Kotlin DSL
```

### Paso 1.2: Copiar Archivos de Configuración

Copiar los siguientes archivos del paquete de migración:

```
android_config/
├── build.gradle           → app/build.gradle.kts
├── build.gradle.project   → build.gradle.kts
└── AndroidManifest.xml    → app/src/main/AndroidManifest.xml
```

### Paso 1.3: Estructura de Paquetes

Crear la siguiente estructura en `app/src/main/java/com/patea/android/`:

```
com.patea.android/
├── data/
│   ├── model/
│   │   ├── Player.kt
│   │   ├── Match.kt
│   │   ├── Team.kt
│   │   └── ...
│   ├── repository/
│   │   ├── PlayersRepository.kt
│   │   ├── MatchesRepository.kt
│   │   └── ...
│   └── remote/
│       └── CloudFunctionsApi.kt
├── di/
│   ├── AppModule.kt
│   ├── FirebaseModule.kt
│   └── NetworkModule.kt
├── ui/
│   ├── auth/
│   │   ├── LoginScreen.kt
│   │   └── AuthViewModel.kt
│   ├── dashboard/
│   │   ├── DashboardScreen.kt
│   │   └── DashboardViewModel.kt
│   ├── players/
│   │   ├── PlayersListScreen.kt
│   │   ├── PlayerDetailScreen.kt
│   │   └── PlayersViewModel.kt
│   ├── matches/
│   │   └── ...
│   ├── components/
│   │   ├── PlayerCard.kt
│   │   ├── MatchCard.kt
│   │   └── ...
│   └── theme/
│       ├── Color.kt
│       ├── Theme.kt
│       └── Type.kt
├── util/
│   ├── Constants.kt
│   ├── Extensions.kt
│   └── DateUtils.kt
├── navigation/
│   ├── NavGraph.kt
│   └── Screen.kt
├── PateaApplication.kt
└── MainActivity.kt
```

---

## 2. Configuración de Firebase

### Paso 2.1: Crear Proyecto en Firebase Console

1. Ir a [Firebase Console](https://console.firebase.google.com/)
2. Usar el **mismo proyecto Firebase** que la web
3. Click en "Add app" > Android
4. Package name: `com.patea.android`
5. Download `google-services.json`

### Paso 2.2: Agregar google-services.json

```bash
# Copiar google-services.json a:
app/google-services.json
```

### Paso 2.3: Configurar Firebase en el Código

```kotlin
// di/FirebaseModule.kt
package com.patea.android.di

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.storage.FirebaseStorage
import com.google.firebase.functions.FirebaseFunctions
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object FirebaseModule {

    @Provides
    @Singleton
    fun provideFirebaseAuth(): FirebaseAuth {
        return FirebaseAuth.getInstance()
    }

    @Provides
    @Singleton
    fun provideFirestore(): FirebaseFirestore {
        return FirebaseFirestore.getInstance().apply {
            // Enable offline persistence
            firestoreSettings = firestoreSettings.toBuilder()
                .setPersistenceEnabled(true)
                .build()
        }
    }

    @Provides
    @Singleton
    fun provideFirebaseStorage(): FirebaseStorage {
        return FirebaseStorage.getInstance()
    }

    @Provides
    @Singleton
    fun provideFirebaseFunctions(): FirebaseFunctions {
        return FirebaseFunctions.getInstance()
    }
}
```

---

## 3. Dependency Injection con Hilt

### Paso 3.1: Configurar Application Class

```kotlin
// PateaApplication.kt
package com.patea.android

import android.app.Application
import dagger.hilt.android.HiltAndroidApp

@HiltAndroidApp
class PateaApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        // Initialize any SDKs here
    }
}
```

### Paso 3.2: Configurar MainActivity

```kotlin
// MainActivity.kt
package com.patea.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import com.patea.android.navigation.NavGraph
import com.patea.android.ui.theme.PateaTheme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            PateaTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    NavGraph()
                }
            }
        }
    }
}
```

---

## 4. Navegación

### Paso 4.1: Definir Rutas

```kotlin
// navigation/Screen.kt
package com.patea.android.navigation

sealed class Screen(val route: String) {
    object Login : Screen("login")
    object Dashboard : Screen("dashboard")
    object Players : Screen("players")
    object PlayerDetail : Screen("players/{playerId}") {
        fun createRoute(playerId: String) = "players/$playerId"
    }
    object Matches : Screen("matches")
    object MatchDetail : Screen("matches/{matchId}") {
        fun createRoute(matchId: String) = "matches/$matchId"
    }
    object CreateMatch : Screen("matches/create")
    object Profile : Screen("profile")
}
```

### Paso 4.2: Crear NavGraph

```kotlin
// navigation/NavGraph.kt
package com.patea.android.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.patea.android.ui.auth.LoginScreen
import com.patea.android.ui.dashboard.DashboardScreen
import com.patea.android.ui.players.PlayersListScreen
import com.patea.android.ui.players.PlayerDetailScreen

@Composable
fun NavGraph(
    navController: NavHostController = rememberNavController(),
    startDestination: String = Screen.Login.route
) {
    NavHost(
        navController = navController,
        startDestination = startDestination
    ) {
        composable(Screen.Login.route) {
            LoginScreen(
                onLoginSuccess = {
                    navController.navigate(Screen.Dashboard.route) {
                        popUpTo(Screen.Login.route) { inclusive = true }
                    }
                }
            )
        }

        composable(Screen.Dashboard.route) {
            DashboardScreen(
                onNavigateToPlayers = {
                    navController.navigate(Screen.Players.route)
                },
                onNavigateToMatches = {
                    navController.navigate(Screen.Matches.route)
                }
            )
        }

        composable(Screen.Players.route) {
            PlayersListScreen(
                groupId = "current-group-id", // Get from user session
                onPlayerClick = { playerId ->
                    navController.navigate(Screen.PlayerDetail.createRoute(playerId))
                },
                onAddPlayerClick = {
                    // Navigate to add player screen
                }
            )
        }

        composable(
            route = Screen.PlayerDetail.route,
            arguments = listOf(
                navArgument("playerId") { type = NavType.StringType }
            )
        ) { backStackEntry ->
            val playerId = backStackEntry.arguments?.getString("playerId") ?: return@composable
            PlayerDetailScreen(
                playerId = playerId,
                onNavigateBack = { navController.popBackStack() }
            )
        }

        // Add more screens...
    }
}
```

---

## 5. Autenticación

### Paso 5.1: AuthRepository

```kotlin
// data/repository/AuthRepository.kt
package com.patea.android.data.repository

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.auth.GoogleAuthProvider
import kotlinx.coroutines.tasks.await
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepository @Inject constructor(
    private val auth: FirebaseAuth
) {
    val currentUser: FirebaseUser?
        get() = auth.currentUser

    suspend fun signInWithGoogle(idToken: String): Result<FirebaseUser> {
        return try {
            val credential = GoogleAuthProvider.getCredential(idToken, null)
            val result = auth.signInWithCredential(credential).await()
            Result.success(result.user!!)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun signInWithEmail(email: String, password: String): Result<FirebaseUser> {
        return try {
            val result = auth.signInWithEmailAndPassword(email, password).await()
            Result.success(result.user!!)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun signOut() {
        auth.signOut()
    }

    fun isUserLoggedIn(): Boolean {
        return currentUser != null
    }
}
```

### Paso 5.2: LoginScreen

```kotlin
// ui/auth/LoginScreen.kt
package com.patea.android.ui.auth

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel

@Composable
fun LoginScreen(
    onLoginSuccess: () -> Unit,
    viewModel: AuthViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(uiState) {
        if (uiState is AuthUiState.Success) {
            onLoginSuccess()
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = "Pateá",
            style = MaterialTheme.typography.displayLarge
        )

        Spacer(modifier = Modifier.height(48.dp))

        Button(
            onClick = { viewModel.signInWithGoogle() },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Iniciar sesión con Google")
        }

        if (uiState is AuthUiState.Loading) {
            CircularProgressIndicator(modifier = Modifier.padding(top = 16.dp))
        }

        if (uiState is AuthUiState.Error) {
            Text(
                text = (uiState as AuthUiState.Error).message,
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier.padding(top = 16.dp)
            )
        }
    }
}
```

---

## 6. Implementación de Features

### Orden Recomendado de Implementación

#### Semana 1-2: Core Features
1. ✅ Autenticación (Google Sign-In)
2. ✅ Dashboard básico
3. ✅ Lista de jugadores
4. ✅ Perfil de jugador

#### Semana 3-4: Matches
1. ✅ Lista de partidos
2. ✅ Detalles de partido
3. ✅ Crear partido
4. ✅ Generación de equipos (Cloud Function)

#### Semana 5-6: Evaluaciones y Stats
1. ✅ Evaluación post-partido
2. ✅ Actualización de stats
3. ✅ Historial de evaluaciones

#### Semana 7-8: Features Avanzadas
1. ✅ Google Fit integration
2. ✅ Pagos con MercadoPago
3. ✅ Notificaciones push

---

## 7. Testing

### Paso 7.1: Unit Tests

```kotlin
// test/PlayersViewModelTest.kt
class PlayersViewModelTest {
    @Test
    fun `loadPlayers updates state to Success`() = runTest {
        // Arrange
        val repository = FakePlayersRepository()
        val viewModel = PlayersViewModel(repository)

        // Act
        viewModel.loadPlayers("group-id")

        // Assert
        assertEquals(PlayersUiState.Success, viewModel.uiState.value)
    }
}
```

### Paso 7.2: UI Tests

```kotlin
// androidTest/PlayersListScreenTest.kt
@Test
fun playersListDisplaysPlayers() {
    composeTestRule.setContent {
        PlayersListScreen(
            groupId = "test-group",
            onPlayerClick = {},
            onAddPlayerClick = {}
        )
    }

    composeTestRule
        .onNodeWithText("Jugadores")
        .assertIsDisplayed()
}
```

---

## 8. Deployment

### Paso 8.1: Generar Signed APK

```bash
# En Android Studio:
# Build > Generate Signed Bundle / APK
# Seleccionar APK
# Crear nuevo keystore o usar existente
# Build variant: release
```

### Paso 8.2: Publicar en Google Play

1. Crear cuenta de Google Play Developer
2. Crear nueva aplicación
3. Completar Store Listing
4. Upload APK/AAB
5. Configurar precios y distribución
6. Submit for review

---

## 📚 Recursos Adicionales

- [Jetpack Compose Docs](https://developer.android.com/jetpack/compose)
- [Firebase Android Docs](https://firebase.google.com/docs/android/setup)
- [Hilt Documentation](https://dagger.dev/hilt/)
- [Material Design 3](https://m3.material.io/)

---

## ✅ Checklist de Implementación

### Setup
- [ ] Proyecto Android creado
- [ ] Firebase configurado
- [ ] Hilt configurado
- [ ] Navegación implementada

### Features Core
- [ ] Autenticación
- [ ] Dashboard
- [ ] Jugadores (CRUD)
- [ ] Partidos (CRUD)

### Integraciones
- [ ] Firebase Firestore
- [ ] Firebase Auth
- [ ] Firebase Storage
- [ ] Cloud Functions
- [ ] Google Fit
- [ ] Google Maps
- [ ] MercadoPago

### Testing
- [ ] Unit tests
- [ ] Integration tests
- [ ] UI tests

### Deployment
- [ ] Signed APK generado
- [ ] Play Store listing completo
- [ ] App publicada

---

**Tiempo Estimado Total**: 16-20 semanas  
**Equipo Recomendado**: 2 desarrolladores Android + 1 diseñador UI/UX
