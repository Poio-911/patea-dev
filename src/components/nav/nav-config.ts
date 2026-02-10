import { LayoutDashboard, Users2, User, ClipboardCheck, Trophy, Search, Calendar, UserSearch } from 'lucide-react';

export const mainNavItems = [
  { href: '/dashboard', label: 'Panel', icon: LayoutDashboard },
  { href: '/players', label: 'Jugadores', icon: User },
  { href: '/groups', label: 'Grupos', icon: Users2 },
];

export const matchesNavItems = [
  { href: '/matches', label: 'Partidos', icon: Trophy, sub: 'Tus encuentros', mobileIcon: Calendar },
  { href: '/explore', label: 'Explorar', icon: Search, sub: 'Jugadores y partidos', mobileIcon: Search },
  { href: '/competitions', label: 'Competiciones', icon: Trophy, sub: 'Torneos y ligas' },
];

export const extraNavItems = [
  { href: '/evaluations', label: 'Evaluaciones', icon: ClipboardCheck },
];

// Compatibility exports for existing components
export const baseNavItems = [...mainNavItems, matchesNavItems[0]];
export const secondaryNavItems = [matchesNavItems[2], matchesNavItems[1], extraNavItems[0]];
