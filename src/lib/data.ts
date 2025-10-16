import { Player, Match } from './types';
import { PlaceHolderImages } from './placeholder-images';

const getPlayerImage = (id: string) => {
  const img = PlaceHolderImages.find(p => p.id === id);
  return img ? img.imageUrl : 'https://picsum.photos/seed/default/400/400';
}

export const players: Player[] = [
  { id: '1', name: 'Bruno', position: 'MED', ovr: 88, pac: 85, sho: 82, pas: 91, dri: 88, def: 70, phy: 78, photoUrl: getPlayerImage("player1"), stats: { matchesPlayed: 25, goals: 12, assists: 15, averageRating: 8.5 } },
  { id: '2', name: 'Leo', position: 'DEL', ovr: 92, pac: 91, sho: 94, pas: 85, dri: 95, def: 40, phy: 70, photoUrl: getPlayerImage("player2"), stats: { matchesPlayed: 30, goals: 28, assists: 10, averageRating: 9.1 } },
  { id: '3', name: 'Virgil', position: 'DEF', ovr: 89, pac: 80, sho: 60, pas: 75, dri: 72, def: 91, phy: 88, photoUrl: getPlayerImage("player3"), stats: { matchesPlayed: 28, goals: 3, assists: 2, averageRating: 8.8 } },
  { id: '4', name: 'Alisson', position: 'POR', ovr: 89, pac: 86, sho: 85, pas: 87, dri: 88, def: 50, phy: 90, photoUrl: getPlayerImage("player4"), stats: { matchesPlayed: 28, goals: 0, assists: 1, averageRating: 8.7 } },
  { id: '5', name: 'Kylian', position: 'DEL', ovr: 91, pac: 97, sho: 90, pas: 80, dri: 92, def: 45, phy: 78, photoUrl: getPlayerImage("player5"), stats: { matchesPlayed: 29, goals: 25, assists: 8, averageRating: 8.9 } },
  { id: '6', name: 'Kevin', position: 'MED', ovr: 91, pac: 78, sho: 88, pas: 94, dri: 87, def: 65, phy: 80, photoUrl: getPlayerImage("player6"), stats: { matchesPlayed: 26, goals: 10, assists: 20, averageRating: 9.0 } },
  { id: '7', name: 'N\'Golo', position: 'MED', ovr: 87, pac: 82, sho: 70, pas: 82, dri: 85, def: 88, phy: 85, photoUrl: getPlayerImage("player7"), stats: { matchesPlayed: 24, goals: 4, assists: 5, averageRating: 8.4 } },
  { id: '8', name: 'Sergio', position: 'DEF', ovr: 86, pac: 75, sho: 65, pas: 70, dri: 70, def: 88, phy: 84, photoUrl: getPlayerImage("player8"), stats: { matchesPlayed: 22, goals: 5, assists: 1, averageRating: 8.2 } },
  { id: '9', name: 'Erling', position: 'DEL', ovr: 90, pac: 90, sho: 93, pas: 65, dri: 80, def: 50, phy: 89, photoUrl: getPlayerImage("player9"), stats: { matchesPlayed: 27, goals: 30, assists: 5, averageRating: 9.2 } },
  { id: '10', name: 'Luka', position: 'MED', ovr: 87, pac: 75, sho: 80, pas: 90, dri: 89, def: 70, phy: 72, photoUrl: getPlayerImage("player10"), stats: { matchesPlayed: 28, goals: 8, assists: 18, averageRating: 8.6 } },
  { id: '11', name: 'Mo', position: 'DEL', ovr: 89, pac: 93, sho: 89, pas: 82, dri: 90, def: 50, phy: 75, photoUrl: getPlayerImage("player11"), stats: { matchesPlayed: 30, goals: 22, assists: 12, averageRating: 8.8 } },
  { id: '12', name: 'Joshua', position: 'MED', ovr: 88, pac: 75, sho: 78, pas: 88, dri: 85, def: 82, phy: 80, photoUrl: getPlayerImage("player12"), stats: { matchesPlayed: 26, goals: 6, assists: 14, averageRating: 8.5 } },
  { id: '13', name: 'Ruben', position: 'DEF', ovr: 88, pac: 78, sho: 55, pas: 70, dri: 70, def: 90, phy: 87, photoUrl: getPlayerImage("player13"), stats: { matchesPlayed: 27, goals: 2, assists: 1, averageRating: 8.7 } },
  { id: '14', name: 'Thibaut', position: 'POR', ovr: 90, pac: 88, sho: 84, pas: 75, dri: 87, def: 45, phy: 91, photoUrl: getPlayerImage("player14"), stats: { matchesPlayed: 29, goals: 0, assists: 0, averageRating: 8.9 } },
  { id: '15', name: 'Jamal', position: 'MED', ovr: 86, pac: 85, sho: 80, pas: 82, dri: 91, def: 60, phy: 70, photoUrl: getPlayerImage("player15"), stats: { matchesPlayed: 25, goals: 14, assists: 10, averageRating: 8.3 } },
  { id: '16', name: 'Cristiano', position: 'DEL', ovr: 86, pac: 85, sho: 90, pas: 78, dri: 84, def: 40, phy: 79, photoUrl: getPlayerImage("player16"), stats: { matchesPlayed: 31, goals: 29, assists: 7, averageRating: 8.5 } },
];

export const matches: Match[] = [
  { id: '1', title: 'Wednesday Night Football', date: '2025-09-10', time: '19:00', location: 'Local Park', type: '7v7', status: 'completed' },
  { id: '2', title: 'Weekend Showdown', date: '2025-09-13', time: '10:00', location: 'City Arena', type: '5v5', status: 'completed' },
  { id: '3', title: 'Friendly Kickabout', date: '2025-09-17', time: '18:30', location: 'Eastside Pitch', type: '5v5', status: 'upcoming' },
  { id: '4', title: 'Clash of Titans', date: '2025-09-20', time: '11:00', location: 'Champions Field', type: '11v11', status: 'upcoming' },
  { id: '5', title: 'Morning Glory FC', date: '2025-09-24', time: '09:00', location: 'Local Park', type: '5v5', status: 'upcoming' },
];

export const mockEvaluations = [
    { performanceTags: ['Goleador', 'Regate exitoso'], evaluatedBy: 'user-2', timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
    { performanceTags: ['Asistencia', 'Jugada clave'], evaluatedBy: 'user-3', timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() },
    { performanceTags: ['Defensa sólida'], evaluatedBy: 'user-2', timestamp: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString() },
    { performanceTags: ['Mal partido'], evaluatedBy: 'user-4', timestamp: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString() },
    { performanceTags: ['Goleador', 'Liderazgo'], evaluatedBy: 'user-3', timestamp: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString() },
];
