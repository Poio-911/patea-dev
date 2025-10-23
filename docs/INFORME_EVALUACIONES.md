# 🔍 INFORME EXHAUSTIVO DEL SISTEMA DE EVALUACIONES
## Análisis Completo de Errores y Flujos

**Fecha**: 22 de Octubre 2025
**Proyecto**: Amateur Football Manager (Pateá)
**Enfoque**: Sistema de evaluaciones peer-to-peer

---

## 📊 ARQUITECTURA DEL SISTEMA DE EVALUACIONES

### Flujo Completo de Evaluación

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. PARTIDO FINALIZA (status: 'completed')                      │
│    ↓                                                            │
│ 2. Sistema genera assignments automáticamente                   │
│    - Colección: /matches/{matchId}/assignments/                │
│    - Cada jugador tiene 2 asignaciones (evaluar 2 compañeros)  │
│    - Status inicial: 'pending'                                 │
│    ↓                                                            │
│ 3. JUGADORES EVALÚAN (/evaluations/[matchId])                  │
│    - Sistema dual: evaluar por puntos (1-10) O por tags        │
│    - Al enviar: crea documento en evaluationSubmissions        │
│    - NO crea evaluations directamente                          │
│    ↓                                                            │
│ 4. ORGANIZADOR SUPERVISA (/matches/[id]/evaluate)              │
│    - Procesa submissions pendientes en segundo plano           │
│    - Convierte submissions → evaluations reales                │
│    - Actualiza assignments status: pending → completed         │
│    ↓                                                            │
│ 5. FINALIZACIÓN                                                 │
│    - Organizador hace click "Finalizar y Calcular OVRs"       │
│    - Sistema calcula promedios y actualiza OVR/atributos      │
│    - Match status: completed → evaluated                       │
└─────────────────────────────────────────────────────────────────┘
```

### Colecciones de Firestore Involucradas

```
/matches/{matchId}
  - status: 'upcoming' | 'completed' | 'evaluated'
  - players: array de participantes
  - ownerUid: organizador del partido

/matches/{matchId}/assignments/{assignmentId}
  - evaluatorId: quien debe evaluar
  - subjectId: quien será evaluado
  - status: 'pending' | 'completed'
  - evaluationId?: referencia a evaluation creada

/evaluationSubmissions/{submissionId}
  - evaluatorId: string
  - matchId: string
  - submittedAt: timestamp
  - submission: { evaluatorGoals, evaluations[] }

/evaluations/{evaluationId}
  - assignmentId: string
  - playerId: string (evaluado)
  - evaluatorId: string (evaluador)
  - matchId: string
  - rating?: number (1-10)
  - performanceTags?: PerformanceTag[]
  - goals: number
  - evaluatedAt: timestamp

/players/{playerId}/ovrHistory/{historyId}
  - date: timestamp
  - oldOVR: number
  - newOVR: number
  - change: number
  - matchId: string
```

---

## 🐛 ERRORES CRÍTICOS ENCONTRADOS

### **ERROR #1: Estado de Carga Infinito en Evaluación por Puntos** ⚠️ CRÍTICO

**Ubicación**: `src/components/perform-evaluation-view.tsx`

**Descripción del problema reportado por el usuario**:
> "no se puede evaluar por puntos pero queda cargando"

**Causa raíz**:

1. **Valor por defecto del rating no se propaga al form**
   ```typescript
   // Línea 133 - Valor por defecto
   rating: 5,

   // Línea 313 - Slider usa defaultValue en vez de value
   <Slider
     min={1}
     max={10}
     step={1}
     defaultValue={[ratingField.value || 5]}  // ❌ PROBLEMA
     onValueChange={(value) => ratingField.onChange(value[0])}
   />
   ```

   **Problema**: Si el usuario NO mueve el slider, `ratingField.value` permanece `undefined`, no se actualiza a 5.

2. **Schema de Zod permite rating opcional**
   ```typescript
   // Línea 45 - Rating es OPCIONAL
   rating: z.coerce.number().min(1).max(10).optional(),  // ❌
   ```

   **Problema**: La validación de Zod no fuerza que el rating exista cuando `evaluationType === 'points'`.

3. **Validación manual no detiene la ejecución correctamente**
   ```typescript
   // Líneas 153-159
   if (evaluation.evaluationType === 'points' && (!evaluation.rating || evaluation.rating < 1 || evaluation.rating > 10)) {
     toast({
       variant: 'destructive',
       title: 'Error de Validación',
       description: `Debes asignar un rating (1-10) para ${evaluation.displayName}.`,
     })
     return  // ✅ Sí retorna
   }
   ```

   **Problema**: Aunque retorna, si el `rating` es `undefined`, el documento se crea con `rating: undefined` en Firestore.

4. **addDoc no maneja errores de validación de Firestore**
   ```typescript
   // Línea 180
   await addDoc(collection(firestore, 'evaluationSubmissions'), submissionData);
   ```

   **Problema**: Si Firestore rechaza el documento por tener campos inválidos, el error se captura pero no se maneja adecuadamente. El estado `isSubmitting` podría quedarse en `true`.

**Impacto**:
- ❌ El usuario presiona "Enviar Evaluaciones"
- ❌ El sistema valida pero con `rating: undefined`
- ❌ Se intenta guardar en Firestore
- ❌ Firestore podría rechazar silenciosamente o guardar con campo `undefined`
- ❌ El botón queda en estado "Enviando..." indefinidamente
- ❌ El usuario NO puede volver a intentar

**Solución propuesta**:
```typescript
// 1. Cambiar schema de Zod para hacer rating requerido cuando es por puntos
const playerEvaluationSchema = z.object({
  assignmentId: z.string(),
  subjectId: z.string(),
  displayName: z.string(),
  photoUrl: z.string(),
  position: z.string(),
  evaluationType: z.enum(['points', 'tags']).default('points'),
  rating: z.coerce.number().min(1).max(10),  // ✅ Eliminar .optional()
  performanceTags: z.array(z.any()).min(3).optional(),
});

// 2. Cambiar Slider para usar value controlado en vez de defaultValue
<FormField
  control={form.control}
  name={`evaluations.${index}.rating`}
  render={({ field: ratingField }) => (
    <FormItem>
      <FormLabel>Rating: {ratingField.value || 5}</FormLabel>
      <FormControl>
        <div className="flex items-center gap-2 pt-2">
          <span className="text-xs text-muted-foreground">1</span>
          <Slider
            min={1}
            max={10}
            step={1}
            value={[ratingField.value || 5]}  // ✅ value controlado
            onValueChange={(value) => ratingField.onChange(value[0])}
          />
          <span className="text-xs text-muted-foreground">10</span>
        </div>
      </FormControl>
    </FormItem>
  )}
/>

// 3. Asegurar valor inicial en useEffect
useEffect(() => {
  if (assignments && allGroupPlayers) {
    if (assignments.length > 0) {
      const initialFormValues: PlayerEvaluationFormData[] = []
      const tagsForPlayers: Record<string, PerformanceTag[]> = {}

      for (const assignment of assignments) {
        const subject = allGroupPlayers.find((p) => p.id === assignment.subjectId)
        if (subject) {
          initialFormValues.push({
            assignmentId: assignment.id,
            subjectId: assignment.subjectId,
            displayName: subject.name,
            photoUrl: subject.photoUrl || '',
            position: subject.position,
            evaluationType: 'points',
            rating: 5,  // ✅ Valor inicial explícito
            performanceTags: [],
          })
          tagsForPlayers[subject.id] = getRandomTags(subject.position)
        }
      }

      replace(initialFormValues)
      setRandomTags(tagsForPlayers)
    }
    setIsPageLoading(false)
  }
}, [assignments, allGroupPlayers, replace, assignmentsLoading, playersLoading, getRandomTags])

// 4. Mejorar manejo de errores en submit
const onSubmit = async (data: EvaluationFormData) => {
  if (!firestore || !user || !matchId) return

  // Validación reforzada
  for (const evaluation of data.evaluations) {
    if (evaluation.evaluationType === 'points' && (!evaluation.rating || evaluation.rating < 1 || evaluation.rating > 10)) {
      toast({
        variant: 'destructive',
        title: 'Error de Validación',
        description: `Debes asignar un rating (1-10) para ${evaluation.displayName}.`,
      })
      return
    }
    if (evaluation.evaluationType === 'tags' && (!evaluation.performanceTags || evaluation.performanceTags.length < 3)) {
      toast({
        variant: 'destructive',
        title: 'Error de Validación',
        description: `Debes seleccionar al menos 3 etiquetas para ${evaluation.displayName}.`,
      })
      return
    }
  }

  setIsSubmitting(true)
  try {
    const submissionData = {
      evaluatorId: user.uid,
      matchId,
      submittedAt: new Date().toISOString(),
      submission: data,
    };

    await addDoc(collection(firestore, 'evaluationSubmissions'), submissionData);

    toast({
      title: '¡Evaluaciones en camino!',
      description: 'Tus evaluaciones se han enviado y se procesarán en segundo plano.',
    })
    router.push('/evaluations')
  } catch (error: any) {
    console.error('Error submitting evaluation:', error);  // ✅ Log del error
    toast({
      variant: 'destructive',
      title: 'Error',
      description: error.message || 'No se pudieron enviar las evaluaciones.',
    })
  } finally {
    setIsSubmitting(false)  // ✅ Siempre resetear estado
  }
}
```

---

### **ERROR #2: Evaluaciones por Tags No Se Procesan Correctamente** ⚠️ CRÍTICO

**Ubicación**: `src/app/matches/[id]/evaluate/page.tsx` líneas 228-231

**Código problemático**:
```typescript
// Línea 228-231
if (tagBasedEvals.length > pointBasedEvals.length) {
    const combinedTags = tagBasedEvals.flatMap(ev => ev.performanceTags || []);
    updatedAttributes = calculateAttributeChanges(player, combinedTags);
}
```

**Problema**:
- Solo se aplican los efectos de tags si `tagBasedEvals.length > pointBasedEvals.length`
- Si hay IGUAL cantidad de evaluaciones por tags y por puntos, los tags se ignoran
- Los tags deberían aplicarse SIEMPRE si existen, independientemente de la cantidad
- Además, si hay más evaluaciones por puntos, los tags se pierden completamente

**Escenario de fallo**:
```
Jugador recibe:
- 2 evaluaciones por puntos (rating 8 y 9)
- 2 evaluaciones por tags (con tags positivos)

Resultado actual: Solo se procesan los puntos, los tags se ignoran
Resultado esperado: Se procesan AMBOS (puntos para OVR, tags para atributos)
```

**Otro escenario de fallo**:
```
Jugador recibe:
- 3 evaluaciones por puntos
- 2 evaluaciones por tags

Resultado actual: Tags ignorados completamente
Resultado esperado: Aplicar ambos sistemas
```

**Lógica incorrecta actual**:
```typescript
if (tagBasedEvals.length > pointBasedEvals.length) {
    // Solo tags
    updatedAttributes = calculateAttributeChanges(player, combinedTags);
}

if (pointBasedEvals.length >= tagBasedEvals.length) {
    // Solo puntos
    const avgRating = totalRating / pointBasedEvals.length;
    ovrChangeFromPoints = calculateOvrChange(player.ovr, avgRating);
}
```

**Solución propuesta**:
```typescript
// Procesar tags SIEMPRE si existen
if (tagBasedEvals.length > 0) {
    const combinedTags = tagBasedEvals.flatMap(ev => ev.performanceTags || []);
    updatedAttributes = calculateAttributeChanges(player, combinedTags);
}

// Procesar puntos SIEMPRE si existen
if (pointBasedEvals.length > 0) {
    const totalRating = pointBasedEvals.reduce((sum, ev) => sum + (ev.rating || 0), 0);
    const avgRating = totalRating / pointBasedEvals.length;
    ovrChangeFromPoints = calculateOvrChange(player.ovr, avgRating);
}

// Los dos sistemas pueden coexistir:
// - Tags afectan atributos específicos (pac, sho, pas, dri, def, phy)
// - Puntos afectan OVR general
// Ambos se suman al final
```

**Código completo corregido**:
```typescript
for (const playerId of playerIdsToUpdate) {
    const player = playerDocs.get(playerId);
    if (!player) continue;

    const playerPeerEvals = peerEvalsByPlayer[playerId];
    const pointBasedEvals = playerPeerEvals.filter(ev => ev.rating !== undefined && ev.rating !== null);
    const tagBasedEvals = playerPeerEvals.filter(ev => ev.performanceTags && ev.performanceTags.length > 0);

    let updatedAttributes = { ...player };
    let ovrChangeFromPoints = 0;

    // ✅ PROCESAR TAGS SIEMPRE SI EXISTEN
    if (tagBasedEvals.length > 0) {
        const combinedTags = tagBasedEvals.flatMap(ev => ev.performanceTags || []);
        updatedAttributes = calculateAttributeChanges(player, combinedTags);
    }

    // ✅ PROCESAR PUNTOS SIEMPRE SI EXISTEN
    if (pointBasedEvals.length > 0) {
        const totalRating = pointBasedEvals.reduce((sum, ev) => sum + (ev.rating || 0), 0);
        const avgRating = totalRating / pointBasedEvals.length;
        ovrChangeFromPoints = calculateOvrChange(player.ovr, avgRating);
    }

    // Calcular nuevo OVR (promedio de atributos + cambio por puntos)
    let newOvr = Math.round((updatedAttributes.pac + updatedAttributes.sho + updatedAttributes.pas + updatedAttributes.dri + updatedAttributes.def + updatedAttributes.phy) / 6);
    newOvr += ovrChangeFromPoints;
    newOvr = Math.max(OVR_PROGRESSION.MIN_OVR, Math.min(OVR_PROGRESSION.HARD_CAP, newOvr));

    // ... resto del código
}
```

---

### **ERROR #3: Race Condition en Procesamiento de Submissions** ⚠️ ALTO

**Ubicación**: `src/app/matches/[id]/evaluate/page.tsx` líneas 161-165

**Código problemático**:
```typescript
useEffect(() => {
  if (match && match.status !== 'evaluated') {
    processPendingSubmissions();  // ❌ Sin control de concurrencia
  }
}, [match, processPendingSubmissions]);
```

**Problema**:
1. El `useEffect` se ejecuta cada vez que cambia `match`
2. Si múltiples organizadores abren la página simultáneamente
3. Todos ejecutan `processPendingSubmissions()` al mismo tiempo
4. Pueden procesar las mismas submissions múltiples veces
5. Firestore no tiene locks nativos, batch podría ejecutarse múltiples veces

**Escenario de fallo**:
```
T=0:    Organizador A abre /matches/123/evaluate
T=0.5:  Organizador B abre /matches/123/evaluate
T=1:    Ambos ejecutan getDocs(submissionsQuery)
T=1.5:  Ambos obtienen las mismas 5 submissions
T=2:    Ambos ejecutan batch.commit() con las mismas operaciones
T=2.5:  Se crean 10 evaluations (duplicadas) en vez de 5
        Las 5 submissions se eliminan
        Los assignments se actualizan 2 veces (no es problema)
Resultado: 5 evaluations duplicadas en Firestore
```

**Impacto**:
- Evaluaciones duplicadas en la base de datos
- Cálculos de OVR incorrectos (se cuentan evaluaciones doble)
- Estadísticas infladas
- Difícil de debuggear

**Solución propuesta con Transaction Lock**:
```typescript
const processPendingSubmissions = useCallback(async () => {
  if (!firestore || !matchId) return;

  setIsProcessingSubmissions(true);

  try {
    // Usar transaction para adquirir lock y procesar
    await runTransaction(firestore, async (transaction) => {
      // 1. Intentar adquirir lock
      const lockRef = doc(firestore, 'matches', matchId as string, '_processing', 'lock');
      const lockDoc = await transaction.get(lockRef);

      // Verificar si ya está siendo procesado (lock activo de hace menos de 30 segundos)
      if (lockDoc.exists()) {
        const lockData = lockDoc.data();
        const lockAge = Date.now() - lockData.timestamp;

        if (lockAge < 30000) { // 30 segundos
          console.log('Already being processed by another instance');
          throw new Error('ALREADY_PROCESSING');
        }
      }

      // 2. Adquirir lock
      transaction.set(lockRef, {
        timestamp: Date.now(),
        processedBy: user?.uid,
      });

      // 3. Obtener submissions pendientes
      const submissionsQuery = query(
        collection(firestore, 'evaluationSubmissions'),
        where('matchId', '==', matchId)
      );
      const snapshot = await getDocs(submissionsQuery);

      if (snapshot.empty) {
        // Liberar lock
        transaction.delete(lockRef);
        return;
      }

      setPendingSubmissionsCount(snapshot.size);

      // 4. Procesar cada submission
      for (const submissionDoc of snapshot.docs) {
        const submission = submissionDoc.data();
        const { evaluatorId, submission: formData } = submission;

        // Process self-evaluation
        const selfEvalRef = doc(collection(firestore, 'matches', matchId as string, 'selfEvaluations'));
        transaction.set(selfEvalRef, {
          playerId: evaluatorId,
          matchId,
          goals: formData.evaluatorGoals,
          reportedAt: submission.submittedAt,
        });

        // Process peer evaluations
        for (const evaluation of formData.evaluations) {
          const evalRef = doc(collection(firestore, 'evaluations'));
          const newEvaluation: Omit<Evaluation, 'id'> = {
            assignmentId: evaluation.assignmentId,
            playerId: evaluation.subjectId,
            evaluatorId,
            matchId: matchId as string,
            goals: 0,
            evaluatedAt: submission.submittedAt,
          };

          if (evaluation.evaluationType === 'points') newEvaluation.rating = evaluation.rating;
          else newEvaluation.performanceTags = evaluation.performanceTags;

          transaction.set(evalRef, newEvaluation);

          const assignmentRef = doc(firestore, 'matches', matchId as string, 'assignments', evaluation.assignmentId);
          transaction.update(assignmentRef, { status: 'completed', evaluationId: evalRef.id });
        }

        // Delete the processed submission
        transaction.delete(submissionDoc.ref);
      }

      // 5. Liberar lock
      transaction.delete(lockRef);
    });

    toast({
      title: "Nuevas evaluaciones procesadas",
      description: `${pendingSubmissionsCount} envío(s) de evaluaciones han sido registrados.`
    });

  } catch (error: any) {
    if (error.message === 'ALREADY_PROCESSING') {
      console.log('Skipping - already being processed');
    } else {
      console.error("Error processing submissions:", error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudieron procesar las evaluaciones pendientes.'
      });
    }
  } finally {
    setIsProcessingSubmissions(false);
    setPendingSubmissionsCount(0);
  }
}, [firestore, matchId, toast, user]);
```

**Alternativa más simple con timestamp check**:
```typescript
// Agregar campo "processingStarted" a cada submission
// Antes de procesar, marcar como "en proceso"
// Si ya tiene timestamp reciente, skip

const submissionsQuery = query(
  collection(firestore, 'evaluationSubmissions'),
  where('matchId', '==', matchId),
  where('processingStarted', '==', null)  // Solo no procesadas
);
```

---

### **ERROR #4: No Se Validan Mínimo de Etiquetas en Schema** ⚠️ MEDIO

**Ubicación**: `src/components/perform-evaluation-view.tsx` línea 46-49

**Código actual**:
```typescript
performanceTags: z
  .array(z.any())
  .min(3, 'Debes seleccionar al menos 3 etiquetas.')
  .optional(),  // ❌ El .optional() anula el .min(3)
```

**Problema**:
- El schema requiere mínimo 3 tags si existe el array
- PERO al ser `.optional()`, permite que `performanceTags` sea `undefined`
- La validación manual en línea 161 verifica correctamente
- Pero el schema de Zod no refuerza esta regla
- Hay inconsistencia entre schema y validación manual

**Impacto**:
- Si se elimina la validación manual (línea 161-168), el formulario permitiría enviar evaluaciones por tags sin tags
- Inconsistencia entre las dos capas de validación
- Potencial bug futuro si alguien remueve la validación manual confiando en el schema

**Solución propuesta con Zod Refinement**:
```typescript
const evaluationSchema = z.object({
  evaluatorGoals: z.coerce.number().min(0).max(20).default(0),
  evaluations: z.array(playerEvaluationSchema).refine((evaluations) => {
    // Validación condicional basada en evaluationType
    return evaluations.every(evaluation => {
      if (evaluation.evaluationType === 'points') {
        // Si es por puntos, debe tener rating válido
        return evaluation.rating !== undefined &&
               evaluation.rating >= 1 &&
               evaluation.rating <= 10;
      }
      if (evaluation.evaluationType === 'tags') {
        // Si es por tags, debe tener al menos 3 tags
        return evaluation.performanceTags &&
               evaluation.performanceTags.length >= 3;
      }
      return true;
    });
  }, {
    message: 'Cada evaluación debe tener un rating válido (1-10) o al menos 3 etiquetas de rendimiento',
  }),
});

// Eliminar las validaciones .optional() y .min() del playerEvaluationSchema
const playerEvaluationSchema = z.object({
  assignmentId: z.string(),
  subjectId: z.string(),
  displayName: z.string(),
  photoUrl: z.string(),
  position: z.string(),
  evaluationType: z.enum(['points', 'tags']).default('points'),
  rating: z.coerce.number().min(1).max(10).nullable(),  // Puede ser null
  performanceTags: z.array(z.any()).nullable(),  // Puede ser null
});
```

**Alternativa con Discriminated Union**:
```typescript
const pointsEvaluationSchema = z.object({
  assignmentId: z.string(),
  subjectId: z.string(),
  displayName: z.string(),
  photoUrl: z.string(),
  position: z.string(),
  evaluationType: z.literal('points'),
  rating: z.coerce.number().min(1).max(10),  // ✅ Requerido
  performanceTags: z.never().optional(),
});

const tagsEvaluationSchema = z.object({
  assignmentId: z.string(),
  subjectId: z.string(),
  displayName: z.string(),
  photoUrl: z.string(),
  position: z.string(),
  evaluationType: z.literal('tags'),
  rating: z.never().optional(),
  performanceTags: z.array(z.any()).min(3),  // ✅ Mínimo 3
});

const playerEvaluationSchema = z.discriminatedUnion('evaluationType', [
  pointsEvaluationSchema,
  tagsEvaluationSchema,
]);
```

---

### **ERROR #5: Assignments Status No Se Actualiza en Transacción Atómica** ⚠️ ALTO

**Ubicación**: `src/app/matches/[id]/evaluate/page.tsx` líneas 95-159

**Código problemático**:
```typescript
// Línea 110: writeBatch usado FUERA de transaction
const batch = writeBatch(firestore);

// ... procesamiento ...

// Línea 149: commit del batch
await batch.commit();
```

**Problema**:
- El procesamiento de submissions usa `writeBatch`
- Pero la finalización usa `runTransaction`
- Si alguien finaliza mientras se procesan submissions:
  - Las submissions se eliminan
  - Pero las evaluations ya se crearon
  - El estado del match cambia a 'evaluated'
  - Las assignments quedan en estado inconsistente

**Escenario de fallo detallado**:
```
T=0:    processPendingSubmissions() inicia
        - Crea batch
        - Obtiene 5 submissions de Firestore

T=1:    Organizador hace click en "Finalizar y Calcular OVRs"

T=1.5:  handleFinalizeEvaluation() inicia
        - Inicia transaction
        - Lee assignments (status: pending para estos 5)
        - Lee evaluations existentes (NO incluye las 5 nuevas)

T=2:    processPendingSubmissions() ejecuta batch.commit()
        - Crea 5 evaluations nuevas
        - Actualiza 5 assignments a 'completed'
        - Elimina 5 submissions

T=2.5:  handleFinalizeEvaluation() continúa transaction
        - Calcula OVRs basado en evaluations viejas
        - NO incluye las 5 evaluations recién creadas
        - Actualiza match status a 'evaluated'
        - Transaction commit

Resultado final:
  ✅ 5 evaluations creadas
  ✅ 5 assignments marcadas como completed
  ❌ Pero OVRs calculados SIN estas 5 evaluations
  ❌ Match marcado como 'evaluated' prematuramente
  ❌ No se pueden recalcular porque match ya está 'evaluated'
```

**Solución propuesta**:
```typescript
// Opción 1: Usar transaction en vez de batch para procesamiento
const processPendingSubmissions = useCallback(async () => {
  if (!firestore || !matchId) return;

  setIsProcessingSubmissions(true);

  try {
    await runTransaction(firestore, async (transaction) => {
      const submissionsQuery = query(
        collection(firestore, 'evaluationSubmissions'),
        where('matchId', '==', matchId)
      );
      const snapshot = await getDocs(submissionsQuery);

      if (snapshot.empty) {
        return;
      }

      setPendingSubmissionsCount(snapshot.size);

      for (const submissionDoc of snapshot.docs) {
        const submission = submissionDoc.data();
        const { evaluatorId, submission: formData } = submission;

        // Process self-evaluation
        const selfEvalRef = doc(collection(firestore, 'matches', matchId as string, 'selfEvaluations'));
        transaction.set(selfEvalRef, {
          playerId: evaluatorId,
          matchId,
          goals: formData.evaluatorGoals,
          reportedAt: submission.submittedAt,
        });

        // Process peer evaluations
        for (const evaluation of formData.evaluations) {
          const evalRef = doc(collection(firestore, 'evaluations'));
          const newEvaluation: Omit<Evaluation, 'id'> = {
            assignmentId: evaluation.assignmentId,
            playerId: evaluation.subjectId,
            evaluatorId,
            matchId: matchId as string,
            goals: 0,
            evaluatedAt: submission.submittedAt,
          };

          if (evaluation.evaluationType === 'points') newEvaluation.rating = evaluation.rating;
          else newEvaluation.performanceTags = evaluation.performanceTags;

          transaction.set(evalRef, newEvaluation);

          const assignmentRef = doc(firestore, 'matches', matchId as string, 'assignments', evaluation.assignmentId);
          transaction.update(assignmentRef, { status: 'completed', evaluationId: evalRef.id });
        }

        // Delete the processed submission
        transaction.delete(submissionDoc.ref);
      }
    });

    toast({ title: "Nuevas evaluaciones procesadas", description: `${pendingSubmissionsCount} envío(s) de evaluaciones han sido registrados.` });

  } catch (error) {
    console.error("Error processing submissions:", error);
    toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron procesar las evaluaciones pendientes.' });
  } finally {
    setIsProcessingSubmissions(false);
    setPendingSubmissionsCount(0);
  }
}, [firestore, matchId, toast]);

// Opción 2: Verificar en handleFinalizeEvaluation que no haya submissions pendientes
const handleFinalizeEvaluation = async () => {
  if (!firestore || !match || !match.id) return;
  setIsFinalizing(true);

  try {
    // ✅ Verificar si hay submissions pendientes
    const pendingSubmissionsQuery = query(
      collection(firestore, 'evaluationSubmissions'),
      where('matchId', '==', match.id)
    );
    const pendingSnapshot = await getDocs(pendingSubmissionsQuery);

    if (!pendingSnapshot.empty) {
      toast({
        variant: 'destructive',
        title: 'Evaluaciones pendientes',
        description: `Hay ${pendingSnapshot.size} evaluaciones sin procesar. Espera a que se procesen antes de finalizar.`,
      });
      setIsFinalizing(false);
      return;
    }

    // Continuar con finalización...
    await runTransaction(firestore, async (transaction) => {
      // ... resto del código
    });
  } catch (error) {
    // ...
  } finally {
    setIsFinalizing(false);
  }
};
```

---

### **ERROR #6: Cálculo de Average Rating No Está Claro** ⚠️ BAJO

**Ubicación**: `src/app/matches/[id]/evaluate/page.tsx` líneas 246-248

**Código actual**:
```typescript
// Línea 247-248
const avgRatingFromPoints = pointBasedEvals.length > 0
  ? pointBasedEvals.reduce((sum, ev) => sum + (ev.rating || 0), 0) / pointBasedEvals.length
  : player.stats.averageRating;

const newAvgRating = pointBasedEvals.length > 0
  ? ((player.stats.averageRating || 0) * (player.stats.matchesPlayed || 0) + avgRatingFromPoints) / newMatchesPlayed
  : player.stats.averageRating;
```

**Análisis del cálculo**:
1. `avgRatingFromPoints` = promedio de ratings del partido actual (si recibe 2 evals de 8 y 9 → 8.5)
2. `newAvgRating` = promedio ponderado: (rating_acumulado × partidos_previos + rating_nuevo) / total_partidos

**Problema conceptual**:
- ¿El `averageRating` debe ser promedio de PARTIDOS o promedio de EVALUACIONES?
- Si es promedio de partidos: El cálculo es correcto
- Si es promedio de evaluaciones: El cálculo está mal

**Ejemplo**:
```
Jugador:
- matchesPlayed: 5
- averageRating: 7.0
- Nuevo partido: recibe 2 evaluaciones (8 y 9)

INTERPRETACIÓN 1: Promedio de PARTIDOS
  avgRatingFromPoints = (8 + 9) / 2 = 8.5
  newAvgRating = (7.0 × 5 + 8.5) / 6 = 43.5 / 6 = 7.25 ✅

INTERPRETACIÓN 2: Promedio de EVALUACIONES
  Evaluaciones previas: 5 partidos × ~2 evals = ~10 evaluaciones
  Nuevas evaluaciones: 2 (8 y 9)
  newAvgRating = (10 × 7.0 + 8 + 9) / 12 = 87 / 12 = 7.25 ✅

  Coincide en este caso, pero no siempre
```

**Caso donde NO coincide**:
```
Jugador recibe cantidad variable de evaluaciones por partido:
- Partido 1: 3 evaluaciones (promedio 8)
- Partido 2: 1 evaluación (9)
- Partido 3: 2 evaluaciones (7)

PROMEDIO DE PARTIDOS:
  (8 + 9 + 7) / 3 = 8.0

PROMEDIO DE EVALUACIONES:
  (8+8+8 + 9 + 7+7) / 6 = 47 / 6 = 7.83

Diferencia: 0.17 puntos
```

**Recomendación**:
1. Documentar claramente qué representa `averageRating`
2. Si es promedio de partidos (actual): está correcto
3. Si debe ser promedio de evaluaciones: cambiar lógica
4. Agregar comentario explicativo en el código

**Solución (con documentación)**:
```typescript
// averageRating representa el promedio de rating POR PARTIDO
// NO el promedio de todas las evaluaciones individuales recibidas
// Esto normaliza el impacto independientemente de cuántas personas te evalúen cada partido

const avgRatingFromPoints = pointBasedEvals.length > 0
  ? pointBasedEvals.reduce((sum, ev) => sum + (ev.rating || 0), 0) / pointBasedEvals.length
  : player.stats.averageRating;

// Promedio ponderado: (avg_previo × partidos_previos + avg_nuevo_partido) / total_partidos
const newAvgRating = pointBasedEvals.length > 0
  ? ((player.stats.averageRating || 0) * (player.stats.matchesPlayed || 0) + avgRatingFromPoints) / newMatchesPlayed
  : player.stats.averageRating;
```

---

### **ERROR #7: Submission No Se Elimina Si El Procesamiento Falla Parcialmente** ⚠️ MEDIO

**Ubicación**: `src/app/matches/[id]/evaluate/page.tsx` líneas 145-146

**Código problemático**:
```typescript
// Línea 145-146
// Delete the processed submission
batch.delete(submissionDoc.ref);
```

**Problema**:
- Si el `batch.commit()` falla DESPUÉS de agregar el delete
- Las submissions se eliminarían SIN haber creado las evaluations
- Pérdida de datos irreversible

**Funcionamiento de writeBatch**:
```
writeBatch() en Firestore es atómico:
- TODAS las operaciones se ejecutan, o NINGUNA
- Si falla 1 operación, todas se cancelan
- Pero el problema es QUÉ pasa si falla

Escenario:
1. Batch añade: create evaluation 1  ✅
2. Batch añade: create evaluation 2  ✅
3. Batch añade: update assignment 1  ✅
4. Batch añade: update assignment 2  ✅
5. Batch añade: DELETE submission     ✅
6. batch.commit() → ERROR (timeout, permisos, etc.)
   Resultado: NADA se ejecuta ✅ (batch es atómico)

PERO:
- Si el error es temporal (timeout de red)
- Y la app reintenta
- ¿Cómo sabe si el batch se ejecutó o no?
```

**Problema real**:
No es tanto que el batch falle parcialmente (es atómico), sino:
1. Incertidumbre si el batch se ejecutó en caso de error de red
2. No hay forma de "retry" idempotente
3. No hay backup de las submissions si se pierde conexión

**Solución propuesta - Soft Delete**:
```typescript
// En vez de eliminar, marcar como procesada
batch.update(submissionDoc.ref, {
  processed: true,
  processedAt: new Date().toISOString(),
  processedBy: user?.uid
});

// Actualizar query para ignorar procesadas
const submissionsQuery = query(
  collection(firestore, 'evaluationSubmissions'),
  where('matchId', '==', matchId),
  where('processed', '!=', true)  // Solo no procesadas
);

// Job de limpieza periódico (opcional)
// Eliminar submissions procesadas después de 30 días
```

**Solución alternativa - Dos fases**:
```typescript
// Fase 1: Procesar y marcar como procesadas
await batch.commit();

// Fase 2: Solo si fase 1 exitosa, eliminar submissions
try {
  const deleteBatch = writeBatch(firestore);
  snapshot.docs.forEach(doc => {
    deleteBatch.delete(doc.ref);
  });
  await deleteBatch.commit();
} catch (deleteError) {
  // No crítico si falla el delete, ya están marcadas como procesadas
  console.warn('Failed to delete processed submissions:', deleteError);
}
```

**Solución con Cloud Function (mejor)**:
```typescript
// En Cloud Functions (backend)
exports.cleanupProcessedSubmissions = functions.pubsub
  .schedule('every 1 hours')
  .onRun(async (context) => {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - 1);  // Más de 1 hora

    const oldSubmissions = await db
      .collection('evaluationSubmissions')
      .where('processed', '==', true)
      .where('processedAt', '<', cutoffDate.toISOString())
      .get();

    const batch = db.batch();
    oldSubmissions.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    return null;
  });
```

---

### **ERROR #8: Tags con Efectos Negativos No Están Balanceados** ⚠️ BAJO

**Ubicación**: `src/lib/performance-tags.ts` líneas 320-507

**Análisis cuantitativo**:
```
Total tags positivos: 35 tags
Total tags negativos: 20 tags
Ratio: 64% positivos, 36% negativos

Efectos promedio:
Positivos: ~+2.1 puntos por tag (suma de effects)
Negativos: ~-1.8 puntos por tag

Tag más fuerte positivo: 'Garra Charrua' (+3 PHY)
Tag más fuerte negativo: 'Espectador de Lujo' (-6 total en 6 atributos)
```

**Tags negativos extremos**:
```typescript
// Tag más punitivo
{
  id: 'miro_el_partido_de_adentro',
  name: 'Espectador de Lujo',
  effects: [
    { attribute: 'pac', change: -1 },
    { attribute: 'sho', change: -1 },
    { attribute: 'pas', change: -1 },
    { attribute: 'dri', change: -1 },
    { attribute: 'def', change: -1 },
    { attribute: 'phy', change: -1 }
  ],  // ❌ -6 puntos totales
  impact: 'negative',
  positions: ['ALL']
}

// Comparar con tag positivo más fuerte
{
  id: 'garra_charrua',
  name: 'Corazón y Garra',
  effects: [{ attribute: 'phy', change: 3 }],  // +3 puntos
  impact: 'positive',
  positions: ['ALL']
}

Ratio: -6 vs +3 = 2:1 desbalanceado
```

**Impacto del desbalance**:
```
Jugador recibe evaluación negativa con 3 tags:
- 'Espectador de Lujo': -6
- 'Se Comió un Elefante': -3 (sho)
- 'Manos de Manteca': -3 (def, solo arquero)
Total: -12 puntos de atributos

Jugador recibe evaluación positiva con 3 tags:
- 'Garra Charrua': +3
- 'La Colgó del Ángulo': +3 (sho) +1 (dri) = +4
- 'Gambeta Endiablada': +3 (dri) +1 (pac) = +4
Total: +11 puntos de atributos

Casi equilibrado en este caso, pero 'Espectador' por sí solo es muy severo
```

**Problema psicológico**:
- Un tag que afecta 6 atributos se siente muy punitivo
- Puede desincentivar a jugadores a aceptar evaluaciones
- "Si tengo un mal partido, pierdo en TODO"

**Solución propuesta - Rebalancear tag extremo**:
```typescript
// ANTES (muy severo)
{
  id: 'miro_el_partido_de_adentro',
  name: 'Espectador de Lujo',
  effects: [
    { attribute: 'pac', change: -1 },
    { attribute: 'sho', change: -1 },
    { attribute: 'pas', change: -1 },
    { attribute: 'dri', change: -1 },
    { attribute: 'def', change: -1 },
    { attribute: 'phy', change: -1 }
  ],
  impact: 'negative',
  positions: ['ALL']
}

// DESPUÉS (más balanceado)
{
  id: 'miro_el_partido_de_adentro',
  name: 'Espectador de Lujo',
  description: 'No participó, estuvo desconectado y no influyó en el juego.',
  effects: [
    { attribute: 'pac', change: -1 },
    { attribute: 'phy', change: -2 }
  ],  // ✅ Total: -3 (equivalente a mejor tag positivo)
  impact: 'negative',
  positions: ['ALL']
}
```

**Solución alternativa - Dividir en múltiples tags**:
```typescript
// Crear tags más específicos
{
  id: 'no_se_movio',
  name: 'Se Quedó Parado',
  description: 'No se mostró como opción de pase, caminó la cancha.',
  effects: [
    { attribute: 'pac', change: -2 },
    { attribute: 'phy', change: -1 }
  ],
  impact: 'negative',
  positions: ['ALL']
},
{
  id: 'desconectado',
  name: 'Desconectado del Juego',
  description: 'No participó en las jugadas del equipo.',
  effects: [
    { attribute: 'pas', change: -2 },
    { attribute: 'dri', change: -1 }
  ],
  impact: 'negative',
  positions: ['ALL']
}
```

---

## 📋 RESUMEN DE PRIORIDADES

### 🔴 Prioridad CRÍTICA (Fix Inmediato)

1. **ERROR #1**: Estado de carga infinito en evaluación por puntos
   - **Impacto**: Los usuarios NO pueden evaluar → bloquea funcionalidad principal
   - **Archivos**: `src/components/perform-evaluation-view.tsx`
   - **Esfuerzo**: 2 horas
   - **Líneas a cambiar**: 45, 133, 313

2. **ERROR #2**: Evaluaciones por tags no se procesan
   - **Impacto**: Pérdida de datos de evaluaciones → afecta OVR calculation
   - **Archivos**: `src/app/matches/[id]/evaluate/page.tsx`
   - **Esfuerzo**: 1 hora
   - **Líneas a cambiar**: 228-237

### 🟡 Prioridad ALTA (Fix en Sprint Actual)

3. **ERROR #3**: Race condition en procesamiento
   - **Impacto**: Evaluaciones duplicadas → datos incorrectos
   - **Archivos**: `src/app/matches/[id]/evaluate/page.tsx`
   - **Esfuerzo**: 4 horas (requiere testing de concurrencia)
   - **Solución**: Implementar transaction lock

4. **ERROR #5**: Assignments status no atómico
   - **Impacto**: Inconsistencias en estado → OVR mal calculado
   - **Archivos**: `src/app/matches/[id]/evaluate/page.tsx`
   - **Esfuerzo**: 3 horas
   - **Solución**: Usar transaction en vez de batch

### 🟢 Prioridad MEDIA (Backlog)

5. **ERROR #4**: Schema no valida tags mínimos
   - **Impacto**: Inconsistencia en validación (no bloquea pero es técnica debt)
   - **Archivos**: `src/components/perform-evaluation-view.tsx`
   - **Esfuerzo**: 2 horas
   - **Solución**: Usar discriminated union en Zod

6. **ERROR #7**: Submissions eliminadas sin backup
   - **Impacto**: Pérdida potencial de datos en caso de error
   - **Archivos**: `src/app/matches/[id]/evaluate/page.tsx`
   - **Esfuerzo**: 1 hora
   - **Solución**: Soft delete

### 🔵 Prioridad BAJA (Nice to Have)

7. **ERROR #6**: Cálculo de averageRating no documentado
   - **Impacto**: Confusión conceptual (no afecta funcionalidad)
   - **Archivos**: `src/app/matches/[id]/evaluate/page.tsx`
   - **Esfuerzo**: 30 minutos
   - **Solución**: Agregar comentarios explicativos

8. **ERROR #8**: Tags negativos desbalanceados
   - **Impacto**: Experiencia de usuario (percepción de injusticia)
   - **Archivos**: `src/lib/performance-tags.ts`
   - **Esfuerzo**: 1 hora
   - **Solución**: Rebalancear efectos del tag "Espectador de Lujo"

---

## 🔧 MEJORAS SUGERIDAS ADICIONALES

### 1. Añadir Retry Logic para Submissions Fallidas
```typescript
// En evaluationSubmissions, agregar campos:
interface EvaluationSubmission {
  evaluatorId: string;
  matchId: string;
  submittedAt: string;
  submission: EvaluationFormData;
  // ✅ Nuevos campos
  retryCount?: number;
  lastAttemptAt?: string;
  lastError?: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
}

// Implementar retry en processPendingSubmissions
if (submission.retryCount && submission.retryCount >= 3) {
  // Mover a dead letter queue
  await addDoc(collection(firestore, 'evaluationSubmissionsDeadLetter'), {
    ...submission,
    failedAt: new Date().toISOString(),
    reason: 'max_retries_exceeded'
  });
  await deleteDoc(submissionDoc.ref);
  continue;
}
```

**Beneficios**:
- Tolerancia a errores temporales
- Visibilidad de problemas recurrentes
- No bloquea el sistema si 1 submission falla

### 2. Implementar Dead Letter Queue

```typescript
// Colección separada para submissions que fallaron múltiples veces
/evaluationSubmissionsDeadLetter/{id}
  - originalSubmissionId: string
  - failedAt: timestamp
  - retryCount: number
  - lastError: string
  - submission: EvaluationFormData

// Dashboard para organizers
"Evaluaciones Fallidas (3)"
- Juan Pérez → Partido 20/10 → Error: "Player not found"
  [Reintentar] [Ver Detalles] [Descartar]
```

**Beneficios**:
- No se pierden datos permanentemente
- Organizers pueden investigar y resolver manualmente
- Métricas de calidad del sistema

### 3. Añadir Audit Logs

```typescript
// Nueva colección
/evaluationAuditLogs/{id}
  - action: 'submit' | 'process' | 'finalize' | 'retry'
  - matchId: string
  - userId: string
  - timestamp: string
  - success: boolean
  - error?: string
  - metadata?: Record<string, any>

// Ejemplo de uso
await addDoc(collection(firestore, 'evaluationAuditLogs'), {
  action: 'process_submissions',
  matchId: match.id,
  userId: user.uid,
  timestamp: new Date().toISOString(),
  success: true,
  metadata: {
    submissionsProcessed: snapshot.size,
    evaluationsCreated: evaluationCount,
    duration: endTime - startTime
  }
});
```

**Beneficios**:
- Trazabilidad completa
- Debugging facilitado
- Compliance y seguridad
- Métricas de performance

### 4. Optimizar Queries con Índices Compuestos

```javascript
// En Firebase Console → Firestore → Indexes
// Crear índices compuestos para queries frecuentes:

// Query: evaluationSubmissions por matchId sin procesar
evaluationSubmissions
  - matchId (Ascending)
  - processed (Ascending)

// Query: assignments por evaluatorId y status
matches/{matchId}/assignments
  - evaluatorId (Ascending)
  - status (Ascending)

// Query: evaluations por matchId y assignmentId
evaluations
  - matchId (Ascending)
  - assignmentId (Ascending)
```

**Beneficios**:
- Queries 10-100x más rápidas
- Menor consumo de reads
- Mejor experiencia de usuario

### 5. Implementar Idempotency Keys

```typescript
// En submissions, usar ID predecible
const submissionId = `${user.uid}_${matchId}_${Date.now()}`;
const submissionRef = doc(firestore, 'evaluationSubmissions', submissionId);

await setDoc(submissionRef, {
  evaluatorId: user.uid,
  matchId,
  submittedAt: new Date().toISOString(),
  submission: data,
});

// Si el usuario hace doble-click, el segundo setDoc sobrescribe el primero
// No se crean submissions duplicadas
```

**Beneficios**:
- Previene duplicados por doble-click
- Retry-safe
- Más predecible

---

## 📊 MÉTRICAS SUGERIDAS PARA MONITOREO

### 1. Tasa de Éxito de Submissions
```typescript
// Tracking
successRate = submissionsProcessed / submissionsCreated

// Objetivo: > 95%
// Alerta si: < 90% en 24 horas
```

### 2. Tiempo Promedio de Procesamiento
```typescript
// Tracking
avgProcessingTime = (sum of processingTime) / count

// Objetivo: < 5 segundos
// Alerta si: > 30 segundos
```

### 3. Rate de Errores por Tipo
```typescript
// Tracking por tipo
errors: {
  validation: 5,
  firestore: 2,
  raceCondition: 1,
  unknown: 3
}

// Alerta si algún tipo > 10% del total
```

### 4. Distribución de evaluationType
```typescript
// Tracking
distribution: {
  points: 75%,
  tags: 25%
}

// Útil para entender preferencias de usuarios
```

### 5. Tiempo Hasta Primera Evaluación
```typescript
// Tracking
timeToFirstEval = evaluationSubmittedAt - matchCompletedAt

// Objetivo: < 24 horas
// Alerta si: > 48 horas
```

### 6. Completitud de Evaluaciones
```typescript
// Tracking
completionRate = (completedAssignments / totalAssignments) * 100

// Objetivo: > 80% (threshold actual)
// Alerta si: < 50%
```

---

## 🧪 TESTS SUGERIDOS

### Tests Unitarios

```typescript
// Test 1: Rating por defecto se establece
describe('PerformEvaluationView', () => {
  it('should initialize rating field with value 5', () => {
    // ...
    expect(form.getValues('evaluations[0].rating')).toBe(5);
  });
});

// Test 2: Validación de tags mínimos
it('should reject tags evaluation with less than 3 tags', () => {
  // ...
  expect(form.formState.errors.evaluations).toBeDefined();
});

// Test 3: Cálculo de OVR
it('should calculate OVR change correctly', () => {
  const change = calculateOvrChange(75, 8.5);
  expect(change).toBeCloseTo(2, 0);
});
```

### Tests de Integración

```typescript
// Test 4: Flujo completo de evaluación
it('should process submission and create evaluation', async () => {
  // 1. Crear submission
  // 2. Ejecutar processPendingSubmissions
  // 3. Verificar que evaluation fue creada
  // 4. Verificar que assignment está completed
  // 5. Verificar que submission fue eliminada
});

// Test 5: Race condition prevention
it('should not process same submission twice', async () => {
  // Ejecutar processPendingSubmissions() simultáneamente 2 veces
  // Verificar que solo se creó 1 evaluation
});
```

### Tests E2E

```typescript
// Test 6: Evaluar por puntos end-to-end
it('should complete points evaluation flow', async () => {
  // 1. Login como jugador
  // 2. Navegar a /evaluations/{matchId}
  // 3. Mover slider a 8
  // 4. Click "Enviar Evaluaciones"
  // 5. Verificar toast de éxito
  // 6. Verificar redirect a /evaluations
});
```

---

## 📚 DOCUMENTACIÓN RECOMENDADA

### Para Developers

```markdown
# Sistema de Evaluaciones

## Flujo de Datos
[Diagrama actualizado con estados y transiciones]

## Esquemas de Validación
[Documentar todos los schemas de Zod]

## Algoritmo de OVR
[Explicar paso a paso con ejemplos]

## Troubleshooting
[Problemas comunes y soluciones]
```

### Para Usuarios

```markdown
# Cómo Evaluar a tus Compañeros

## Evaluación por Puntos
- 1-10: ¿Qué significa cada número?
- Consejos para evaluar objetivamente

## Evaluación por Tags
- ¿Qué son los tags?
- ¿Cómo afectan al jugador?
- Ejemplos de tags positivos y negativos
```

---

## 🎯 CONCLUSIÓN

El sistema de evaluaciones tiene **8 errores identificados**, de los cuales **2 son críticos** y requieren atención inmediata:

1. **ERROR #1** (Crítico): Bloquea la funcionalidad de evaluación por puntos
2. **ERROR #2** (Crítico): Pérdida de datos de evaluaciones por tags

Los otros 6 errores son de prioridad media-baja pero deben ser abordados para garantizar:
- Consistencia de datos
- Tolerancia a fallos
- Experiencia de usuario positiva

**Esfuerzo total estimado**: 14.5 horas de desarrollo + 6 horas de testing = ~20.5 horas

**Recomendación**: Priorizar ERROR #1 y ERROR #2 para el próximo deploy, y abordar ERROR #3 y ERROR #5 en el siguiente sprint.

---

**Generado el**: 22 de Octubre 2025
**Versión**: 1.0
**Autor**: Análisis exhaustivo del sistema de evaluaciones
