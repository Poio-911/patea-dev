import type { CardAnimationType } from '@/components/animated-card-wrapper';

/**
 * Calcula el delay de animación para crear efecto en cascada (stagger)
 * @param index - Índice del elemento en la lista
 * @param columns - Número de columnas en el grid (default: 3)
 * @returns Delay en segundos
 */
export function getStaggerDelay(index: number, columns: number = 3): number {
  const row = Math.floor(index / columns);
  const col = index % columns;
  return row * 0.05 + col * 0.02;
}

/**
 * Selecciona el tipo de animación según el overall rating del jugador
 * Cards de mayor rareza tienen animaciones más dramáticas
 * @param ovr - Overall rating del jugador (0-99)
 * @returns Tipo de animación
 */
export function getAnimationByRarity(ovr: number): CardAnimationType {
  if (ovr >= 86) return 'flip';   // Elite - más dramático (rotación 3D)
  if (ovr >= 76) return 'rotate'; // Gold - rotación 2D
  if (ovr >= 65) return 'zoom';   // Silver - zoom desde centro
  return 'slide';                 // Bronze - slide sutil desde abajo
}
