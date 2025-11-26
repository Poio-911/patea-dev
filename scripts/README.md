# Scripts de Migración

Este directorio contiene scripts para migrar datos en Firestore.

## migrate-cup-brackets.ts

Migra los brackets de copas existentes para corregir el cálculo de `nextMatchNumber`.

### Problema que soluciona

Las copas creadas antes del fix tenían brackets con `nextMatchNumber: 0` para el primer partido de cada ronda, lo cual causaba el error "No next match defined" al intentar avanzar ganadores.

### Qué hace el script

1. Busca todas las copas en Firestore
2. Identifica las que tienen `nextMatchNumber: 0` (brackets corruptos)
3. Recalcula correctamente los `nextMatchNumber` usando: `Math.ceil(matchNumber / 2)`
4. Actualiza los documentos en Firestore

### Cómo ejecutar

```bash
npm run migrate:cups
```

### Salida esperada

```
[Migration] Starting cup bracket migration...

[Migration] Found 3 cups

[Migration] Processing cup: Copa de Verano
  → Fixing 3 bracket matches
    Match 1 (semifinals): 0 → 1
    Match 2 (semifinals): 0 → 1
  ✅ Successfully migrated

[Migration] Processing cup: Copa Amigos
  ✓ Skipping - Bracket already correct

========================================
Migration Complete
========================================
Total cups: 3
✅ Migrated: 1
⚠️  Skipped: 2
❌ Errors: 0
========================================
```

### Seguridad

- El script solo actualiza copas que tienen `nextMatchNumber: 0`
- Agrega un campo `migratedAt` con timestamp
- Las copas ya correctas no se modifican
- No afecta otros datos de la copa (equipos, partidos, etc.)

### Reversión

Si algo sale mal, podés restaurar desde un backup de Firestore o recrear las copas afectadas.
