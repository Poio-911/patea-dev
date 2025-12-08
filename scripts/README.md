# Scripts de Migración y Setup

Este directorio contiene scripts one-time para inicializar datos y migrar estructuras existentes en Firestore.

## ⚠️ Importante

- Estos scripts son **one-time utilities** para tareas específicas
- **NO deben ejecutarse automáticamente** en producción
- Solo ejecutar cuando sea necesario y con supervisión
- Requieren variables de entorno de `.env.local`
- Se conectan directamente a **producción** (emulators deshabilitados)

---

## Scripts Disponibles

### 1. init-credit-packages.ts

**Tipo**: Setup inicial
**Estado**: ✅ Legacy - Solo ejecutar UNA vez en setup inicial

Inicializa la colección `creditPackages` en Firestore con los 4 paquetes de créditos disponibles para compra.

#### Paquetes creados

| ID | Título | Créditos | Precio (ARS) | Descuento | Popular |
|----|--------|----------|--------------|-----------|---------|
| `package_10` | Paquete Básico | 10 | $500 | 0% | No |
| `package_25` | Paquete Intermedio | 25 | $1000 | 20% | **Sí** |
| `package_50` | Paquete Avanzado | 50 | $1750 | 30% | No |
| `package_100` | Paquete Premium | 100 | $3000 | 40% | No |

#### Cuándo ejecutar

- **Una sola vez** al configurar el proyecto por primera vez
- Solo si la colección `creditPackages` está vacía
- **NO ejecutar si los paquetes ya existen** (sobrescribirá con IDs determinísticos)

#### Cómo ejecutar

```bash
npm run init:packages
```

#### Salida esperada

```
🚀 Iniciando creación de paquetes de créditos...

✅ Creado: Paquete Básico
   - Créditos: 10
   - Precio: $500
   - Descuento: 0%
   - Popular: No

✅ Creado: Paquete Intermedio
   - Créditos: 25
   - Precio: $1000
   - Descuento: 20%
   - Popular: Sí

[...]

✅ Todos los paquetes de créditos fueron creados exitosamente!

📦 Resumen:
   - Total de paquetes: 4
   - Precio mínimo: $500
   - Precio máximo: $3000
   - Créditos totales disponibles: 185

🎉 Script completado!
```

#### Seguridad

- Usa document IDs determinísticos (`package_10`, `package_25`, etc.)
- No borra paquetes existentes, solo los sobrescribe
- Los usuarios con transacciones existentes no se ven afectados
- Para modificar precios en producción, **editar directamente en Firebase Console**

---

### 2. migrate-cup-brackets.ts

**Tipo**: Migración de datos
**Estado**: ✅ Legacy - Ya ejecutado en producción

Migra los brackets de copas existentes para corregir el cálculo de `nextMatchNumber`.

#### Problema que soluciona

Las copas creadas antes del fix tenían brackets con `nextMatchNumber: 0` para el primer partido de cada ronda, lo cual causaba el error "No next match defined" al intentar avanzar ganadores.

#### Qué hace el script

1. Busca todas las copas en Firestore
2. Identifica las que tienen `nextMatchNumber: 0` (brackets corruptos)
3. Recalcula correctamente los `nextMatchNumber` usando: `Math.ceil(matchNumber / 2)`
4. Actualiza los documentos en Firestore

#### Cuándo ejecutar

- Solo si hay copas existentes con bracket corrupto
- **NO ejecutar si no hay copas con problemas** (el script lo detecta automáticamente)
- Seguro ejecutar múltiples veces (detecta qué copas ya están corregidas)

#### Cómo ejecutar

```bash
npm run migrate:cups
```

#### Salida esperada

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

#### Seguridad

- El script solo actualiza copas que tienen `nextMatchNumber: 0`
- Agrega un campo `migratedAt` con timestamp
- Las copas ya correctas no se modifican
- No afecta otros datos de la copa (equipos, partidos, etc.)

#### Reversión

Si algo sale mal, podés restaurar desde un backup de Firestore o recrear las copas afectadas.

---

## Requisitos de Entorno

Todos los scripts requieren las siguientes variables en `.env.local`:

```bash
# Firebase Admin SDK
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}

# Storage (solo para migrate-cup-brackets)
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=mil-disculpis.appspot.com
```

### Cómo obtener la Service Account Key

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto
3. Settings → Service Accounts
4. Click "Generate New Private Key"
5. Copia el JSON completo a `FIREBASE_SERVICE_ACCOUNT_KEY` (una sola línea)

---

## Troubleshooting

### Error: "FIREBASE_SERVICE_ACCOUNT_KEY no encontrada"

- Verifica que `.env.local` existe en la raíz del proyecto
- Asegúrate que la variable está en una sola línea (sin saltos de línea)
- Verifica que el JSON es válido

### Error: "Could not initialize Firebase Admin SDK"

- El JSON de la service account está malformado
- Falta algún campo requerido (`project_id`, `private_key`, etc.)

### Error: "Emulator connection refused"

- Los scripts deshabilitan emulators automáticamente
- Si persiste, verifica que no hay `FIRESTORE_EMULATOR_HOST` en tu entorno

### Los cambios no se reflejan en la app

- Verifica que estás conectado a producción (no emulators)
- Revisa Firebase Console para confirmar los cambios
- Limpia el caché del navegador (Ctrl+Shift+R)
