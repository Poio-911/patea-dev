# ⚽ Pateá Mobile — Flutter App

> **Tu carrera amateur, profesionalizada.**  
> Aplicación móvil nativa desarrollada en **Flutter 3.41+ / Dart 3.11+**, conectada en tiempo real a **Firebase (`mil-disculpis`)**, con sistema de diseño deportivo (Game Theme), cartas coleccionables 3D con auras de OVR, y cálculo de progresión anti-inflación.

---

## 📱 Capturas y Vistas Principales

| Dashboard Deportivo | El Vestuario (Cartas 3D) | Minuto a Minuto en Vivo |
| :---: | :---: | :---: |
| Próximo partido, alertas en vivo y estadísticas | Cartas FIFA con tiers y 6 atributos | Marcador y registro de goles en tiempo real |

---

## 🏗️ Arquitectura del Proyecto

El proyecto sigue una arquitectura modular por capas orientada a características (**Feature-First**) y gestión de estado reactiva con **Flutter Riverpod**:

```
patea_mobile/
├── lib/
│   ├── core/
│   │   ├── constants/
│   │   │   └── performance_tags.dart       # Base de datos de los 45 tags de rendimiento
│   │   ├── models/
│   │   │   ├── competition_model.dart      # Ligas y Brackets de Copas
│   │   │   ├── group_model.dart            # Grupos, equipos e indumentarias
│   │   │   ├── match_model.dart            # Partidos, equipos y eventos
│   │   │   └── player_model.dart           # Jugadores, atributos y estadísticas
│   │   ├── router/
│   │   │   └── app_router.dart             # GoRouter con barra de navegación Dark Glass
│   │   ├── services/
│   │   │   ├── auth_service.dart           # Firebase Auth (Email & Google)
│   │   │   ├── evaluation_service.dart     # Evaluaciones peer-to-peer y deltas OVR
│   │   │   ├── firestore_service.dart      # Streams reactivos de Firestore
│   │   │   ├── group_service.dart          # Gestión de grupos y jugadores manuales
│   │   │   ├── match_service.dart          # Ciclo de vida y eventos en vivo
│   │   │   └── tournament_service.dart     # Llaves de copas y avance automático
│   │   ├── theme/
│   │   │   ├── app_colors.dart             # Paleta Carbon, Neon Volt, Turquesa y Tiers
│   │   │   ├── app_theme.dart              # ThemeData oscuro y configuraciones de botones/inputs
│   │   │   └── app_typography.dart         # Google Fonts (Space Grotesk, Outfit)
│   │   ├── utils/
│   │   │   ├── bracket_generator.dart      # Generador y avance de llaves de eliminación
│   │   │   └── ovr_calculator.dart         # Motor matemático de OVR anti-inflación
│   │   └── widgets/
│   │       ├── attributes_radar_chart.dart # Polígono de radar con fl_chart
│   │       ├── jersey_painter.dart         # Renderizador vectorial de 6 camisetas
│   │       ├── patea_background.dart       # Fondo carbon con ambient radial glow
│   │       ├── player_card_widget.dart     # Carta coleccionable con física táctil 3D
│   │       └── player_position_badge.dart  # Badges posicionales DEL, MED, DEF, POR
│   ├── features/
│   │   ├── auth/                           # Pantalla de Login / Registro
│   │   ├── coach/                          # DT Virtual IA (Chat táctico)
│   │   ├── competitions/                   # Tablas de liga y llaves interactivas de copa
│   │   ├── dashboard/                      # Panel principal con hero match y métricas
│   │   ├── evaluations/                    # Formulario de 45 tags con recálculo de OVR
│   │   ├── matches/                        # Minuto a minuto en vivo y creación de partidos
│   │   ├── players/                        # Grilla de vestuario y detalle de jugador
│   │   └── social/                         # Muro de actividades y tabla de líderes
│   ├── firebase_options.dart               # Configuración oficial del proyecto Firebase
│   └── main.dart                           # Entrada principal con ProviderScope
```

---

## ⚡ Características Principales

1. **Cartas Coleccionables 3D**:
   - Rotación y perspectiva táctil en tiempo real mediante `Transform` y `Matrix4`.
   - Auras de resplandor dinámicas según el tier de OVR (Platino Elite, Oro, Plata, Bronce).
   - Grid de 6 atributos (`RIT`, `TIR`, `PAS`, `REG`, `DEF`, `FIS`) con barras de progreso y resaltado automático del atributo principal con el color de la posición.
   - Marca de agua gigante de la posición en el fondo.

2. **Motor Matemático Anti-Inflación de OVR**:
   - Escala de progresión de OVR según el nivel actual del jugador (<50: 0.50, <70: 0.30, ≥90: 0.05).
   - Acotamiento estricto a un máximo de ±1.5 OVR por partido.
   - Distribución de puntos ponderada según la posición (`DEL`, `MED`, `DEF`, `POR`).
   - Amortiguación de atributos altos (≥60: 0.7, ≥75: 0.4, ≥85: 0.2, ≥92: 0.1).
   - Aplicación directa de los 45 tags de rendimiento y registro en la subcolección `ovrHistory`.

3. **Partidos y Control de Organizador en Vivo**:
   - Creación de partidos manuales o colaborativos.
   - Registro en tiempo real de goles (con selección de autor), tarjetas y sustituciones.
   - Marcador dinámico y temporizador en vivo.
   - Habilitación automática de evaluaciones al finalizar el partido.

4. **Torneos y Copas con Avance Automático**:
   - Generación automática de llaves para 2, 4, 8, 16 o 32 equipos.
   - Visor interactivo con Zoom & Pan (`InteractiveViewer`).
   - Carga de resultados con avance automático del equipo ganador a la siguiente ronda.

5. **Comunidad y Asistente IA**:
   - Muro social de actividades con reacciones en vivo (🔥, 👏, ⚽).
   - Rankings globales y podio (Oro, Plata, Bronce).
   - Chat interactivo con el DT Virtual IA para análisis táctico.

---

## 🚀 Guía de Ejecución y Despliegue

### Requisitos Previos:
- Flutter SDK 3.41+ instalado.
- Android Studio / SDK Build Tools con emulador activo (`emulator-5554` o dispositivo físico).
- JDK 17 (Adoptium / OpenJDK).

### Comandos de Desarrollo:
```bash
# 1. Navegar al directorio de la app móvil
cd patea_mobile

# 2. Instalar dependencias
flutter pub get

# 3. Verificar análisis estático
flutter analyze

# 4. Ejecutar en emulador o dispositivo conectado
flutter run
```

### Compilar APK para Android:
```bash
flutter build apk --debug
# O para producción:
flutter build apk --release
```
