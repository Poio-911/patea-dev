import { LayoutDashboard, Users2, User, ClipboardCheck, Trophy, Search, Calendar, UserSearch } from 'lucide-react';

export const mainNavItems = [
  { href: '/dashboard', label: 'Panel', icon: LayoutDashboard },
  { href: '/players', label: 'Jugadores', icon: User },
  { href: '/groups', label: 'Grupos', icon: Users2 },
];

export const matchesNavItems = [
  { href: '/matches', label: 'Partidos', icon: Trophy, sub: 'Tus encuentros', mobileIcon: Calendar },
  { href: '/find-match', label: 'Buscar Partido', icon: Search, sub: 'Encontrar partido' },
  { href: '/find-players', label: 'Buscar Jugadores', icon: UserSearch, sub: 'Encontrar jugadores' },
  { href: '/competitions', label: 'Competiciones', icon: Trophy, sub: 'Torneos y ligas' },
];

export const extraNavItems = [
  { href: '/evaluations', label: 'Evaluaciones', icon: ClipboardCheck },
];

// Compatibility exports for existing components
export const baseNavItems = [...mainNavItems, matchesNavItems[0]];
export const secondaryNavItems = [matchesNavItems[3], matchesNavItems[1], matchesNavItems[2], extraNavItems[0]];
