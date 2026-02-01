# generate-player-card-image

## Propósito
Genera tarjetas visuales estilo FIFA Ultimate Team para jugadores.

## Modelo AI
- **Tipo**: Generación de imagen
- **Formato**: Data URI

## Input Schema
```typescript
{
  playerData: {
    name: string;
    position: string;
    ovr: number;
    pac: number;
    sho: number;
    pas: number;
    dri: number;
    def: number;
    phy: number;
    photoUrl?: string;
  }
}
```

## Output
```typescript
string  // Data URI de la tarjeta generada
```

## Sistema de Créditos
- Cada jugador: 3 créditos por día
- Reset diario automático
- Previene abuso del servicio

## Usado En
- PlayerProfileView - Botón "Generar Tarjeta"
- `generatePlayerCardImageAction(playerId)`

## Limitaciones
- Requiere créditos disponibles
- 1 crédito = 1 generación
- No se pueden acumular créditos

## Formato de Tarjeta
- Estilo FIFA/FUT
- Colores según OVR (oro, plata, bronce)
- Incluye foto del jugador si está disponible
- Muestra todos los atributos
