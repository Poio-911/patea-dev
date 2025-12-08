/**
 * Static data and constants used throughout the app
 * Contains attribute descriptions, performance tags, and other reference data
 */

'use client';

export const attributeDescriptions: Record<string, { name: string, description: string }> = {
  PAC: { name: 'Ritmo (RIT)', description: 'Mide la velocidad y aceleración del jugador en el campo.' },
  SHO: { name: 'Tiro (TIR)', description: 'Define la precisión y potencia de los remates a puerta.' },
  PAS: { name: 'Pase (PAS)', description: 'Representa la calidad y visión para dar pases a los compañeros.' },
  DRI: { name: 'Regate (REG)', description: 'Mide el control del balón y la habilidad en el uno contra uno.' },
  DEF: { name: 'Defensa (DEF)', description: 'Indica la capacidad para marcar, realizar entradas y posicionarse defensivamente.' },
  PHY: { name: 'Físico (FIS)', description: 'Representa la fuerza, resistencia y aguante del jugador durante el partido.' }
};
