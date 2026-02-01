# generate-duo-image

## Propósito
Genera imágenes tipo "scene" con 1 o 2 jugadores en una escena de fútbol, preservando rasgos faciales de las fotos de referencia.

## Modelo AI
- **Modelo**: `googleai/gemini-2.5-flash-image-preview`
- **Output**: Data URI de imagen generada

## Input Schema
```typescript
(
  player1DataUri: string,  // Foto del jugador 1
  player2DataUri: string,  // Foto del jugador 2 (o misma que 1 para solo)
  player1Name: string,
  player2Name: string,
  prompt: string  // Descripción de la escena
)
```

## Output
```typescript
string  // Data URI de la imagen generada
```

## Lógica
- Si `player1DataUri === player2DataUri` → Imagen individual
- Caso contrario → Imagen de dúo
- Prompt adaptado según número de jugadores

## Instrucciones al Modelo
- Preservar rasgos faciales de las referencias
- Escena de fútbol amateur
- Estilo cinematográfico y épico
- No incluir texto ni marcas de agua

## Usado En
- Generación de contenido visual para partidos
- `generateDuoImageAction(player1Id, player2Id, prompt)`

## Ejemplo
```javascript
await generateDuoImage(
  "data:image/jpeg;base64,...",  // Foto Juan
  "data:image/jpeg;base64,...",  // Foto Pedro
  "Juan",
  "Pedro",
  "Celebrando un gol juntos con abrazo"
);
// Returns: "data:image/jpeg;base64,..." (imagen generada)
```
