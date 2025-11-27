# get-match-day-forecast

## Propósito
Obtiene un pronóstico meteorológico simple para el día y ubicación de un partido programado.

## Modelo AI
- **Modelo**: `googleai/gemini-2.5-flash`
- **Rol**: Asistente meteorológico

## Input Schema
```typescript
{
  location: string;  // Dirección o nombre del lugar
  date: string;      // ISO date string
}
```

## Output Schema
```typescript
{
  description: string;  // 2-3 palabras (ej: "Parcialmente Nublado")
  icon: 'Sun' | 'Cloud' | 'Cloudy' | 'CloudRain' | 'CloudSnow' | 'Wind' | 'Zap';
  temperature: number;  // En grados Celsius
}
```

## Usado En
- AddMatchDialog - Al crear partido, muestra pronóstico
- MatchCard - Muestra clima del partido upcoming
- `getMatchDayForecastAction(location, date)`

## Ejemplo
```javascript
// Input:
{
  location: "Parque Rodó, Montevideo",
  date: "2025-02-15"
}

// Output:
{
  description: "Sol y Nubes",
  icon: "Cloud",
  temperature: 24
}
```

## Notas
- Descripción muy concisa (max 3 palabras)
- Respuesta en español
- Iconos mapped a Lucide React icons
