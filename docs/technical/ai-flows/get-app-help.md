# get-app-help

## Propósito
Asistente de ayuda contextual que responde preguntas sobre cómo usar la aplicación Pateá.

## Modelo AI
- **Modelo**: `googleai/gemini-2.5-flash`
- **Nombre**: "Pateá Assistant"
- **Idioma**: Español rioplatense

## Input Schema
```typescript
{
  userMessage: string;
  conversationHistory?: Array<{
    role: 'user' | 'agent';
    content: string;
  }>;
}
```

## Output Schema
```typescript
{
  response: string;  // Respuesta concisa y clara
}
```

## Documentación Interna
El prompt incluye documentación completa de:
- Conceptos core (Grupos, Jugadores, OVR)
- Feature: Grupos e invite codes
- Feature: Teams persistentes
- Feature: Matches (Manual, Collaborative, By Teams)
- Feature: Evaluaciones y progresión
- Feature: Buscar partidos/jugadores
- Feature: AI Chat y análisis

## Usado En
- HelpChatDialog - Dialog de ayuda principal
- SettingsSheet - Link a ayuda
- `getAppHelpAction(userMessage, history)`

## Ejemplos
**Q**: "¿Cómo creo un partido?"
**A**: "Para crear un partido, andá a la sección 'Partidos' y tocá el botón '+'. Podés elegir 3 tipos: Manual (vos elegís todos los jugadores), Colaborativo (otros se suman), o Por Equipos (entre dos equipos del grupo)."

**Q**: "¿Por qué no sube mi OVR?"
**A**: "Tu OVR solo cambia cuando el organizador del partido finaliza las evaluaciones. Primero todos evalúan a sus compañeros, y recién cuando hay suficientes evaluaciones, el organizador cierra el proceso y ahí se actualizan los atributos."
