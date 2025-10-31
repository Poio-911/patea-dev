
'use client';

import { Player, Match } from './types';
import { PlaceHolderImages } from './placeholder-images';

const getPlayerImage = (id: string) => {
  const img = PlaceHolderImages.find(p => p.id === id);
  return img ? img.imageUrl : 'https://picsum.photos/seed/default/400/400';
}

export const attributeDescriptions: Record<string, { name: string, description: string }> = {
  PAC: { name: 'Ritmo (RIT)', description: 'Mide la velocidad y aceleración del jugador en el campo.' },
  SHO: { name: 'Tiro (TIR)', description: 'Define la precisión y potencia de los remates a puerta.' },
  PAS: { name: 'Pase (PAS)', description: 'Representa la calidad y visión para dar pases a los compañeros.' },
  DRI: { name: 'Regate (REG)', description: 'Mide el control del balón y la habilidad en el uno contra uno.' },
  DEF: { name: 'Defensa (DEF)', description: 'Indica la capacidad para marcar, realizar entradas y posicionarse defensivamente.' },
  PHY: { name: 'Físico (FIS)', description: 'Representa la fuerza, resistencia y aguante del jugador durante el partido.' }
};


export const players: Player[] = [
  // This data is now fetched from Firestore
];

export const matches: Match[] = [
  // This data is now fetched from Firestore
];

export const performanceTags = [
  'Velocidad',
  'Pase',
  'Defensa',
  'Actitud',
  'Ataque',
  'Resistencia',
  'Posicionamiento',
  'Liderazgo',
  'Comunicacion',
  'Regate',
  'Marcaje',
  'Finalización',
  'Cabeceo',
  'Apoyo',
  'Recuperación',
  'Creatividad',
  'Presión',
  'Coberturas'
];


export const mockEvaluations = [
    { performanceTags: ['Goleador', 'Regate exitoso'], evaluatedBy: 'user-2', timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
    { performanceTags: ['Asistencia', 'Jugada clave'], evaluatedBy: 'user-3', timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() },
    { performanceTags: ['Defensa sólida'], evaluatedBy: 'user-2', timestamp: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString() },
    { performanceTags: ['Mal partido'], evaluatedBy: 'user-4', timestamp: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString() },
    { performanceTags: ['Goleador', 'Liderazgo'], evaluatedBy: 'user-3', timestamp: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString() },
];


export const youtubeGoalHighlights = [
  { videoId: 'Y_9t3_I4_2Q', title: 'Nacional vs. Peñarol: los goles del clásico del Apertura 2024' },
  { videoId: 'fNFzfwLM72c', title: 'Los goles de la 1ª fecha del Torneo Apertura 2024 | Tenfield' },
  { videoId: 'o-YBDTqX_ZU', title: 'Los goles de la 2ª fecha del Torneo Apertura 2024 | Tenfield' },
  { videoId: 'r6y1a-1e62A', title: 'Los goles de la 3ª fecha del Torneo Apertura 2024 | Tenfield' },
  { videoId: 'YQ-qB4I3M7s', title: 'Uruguay 3-1 Chile | Mejores Momentos | Eliminatorias CONMEBOL' }
];



