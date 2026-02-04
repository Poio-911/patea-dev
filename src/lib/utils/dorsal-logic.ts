import { PlayerPosition } from "@/lib/types";

export const PREFERRED_DORSALS: Record<PlayerPosition, number[]> = {
    // Porteros
    POR: [1, 12, 13, 23, 25, 99],

    // Defensores
    DEF: [2, 3, 4, 6, 13, 15, 24, 5, 14, 18, 20, 22],

    // Mediocampistas
    MED: [5, 4, 6, 8, 10, 14, 16, 26, 30, 20, 21, 7, 11, 17, 22, 25],

    // Delanteros
    DEL: [9, 10, 7, 11, 19, 20, 23, 33, 99, 18, 22, 14, 21],
};

/**
 * Asigna un dorsal inteligente basado en la posición y los dorsales ya ocupados.
 * @param position Posición del jugador
 * @param usedNumbers Set de números ya asignados en el equipo
 * @returns El número asignado
 */
export function assignSmartDorsal(position: PlayerPosition, usedNumbers: Set<number>): number {
    const preferences = PREFERRED_DORSALS[position] || [];

    // 1. Intentar usar un predeterminado
    for (const num of preferences) {
        if (!usedNumbers.has(num)) {
            return num;
        }
    }

    // 2. Si están todos ocupados, buscar el más bajo disponible (evitando 1 si no es POR)
    let candidate = 2; // Empezamos de 2 para jugadores de campo
    if (position === 'POR') candidate = 1;

    while (usedNumbers.has(candidate)) {
        candidate++;
    }

    return candidate;
}
