# Reglas por tipo de partido y por rol

> Estado: **propuesta para validar. No hay código cambiado.**
> Es el paso 1 del orden acordado: primero se fijan las reglas, después se
> arreglan los huecos contra ellas y por último se suman las funciones que faltan.
> Parte del análisis de los cinco tipos hecho sobre la rama `feat/flutter-mobile-app`
> (commit `838bda17`).

---

## 1. Principios

1. **El servidor decide; la pantalla sólo lo refleja.** Un botón oculto no es una
   restricción. Toda regla de esta página se impone en las Cloud Functions o en
   las reglas de Firestore/Storage, y la app se limita a no ofrecer lo que va a
   fallar.
2. **Los estados son una máquina, no un campo libre.** Cada transición la hace una
   sola función, desde un estado de origen concreto (§3). Nadie reabre un partido
   cerrado ni cierra uno que no se jugó.
3. **En un partido entre equipos, los planteles son los de cada equipo.** No hay
   anotarse, pedir lugar, salir ni "equilibrar" sueltos. El plantel cambia porque
   cambia el equipo, o porque un gestor reemplaza a alguien.
4. **Privado significa privado.** Quien no está vinculado al partido no lo ve en
   detalle, no vota, no escribe y no sube nada. Público sólo abre lo que cada tipo
   diga (§4).
5. **Quien se vincula puede participar.** Todos los vinculados al partido pueden
   mirar en vivo, escribir en el chat y **subir clips** (§6).
6. **Lo importante deja rastro.** Quién cargó o corrigió un resultado, quién
   canceló, quién reemplazó a un jugador.

---

## 2. Roles

| Rol | Quién es |
|---|---|
| **Organizador** | `ownerUid` del partido (en competiciones, el organizador de la competición). |
| **Capitán** | Gestor de un equipo dentro del partido. En entre grupos ya existe (`captains`); se propone extenderlo a `by_teams` con el creador de cada equipo. |
| **Gestores** | Organizador + capitanes. Es el conjunto que "gestiona" el partido. |
| **Jugador** | Está en el plantel del partido (`playerUids`). |
| **Vinculado** | Gestor, jugador, o miembro de alguno de los grupos que participan. |
| **Tercero** | Cualquier otro usuario con sesión. |
| **Sin sesión** | No lee nada de `matches`. Sin cambios. |

---

## 3. Estados y transiciones

```
planning ──confirmar fecha──▶ upcoming ──iniciar──▶ active ──finalizar──▶ completed ──cerrar evaluación──▶ evaluated
    │                            │
    └──────────cancelar──────────┴──▶ cancelled
```

| Transición | Función | Desde | Quién |
|---|---|---|---|
| `planning → upcoming` | confirmar fecha | `planning` | gestores |
| `upcoming → active` | `startMatch` | `upcoming` | gestores |
| `active → completed` | `finishMatch` | **`active`** | gestores |
| `completed → evaluated` | `finalizeMatchEvaluation` | `completed` | organizador (y capitán rival en entre grupos, §4.4) |
| `planning/upcoming → cancelled` | `cancelMatch` *(nueva)* | `planning`, `upcoming` | gestores |

**No existe** ningún camino que vuelva a `active` o `upcoming` desde un estado
posterior, ni que cierre un partido que nunca estuvo `active`. `updateLiveState`
deja de poder cambiar el estado: sólo cambia período y cronómetro de un partido
que **ya** está `active`.

Los partidos de **competición** (§4.5) siguen su propia ruta: el resultado se
puede cargar directo (`recordResult`) además de dirigirlo en vivo.

---

## 4. Reglas por tipo

Leyenda: ✅ puede · ❌ no puede · 🔸 con condición (se aclara).

### 4.1 Cómo entra y sale la gente

| | Elegir jugadores (`manual`) | Inscripción abierta (`collaborative`) | Dos equipos (`by_teams`) | Entre grupos (`intergroup_friendly`) | Liga / copa |
|---|---|---|---|---|---|
| **Anotarse directo** | ❌ | ✅ miembro del grupo; 🔸 de otro grupo sólo si es público | ❌ | ❌ | ❌ |
| **Pedir lugar** | ✅ miembro; 🔸 de otro grupo sólo si es público | — (no hace falta) | ❌ | ❌ | ❌ |
| **Aprobar / rechazar pedido** | organizador | — | — | — | — |
| **Invitar** | organizador | organizador | ❌ | ❌ | ❌ |
| **Responder invitación** *(nuevo)* | el invitado acepta y entra directo, o rechaza | ídem | — | — | — |
| **Salir** | ✅ jugador, hasta `active` | ✅ jugador, hasta `active` | ❌ avisa al gestor | ❌ avisa al capitán | ❌ |
| **Quitar o reemplazar jugador** *(nuevo)* | organizador | organizador | organizador y capitán **de ese equipo** | capitán **de su propio equipo** | capitán/admin del equipo, sólo antes de iniciar el partido |
| **Cambios en el equipo después de crear el partido** | — | — | 🔸 se reflejan hasta `upcoming` y se avisa a los gestores; en `active` queda congelado | ídem | congelado al iniciar la competición |
| **Equilibrar / mover jugadores** | ✅ organizador | ✅ organizador (y automático al completarse) | ❌ | ❌ | ❌ |
| **El organizador juega** | ✅ botón "Sumarme" | ✅ botón "Sumarme" | 🔸 si está en un plantel | 🔸 si está en un plantel | — |

Reglas de plantel para `manual` y `collaborative`: **cualquier cambio de plantel**
(anotarse, aprobar, salir, quitar) deja los equipos como **desactualizados**. Si el
partido se completa, los equipos se regeneran solos en `collaborative`; en `manual`
y en los demás casos el organizador tiene que equilibrar antes de iniciar, y la
pantalla lo avisa. Hoy sólo `salir` lo hace; anotarse con equipos ya hechos deja a
la persona fuera de los equipos y `startMatch` falla sin explicación.

**Suplentes:** en los partidos entre equipos entran al plantel del partido con la
marca de suplente (pueden jugar, ser evaluados y subir clips).

### 4.2 Quién gestiona y qué puede hacer

| | `manual` | `collaborative` | `by_teams` | `intergroup_friendly` | Liga / copa |
|---|---|---|---|---|---|
| **Gestores** | organizador | organizador | organizador + creador de cada equipo | organizador + los dos capitanes | organizador de la competición |
| **Proponer / confirmar fecha y cancha** | gestores | gestores | gestores | gestores | vía "programar" de la competición |
| **Votar fecha y cancha** | 🔸 jugadores y gestores | ídem | ídem | ídem | — |
| **Reprogramar / cambiar cancha** | gestores en `planning`/`upcoming`, avisa a los jugadores | ídem | ídem | ídem | organizador, con validación de fecha futura |
| **Iniciar** | gestores | gestores (con equipos hechos) | gestores | gestores | gestores — **botón en el móvil** *(nuevo)* |
| **Dirigir y registrar eventos** | gestores, sólo `active` | ídem | ídem | ídem | ídem |
| **Finalizar** | gestores, sólo desde `active` | ídem | ídem | ídem | ídem |
| **Cargar resultado directo** | — | — | — | — | organizador; la corrección queda **auditada** (quién, cuándo, valor anterior) |
| **Cancelar** | gestores | gestores | gestores | **cualquiera de los dos capitanes**, avisa al rival | ❌ (se anula desde la competición) |
| **Borrar** | organizador, sólo si no hubo actividad o está `cancelled` | ídem | ídem | organizador, ídem; con desafío pendiente o rechazado | ❌ nunca |
| **Cerrar evaluación** | organizador | organizador | organizador | **cualquiera de los dos capitanes** | organizador |
| **Evaluar** | jugadores asignados | ídem | ídem | ídem | ídem |

Un partido que se pasó de fecha y **no se jugó** se **cancela**; no se "finaliza".
Hoy se puede finalizar con 0-0 y, en entre grupos, eso suma un empate falso al
historial de rivales.

### 4.3 Qué ve y qué puede hacer cada persona

| | Organizador | Capitán | Jugador | Miembro de grupo participante | Tercero |
|---|---|---|---|---|---|
| **Ver detalle (privado)** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Ver detalle (público)** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Votar fecha/cancha** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Chat** (escribir) | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Subir clips** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Mirar en vivo / presencia** | ✅ | ✅ | ✅ | ✅ | 🔸 sólo si es público |
| **Compartir el link** | ✅ | ✅ | ✅ | ✅ | 🔸 sólo si es público |

### 4.4 Entre grupos: igualdad entre los dos equipos

Los dos equipos tienen **los mismos derechos**. Hoy el organizador conserva
privilegios que el capitán rival no tiene.

| | Equipo del organizador | Equipo rival (hoy) | Equipo rival (propuesta) |
|---|---|---|---|
| Borrar / cancelar | ✅ | ❌ | ✅ cancelar, con aviso |
| Cerrar evaluación y ver asignaciones | ✅ | ❌ | ✅ |
| Aviso al crearse el partido | su grupo | nunca | ambos grupos |
| Ver el partido en su lista | ✅ | sólo si su grupo activo coincide | por grupo **y** por ser jugador |
| Dirigir en vivo y eventos | ✅ | ✅ (app) | ✅ (también en la web) |

### 4.5 Liga y copa

- Los partidos **nacen del motor de la competición** y se gestionan **sólo** desde
  ella. Nadie se anota, sale, invita, equilibra ni mueve jugadores.
- La llave de copa y el fixture de liga **no admiten borrar** un partido: si no se
  puede jugar, se anula desde la competición (y el siguiente cruce se resuelve).
- Los planteles quedan congelados al iniciar la competición. Cambiarlos antes
  requiere al capitán/admin del equipo.
- Iniciar y dirigir un partido de competición debe poder hacerse desde el móvil.
- `leagues` y `cups` **dejan de poder escribirse directo** desde el cliente: todo
  pasa por `manageCompetition` (hoy el dueño puede reescribir tablas y llaves).

---

## 5. Visibilidad por sección

| Sección | Regla propuesta |
|---|---|
| **Lista de Partidos** | Partidos de tu grupo activo **más** los de los grupos con los que participás, **más** "Mis partidos" por ser jugador (hoy un jugador con otro grupo activo no ve el suyo). |
| **Panel** | Los partidos donde jugás o gestionás. |
| **Explorar / Partidos abiertos** | Sólo `manual` y `collaborative` públicos, futuros y con cupo. Nunca partidos de equipos ni de competición. "Falta uno" sólo para partidos que admiten sueltos. |
| **Ficha de equipo (agenda)** | Por `participantTeamIds`, **no por nombre**: renombrar o tener un homónimo no cambia nada. |
| **Notificaciones** | Convocados al crearse; gestores ante cambios de plantel, cancelación y fecha; ambos grupos en entre grupos. |
| **Competiciones** | Miembros del grupo y las públicas. Una privada no se lista a terceros. |

---

## 6. Clips para todos los vinculados

Pedido: **que todos puedan subir clips.** Se define así:

- **Pueden subir:** organizador, capitanes, jugadores de **cualquiera de los
  equipos** y **miembros de los grupos que participan** (el que filma desde el
  costado suele ser uno de ellos, aunque no juegue).
- **En todos los tipos de partido** (incluidas ligas y copas) y en entre grupos
  para **ambos** equipos.
- **Cuándo:** en `active`, `completed` y `evaluated`.
- **Quién no:** un tercero sin vínculo con el partido.
- **Dónde se impone:** en la regla de Firestore de la ficha **y en Storage**. Hoy
  Storage deja subir 40 MB a cualquiera en cualquier partido y la ficha sólo la
  puede crear un participante; los videos de terceros quedan huérfanos.
  Storage consultará el partido (`firestore.get`) y exigirá el vínculo.
- **Topes:** hasta 10 clips por persona y partido, 40 MB cada uno.
- **Borrar:** cada uno borra los suyos; los gestores pueden borrar cualquiera
  (moderación).
- **Chat:** sólo escriben los participantes, y cada uno **edita sólo sus propios
  mensajes** (hoy cualquiera puede reescribir los ajenos, incluido `senderId`).

---

## 7. Lectura de partidos privados

Hoy cualquier usuario con sesión puede **leer** cualquier partido, incluidos
planteles, OVR y subcolecciones (`joinRequests`, `selfEvaluations`, clips). Se
propone en dos tiempos:

1. **Ya:** cerrar las subcolecciones sensibles a vinculados (`joinRequests`,
   `selfEvaluations`, `clips`, `presence`, `messages`).
2. **Después, aparte:** restringir el documento principal de un partido privado a
   vinculados. Es un cambio con costo de lecturas y riesgo de romper pantallas que
   hoy leen directo, así que va con su propio análisis de consultas e índices.

---

## 8. Decisiones que necesito de vos

Con mi propuesta por defecto entre paréntesis.

1. **Clips:** ¿participantes **y miembros de los grupos participantes**, sin
   terceros? (**sí**, con tope de 10 por persona).
2. **Lectura de privados:** ¿cerrar las subcolecciones ya y el documento principal
   en un segundo paso? (**sí**)
3. **`by_teams`:** ¿el creador de cada equipo es capitán, como en entre grupos?
   (**sí**)
4. **Salir de un partido de equipos:** ¿prohibido, y que un gestor reemplace?
   (**sí**)
5. **Suplentes:** ¿entran al plantel del partido? (**sí, con marca**)
6. **Evaluación entre grupos:** ¿la puede cerrar cualquiera de los dos capitanes?
   (**sí**)
7. **Cambios de plantel tras crear `by_teams`:** ¿se sincronizan hasta `upcoming`
   como en entre grupos? (**sí**)
8. **Estado nuevo `cancelled`:** ¿cancelar en lugar de borrar o finalizar sin
   jugar? (**sí**)
9. **El organizador juega** su propio partido con "Sumarme". (**sí**)
10. **Plantel cambiado con equipos hechos** (`manual`/`collaborative`): ¿equipos
    "desactualizados" y hay que equilibrar antes de iniciar? (**sí**)

---

## 9. Orden de implementación (después de validar)

**A — Cerrar huecos en el servidor** (no agregan funciones):
máquina de estados (`updateLiveState`, `finishMatch`, `confirmMatchDate`,
`deleteMatch`), `joinMatch` respetando la aprobación de `manual`, guardias de
competición y de partidos de equipos en `joinMatch`/`leaveMatch`/`respondJoinRequest`/
`updateMatchTeams`/`shuffleTeams`/`sendMatchInvitations`, votos sólo de jugadores.

**B — Reglas de Firestore y Storage:** clips con vínculo y tope (**incluye "todos
pueden subir"**), chat con edición sólo propia, subcolecciones sensibles cerradas,
`leagues`/`cups` sin escritura directa.

**C — Funciones nuevas, de a una pieza:**
1. `cancelMatch` + aviso a los participantes.
2. Responder invitaciones en el móvil.
3. Quitar o reemplazar jugadores; salir deja de existir en partidos de equipos.
4. Capitanes en `by_teams` + sincronizar plantel (reusa el mecanismo de entre
   grupos).
5. Cerrar evaluación por cualquiera de los capitanes.
6. Iniciar y dirigir partidos de competición desde el móvil.
7. Auditoría de resultados.
8. "Sumarme" para el organizador y equipos desactualizados.
9. Visibilidad: "Mis partidos" por jugador, agenda por id, avisos a ambos grupos.

Cada paso lleva tests, y todo lo de A y B **requiere desplegar** funciones y
reglas para tener efecto. El estado de despliegue actual se debe confirmar antes de
empezar.
