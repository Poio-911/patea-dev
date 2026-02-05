# Pateá - Plataforma de Fútbol Amateur con Inteligencia Artificial

**Documento de Producto**
**Versión 1.0 | Febrero 2026**

---

## Índice

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [El Problema](#2-el-problema)
3. [La Solución: Pateá](#3-la-solución-pateá)
4. [Arquitectura de la Plataforma](#4-arquitectura-de-la-plataforma)
5. [Módulos Funcionales](#5-módulos-funcionales)
6. [El Ciclo de Vida del Jugador](#6-el-ciclo-de-vida-del-jugador)
7. [Sistema de Progresión (OVR)](#7-sistema-de-progresión-ovr)
8. [Inteligencia Artificial Integrada](#8-inteligencia-artificial-integrada)
9. [Stack Tecnológico](#9-stack-tecnológico)
10. [Roadmap de Desarrollo](#10-roadmap-de-desarrollo)
11. [Diferenciadores Clave](#11-diferenciadores-clave)

---

## 1. Resumen Ejecutivo

**Pateá** es una plataforma web progresiva (PWA) que transforma la experiencia del fútbol amateur mediante la digitalización completa de la gestión de partidos, la gamificación del rendimiento deportivo y la integración de inteligencia artificial generativa.

### Propuesta de Valor

> "Convertimos cada picadito en una experiencia profesional, donde cada jugador tiene su carta coleccionable que evoluciona según su rendimiento real en cancha."

### Cifras Clave

| Métrica | Valor |
|---------|-------|
| Flujos de IA activos | 13 |
| Tipos de partido soportados | 7 |
| Tags de rendimiento | 45 |
| Atributos de jugador | 6 (PAC, SHO, PAS, DRI, DEF, PHY) |
| Rango de OVR | 40-99 |

---

## 2. El Problema

### El Fútbol Amateur Está Desorganizado

Cada semana, millones de personas organizan partidos de fútbol amateur enfrentando los mismos problemas:

1. **Coordinación Manual**: WhatsApp saturado con "¿quién va?", "¿a qué hora?", "¿dónde es?"
2. **Equipos Desbalanceados**: El clásico "ganamos porque teníamos al mejor"
3. **Sin Registro Histórico**: Nadie recuerda quién metió el gol del campeonato hace 2 años
4. **Falta de Motivación**: Después de años jugando, todo se siente igual
5. **Cero Profesionalismo**: No hay estadísticas, no hay métricas, no hay progresión

### El Mercado Ignorado

- **Videojuegos de fútbol**: Desconectados de la cancha real, no reflejan tu rendimiento
- **Apps de organización**: Solo coordinan horarios, no gamifican ni analizan datos
- **Ligas locales**: Gestión en papel o Excel, sin tecnología moderna

**Pateá llena este vacío**: Une la gamificación de los videojuegos con la realidad del fútbol amateur.

---

## 3. La Solución: Pateá

### Una Plataforma Integral

Pateá no es solo una app para organizar partidos. Es un **ecosistema deportivo completo** que:

```
┌─────────────────────────────────────────────────────────────────┐
│                         PATEÁ                                   │
├─────────────────────────────────────────────────────────────────┤
│  ORGANIZACIÓN        GAMIFICACIÓN         INTELIGENCIA          │
│  ─────────────       ─────────────        ────────────          │
│  • Partidos          • Cartas digitales   • Equipos IA          │
│  • Grupos            • OVR dinámico       • Análisis            │
│  • Ligas             • Logros             • Crónicas            │
│  • Copas             • Rankings           • Predicciones        │
│                                                                 │
│  RED SOCIAL          COMPETICIONES        PERSONALIZACIÓN       │
│  ──────────          ────────────         ───────────────       │
│  • Feed              • Ligas              • Camisetas           │
│  • Seguidos          • Copas              • Equipos             │
│  • Reacciones        • Brackets           • Perfiles            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Arquitectura de la Plataforma

### Diagrama de Alto Nivel

```
┌──────────────────────────────────────────────────────────────────────┐
│                            CLIENTE                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │   Next.js   │  │   React 18  │  │ Tailwind CSS│  │  shadcn/ui  │  │
│  │  App Router │  │  Components │  │   Styling   │  │     UI      │  │
│  └──────┬──────┘  └──────┬──────┘  └─────────────┘  └─────────────┘  │
│         │                │                                            │
│         └────────┬───────┘                                            │
│                  ▼                                                    │
│         ┌───────────────┐                                             │
│         │ Server Actions│  ◄── Mutaciones server-side                 │
│         └───────┬───────┘                                             │
└─────────────────┼────────────────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│                          FIREBASE                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │  Firestore  │  │    Auth     │  │   Storage   │  │     FCM     │  │
│  │  Database   │  │   Google    │  │   Images    │  │    Push     │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      INTELIGENCIA ARTIFICIAL                          │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                    Firebase Genkit                               │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │ │
│  │  │ Gemini 2.0   │  │ Gemini 2.5   │  │ Gemini 2.5   │           │ │
│  │  │    Flash     │  │    Flash     │  │ Flash-Image  │           │ │
│  │  │  (Análisis)  │  │ (Resúmenes)  │  │ (Imágenes)   │           │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘           │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

### Flujo de Datos en Tiempo Real

```
Usuario A                    Firestore                    Usuario B
    │                            │                            │
    │  updateDoc(match)          │                            │
    ├───────────────────────────►│                            │
    │                            │  onSnapshot()              │
    │                            ├───────────────────────────►│
    │                            │                            │
    │                            │◄── Re-render automático ───┤
```

La arquitectura usa **listeners en tiempo real** (`onSnapshot`) que permiten que múltiples usuarios vean cambios instantáneamente sin refrescar la página.

---

## 5. Módulos Funcionales

### 5.1 Dashboard

**Ruta:** `/dashboard`

El centro de comando del jugador que muestra:

| Componente | Descripción |
|------------|-------------|
| **Tarjeta de Jugador** | Foto, nombre, posición, OVR actual con diseño de carta coleccionable |
| **Próximo Partido** | Countdown, ubicación con mapa, pronóstico del clima |
| **Estadísticas Rápidas** | Partidos, goles, asistencias, promedio de rating |
| **Actividad Reciente** | Feed condensado de últimas actividades del grupo |

---

### 5.2 Jugadores (El Vestuario)

**Ruta:** `/players`

Sistema completo de gestión de jugadores con cartas coleccionables.

#### Atributos del Jugador

Cada jugador tiene 6 atributos que determinan su OVR (Overall Rating):

| Atributo | Código | Descripción |
|----------|--------|-------------|
| Velocidad | PAC | Rapidez y aceleración |
| Tiro | SHO | Potencia y precisión de disparo |
| Pase | PAS | Visión y precisión de pases |
| Regate | DRI | Control de balón y gambeta |
| Defensa | DEF | Marcaje y anticipación |
| Físico | PHY | Fuerza y resistencia |

**Fórmula OVR:**
```
OVR = (PAC + SHO + PAS + DRI + DEF + PHY) / 6
```

#### Tiers de Rareza (Por OVR)

| Tier | Rango OVR | Efecto Visual |
|------|-----------|---------------|
| **Elite** | 86-99 | Animación 3D flip, borde dorado |
| **Gold** | 76-85 | Rotación 2D, borde amarillo |
| **Silver** | 65-75 | Zoom suave, borde plateado |
| **Bronze** | 40-64 | Slide básico, borde bronce |

---

### 5.3 Grupos

**Ruta:** `/groups`

Sistema de organización social que permite:

- **Crear grupos** con código de invitación único (6 caracteres)
- **Gestionar membresías** con roles (Admin, Moderador, Miembro)
- **Diseñar equipos** con camisetas personalizables
- **Ver estadísticas** agregadas del grupo

#### Sistema de Camisetas

6 diseños disponibles con colores personalizables:

| Diseño | Descripción |
|--------|-------------|
| `plain` | Color sólido uniforme |
| `vertical` | Franjas verticales clásicas |
| `band` | Franja horizontal en el pecho |
| `chevron` | V invertida en el pecho |
| `thirds` | División en tres bloques |
| `lines` | Líneas finas decorativas |

---

### 5.4 Partidos

**Ruta:** `/matches`

El corazón de la plataforma. Soporta **7 tipos de partido**:

#### Tipos de Partido

| Tipo | Descripción | Jugadores |
|------|-------------|-----------|
| `manual` | Organizador selecciona jugadores, IA arma equipos | Invitados |
| `collaborative` | Abierto, jugadores se anotan hasta llenar | Auto-inscripción |
| `by_teams` | Dos equipos predefinidos se enfrentan | Planteles completos |
| `intergroup_friendly` | Amistoso entre grupos diferentes | Mixto |
| `league` | Partido de liga con puntos | Equipos de liga |
| `cup` | Partido eliminatorio de copa | Equipos de copa |
| `league_final` | Final de desempate de liga | 2 equipos empatados |

#### Ciclo de Vida del Partido

```
┌──────────┐    Iniciar    ┌──────────┐   Finalizar   ┌───────────┐   Evaluar   ┌───────────┐
│ UPCOMING │──────────────►│  ACTIVE  │──────────────►│ COMPLETED │────────────►│ EVALUATED │
└──────────┘               └──────────┘               └───────────┘             └───────────┘
     │                          │                          │                          │
     ▼                          ▼                          ▼                          ▼
 • Confirmaciones          • Registro de             • Asignaciones de         • OVRs actualizados
 • Votación fecha            goles/tarjetas            evaluación creadas      • Crónica generada
 • Chat grupal             • Timer en vivo           • Estadísticas            • Post en feed social
 • Equipos generados       • Marcador real-time        calculadas              • Logros desbloqueados
```

#### Dashboard de Partido en Vivo

Durante un partido activo, el organizador puede registrar:

| Evento | Datos Capturados |
|--------|------------------|
| **Gol** | Jugador, minuto, tipo (normal/penal/tiro libre/cabeza/volea/autogol), asistencia |
| **Tarjeta** | Jugador, tipo (amarilla/roja), minuto, razón |
| **Sustitución** | Jugador sale, jugador entra, minuto, razón |
| **Falta** | Jugador, tipo, ubicación en cancha |
| **Corner/Tiro libre** | Equipo, minuto |
| **Atajada** | Arquero, minuto |

---

### 5.5 Competiciones

**Ruta:** `/competitions`

Sistema completo de torneos organizados.

#### Ligas

| Característica | Detalle |
|----------------|---------|
| **Formatos** | Round Robin (todos vs todos), Double Round Robin (ida y vuelta) |
| **Puntuación** | Victoria: 3pts, Empate: 1pt, Derrota: 0pts |
| **Desempates** | 1) Puntos → 2) Diferencia de gol → 3) Goles a favor → 4) Head-to-head → 5) Final extra |
| **Fixture** | Generado automáticamente al iniciar la liga |
| **Equipos** | 2-16 equipos por liga |

#### Copas

| Característica | Detalle |
|----------------|---------|
| **Formato** | Eliminación directa (single elimination) |
| **Equipos** | 2, 4, 8, 16 o 32 equipos |
| **Seeding** | Random o basado en OVR promedio |
| **Rondas** | 32avos → 16avos → 8avos → Semifinal → Final |
| **Avance** | Automático al finalizar cada partido |

#### Bracket Visual

```
Cuartos          Semifinal         Final           Campeón
┌─────────┐
│ Equipo 1│──┐
└─────────┘  │    ┌─────────┐
             ├───►│ Ganador │──┐
┌─────────┐  │    └─────────┘  │
│ Equipo 2│──┘                 │    ┌─────────┐
└─────────┘                    ├───►│ Ganador │──┐
                               │    └─────────┘  │    ┌─────────┐
┌─────────┐                    │                 ├───►│ CAMPEÓN │
│ Equipo 3│──┐                 │                 │    └─────────┘
└─────────┘  │    ┌─────────┐  │                 │
             ├───►│ Ganador │──┘                 │
┌─────────┐  │    └─────────┘                    │
│ Equipo 4│──┘                                   │
└─────────┘                                      │
```

---

### 5.6 Evaluaciones

**Ruta:** `/evaluations`

Sistema peer-to-peer donde los jugadores evalúan a sus compañeros después de cada partido.

#### Tres Métodos de Evaluación

| Método | Descripción | Impacto en OVR |
|--------|-------------|----------------|
| **Puntos** | Slider 1-10 | Modifica OVR general, distribuido por posición |
| **Tags** | Seleccionar 3+ etiquetas de rendimiento | Modifica atributos específicos directamente |
| **Texto (IA)** | Descripción libre procesada por Gemini | IA extrae atributos y genera resumen |

#### Tags de Rendimiento

**45 tags totales** organizados por categoría:

**Positivos (24):**
- Arquero: "El Pulpo" (+3 DEF), "Achique Valiente" (+2 PAC, +1 DEF)
- Defensa: "Un Muro" (+3 DEF), "Cierre Providencial" (+3 DEF, +1 PAC)
- Mediocampo: "Pase Quirúrgico" (+3 PAS, +1 DRI), "El Titiritero" (+2 PAS, +1 DRI)
- Ataque: "Definió como los Dioses" (+3 SHO), "Gambeta Endiablada" (+3 DRI, +1 PAC)
- Actitud: "Corazón y Garra" (+3 PHY), "Correcaminos" (+2 PAC, +2 PHY)

**Negativos (21):**
- Arquero: "Manos de Manteca" (-3 DEF), "Estatua de Sal" (-2 DEF, -1 PAC)
- Defensa: "Salió con el Diario" (-3 DEF, -1 PAC), "Perdió la Marca" (-2 DEF)
- Mediocampo: "Pase al Rival" (-3 PAS), "Se Enamoró de la Pelota" (-2 DRI, -1 PAS)
- Ataque: "Se Comió un Elefante" (-3 SHO), "La Mandó a la Tribuna" (-2 SHO)

---

### 5.7 Feed Social

**Ruta:** `/social`

Red social interna con actividades generadas automáticamente.

#### Tipos de Actividad

| Tipo | Trigger | Contenido |
|------|---------|-----------|
| `match_played` | Partido finalizado | Resultado, equipos, goles |
| `match_organized` | Partido creado | Invitación a unirse |
| `ovr_increased` | OVR sube | Nuevo OVR, diferencia |
| `ovr_decreased` | OVR baja | Nuevo OVR, diferencia |
| `goal_scored` | Gol registrado | Jugador, partido, minuto |
| `achievement_unlocked` | Logro desbloqueado | Nombre del logro |
| `player_created` | Nuevo registro | Bienvenida al jugador |
| `new_follower` | Alguien te sigue | Quién te empezó a seguir |

#### Interacciones

| Acción | Descripción |
|--------|-------------|
| **Reacciones** | 🔥 Fuego, 👏 Aplauso, ⚽ Gol |
| **Comentarios** | Thread de respuestas con likes |
| **Reposts** | Compartir actividad de otros |
| **Seguir** | Ver actividades de usuarios específicos |

---

### 5.8 Notificaciones

Sistema de alertas push y en-app.

| Tipo | Descripción |
|------|-------------|
| `match_invite` | Invitación a partido |
| `match_reminder` | Recordatorio 1 hora antes |
| `evaluation_pending` | Evaluaciones por completar |
| `ovr_milestone` | Alcanzaste nuevo tier de OVR |
| `achievement_unlocked` | Nuevo logro desbloqueado |
| `new_follower` | Alguien te empezó a seguir |
| `challenge_received` | Desafío de otro equipo |

---

## 6. El Ciclo de Vida del Jugador

### De Novato a Leyenda

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CICLO DE VIDA DEL JUGADOR                            │
└─────────────────────────────────────────────────────────────────────────────┘

     REGISTRO                    INTEGRACIÓN                   PARTICIPACIÓN
        │                            │                              │
        ▼                            ▼                              ▼
  ┌───────────┐              ┌───────────────┐              ┌───────────────┐
  │  Crear    │              │   Unirse a    │              │   Jugar       │
  │  Cuenta   │─────────────►│    Grupo      │─────────────►│   Partidos    │
  │           │              │               │              │               │
  │ • OVR: 50 │              │ • Código 6    │              │ • Manual      │
  │ • Stats:0 │              │   caracteres  │              │ • Colaborativo│
  │           │              │ • Elegir      │              │ • Por equipos │
  └───────────┘              │   equipo      │              │ • Liga/Copa   │
                             └───────────────┘              └───────┬───────┘
                                                                    │
        ┌───────────────────────────────────────────────────────────┘
        │
        ▼
  ┌───────────────┐          ┌───────────────┐              ┌───────────────┐
  │   Ser         │          │   Recibir     │              │   Ver         │
  │   Evaluado    │─────────►│   Cambios     │─────────────►│   Progreso    │
  │               │          │   de OVR      │              │               │
  │ • Por peers   │          │               │              │ • Historial   │
  │ • Puntos/Tags │          │ • +/- hasta   │              │ • Gráficos    │
  │ • Texto IA    │          │   1.5 OVR     │              │ • Comparativas│
  └───────────────┘          └───────────────┘              └───────┬───────┘
                                                                    │
        ┌───────────────────────────────────────────────────────────┘
        │
        ▼
  ┌───────────────┐          ┌───────────────┐              ┌───────────────┐
  │   Desbloquear │          │   Competir    │              │   Alcanzar    │
  │   Logros      │─────────►│   en Torneos  │─────────────►│   Elite       │
  │               │          │               │              │   (OVR 86+)   │
  │ • Hat-trick   │          │ • Ligas       │              │               │
  │ • 100 goles   │          │ • Copas       │              │ • Carta       │
  │ • Invicto     │          │ • Campeón     │              │   animada     │
  └───────────────┘          └───────────────┘              └───────────────┘
```

### Engagement Loops

**Loop Semanal:**
```
Lunes: Recibir recordatorio de partido → Confirmar asistencia
Miércoles: Jugar partido → Registrar eventos en vivo
Jueves: Evaluar compañeros → Ver crónica generada por IA
Viernes: Recibir nuevo OVR → Comparar con amigos
Domingo: Ver tabla de liga actualizada → Planificar próximo partido
```

**Loop de Progresión:**
```
Jugar bien → Recibir buenas evaluaciones → OVR sube →
Carta se ve mejor → Motivación para jugar mejor → Repetir
```

---

## 7. Sistema de Progresión (OVR)

### Filosofía de Diseño

El sistema de OVR está diseñado para:

1. **Reflejar rendimiento real** - No se compra, se gana jugando
2. **Ser justo** - Catch-up para novatos, grind para élites
3. **Incentivar consistencia** - Rendimiento sostenido > picos aislados
4. **Evitar inflación** - Scaling dinámico previene OVRs inflados

### Cálculo de Cambio de OVR

#### Paso 1: Aplicar Tags (Directo a Atributos)

```
Si recibió tag "Goleador" (+3 SHO, +1 PAC):
  player.sho += 3
  player.pac += 1
```

#### Paso 2: Aplicar Evaluación IA (Si usó texto)

```
IA analiza: "Jugó muy bien, recuperó muchas pelotas"
IA extrae: { def: +2, phy: +1 }
Aplicar directamente a atributos
```

#### Paso 3: Calcular Cambio por Puntos (Rating 1-10)

**Fórmula:**
```
ratingDelta = avgRating - 5  (baseline es 5 = neutro)
scale = getScaleByOVR(currentOVR)
ovrChange = ratingDelta × scale
ovrChange = clamp(ovrChange, -1.5, +1.5)  // Máximo ±1.5 por partido
```

#### Scaling Dinámico (Anti-Inflación)

| OVR Actual | Scale | Ejemplo (Rating 8) |
|------------|-------|---------------------|
| < 50 | 0.50 | (8-5) × 0.50 = **+1.5** |
| 50-60 | 0.40 | (8-5) × 0.40 = **+1.2** |
| 60-70 | 0.30 | (8-5) × 0.30 = **+0.9** |
| 70-80 | 0.20 | (8-5) × 0.20 = **+0.6** |
| 80-90 | 0.10 | (8-5) × 0.10 = **+0.3** |
| ≥ 90 | 0.05 | (8-5) × 0.05 = **+0.15** |

**Interpretación:** Un jugador con OVR 50 que recibe rating 8 gana +1.5 OVR. El mismo rating para un jugador con OVR 90 le da solo +0.15 OVR.

#### Paso 4: Distribuir Puntos por Posición

El cambio de OVR se distribuye a los 6 atributos según la posición del jugador:

| Posición | PAC | SHO | PAS | DRI | DEF | PHY |
|----------|-----|-----|-----|-----|-----|-----|
| **DEL** | 25% | 35% | 15% | 15% | 5% | 5% |
| **MED** | 15% | 15% | 30% | 20% | 10% | 10% |
| **DEF** | 15% | 5% | 15% | 5% | 40% | 20% |
| **POR** | 10% | 5% | 10% | 5% | 50% | 20% |

**Ejemplo:** Un delantero gana +1.2 OVR (total 7.2 puntos de atributo):
- PAC: +1.8, SHO: +2.5, PAS: +1.1, DRI: +1.1, DEF: +0.4, PHY: +0.4

#### Paso 5: Recalcular OVR Final

```
newOVR = (PAC + SHO + PAS + DRI + DEF + PHY) / 6
newOVR = clamp(newOVR, 40, 99)
```

### Ejemplo Completo

**Jugador:** Juan (DEL), OVR 65

**Partido:**
- Recibió tags: "Goleador" (+3 SHO, +1 PAC), "Correcaminos" (+2 PAC, +2 PHY)
- Rating promedio: 8/10

**Cálculo:**

```
1. Tags: SHO +3, PAC +3, PHY +2

2. Puntos:
   - ratingDelta = 8 - 5 = 3
   - scale (OVR 65) = 0.30
   - ovrChange = 3 × 0.30 = 0.9
   - Distribución DEL: PAC +0.22, SHO +0.32, PAS +0.14, DRI +0.14, DEF +0.04, PHY +0.04

3. Total cambios:
   - PAC: +3 (tags) + 0.22 (puntos) = +3.22 → +3
   - SHO: +3 (tags) + 0.32 (puntos) = +3.32 → +3
   - PHY: +2 (tags) + 0.04 (puntos) = +2.04 → +2

4. Nuevo OVR = promedio de 6 atributos actualizados ≈ 66
```

---

## 8. Inteligencia Artificial Integrada

### 13 Flujos de IA Activos

Pateá integra **Google Gemini** a través de Firebase Genkit para potenciar múltiples funcionalidades:

#### Generación de Equipos

| Flujo | Modelo | Función |
|-------|--------|---------|
| `generate-balanced-teams` | Gemini 2.0 Flash | Crea equipos equilibrados considerando OVR, posición y química |

**Input:** Lista de jugadores con atributos
**Output:**
- 2 equipos balanceados
- Porcentaje de equilibrio (0-100%)
- Formación sugerida (ej: 1-2-1 para fútbol 5)
- Tags tácticos (ej: "Ataque Rápido", "Defensa Sólida")

#### Análisis de Jugadores

| Flujo | Modelo | Función |
|-------|--------|---------|
| `analyze-player-progression` | Gemini 2.0 Flash | Analiza historial de OVR y explica evolución |
| `detect-player-patterns` | Gemini 2.0 Flash | Identifica tendencias (ej: "Mejor los viernes") |
| `suggest-player-improvements` | Gemini 2.0 Flash | 3 consejos personalizados para mejorar |

#### Asistencia y Chat

| Flujo | Modelo | Función |
|-------|--------|---------|
| `coach-conversation` | Gemini 2.0 Flash | Chat con DT virtual que conoce tus stats |
| `get-app-help` | Gemini 2.0 Flash | Asistente de ayuda contextual |
| `find-best-fit-player` | Gemini 2.0 Flash | Recomienda jugadores para completar partido |

#### Generación de Contenido

| Flujo | Modelo | Función |
|-------|--------|---------|
| `generate-match-chronicle` | Gemini 2.0 Flash | Crónica periodística del partido |
| `generate-group-summary` | Gemini 2.5 Flash | Resumen narrativo del estado del grupo |

#### Generación de Imágenes

| Flujo | Modelo | Función |
|-------|--------|---------|
| `generate-player-card-image` | Gemini 2.5 Flash Image | Transforma selfie en retrato profesional |
| `generate-duo-image` | Gemini 2.5 Flash Image | Imagen cinemática de 2 jugadores enfrentados |

#### Utilidades

| Flujo | Modelo | Función |
|-------|--------|---------|
| `get-match-day-forecast` | API OpenMeteo | Pronóstico del clima para el partido |
| `analyze-text-performance` | Gemini 2.0 Flash | Extrae atributos de evaluación textual |

### Ejemplo: Crónica Generada por IA

**Input:**
```json
{
  "matchTitle": "Clásico del Barrio",
  "result": { "teamA": 3, "teamB": 2 },
  "events": [
    { "type": "goal", "player": "Juan", "minute": 15, "assist": "Pedro" },
    { "type": "goal", "player": "Carlos", "minute": 28 },
    { "type": "card", "player": "Luis", "cardType": "yellow", "minute": 45 }
  ],
  "mvp": { "name": "Juan", "rating": 9.2 }
}
```

**Output IA:**
```markdown
# La Zurda de Juan Definió un Clásico de Infarto

En una tarde donde el sol parecía querer ver fútbol también,
el Clásico del Barrio nos regaló cinco goles y una tensión
que se cortaba con cuchillo.

Juan, el hombre del partido, abrió la cuenta al 15' con un
zurdazo imposible tras un pase quirúrgico de Pedro. "La vi
venir y le pegué con todo", confesó el goleador entre risas.

El partido se calentó cuando Luis vio la amarilla justo antes
del descanso, dejando a su equipo en la cuerda floja para el
complemento...

**MVP del partido:** Juan (9.2) - 2 goles, 1 asistencia
```

---

## 9. Stack Tecnológico

### Frontend

| Tecnología | Versión | Uso |
|------------|---------|-----|
| **Next.js** | 14 | Framework principal, App Router, Server Components |
| **React** | 18 | UI Components, Hooks |
| **TypeScript** | 5.x | Type safety en todo el proyecto |
| **Tailwind CSS** | 3.x | Estilos utility-first |
| **shadcn/ui** | Latest | Componentes base accesibles |
| **Framer Motion** | 11.x | Animaciones fluidas |
| **React Hook Form** | 7.x | Manejo de formularios |
| **Zod** | 3.x | Validación de schemas |

### Backend / Servicios

| Tecnología | Uso |
|------------|-----|
| **Firebase Firestore** | Base de datos NoSQL en tiempo real |
| **Firebase Auth** | Autenticación (Google OAuth) |
| **Firebase Storage** | Almacenamiento de imágenes |
| **Firebase Cloud Messaging** | Notificaciones push |
| **Firebase App Hosting** | Hosting con SSR |
| **Firebase Genkit** | Orquestación de flujos de IA |

### Inteligencia Artificial

| Modelo | Uso |
|--------|-----|
| **Gemini 2.0 Flash** | Análisis, chat, generación de texto |
| **Gemini 2.5 Flash** | Resúmenes avanzados |
| **Gemini 2.5 Flash Image** | Generación de imágenes |

### Integraciones

| Servicio | Uso |
|----------|-----|
| **Google Maps API** | Ubicaciones, geocodificación |
| **Google Fit API** | Datos de actividad física |
| **OpenMeteo API** | Pronóstico del clima |

### DevOps

| Herramienta | Uso |
|-------------|-----|
| **Git/GitHub** | Control de versiones |
| **ESLint** | Linting de código |
| **Playwright** | Testing E2E |
| **PWA** | Instalable como app nativa |

---

## 10. Roadmap de Desarrollo

### Q1 2026 (Actual)

✅ **Completado:**
- Sistema de partidos (7 tipos)
- Evaluaciones (3 métodos)
- Competiciones (Ligas + Copas)
- 13 flujos de IA
- Feed social con reacciones
- PWA instalable

### Q2 2026

🔄 **En Desarrollo:**
- [ ] Notificaciones push FCM completas
- [ ] Integración Google Fit funcional
- [ ] Modo offline mejorado
- [ ] Onboarding interactivo
- [ ] Sistema de logros expandido

### Q3 2026

📋 **Planificado:**
- [ ] App nativa Android (Kotlin + Firebase)
- [ ] Sistema de logros completo (50+ logros)
- [ ] Torneos públicos inter-grupos
- [ ] Marketplace de jugadores (préstamos entre grupos)
- [ ] Dashboard de analytics para admins

### Q4 2026

🎯 **Objetivo:**
- [ ] App iOS
- [ ] API pública para integraciones
- [ ] Sistema de sponsors para ligas
- [ ] Streaming integrado
- [ ] Expansión regional LATAM

### 2027

🚀 **Visión:**
- [ ] IA predictiva (pronóstico de resultados)
- [ ] Realidad aumentada (stats en vivo con cámara)
- [ ] Wearables (integración smartwatch)
- [ ] White-label para federaciones
- [ ] Expansión internacional

---

## 11. Diferenciadores Clave

### Ventajas Tecnológicas

| Ventaja | Descripción |
|---------|-------------|
| **IA Integrada Nativamente** | No es un add-on, es parte del core del producto |
| **Real-time First** | Arquitectura diseñada para sincronización en tiempo real |
| **Gamificación Profunda** | Sistema de OVR único con cartas coleccionables |
| **Data Network Effect** | Más datos = mejor IA = mejor producto |

### Ventajas de Producto

| Ventaja | Descripción |
|---------|-------------|
| **Engagement Emocional** | Tu carta evoluciona = tu identidad deportiva |
| **Comunidad Incorporada** | No necesitas traer amigos, están en el grupo |
| **Zero Friction** | Crear partido en < 2 minutos |
| **Portable Progress** | Tu OVR te sigue a cualquier grupo |

### Propuesta Única

Pateá se posiciona de manera única en el mercado al combinar:

| Componente | Descripción |
|------------|-------------|
| **Tracking deportivo** | Estadísticas detalladas de cada jugador y partido |
| **Gamificación** | Sistema de cartas con progresión basada en rendimiento real |
| **Gestión de equipos** | Organización completa de grupos, ligas y copas |
| **IA Generativa** | 13 flujos de inteligencia artificial integrados nativamente |
| **Red social** | Feed de actividades con reacciones y seguidos |

---

## Contacto

**Pateá - Donde tu fútbol se vuelve leyenda**

- Web: [patea.app](https://patea.app)
- Email: contacto@patea.app

---

*Documento generado en Febrero 2026*
*Datos verificados contra código fuente v1.0*
