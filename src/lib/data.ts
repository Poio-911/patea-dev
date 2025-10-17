
'use client';

import { Player, Match } from './types';
import { PlaceHolderImages } from './placeholder-images';

const getPlayerImage = (id: string) => {
  const img = PlaceHolderImages.find(p => p.id === id);
  return img ? img.imageUrl : 'https://picsum.photos/seed/default/400/400';
}

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
  { videoId: 'Y_9t3_I4_2Q', title: 'Nacional vs Peñarol | Mejores Momentos | Apertura 2024' },
  { videoId: 'abc123def45', title: 'Golazo de Alan Medina | Liverpool vs Defensor Sporting' },
  { videoId: 'fNFzfwLM72c', title: 'Top 5 Goles de la Fecha | Campeonato Uruguayo' },
  { videoId: 'o-YBDTqX_ZU', title: 'Resumen: Wanderers vs Danubio | Goles y Jugadas' },
  { videoId: 'r6y1a-1e62A', title: 'Gol de último minuto | Cerro Largo vs Fénix' },
];
