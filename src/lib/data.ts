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

export const mockEvaluations = [
    { performanceTags: ['Goleador', 'Regate exitoso'], evaluatedBy: 'user-2', timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
    { performanceTags: ['Asistencia', 'Jugada clave'], evaluatedBy: 'user-3', timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() },
    { performanceTags: ['Defensa sólida'], evaluatedBy: 'user-2', timestamp: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString() },
    { performanceTags: ['Mal partido'], evaluatedBy: 'user-4', timestamp: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString() },
    { performanceTags: ['Goleador', 'Liderazgo'], evaluatedBy: 'user-3', timestamp: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString() },
];
