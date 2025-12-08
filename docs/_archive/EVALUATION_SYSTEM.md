# 📊 SISTEMA DE EVALUACIÓN COMPLETO - FC24 Team Manager

## 📋 **ÍNDICE**

1. [Escala de Puntos y Calificaciones](#escala-de-puntos)
2. [Sistema de Atributos FIFA](#sistema-de-atributos)
3. [Etiquetas y Categorías](#etiquetas-y-categorías)
4. [Proceso de Evaluación](#proceso-de-evaluación)
5. [Algoritmo de Cambio de OVR](#algoritmo-de-cambio-de-ovr)
6. [Limitantes Anti-Sobreevaluación](#limitantes-anti-sobreevaluación)
7. [Reglas de Validación](#reglas-de-validación)
8. [Trazabilidad y Logs](#trazabilidad-y-logs)

---

## 🎯 **ESCALA DE PUNTOS Y CALIFICACIONES** {#escala-de-puntos}

### **Sistema Dual de Calificación**

La app utiliza **DOS escalas de calificación** que se convierten automáticamente:

| Escala | Rango | Uso | Descripción |
|--------|-------|-----|-------------|
| **Escala 10** | 1-10 | Evaluación por usuarios | Lo que ven los jugadores al evaluar |
| **Escala 5** | 1-5 | Almacenamiento Firebase | Conversión automática: `rating_5 = round(rating_10 / 2)` |

### **Escala de 10 Puntos (Usuario)**

```
┌────────────────────────────────────────────────────────┐
│ 10/10 ⭐⭐⭐⭐⭐  EXCEPCIONAL  (Jugador profesional)     │
│  9/10 ⭐⭐⭐⭐⭐  SOBRESALIENTE (Jugador destacado)      │
│  8/10 ⭐⭐⭐⭐☆  MUY BUENO (Por encima del promedio)    │
│  7/10 ⭐⭐⭐☆☆  BUENO (Buen rendimiento)               │
│  6/10 ⭐⭐⭐☆☆  SATISFACTORIO (Cumplió su rol)         │
│  5/10 ⭐⭐☆☆☆  REGULAR (Rendimiento neutro)            │
│  4/10 ⭐⭐☆☆☆  BAJO (Debajo del promedio)              │
│  3/10 ⭐☆☆☆☆  MALO (Rendimiento deficiente)            │
│  2/10 ⭐☆☆☆☆  MUY MALO (Muy por debajo del nivel)     │
│  1/10 ☆☆☆☆☆  PÉSIMO (No aportó nada)                  │
└────────────────────────────────────────────────────────┘
```

### **Interpretación del Rating Promedio**

| Rating Promedio | Impacto en OVR | Significado |
|-----------------|----------------|-------------|
| **9.0 - 10.0** | +1 a +2 puntos | Rendimiento excepcional → **SUBE OVR** |
| **7.0 - 8.9** | +0.5 a +1 punto | Buen rendimiento → **Sube levemente** |
| **5.0 - 6.9** | 0 puntos | Rendimiento neutro → **Sin cambios** |
| **3.0 - 4.9** | -0.5 a -1 punto | Mal rendimiento → **Baja levemente** |
| **1.0 - 2.9** | -1 a -2 puntos | Rendimiento pésimo → **BAJA OVR** |

**IMPORTANTE:** El rating 5/10 (satisfactorio) es el **punto neutro** que NO genera cambios en el OVR.

---

## ⚽ **SISTEMA DE ATRIBUTOS FIFA** {#sistema-de-atributos}

### **6 Atributos Principales**

Cada jugador tiene 6 atributos fundamentales basados en FIFA/FC24:

```
┌──────────────┬────────┬───────────────────────────────────────┐
│ ATRIBUTO     │ CÓDIGO │ DESCRIPCIÓN                           │
├──────────────┼────────┼───────────────────────────────────────┤
│ Velocidad    │ PAC    │ Rapidez, aceleración, sprint          │
│ Remate       │ SHO    │ Precisión, potencia, definición       │
│ Pase         │ PAS    │ Precisión de pases, visión de juego   │
│ Regate       │ DRI    │ Control de balón, habilidad, gambeta  │
│ Defensa      │ DEF    │ Marcaje, tackle, posicionamiento      │
│ Físico       │ PHY    │ Fuerza, resistencia, aguante          │
└──────────────┴────────┴───────────────────────────────────────┘
```

### **Rango de Atributos**

```
Rango Válido: 20 - 90
Rango Óptimo: 40 - 85
```

| Rango | Nivel | Descripción |
|-------|-------|-------------|
| **85-90** | ÉLITE | Solo jugadores excepcionales (difícil llegar) |
| **75-84** | MUY BUENO | Jugadores destacados del grupo |
| **65-74** | BUENO | Jugadores competentes |
| **55-64** | PROMEDIO | La mayoría de jugadores recreativos |
| **45-54** | BAJO | Necesita mejorar |
| **20-44** | MUY BAJO | Principiantes o rendimiento muy pobre |

**⚠️ LIMITANTE IMPORTANTE:** El límite máximo fue **reducido de 99 → 90** para mantener realismo. Solo jugadores con rendimiento extraordinario sostenido pueden llegar a 85+.

---

## 🏷️ **ETIQUETAS Y CATEGORÍAS** {#etiquetas-y-categorías}

### **Sistema de Tags**

Cada evaluación puede incluir **1-2 etiquetas** (tags) que describen aspectos destacados del jugador.

#### **Tags Disponibles (18 categorías)**

```javascript
[
  'Velocidad',        // Jugador rápido
  'Pase',             // Buenos pases
  'Defensa',          // Sólido en defensa
  'Actitud',          // Buena actitud y compromiso
  'Ataque',           // Ofensivo, busca gol
  'Resistencia',      // Aguante físico todo el partido
  'Posicionamiento',  // Buena ubicación táctica
  'Liderazgo',        // Guía al equipo
  'Comunicacion',     // Habla, organiza
  'Regate',           // Habilidad 1v1
  'Marcaje',          // Marca bien al rival
  'Finalización',     // Aprovecha chances
  'Cabeceo',          // Bueno de cabeza
  'Apoyo',            // Ayuda a compañeros
  'Recuperación',     // Roba balones
  'Creatividad',      // Genera jugadas
  'Presión',          // Presiona rival
  'Coberturas'        // Ayuda defensiva
]
```

### **Uso de Tags en Evaluaciones**

```
Configuración actual:
- Mínimo: 1 tag por evaluación
- Máximo: 2 tags por evaluación
- Selección: Aleatoria de lista predefinida
- Almacenamiento: Array en Firestore
```

**Ejemplo de evaluación con tags:**
```json
{
  "playerId": "abc123",
  "rating": 8,
  "goals": 2,
  "tags": ["Finalización", "Actitud"],
  "notes": "Gran partido, decisivo en ataque"
}
```

---

## 📝 **PROCESO DE EVALUACIÓN** {#proceso-de-evaluación}

### **Flujo Completo de Evaluación**

```
┌─────────────────────────────────────────────────────────┐
│ PARTIDO FINALIZA                                        │
│ ↓                                                       │
│ Sistema genera asignaciones aleatorias                  │
│ ↓                                                       │
│ Cada jugador recibe 2 compañeros para evaluar          │
│ ↓                                                       │
│ Jugador completa formulario de evaluación              │
│ ↓                                                       │
│ Sistema valida y guarda en Firestore                   │
│ ↓                                                       │
│ Se calcula tasa de participación                        │
│ ↓                                                       │
│ Si participación ≥ 80% → Actualización de OVRs         │
│ ↓                                                       │
│ Sistema recalcula OVR y atributos                       │
│ ↓                                                       │
│ Jugadores reciben notificaciones de cambios            │
└─────────────────────────────────────────────────────────┘
```

### **Reglas de Asignación**

| Regla | Descripción | Motivo |
|-------|-------------|--------|
| **2 evaluaciones por jugador** | Cada uno evalúa a 2 compañeros | Distribución de carga equitativa |
| **Solo compañeros de equipo** | No se evalúa al equipo rival | Evalúas con quien jugaste |
| **No auto-evaluación** | No puedes evaluarte a ti mismo | Evitar sesgos |
| **No invitados (guests)** | Solo jugadores registrados | Sistema requiere cuenta Firebase |
| **Asignación aleatoria** | Sistema elige los 2 compañeros | Evitar favoritismos |

### **Requisitos para Activar Actualización de OVR**

```
Tasa de Participación Mínima: 80%

Fórmula:
participationRate = (evaluaciones_completadas / total_evaluadores)

Ejemplo:
- Partido con 10 jugadores
- 10 evaluadores asignados
- 8 completaron evaluación
- participationRate = 8/10 = 0.8 (80%)
- ✅ SE ACTIVA actualización de OVRs
```

**Estados de Evaluación:**

| Estado | Condición | Acción |
|--------|-----------|--------|
| `pending` | < 80% completado | Esperando más evaluaciones |
| `ready` | ≥ 80% completado | Se puede actualizar OVRs |
| `completed` | OVRs actualizados | Evaluación cerrada |
| `expired` | > 72 horas sin completar | Expirada (no se actualizan OVRs) |

**Timeout de Evaluación:** 72 horas (3 días)

---

## 🧮 **ALGORITMO DE CAMBIO DE OVR** {#algoritmo-de-cambio-de-ovr}

### **Algoritmo Suavizado v1.0** (Implementado Oct 2025)

#### **Configuración del Algoritmo**

```javascript
OVR_PROGRESSION = {
  VERSION: '1.0-smooth',
  BASELINE_RATING: 5,      // Rating neutro (sin cambios)
  SCALE: 0.6,              // Escala lineal inicial
  MAX_STEP: 2,             // Límite máximo de cambio por partido
  DECAY_START: 70,         // Inicio de amortiguación progresiva
  SOFT_CAP: 95,            // Reducción fuerte de progresión
  HARD_CAP: 99             // Límite absoluto
}
```

#### **Fórmula Completa del Algoritmo**

```
PASO 1: Delta Base
─────────────────────
ratingDelta = avgRating - BASELINE_RATING
rawDelta = ratingDelta × SCALE

Ejemplo: Rating 7/10
  → ratingDelta = 7 - 5 = +2
  → rawDelta = 2 × 0.6 = +1.2


PASO 2: Amortiguación Progresiva (OVR 70-95)
──────────────────────────────────────────────
Si currentOVR >= 70:
  t = (currentOVR - 70) / (95 - 70)
  factor = 1 - (0.6 × t)
  decayedDelta = rawDelta × factor

Ejemplo: OVR 80, rawDelta = +1.2
  → t = (80 - 70) / 25 = 0.4
  → factor = 1 - (0.6 × 0.4) = 0.76
  → decayedDelta = 1.2 × 0.76 = +0.91


PASO 3: Reducción Fuerte (OVR 95-99)
─────────────────────────────────────
Si currentOVR >= 95:
  t2 = (currentOVR - 95) / (99 - 95)
  hardFactor = 0.25 × (1 - t2)
  decayedDelta = rawDelta × hardFactor

Ejemplo: OVR 96, rawDelta = +1.2
  → t2 = (96 - 95) / 4 = 0.25
  → hardFactor = 0.25 × (1 - 0.25) = 0.1875
  → decayedDelta = 1.2 × 0.1875 = +0.23


PASO 4: Rate Limit (±2 puntos máximo)
──────────────────────────────────────
finalDelta = clamp(decayedDelta, -MAX_STEP, +MAX_STEP)
appliedDelta = round(finalDelta)

Ejemplo: decayedDelta = +0.91
  → finalDelta = +0.91 (dentro de límite)
  → appliedDelta = +1 (redondeado a entero)


RESULTADO FINAL:
────────────────
newOVR = clamp(currentOVR + appliedDelta, 40, 99)
```

#### **Tabla de Conversión Rating → Cambio OVR**

| Rating Promedio | OVR 50 | OVR 70 | OVR 85 | OVR 95 |
|-----------------|--------|--------|--------|--------|
| **10.0** | +3 → +2* | +2 → +2 | +1 → +1 | +0 → 0 |
| **9.0** | +2 → +2 | +2 → +1 | +1 → +1 | +0 → 0 |
| **8.0** | +2 → +2 | +1 → +1 | +1 → +1 | +0 → 0 |
| **7.0** | +1 → +1 | +1 → +1 | +0 → 0 | +0 → 0 |
| **6.0** | +1 → +1 | +0 → 0 | +0 → 0 | +0 → 0 |
| **5.0** | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 |
| **4.0** | -1 → -1 | -1 → -1 | -0 → 0 | -0 → 0 |
| **3.0** | -1 → -1 | -1 → -1 | -1 → -1 | -0 → 0 |
| **2.0** | -2 → -2 | -1 → -1 | -1 → -1 | -0 → 0 |
| **1.0** | -2 → -2 | -2 → -2 | -1 → -1 | -1 → -1 |

\* Formato: `rawDelta → appliedDelta` (después de limitaciones)

#### **Ejemplo Completo Paso a Paso**

```
CASO: Jugador con OVR 75 recibe rating promedio 8.5/10

PASO 1: Delta Base
  ratingDelta = 8.5 - 5 = +3.5
  rawDelta = 3.5 × 0.6 = +2.1

PASO 2: Amortiguación (OVR 75)
  t = (75 - 70) / 25 = 0.2
  factor = 1 - (0.6 × 0.2) = 0.88
  decayedDelta = 2.1 × 0.88 = +1.85

PASO 3: Soft/Hard Cap
  currentOVR < 95 → No aplica

PASO 4: Rate Limit
  finalDelta = min(1.85, 2) = +1.85
  appliedDelta = round(1.85) = +2

RESULTADO:
  newOVR = 75 + 2 = 77 ✅
```

---

## 🛡️ **LIMITANTES ANTI-SOBREEVALUACIÓN** {#limitantes-anti-sobreevaluación}

### **Sistema de 7 Capas de Protección**

#### **1. Rate Limit por Partido (±2 puntos)**

```javascript
MAX_STEP = 2  // Límite duro

// Implementación
if (finalDelta > 0) finalDelta = Math.min(MAX_STEP, finalDelta)
if (finalDelta < 0) finalDelta = Math.max(-MAX_STEP, finalDelta)
```

**Efecto:** Aunque un jugador reciba 10/10 en todas las evaluaciones, su OVR **no puede subir más de +2 puntos por partido**.

---

#### **2. Amortiguación Progresiva (OVR 70-95)**

```
Factor de Reducción según OVR:

OVR 70: factor = 1.00  (sin reducción)
OVR 75: factor = 0.88  (12% reducción)
OVR 80: factor = 0.76  (24% reducción)
OVR 85: factor = 0.64  (36% reducción)
OVR 90: factor = 0.52  (48% reducción)
OVR 95: factor = 0.40  (60% reducción)
```

**Efecto:** A mayor OVR, **más difícil es seguir subiendo**. Un jugador OVR 90 necesita ratings mucho más altos que uno OVR 70 para subir la misma cantidad de puntos.

---

#### **3. Soft Cap en OVR 95**

```javascript
// A partir de OVR 95, progresión reducida fuertemente
if (currentOVR >= 95) {
  t2 = (currentOVR - 95) / (99 - 95)
  hardFactor = 0.25 × (1 - t2)  // Máximo 25% del delta original
  decayedDelta = rawDelta × hardFactor
}
```

**Tabla de Reducción (OVR 95-99):**

| OVR Actual | Factor de Reducción | Ejemplo (rawDelta +2) |
|------------|---------------------|----------------------|
| **95** | 25% (0.25) | +2.0 → +0.5 |
| **96** | 18.75% (0.1875) | +2.0 → +0.38 → 0 |
| **97** | 12.5% (0.125) | +2.0 → +0.25 → 0 |
| **98** | 6.25% (0.0625) | +2.0 → +0.13 → 0 |
| **99** | 0% (0.0) | +2.0 → +0.0 → 0 |

**Efecto:** Llegar a OVR 99 es **prácticamente imposible** con el sistema actual. Requeriría decenas de partidos con evaluaciones perfectas sostenidas.

---

#### **4. Hard Cap Absoluto (OVR 99)**

```javascript
HARD_CAP = 99  // Límite absoluto

newOVR = Math.max(40, Math.min(HARD_CAP, currentOVR + ovrChange))
```

**Efecto:** Ningún jugador puede superar OVR 99, sin excepciones.

---

#### **5. Límite de Atributos (20-90)**

```javascript
// FIXED: Reducido de 99 → 90 para realismo
newAttributes[attr] = Math.max(20, Math.min(90, currentValue + change))
```

**Antes vs Ahora:**

| Aspecto | ANTES | AHORA |
|---------|-------|-------|
| Límite máximo | 99 | **90** |
| Jugadores élite | Fácil llegar a 95+ | Solo excepcionales |
| Realismo | Inflación de stats | **Más realista** |

**Efecto:** Mantiene la distribución de habilidades más realista. Solo jugadores verdaderamente excepcionales tienen atributos 85+.

---

#### **6. Detección de Anomalías**

```javascript
// Salvaguarda: Si TODOS los atributos ≥ 85 sin rating extremo
const allNearCap = ['pac','sho','pas','dri','def','phy']
  .every(a => newAttributes[a] >= 85)

if (allNearCap && avgRating < 9) {
  window.__EVAL_ATTR_ANOMALIES.push({
    playerId, avgRating,
    before: currentAttributes,
    after: newAttributes,
    reason: 'attributes_near_cap_without_extreme_rating'
  })
  console.warn('[ANOMALY] Atributos cerca de cap sin rating extremo')
}
```

**Efecto:** El sistema **detecta y registra** situaciones anómalas donde un jugador tendría todos los atributos muy altos sin justificación en los ratings recibidos.

---

#### **7. Validación de Ratings (1-10)**

```javascript
// Normalización defensiva de ratings
let raw = evaluation.rating
if (typeof raw === 'string') {
  const match = raw.match(/^[0-9]+(\.[0-9]+)?/)
  if (match) raw = parseFloat(match[0])
}

if (typeof raw !== 'number' || isNaN(raw)) {
  // Ignorar evaluación corrupta
  return
}

let normalized = Math.max(1, Math.min(10, raw))
```

**Casos Manejados:**

| Input | Normalizado | Acción |
|-------|-------------|--------|
| `"9/10"` | 9 | Extraer número |
| `15` | 10 | Clamp a 10 |
| `-3` | 1 | Clamp a 1 |
| `"abc"` | - | **Ignorar** |
| `null` | - | **Ignorar** |
| `undefined` | - | **Ignorar** |

**Efecto:** El sistema **rechaza** evaluaciones mal formadas o fuera de rango, registrándolas en `window.__EVAL_RATING_ANOMALIES` para auditoría.

---

### **Resumen de Limitantes**

```
┌────────────────────────────────────────────────────────┐
│ CAPA 1: Rate Limit           → ±2 puntos/partido     │
│ CAPA 2: Amortiguación OVR70+ → Reducción progresiva  │
│ CAPA 3: Soft Cap OVR95       → 75% reducción         │
│ CAPA 4: Hard Cap OVR99       → Límite absoluto       │
│ CAPA 5: Atributos máx 90     → Realismo              │
│ CAPA 6: Detección anomalías  → Logging               │
│ CAPA 7: Validación ratings   → Rechazo corruptos     │
└────────────────────────────────────────────────────────┘
```

---

## ✅ **REGLAS DE VALIDACIÓN** {#reglas-de-validación}

### **Validación Client-Side (JavaScript)**

```javascript
// 1. Validación de Rating (1-10)
if (rating < 1 || rating > 10) {
  throw new Error('Rating debe estar entre 1 y 10')
}

// 2. Validación de Goles (0-10)
if (goals < 0 || goals > 10) {
  throw new Error('Goles debe estar entre 0 y 10')
}

// 3. Validación de Tags (máximo 20)
if (tags.length > 20) {
  tags = tags.slice(0, 20)
}

// 4. Validación de Notas (máximo 300 caracteres)
if (notes.length > 300) {
  notes = notes.slice(0, 300)
}

// 5. No auto-evaluación
if (evaluatedPlayerId === evaluatorId) {
  throw new Error('No puedes evaluarte a ti mismo')
}
```

### **Validación Server-Side (Firestore Rules)**

```javascript
// firestore.rules (líneas relevantes)

// OVR: 40-99
match /futbol_users/{userId} {
  allow update: if request.resource.data.ovr >= 40
                && request.resource.data.ovr <= 99;
}

// Ratings de evaluación: 1-5 (escala Firebase)
match /evaluations/{evalId} {
  allow create: if request.resource.data.ratings.pace >= 1
                && request.resource.data.ratings.pace <= 5
                && request.resource.data.ratings.shooting >= 1
                && request.resource.data.ratings.shooting <= 5
                // ... (mismo para los 6 atributos)
}
```

### **Validación de Integridad**

| Campo | Tipo | Rango | Validación |
|-------|------|-------|------------|
| `rating` | Number | 1-10 | Client + Server |
| `goals` | Number | 0-10 | Client |
| `tags` | Array | 0-20 items | Client |
| `notes` | String | 0-300 chars | Client |
| `ovr` | Number | 40-99 | **Server (Firestore Rules)** |
| `pac/sho/pas/dri/def/phy` | Number | 20-90 | Client |

---

## 📈 **CAMBIOS POR POSICIÓN** {#cambios-por-posición}

### **Distribución de Cambios según Posición**

Cuando un jugador recibe evaluaciones, los cambios en atributos se distribuyen según su posición:

#### **Delantero (DEL)**

```javascript
attributeChanges.sho += intensity × 2  // Prioridad: Remate
attributeChanges.pac += intensity      // Secundario: Velocidad
attributeChanges.dri += intensity      // Secundario: Regate
```

**Ejemplo:** Delantero recibe rating 8/10 (intensity = +0.5)
- Remate (SHO): +1.0
- Velocidad (PAC): +0.5
- Regate (DRI): +0.5

---

#### **Mediocampista (MED)**

```javascript
attributeChanges.pas += intensity × 2  // Prioridad: Pase
attributeChanges.dri += intensity      // Secundario: Regate
attributeChanges.pac += intensity      // Secundario: Velocidad
```

**Ejemplo:** Mediocampista recibe rating 7/10 (intensity = +0.5)
- Pase (PAS): +1.0
- Regate (DRI): +0.5
- Velocidad (PAC): +0.5

---

#### **Defensor (DEF)**

```javascript
attributeChanges.def += intensity × 2  // Prioridad: Defensa
attributeChanges.phy += intensity      // Secundario: Físico
attributeChanges.pas += intensity      // Secundario: Pase
```

**Ejemplo:** Defensor recibe rating 9/10 (intensity = +1.0)
- Defensa (DEF): +2.0
- Físico (PHY): +1.0
- Pase (PAS): +1.0

---

#### **Portero (POR)**

```javascript
attributeChanges.def += intensity × 2  // Prioridad: Defensa
attributeChanges.phy += intensity      // Secundario: Físico
attributeChanges.pas += intensity      // Secundario: Pase
```

---

#### **Lateral/Wing**

```javascript
attributeChanges.pac += intensity × 2  // Prioridad: Velocidad
attributeChanges.pas += intensity      // Secundario: Pase
attributeChanges.def += intensity      // Secundario: Defensa
```

---

### **Tabla de Intensidad**

| Rating Promedio | Intensity | Cambio Principal | Cambios Secundarios |
|-----------------|-----------|------------------|---------------------|
| **9.0-10.0** | +1.0 | +2.0 | +1.0 cada uno |
| **7.0-8.9** | +0.5 | +1.0 | +0.5 cada uno |
| **5.0-6.9** | 0 | 0 | 0 |
| **3.0-4.9** | -0.5 | -1.0 | -0.5 cada uno |
| **1.0-2.9** | -1.0 | -2.0 | -1.0 cada uno |

**NOTA:** La intensidad fue **reducida a la mitad** (de ±2/±1 a ±1/±0.5) para evitar inflación de atributos.

---

## 📊 **TRAZABILIDAD Y LOGS** {#trazabilidad-y-logs}

### **Sistema de Trazabilidad**

Cada vez que se actualizan los OVRs, el sistema guarda un registro detallado en `evaluation_logs`:

```javascript
{
  playerId: "abc123",
  beforeData: {
    ovr: 75,
    pac: 70, sho: 72, pas: 74, dri: 68, def: 65, phy: 71
  },
  afterData: {
    ovr: 77,
    pac: 71, sho: 73, pas: 75, dri: 69, def: 65, phy: 71
  },
  evaluationContext: {
    matchId: "match_456",
    matchName: "Partido 20/10",
    evaluationType: "evaluacion-grupal-completa",
    evaluationData: {
      participationRate: 0.9,  // 90% completó
      totalEvaluators: 10,
      ovrIncrease: 2,
      averageRating: 8.5,
      totalGoals: 3,
      uniqueTags: ["Finalización", "Actitud", "Velocidad"],
      evaluationsByParticipant: {
        "evaluator1": {
          evaluatorName: "Juan",
          rating: 9,
          goals: 2,
          tags: ["Finalización", "Actitud"],
          notes: "Decisivo en ataque"
        },
        "evaluator2": {
          evaluatorName: "Pedro",
          rating: 8,
          goals: 1,
          tags: ["Velocidad"],
          notes: "Muy rápido"
        }
      }
    }
  },
  timestamp: 1729539600000
}
```

### **Logs de Anomalías**

#### **1. Rating Anomalies**
```javascript
window.__EVAL_RATING_ANOMALIES = [
  {
    type: 'non_numeric',
    raw: "abc",
    playerId: "player123",
    assignment: "evaluator456",
    ts: 1729539600000
  },
  {
    type: 'clamped',
    raw: 15,
    normalized: 10,
    playerId: "player789",
    ts: 1729539700000
  }
]
```

#### **2. Attribute Anomalies**
```javascript
window.__EVAL_ATTR_ANOMALIES = [
  {
    playerId: "player123",
    avgRating: 7.5,  // Rating no justifica stats tan altos
    before: { pac: 82, sho: 84, pas: 83, dri: 85, def: 81, phy: 84 },
    after: { pac: 85, sho: 86, pas: 85, dri: 87, def: 83, phy: 86 },
    ovrBefore: 84,
    ts: 1729539800000,
    reason: 'attributes_near_cap_without_extreme_rating'
  }
]
```

### **Historial de OVR por Jugador**

```javascript
// Almacenado en futbol_users/{userId}
ovrHistory: [
  {
    date: 1729539600000,
    oldOVR: 75,
    newOVR: 77,
    change: +2,
    matchId: "match_456",
    attributeChanges: {
      pac: +1, sho: +1, pas: +1, dri: +1, def: 0, phy: 0
    }
  },
  {
    date: 1729625200000,
    oldOVR: 77,
    newOVR: 78,
    change: +1,
    matchId: "match_789",
    attributeChanges: {
      pac: +0.5, sho: +1, pas: +0.5, dri: +1, def: 0, phy: 0
    }
  }
]
```

---

## 🎯 **CASOS DE USO Y EJEMPLOS**

### **Caso 1: Jugador Promedio que Juega Muy Bien**

```
Jugador: Carlos (OVR 68, Mediocampista)
Partido: 10 jugadores
Evaluaciones recibidas:
  - Evaluador 1: 9/10 (2 goles, tags: Pase, Creatividad)
  - Evaluador 2: 8/10 (0 goles, tags: Posicionamiento)

Cálculo:
  avgRating = (9 + 8) / 2 = 8.5/10

  PASO 1: rawDelta = (8.5 - 5) × 0.6 = +2.1
  PASO 2: OVR 68 → factor = 1.0 (sin amortiguación)
  PASO 3: decayedDelta = 2.1 × 1.0 = +2.1
  PASO 4: appliedDelta = min(2.1, 2) = +2

Resultado:
  OVR: 68 → 70 (+2) ✅

Atributos (Mediocampista, intensity = +1.0):
  PAS: 72 → 74 (+2.0)
  DRI: 65 → 66 (+1.0)
  PAC: 68 → 69 (+1.0)
```

---

### **Caso 2: Jugador Élite que Mantiene Nivel**

```
Jugador: Roberto (OVR 88, Delantero)
Partido: 10 jugadores
Evaluaciones recibidas:
  - Evaluador 1: 8/10
  - Evaluador 2: 9/10

Cálculo:
  avgRating = (8 + 9) / 2 = 8.5/10

  PASO 1: rawDelta = (8.5 - 5) × 0.6 = +2.1
  PASO 2: OVR 88 → t = (88-70)/25 = 0.72
          factor = 1 - (0.6 × 0.72) = 0.568
          decayedDelta = 2.1 × 0.568 = +1.19
  PASO 3: OVR < 95 → No aplica soft cap
  PASO 4: appliedDelta = round(1.19) = +1

Resultado:
  OVR: 88 → 89 (+1) ✅

Nota: A pesar de recibir el mismo rating que Carlos,
Roberto solo sube +1 (vs +2 de Carlos) por la amortiguación.
```

---

### **Caso 3: Jugador Top que Intenta Llegar a 99**

```
Jugador: Messi Local (OVR 96, Delantero)
Partido: 10 jugadores
Evaluaciones recibidas:
  - Evaluador 1: 10/10 (hat-trick!)
  - Evaluador 2: 10/10 (jugador del partido)

Cálculo:
  avgRating = (10 + 10) / 2 = 10/10 (PERFECTO)

  PASO 1: rawDelta = (10 - 5) × 0.6 = +3.0
  PASO 2: OVR 96 → Amortiguación normal
          t = (96-70)/25 = 1.04 (mayor a 1)
          factor = 1 - (0.6 × 1) = 0.4
          decayedDelta = 3.0 × 0.4 = +1.2
  PASO 3: OVR 96 >= 95 → SOFT CAP!
          t2 = (96 - 95) / 4 = 0.25
          hardFactor = 0.25 × (1 - 0.25) = 0.1875
          decayedDelta = 3.0 × 0.1875 = +0.56
  PASO 4: appliedDelta = round(0.56) = +1

Resultado:
  OVR: 96 → 97 (+1) ✅

Conclusión: Incluso con evaluaciones PERFECTAS,
solo sube +1 punto por el soft cap.
```

---

### **Caso 4: Jugador que Juega Mal**

```
Jugador: Diego (OVR 72, Defensor)
Partido: 10 jugadores
Evaluaciones recibidas:
  - Evaluador 1: 3/10 (mal partido)
  - Evaluador 2: 4/10 (errores defensivos)

Cálculo:
  avgRating = (3 + 4) / 2 = 3.5/10

  PASO 1: rawDelta = (3.5 - 5) × 0.6 = -0.9
  PASO 2: OVR 72 → factor = 0.95
          decayedDelta = -0.9 × 0.95 = -0.86
  PASO 3: Soft cap no aplica (solo para >= 95)
  PASO 4: appliedDelta = round(-0.86) = -1

Resultado:
  OVR: 72 → 71 (-1) ⬇️

Atributos (Defensor, intensity = -0.5):
  DEF: 75 → 74 (-1.0)
  PHY: 74 → 73.5 → 73 (-0.5)
  PAS: 70 → 69.5 → 69 (-0.5)
```

---

## 📚 **PREGUNTAS FRECUENTES (FAQ)**

### **¿Cuántos partidos necesito para llegar a OVR 90?**

Depende de tu OVR inicial y ratings recibidos:

| OVR Inicial | Ratings Promedio | Partidos Estimados |
|-------------|------------------|-------------------|
| 70 → 90 | 9-10/10 (excelentes) | 15-20 partidos |
| 70 → 90 | 7-8/10 (buenos) | 30-40 partidos |
| 80 → 90 | 9-10/10 | 12-15 partidos |
| 90 → 95 | 9-10/10 | 8-12 partidos |
| 95 → 99 | 10/10 (perfectos) | 20-30 partidos |

**Nota:** Llegar a 95+ es extremadamente difícil por el soft cap.

---

### **¿Por qué mi OVR no subió si jugué bien?**

Posibles razones:

1. **Participación < 80%:** Si menos del 80% de los jugadores completaron sus evaluaciones, el sistema NO actualiza OVRs
2. **Rating neutro:** Si recibiste ratings 5-6/10, no hay cambios (punto neutro)
3. **OVR alto:** Si tu OVR >= 70, la amortiguación reduce los cambios
4. **Evaluación expirada:** Si pasaron > 72 horas sin completarse

---

### **¿Puedo bajar de OVR?**

**Sí**, si recibes ratings bajos (1-4/10). El sistema es bidireccional:
- Ratings altos → OVR sube
- Ratings bajos → OVR baja

---

### **¿Qué pasa si solo 1 persona me evalúa?**

El promedio se calcula con las evaluaciones recibidas:
- 1 evaluación de 9/10 → avgRating = 9/10
- Pero el cambio será proporcional

**IMPORTANTE:** Necesitas que ≥80% del grupo complete para que se active la actualización.

---

### **¿Los goles afectan el OVR?**

**No directamente**. Los goles se registran en la evaluación pero NO afectan el cálculo de OVR. El único factor es el **rating de 1-10**.

Los goles se usan para:
- Contexto en el historial
- Estadísticas personales
- Trazabilidad

---

## 🔐 **SEGURIDAD Y PREVENCIÓN DE FRAUDE**

### **Medidas Anti-Trampa**

1. **No auto-evaluación:** Sistema rechaza si `evaluatorId === evaluatedId`
2. **Asignación aleatoria:** No puedes elegir a quién evaluar
3. **Timeout 72h:** Evaluaciones antiguas expiran
4. **Validación server-side:** Firestore Rules validan rangos OVR
5. **Logging de anomalías:** Detección automática de patrones sospechosos
6. **Rate limit:** Máximo ±2 por partido (imposible inflar rápido)
7. **Soft cap OVR 95:** Progresión extremadamente lenta al tope

### **Auditoría**

Todos los cambios quedan registrados en:
- `ovrHistory[]` - Historial completo de cambios
- `evaluation_logs` - Trazabilidad detallada con evaluadores
- `__EVAL_RATING_ANOMALIES` - Ratings sospechosos
- `__EVAL_ATTR_ANOMALIES` - Atributos anómalos

---

## 📖 **REFERENCIAS TÉCNICAS**

### **Archivos Relevantes**

| Archivo | Líneas | Descripción |
|---------|--------|-------------|
| `js/unified-evaluation-system.js` | 1740 | Sistema completo de evaluación |
| `firestore.rules` | 304 | Reglas de seguridad Firebase |
| `js/evaluation-ui.js` | - | Interfaz de evaluación |
| `js/firebase-simple.js` | 2349 | Conexión Firebase y CRUD |

### **Funciones Clave**

```javascript
// Algoritmo principal
computeSmoothedOVRDelta(currentOVR, avgRating)  // Línea 48

// Cambios por posición
calculateAttributeChangesByPosition(playerId, avgRating, ovrChange)  // Línea 179

// Actualización OVRs
updatePlayerOVRs(evalData)  // Línea 1003

// Envío evaluación
submitEvaluation(matchId, evaluatorId, evaluations)  // Línea 655
```

---

## ✨ **VERSIÓN DEL ALGORITMO**

```
Algoritmo: v1.0-smooth
Fecha implementación: Octubre 2025
Última actualización: 16 de Octubre 2025
Build stamp: 2025-10-03T00:00:00Z
```

---

**Documento generado automáticamente - FC24 Team Manager © 2025**
