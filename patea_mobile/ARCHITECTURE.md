# 🏛️ Arquitectura Técnica y Motores de Negocio — Pateá Mobile

Este documento describe en profundidad los motores de cálculo, algoritmos de torneos, flujo de datos reactivo y diseño de estado de la aplicación Flutter.

---

## 1. Motor de Cálculo de OVR (`lib/core/utils/ovr_calculator.dart`)

El sistema de progresión de OVR implementa un modelo **anti-inflación** y amortiguación de atributos altos:

```
                          ┌───────────────────────┐
                          │   Rating de Partido   │
                          │        (1 - 10)       │
                          └───────────┬───────────┘
                                      │
                                      ▼
                        ┌───────────────────────────┐
                        │ Delta Base = Rating - 5.0 │
                        └─────────────┬─────────────┘
                                      │
                                      ▼
                         ┌──────────────────────────┐
                         │ Factor de Escala por OVR │
                         │  < 50: 0.50  |  < 80: 0.20│
                         │  < 60: 0.40  |  < 90: 0.10│
                         │  < 70: 0.30  |  ≥ 90: 0.05│
                         └────────────┬─────────────┘
                                      │
                                      ▼
                        ┌───────────────────────────┐
                        │   Clamp Delta: ±1.5 OVR   │
                        └─────────────┬─────────────┘
                                      │
                                      ▼
             ┌────────────────────────────────────────────────┐
             │ Puntos Totales = Delta OVR * 6.0               │
             │ Distribución Ponderada por Posición (DEL/MED…) │
             │ Amortiguación por Atributo (≥60, ≥75, ≥85, ≥92)│
             └────────────────────────┬───────────────────────┘
                                      │
                                      ▼
             ┌────────────────────────────────────────────────┐
             │ Efectos Directos de 45 Tags de Rendimiento     │
             │ OVR Final = Media(PAC, SHO, PAS, DRI, DEF, PHY)│
             └────────────────────────────────────────────────┘
```

### Ponderaciones por Posición:
| Posición | PAC | SHO | PAS | DRI | DEF | PHY |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **DEL (Delantero)** | 25% | 35% | 15% | 15% | 5% | 5% |
| **MED (Medio)** | 15% | 15% | 30% | 20% | 10% | 10% |
| **DEF (Defensa)** | 15% | 5% | 15% | 5% | 40% | 20% |
| **POR (Portero)** | 10% | 5% | 10% | 5% | 50% | 20% |

---

## 2. Algoritmo de Llaves de Torneo (`lib/core/utils/bracket_generator.dart`)

### Generación:
- Compatible con torneos de **2, 4, 8, 16 y 32 equipos**.
- Sorteo aleatorio o sembrado por OVR (`seedingType: 'ovr_based'`).
- Enlace relacional entre partidos mediante `nextMatchNumber = (currentMatchNumber + 1) ~/ 2`.

### Avance Automático:
Cuando se registra el resultado de un partido de copa:
1. Se valida que ambos equipos hayan disputado el partido y no haya empate.
2. Se identifica el `winnerId` y `winnerName`.
3. Se actualiza el partido correspondiente en la siguiente ronda (`round_of_16` ➔ `round_of_8` ➔ `semifinals` ➔ `final`).
4. Si concluye la Gran Final, el torneo pasa automáticamente a estado `completed`.

---

## 3. Flujo de Datos y Reactividad en Firestore

```
┌─────────────────────────┐
│     Cloud Firestore     │
│ (/players, /matches...) │
└────────────┬────────────┘
             │ (Streams en tiempo real)
             ▼
┌─────────────────────────┐
│    FirestoreService     │
│ (Mapeo a Data Models)   │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│    Riverpod Providers   │
│ (StreamProvider<List>)  │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  Flutter UI / Widgets   │
│ (ConsumerWidget/ref)    │
└─────────────────────────┘
```

### Servicios de Mutación:
- **`EvaluationService`**: Ejecuta `batch` atómico en Firestore escribiendo la evaluación, actualizando los 6 atributos en `/players/{id}`, creando el historial en `/players/{id}/ovrHistory/` y publicando la entrada en `/feedActivities/`.
- **`MatchService`**: Controla el inicio de partido, cronómetro, eventos en vivo (goles con autor y asistencia) y cierre de partido.
- **`GroupService`**: Crea grupos con código de 6 caracteres, asocia jugadores manuales y actualiza indumentarias.
- **`TournamentService`**: Administra llaves y fixture de torneos.
