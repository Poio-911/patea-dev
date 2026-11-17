# ⚽ Pateá Mobile — Flutter App

## Revisión local 1.0.31+32 — 17/11/2026

Ligas y copas con diseño nativo propio, mi equipo, próximo encuentro, calendario y llaves, tabla, planteles, estadísticas e inscripciones. El organizador configura, sortea, programa, confirma resultados y archiva conservando el historial. El cierre se sincroniza desde Firebase y genera evaluaciones de forma atómica.

[Funciones y validación](../docs/design/COMPETITIONS_NATIVE_2026-11-17.md) y [guía visual vigente](../docs/design/UX_BRAND_2026-11-15.md). Esta revisión de Android no implica una distribución nueva en TestFlight.

> **Tu carrera amateur, profesionalizada.**  
> Aplicación móvil nativa desarrollada en **Flutter 3.41+ / Dart 3.11+**, conectada en tiempo real a **Firebase (`mil-disculpis`)**, con sistema de diseño deportivo (Game Theme), fichas deportivas con OVR integrado, y cálculo de progresión anti-inflación.

---

## 📱 Capturas y Vistas Principales

| Dashboard Deportivo | El Vestuario (Fichas) | Minuto a Minuto en Vivo |
| :---: | :---: | :---: |
| Próximo partido, alertas en vivo y estadísticas | Fichas con retrato, OVR y 6 atributos | Marcador y registro de goles en tiempo real |

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
│   │       ├── patea_background.dart       # Lienzo tonal con líneas de cancha sutiles
│   │       ├── player_card_widget.dart     # Ficha deportiva con marcador lateral
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

1. **Fichas deportivas integradas**:
   - Retrato con nombre superpuesto y degradado hasta atributos.
   - Posición recta y OVR ámbar conectados por línea y punto.
   - Máximo de atributos destacado, incluidos empates; correspondencia para arqueros.
   - Fotos y zoom conservados, edición legible y grilla adaptable al texto.
   - Ambos temas y movimiento reducido; sin foil ni inclinación 3D.

2. **Shell Glassmórfico y Header Interactivo**:
   - Experiencia Edge-to-Edge nativa con barra de estado y gestos transparentes.
   - Dock de navegación y Header superior con efecto glassmorphism (`BackdropFilter` sigma 18).
   - Tutorial de bienvenida interactivo de 6 pasos con carrusel (`PateaHelpDialog`).
   - Centro de notificaciones en tiempo real desde Firestore (`PateaNotificationsSheet`).
   - Menú de usuario modal con OVR, acceso a perfil, grupos y cierre de sesión (`PateaUserMenuSheet`).

3. **Partidos y Gestión Deportiva**:
   - Hero banner de próximo partido con carrusel automático y fotografía a pantalla completa (`BoxFit.cover`).
   - Fondos de estadio deterministas (`fondo_X.jpg`) con viñeta y gradiente en todas las cards de partidos.
   - Creación de partidos con geolocalización Nominatim y pronóstico meteorológico Open-Meteo.
   - Registro en tiempo real de goles, tarjetas y sustituciones con temporizador en vivo.
   - Estandarización canónica de encabezados y espaciados idénticos en `Plantel`, `Partidos`, `Explorar` y `Evaluaciones`.

4. **Motor Matemático Anti-Inflación de OVR y Evaluaciones**:
   - Escala de progresión de OVR según nivel actual del jugador (<50: 0.50, <70: 0.30, ≥90: 0.05).
   - Acotamiento estricto a un máximo de ±1.5 OVR por partido.
   - Distribución de puntos ponderada según la posición (`DEL`, `MED`, `DEF`, `POR`).
   - Amortiguación de atributos altos (≥60: 0.7, ≥75: 0.4, ≥85: 0.2, ≥92: 0.1).
   - Sistema de 34 tags de rendimiento con cálculo exacto de deltas y registro en `ovrHistory`.

5. **Torneos, Mercado de Fichajes y Asistente IA**:
   - Mercado de fichajes y partidos abiertos en `/explorar` con cálculo de distancias Haversine.
   - Generación de llaves para copas y avance automático de ganadores.
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
