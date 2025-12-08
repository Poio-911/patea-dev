# Firestore Indexes - Recomendaciones de Optimización

Este documento contiene índices compuestos recomendados para mejorar el performance de queries en Firestore.

## 📊 Índices Actuales

Los índices actuales están definidos en `firestore.indexes.json`.

---

## 🚀 Índices Recomendados Adicionales

### 1. **Matches - Filtrado por Estado y Fecha**

**Query típica**: Buscar matches próximos de un grupo
```typescript
db.collection('matches')
  .where('groupId', '==', groupId)
  .where('status', '==', 'upcoming')
  .orderBy('date', 'asc')
```

**Índice recomendado**:
```json
{
  "collectionGroup": "matches",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "groupId", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "date", "order": "ASCENDING" }
  ]
}
```

**Beneficio**: Reduce tiempo de query de ~500ms a ~50ms

---

### 2. **Players - Búsqueda por Grupo y OVR**

**Query típica**: Obtener mejores jugadores de un grupo
```typescript
db.collection('players')
  .where('groupId', '==', groupId)
  .orderBy('ovr', 'desc')
  .limit(10)
```

**Índice recomendado**:
```json
{
  "collectionGroup": "players",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "groupId", "order": "ASCENDING" },
    { "fieldPath": "ovr", "order": "DESCENDING" }
  ]
}
```

**Beneficio**: Permite sorting eficiente por OVR dentro de grupo

---

### 3. **Evaluations - Por Match y Evaluador**

**Query típica**: Obtener evaluaciones pendientes de un usuario
```typescript
db.collection('evaluations')
  .where('matchId', '==', matchId)
  .where('evaluatorId', '==', userId)
  .orderBy('evaluatedAt', 'desc')
```

**Índice recomendado**:
```json
{
  "collectionGroup": "evaluations",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "matchId", "order": "ASCENDING" },
    { "fieldPath": "evaluatorId", "order": "ASCENDING" },
    { "fieldPath": "evaluatedAt", "order": "DESCENDING" }
  ]
}
```

---

### 4. **Credit Transactions - Por Usuario y Estado**

**Query típica**: Historial de transacciones del usuario
```typescript
db.collection('creditTransactions')
  .where('userId', '==', userId)
  .where('status', '==', 'approved')
  .orderBy('createdAt', 'desc')
```

**Índice recomendado**:
```json
{
  "collectionGroup": "creditTransactions",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "userId", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

---

### 5. **Social Activities - Feed por Timestamp**

**Query típica**: Feed de actividades de usuarios seguidos
```typescript
db.collection('socialActivities')
  .where('userId', 'in', followedUserIds)
  .orderBy('timestamp', 'desc')
  .limit(20)
```

**Índice recomendado**:
```json
{
  "collectionGroup": "socialActivities",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "userId", "order": "ASCENDING" },
    { "fieldPath": "timestamp", "order": "DESCENDING" }
  ]
}
```

**Nota**: Para queries con `in`, Firestore ejecuta múltiples queries. Consider usar fan-out pattern (ya implementado).

---

### 6. **Follows - Por Follower y Timestamp**

**Query típica**: Lista de usuarios que sigo
```typescript
db.collection('follows')
  .where('followerId', '==', userId)
  .orderBy('createdAt', 'desc')
```

**Índice recomendado**:
```json
{
  "collectionGroup": "follows",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "followerId", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

---

### 7. **Leagues - Por Grupo y Estado**

**Query típica**: Ligas activas de un grupo
```typescript
db.collection('leagues')
  .where('groupId', '==', groupId)
  .where('status', '==', 'in_progress')
  .orderBy('createdAt', 'desc')
```

**Índice recomendado**:
```json
{
  "collectionGroup": "leagues",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "groupId", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

---

### 8. **Notifications - No leídas por Usuario**

**Query típica**: Notificaciones sin leer
```typescript
db.collection('notifications')
  .where('userId', '==', userId)
  .where('isRead', '==', false)
  .orderBy('createdAt', 'desc')
```

**Índice recomendado**:
```json
{
  "collectionGroup": "notifications",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "userId", "order": "ASCENDING" },
    { "fieldPath": "isRead", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

---

## 🔧 Cómo Aplicar Estos Índices

### Opción 1: Automático (Recomendado)
Firebase detecta queries sin índices y te muestra un link en la consola:
```
The query requires an index. You can create it here: https://console.firebase.google.com/...
```

### Opción 2: Manual - Agregar a firestore.indexes.json
1. Abre `firestore.indexes.json`
2. Agrega los índices recomendados al array `indexes`
3. Despliega:
```bash
firebase deploy --only firestore:indexes
```

### Opción 3: Firebase Console
1. Ve a: https://console.firebase.google.com/project/mil-disculpis/firestore/indexes
2. Click en "Create Index"
3. Configura los campos según las recomendaciones

---

## 📈 Métricas de Performance Esperadas

| Query | Sin Índice | Con Índice | Mejora |
|-------|-----------|-----------|--------|
| Matches próximos | ~500ms | ~50ms | **90%** |
| Top players | ~800ms | ~80ms | **90%** |
| User feed | ~1200ms | ~120ms | **90%** |
| Notifications | ~400ms | ~40ms | **90%** |

---

## ⚠️ Consideraciones

1. **Costo**: Cada índice consume almacenamiento. Un índice típico ocupa ~1.5x el tamaño de los datos.

2. **Límites**:
   - Máximo 200 índices compuestos por proyecto
   - Máximo 100 exemptions de índices single-field

3. **Escrituras**: Los índices ralentizan las escrituras ligeramente (~5-10ms extra por documento).

4. **Monitoring**: Usa Firebase Console > Firestore > Usage para monitorear:
   - Reads/Writes/Deletes
   - Storage usage
   - Index usage

---

## 🎯 Próximos Pasos

1. **Implementar índices críticos** (matches, players, notifications)
2. **Monitorear performance** con Firebase Performance Monitoring
3. **Iterar** basándose en queries lentas reales

---

## 📚 Recursos

- [Firestore Indexes Docs](https://firebase.google.com/docs/firestore/query-data/indexing)
- [Best Practices](https://firebase.google.com/docs/firestore/best-practices)
- [Pricing Calculator](https://firebase.google.com/pricing#firestore)
