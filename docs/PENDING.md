# Documentación Pendiente - Guía de Completación

Este documento lista la documentación que falta crear y proporciona templates para completarla de forma consistente.

## ✅ Documentos Completados (5/21)

### Master Docs
- [x] `README.md` - Índice maestro y overview
- [x] `ai-flows/README.md` - Índice de flujos de IA

### AI Flows (2/12)
- [x] `ai-flows/generate-balanced-teams.md`
- [x] `ai-flows/suggest-player-improvements.md`

### Sections (1/8)
- [x] `sections/01-dashboard.md`

---

## ⏳ Documentación Pendiente

### AI Flows (10 restantes)

#### Análisis de Jugadores
- [ ] `analyze-player-progression.md`
- [ ] `detect-player-patterns.md`

#### Búsqueda
- [ ] `find-best-fit-player.md`

#### Asistencia
- [ ] `coach-conversation.md`
- [ ] `get-app-help.md`

#### Partidos
- [ ] `get-match-day-forecast.md`
- [ ] `generate-match-chronicle.md`

#### Generación Visual
- [ ] `generate-duo-image.md`
- [ ] `generate-player-card-image.md`
- [ ] `generate-group-summary.md`

### Secciones (7 restantes)

- [ ] `02-players.md` - Sistema de jugadores
- [ ] `03-matches.md` - Gestión de partidos
- [ ] `04-competitions.md` - Ligas y copas
- [ ] `05-groups-teams.md` - Grupos y equipos
- [ ] `06-health-fitness.md` - Integración Google Fit
- [ ] `07-social.md` - Feed social
- [ ] `08-auth-settings.md` - Autenticación

---

## 📋 Template para AI Flows

Copiar y adaptar esta estructura:

```markdown
# [nombre-del-flow]

## Propósito
[Qué problema resuelve]

## Modelo AI
- **Modelo**: googleai/gemini-2.5-flash (o específico)
- **Tono**: [directo/motivador/analítico]

## Input Schema
\`\`\`typescript
{
  // Tipos TypeScript del input
}
\`\`\`

## Output Schema
\`\`\`typescript
{
  // Tipos TypeScript del output
}
\`\`\`

## Estrategia de Prompt
[Cómo funciona el prompt]

## Ejemplos de Uso
### Ejemplo 1
**Input:** [JSON example]
**Output:** [JSON example]

## Integración en la Aplicación
### Dónde se usa
1. [Componente/vista donde se usa]
2. [Server action que lo llama]

### Flujo de Usuario
[Paso a paso de cómo el usuario lo activa]

## Manejo de Errores
[Errores comunes y cómo se manejan]

## Métricas
- Tiempo promedio: X segundos
- Tasa de éxito: X%

## Mejoras Futuras
- [ ] Idea 1
- [ ] Idea 2
```

---

## 📋 Template para Secciones

```markdown
# [Nombre de la Sección]

## Descripción General
[Qué hace esta sección]

## Ruta(s)
- `/ruta-principal`
- `/ruta/[param]`

## Componentes Principales
### 1. ComponenteName
[Descripción]

### 2. OtroComponente
[Descripción]

## Flujos de IA Integrados
### flow-name
**Usado en**: [Dónde]
- [Cómo se activa]

## Server Actions Utilizados
\`\`\`typescript
actionName(params: Type)
\`\`\`

## Modelos de Datos
\`\`\`typescript
interface DataModel {
  // Estructura Firestore
}
\`\`\`

## Características Especiales
[Features únicos de esta sección]

## Navegación
### Desde aquí hacia:
[Links]

### Hacia aquí desde:
[Links]

## Responsive Design
- Desktop: [Comportamiento]
- Mobile: [Comportamiento]

## Permisos y Roles
[Quién puede acceder]

## Código Relevante
- Página: `src/app/.../page.tsx`
- Componentes: `src/components/...`
- Actions: `src/lib/actions/...`
```

---

## 🔑 Información Clave por Sección

### 02-players.md
**Foco**: CRUD de jugadores, sistema de atributos, evaluaciones, progresión
**AI Flows**: suggest-player-improvements, analyze-player-progression, detect-player-patterns
**Componentes clave**: PlayerCard, PlayerDetailCard, EditPlayerDialog, PlayerProgressionView

### 03-matches.md
**Foco**: Calendario, creación de partidos, equipos, evaluación post-partido
**AI Flows**: generate-balanced-teams, get-match-day-forecast, generate-match-chronicle
**Componentes clave**: MatchCard, AddMatchDialog, PerformEvaluationView, MatchDetailsDialog

### 04-competitions.md
**Foco**: Ligas (tabla, fixtures), Copas (brackets), aplicaciones, resultados
**AI Flows**: Ninguno directo
**Componentes clave**: LeagueStandingsTable, CupBracket, ApplicationsManager

### 05-groups-teams.md
**Foco**: Gestión de grupos, teams dentro de grupos, invitaciones, roster
**AI Flows**: generate-group-summary
**Componentes clave**: CreateTeamDialog, InvitePlayerDialog, TeamRosterPlayer

### 06-health-fitness.md
**Foco**: Integración Google Fit, linking de actividades, impacto en atributos
**AI Flows**: Ninguno
**Componentes clave**: LinkGoogleFitButton, ImportActivityDialog
**Server Actions**: google-fit-actions.ts (TODO en su propio archivo)

### 07-social.md
**Foco**: Feed de actividad, follows, interacciones sociales
**AI Flows**: Ninguno
**Componentes clave**: SocialFeed, FollowButton, ActivityCard

### 08-auth-settings.md
**Foco**: Login, registro, perfil, preferencias, tema
**AI Flows**: get-app-help (ayuda contextual)
**Componentes clave**: LoginForm, RegisterForm, SettingsSheet

---

## 🎯 Prioridad de Completación

### Alta Prioridad (Core Features)
1. `02-players.md`
2. `03-matches.md`  
3. `detect-player-patterns.md`
4. `coach-conversation.md`

### Media Prioridad
5. `04-competitions.md`
6. `05-groups-teams.md`
7. `generate-match-chronicle.md`
8. `find-best-fit-player.md`

### Baja Prioridad (Nice to Have)
9. Resto de AI flows de generación visual
10. `06-health-fitness.md`
11. `07-social.md`
12. `08-auth-settings.md`

---

## 📊 Progreso Total

- **Completado**: 5/21 (24%)
- **Restante**: 16 documentos
- **Tiempo estimado**: 3-4 horas para completar todo

---

## ✍️ Notas para Documentadores

1. **Consistencia**: Seguir los templates estrictamente
2. **Ejemplos Reales**: Usar datos de la app real, no inventados
3. **Code References**: Incluir rutas exactas a archivos
4. **Screenshots**: Considerar añadir capturas donde sea relevante
5. **Links Internos**: Referenciar otros documentos cuando sea apropiado
6. **Actualización**: Mantener sincronizado con cambios en el código

---

## 🚀 Siguientes Pasos

1. Completar los 4 docs de alta prioridad
2. Revisar y validar con el equipo
3. Completar documentación de prioridad media
4. Añadir diagramas y flowcharts si es necesario
5. Publicar en wiki interna o Notion
