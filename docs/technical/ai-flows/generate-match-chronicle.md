# generate-match-chronicle

## Propósito
Genera una crónica periodística estilo "minuto a minuto" de un partido finalizado, con tono apasionado y futbolero.

## Modelo AI
- **Modelo**: `googleai/gemini-2.5-flash`
- **Rol**: Cronista deportivo (estilo Victor Hugo Morales, Bambino Pons)

## Input Schema
```typescript
{
  matchTitle: string;
  team1Name: string;
  team1Score: number;
  team2Name: string;
  team2Score: number;
  mvp: {
    name: string;
    reason: string;
  };
  keyEvents: Array<{
    minute: number;
    playerName: string;
    description: string;
    relatedPlayerName?: string;  // Para asistencias
  }>;
}
```

## Output Schema
```typescript
{
  headline: string;  // Titular potente y periodístico
  introduction: string;  // Párrafo inicial con color
  keyMoments: string;  // Narración de eventos clave
  conclusion: string;  // Cierre con mención al MVP
}
```

## Estilo
- Lenguaje apasionado y futbolero argentino/uruguayo
- Formato "Min X': ¡DESCRIPCIÓN!"
- No inventar, basarse solo en datos provistos
- Elegir 3-4 eventos más importantes

## Usado En
- MatchChronicleCard - Muestra crónica post-partido
- Match Details View - Tab "Crónica"
- `generateMatchChronicleAction(matchId)`

## Ejemplo
```javascript
// Output:
{
  headline: "¡ÉPICO! Los Sin Chaleco se llevaron el clásico 3-2",
  introduction:  "En un partido vibrante que tuvo de todo, Los Sin Chaleco vencieron 3-2 a Los Con Chaleco en un partidazo que se definió sobre la hora.",
  keyMoments: "Min 12': ¡GOLAZO de Juan! La colgó del ángulo, imposible para el arquero...",
  conclusion: "Un partidazo que quedará en el recuerdo. MVP indiscutido: Juan, con 2 goles y una asistencia."
}
```
