# Competiciones - Ligas y Copas

## Descripción General
Sistema de competiciones formales con ligas (tabla de posiciones) y copas (bracket eliminatorio).

## Rutas
- `/competitions` - Lista de competiciones
- `/competitions/leagues/[id]` - Vista de liga
- `/competitions/cups/[id]` - Vista de copa

## Tipos de Competición

### Ligas
- **Formato**: Todos contra todos (ida y/o vuelta)
- **Tabla**: Puntos, PJ, PG, PE, PP, GF, GC, DG
- **Criterios**: Pts → DG → GF
- **Final**: Opcional (1° vs 2°)

### Copas
- **Formato**: Eliminación directa
- **Bracket**: Visual de llaves
- **Seeding**: Manual, Random, By OVR
- **Stages**: Cuartos, Semis, Final

## Componentes

### CompetitionCard
- Tipo, nombre, status
- Participantes
- Fecha inicio/fin

### LeagueStandingsTable
- Tabla ordenada de posiciones
- Color coding (top, medio, descenso)
- Click para ver equipo

### CupBracketView
- Visual de llaves eliminatorias
- Resultados por ronda
- Winner destacado

### ApplicationsManager
- Lista de aplicaciones
- Aprobar/rechazar equipos
- Límite de participantes

## Server Actions

```typescript
createLeagueAction(leagueData)
createCupAction(cupData)
applyToCompetitionAction(competitionId, teamId)
approveApplicationAction(applicationId)
generateFixturesAction(leagueId)  // Auto-genera partidos
generateBracketAction(cupId)  // Auto-genera llaves
updateStandingsAction(leagueId)  // Tras cada partido
advanceBracketAction(cupId, matchId, winnerId)
```

## Modelos de Datos

### League
```typescript
{
  id: string;
  name: string;
  groupId: string;
  format: 'single' | 'double';  // Ida o ida-vuelta
  status: 'draft' | 'active' | 'completed';
  participants: string[];  // Team IDs
  standings: Array<{
    teamId: string;
    points: number;
    played: number;
    won: number;
    drawn: number;
    lost: number;
    goalsFor: number;
    goalsAgainst: number;
  }>;
  hasFinal: boolean;
  finalMatchId?: string;
}
```

### Cup
```typescript
{
  id: string;
  name: string;
  groupId: string;
  format: 'knockout';
  seedingType: 'manual' | 'random' | 'by_ovr';
  status: 'draft' | 'active' | 'completed';
  participants: string[];
  bracket: {
    quarterfinals: BracketMatch[];
    semifinals: BracketMatch[];
    final: BracketMatch;
  };
  winnerId?: string;
}
```

## Flujo de Vida

### Liga
1. Crear liga → Status: draft
2. Equipos aplican
3. Organizador aprueba participantes
4. Auto-generar fixtures (partidos)
5. Activar liga → Status: active
6. Partidos se juegan
7. Tabla se actualiza automáticamente
8. Liga finaliza → Status: completed
9. Opcional: Final entre 1° y 2°

### Copa
1. Crear copa → Status: draft
2. Equipos aplican
3. Organizador aprueba (debe ser potencia de 2)
4. Seleccionar seeding
5. Auto-generar bracket
6. Activar copa → Status: active
7. Partidos eliminatorios
8. Ganadores avanzan automáticamente
9. Copa finaliza cuando hay campeón

## Características

### Auto-Generación de Fixtures
- Algoritmo round-robin para ligas
- Considera disponibilidad de canchas
- Distribuye partidos en el tiempo

### Actualización Automática
- Tabla de liga se actualiza tras cada partido
- Bracket avanza al ingresar resultado
- Notificaciones a participantes

### Aplicaciones
- Sistema de apply/approve
- Límite de participantes
- Deadline de inscripción

## No Tiene AI Flows
Las competiciones usan lógica algorítmica estándar, no requieren IA.

## Próximas Mejoras
- [ ] Playoffs al estilo NBA
- [ ] Grupos + eliminación (estilo Copa del Mundo)
- [ ] Ascenso/Descenso entre ligas
- [ ] Stats aggregadas de competición
- [ ] Trofeos y badges digitales
