# Grupos y Equipos

## Descripción General
Sistema de grupos colaborativos donde usuarios se organizan en comunidades, y pueden crear equipos persistentes con roster y jersey personalizado.

## Rutas
- `/groups` - Mis grupos
- `/groups/[id]` - Vista del grupo
- `/groups/create` - Crear grupo

## Grupos

### Funcionalidad
- Comunidad de jugadores
- Partidos, ligas, copas ocurren dentro de un grupo
- Cada usuario puede estar en múltiples grupos
- Un "grupo activo" a la vez

### Componentes
- **GroupCard**: Vista compacta
- **GroupDetailView**: Info completa, miembros, teams
- **CreateGroupDialog**: Nombre, descripción
- **InvitePlayerDialog**: Compartir código de invitación

### Invite System
- Código de 6 caracteres único
- Se comparte vía link o texto
- Usuario ingresa código para unirse

### Server Actions
```typescript
createGroupAction(name, description)
updateGroupAction(groupId, updates)
deleteGroupAction(groupId)
joinGroupAction(inviteCode)
leaveGroupAction(groupId)
setActiveGroupAction(groupId)
```

## Equipos Persistentes (Teams)

### Diferencia con Teams de Partido
- **Equipo de Partido**: Temporal, generado por IA para un match
- **Team Persistente**: Permanente, nombre, jersey, roster

### Usar Teams Para
- Rivalidades recurrentes
- Partidos "By Teams"
- Ligas y copas
- Identidad de grupo

### Componentes
- **CreateTeamDialog**: Nombre, jersey, roster
- **TeamRosterPlayer**: Jugador con número y status (titular/suplente)
- **TeamDetailDialog**: Ver detalles del team
- **JerseyDesigner**: Personalizar colores y patrón

### Jersey Customization
Patrones disponibles:
- Plain (color sólido)
- Vertical (rayas verticales)
- Band (franja horizontal)
- Chevron (V invertida)
- Thirds (tercios)
- Lines (líneas finas)

### Server Actions
```typescript
createTeamAction(groupId, teamData)
updateTeamAction(teamId, updates)
deleteTeamAction(teamId)
addPlayerToTeamAction(teamId, playerId, number, status)
removePlayerFromTeamAction(teamId, playerId)
```

## Modelos de Datos

### Group
```typescript
{
  id: string;
  name: string;
  description?: string;
  ownerUid: string;
  inviteCode: string;  // 6 chars, unique
  members: string[];  // User UIDs
  createdAt: string;
  summary?: string;  // AI-generated
}
```

### GroupTeam
```typescript
{
  id: string;
  name: string;
  groupId: string;
  jersey: {
    type: JerseyType;
    primaryColor: string;
    secondaryColor: string;
  };
  members: Array<{
    playerId: string;
    number: number;  // Camiseta
    status: 'titular' | 'suplente';
  }>;
  createdBy: string;
  isChallengeable: boolean;  // Para desafíos externos
}
```

## AI Flow Integrado

### generate-group-summary
- Genera descripción del grupo
- Basado en miembros, stats, actividad
- Se actualiza periódicamente

## Características

### Active Group Switcher
- Dropdown en navbar
- Cambia contexto de toda la app
- Persiste en localStorage

### Member Management
- Solo owner puede expulsar miembros
- Cualquier miembro puede invitar
- Auto-leave si grupo se elimina

### Team Availability Posts
- Equipos pueden publicar disponibilidad
- Otros grupos pueden desafiar
- Sistema de match-making

## Navegación
- Desde Dashboard → Grupo activo
- Desde Navbar → Cambiar grupo
- Desde Settings → Gestionar grupos

## Permisos

### Owner del Grupo
- Editar, eliminar grupo
- Expulsar miembros
- Gestionar invitaciones

### Miembro Regular
- Ver grupo
- Crear teams
- Invitar jugadores

### No Miembro
- Solo ve grupos públicos (futuro)

## Próximas Mejoras
- [ ] Grupos públicos/privados
- [ ] Roles (admin, moderador, miembro)
- [ ] Group chat
- [ ] Stats agregadas del grupo
- [ ] Leaderboards internos
