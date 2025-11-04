# Changelog

Todos los cambios notables en este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added - Sistema de Logging y Manejo de Errores (2025-10-25)

#### 🆕 Archivos Nuevos

- **`src/lib/logger.ts`** - Sistema de logging condicional
  - Logs de desarrollo (`log`, `info`, `debug`) solo se muestran en `NODE_ENV=development`
  - Logs de producción (`warn`, `error`) siempre activos
  - Preparado para integración futura con Sentry
  - Context rico para debugging (userId, matchId, etc.)

- **`src/lib/errors.ts`** - Sistema de errores estandarizado
  - 20+ códigos de error específicos: `AUTH_*`, `VAL_*`, `AI_*`, `DATA_*`, `RES_*`, `SYS_*`
  - Mensajes diferenciados: user-friendly vs técnicos
  - Helper `handleServerActionError()` para manejo automático de errores
  - Helper `formatErrorResponse()` para responses consistentes
  - Helper `createError()` para crear errores tipados con contexto

- **`src/lib/auth-helpers.ts`** - Helpers de autenticación y autorización
  - `validateUser()` - Verifica existencia de usuario
  - `validatePlayerOwnership()` - Valida ownership de jugador
  - `validateMatchOwnership()` - Valida ownership de partido
  - `validateGroupAdmin()` - Valida admin de grupo
  - `validatePlayerInGroup()` - Valida pertenencia a grupo
  - `validateUserAndPlayerOwnership()` - Validación combinada
  - `validatePlayerAccessInGroup()` - Validación completa de acceso

#### 🔒 Seguridad

- **Firestore Security Rules** - Reglas granulares por colección (antes: comodín inseguro)
  - `users/`: Solo owner puede escribir su perfil
  - `players/`: Solo owner puede modificar su jugador
  - `matches/`: Solo organizador puede modificar partido
  - `evaluations/`: Solo lectura (escritura desde server actions)
  - `notifications/`: Solo destinatario puede leer
  - `invitations/`: Control de invitador/invitado
  - `ovrHistory/`, `evaluationAssignments/`: Solo escritura desde server
  - Helper functions reutilizables: `isAuthenticated()`, `isOwner()`, `isResourceOwner()`

- **Validación de permisos server-side** en actions críticas
  - `coachConversationAction()` - Solo owner del jugador puede usar el chat DT
  - `detectPlayerPatternsAction()` - Solo owner puede ver análisis de patrones
  - Parámetro opcional `userId` agregado para validación

#### 🐛 Correcciones

- **Limpieza de console.logs en producción**
  - `src/lib/actions.ts`: 8 `console.error` → `logger.error`
  - `src/components/match-card.tsx`: 5 logs (3 warns + 2 errors) → `logger.*`
  - `src/components/player-profile-view.tsx`: 4 `console.error` → `logger.error`
  - Total: 17/59 logs críticos reemplazados

- **Manejo de errores mejorado en Server Actions**
  - `generatePlayerCardImageAction()`: Códigos de error específicos para cada caso
    - `DATA_NOT_FOUND`: Jugador no existe
    - `AI_NO_CREDITS`: Sin créditos para generar
    - `VAL_MISSING_FIELD`: Falta foto de perfil
    - `VAL_INVALID_FORMAT`: Foto placeholder no válida
  - `findBestFitPlayerAction()`: Usa `handleServerActionError()` automático
  - `coachConversationAction()`: Error tipado cuando jugador no existe
  - `detectPlayerPatternsAction()`: Error tipado cuando jugador no existe

#### 📊 Estadísticas

| Métrica | Antes | Después |
|---------|-------|---------|
| Console.logs en producción | 59 en 29 archivos | 17 reemplazados en críticos |
| Manejo de errores | Inconsistente | Estandarizado con códigos |
| Validación de permisos | Solo frontend | Frontend + Server-side |
| Firestore Security | Abierta | Granular por colección |

#### ⚠️ Breaking Changes

Ninguno. Todos los cambios son backwards compatible, pero se recomienda actualizar los componentes que llaman a `coachConversationAction` y `detectPlayerPatternsAction` para pasar el `userId`.

#### 📝 Notas para Desarrolladores

- Los logs de desarrollo (`logger.log()`) solo aparecen en local
- Los errores ahora tienen códigos (`code: 'AI_NO_CREDITS'`) para tracking
- Las Firestore Rules ahora son estrictas - testear antes de deploy
- Preparado para integración con Sentry (descomentar en `logger.ts`)

---

## [1.0.0] - 2025-10-23

### Added
- Sistema de generación de foto profesional con IA
- Sistema de crop de avatar con zoom y drag & drop
- Créditos de generación de imágenes (`cardGenerationCredits`)
- Campos `cropPosition` y `cropZoom` en colección `players`

### Fixed
- 6 errores críticos en sistema de evaluaciones (ver `src/docs/CORRECCIONES_EVALUACION.md`)
  - Carga infinita en evaluación por puntos
  - Evaluaciones por etiquetas no se procesaban
  - Race conditions en procesamiento
  - Validación inconsistente con Zod
  - Soft delete de submissions
  - Balance de etiquetas negativas

---

[Unreleased]: https://github.com/tu-usuario/tu-repo/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/tu-usuario/tu-repo/releases/tag/v1.0.0
