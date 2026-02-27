import { LayoutDashboard, User, ClipboardCheck, Trophy, Calendar, Globe, Users2 } from 'lucide-react';

export const mainNavItems = [
  { href: '/dashboard', label: 'Panel', icon: LayoutDashboard },
  { href: '/players', label: 'Jugadores', icon: User },
  { href: '/explorar', label: 'Explorar', icon: Globe },
  { href: '/comunidad', label: 'Comunidad', icon: Users2 },
];

export const matchesNavItems = [
  { href: '/matches', label: 'Partidos', icon: Trophy, sub: 'Tus encuentros', mobileIcon: Calendar },
  { href: '/competitions', label: 'Competiciones', icon: Trophy, sub: 'Torneos y ligas' },
];

export const extraNavItems = [
  { href: '/evaluations', label: 'Evaluaciones', icon: ClipboardCheck },
];

// Compatibility exports for existing components
export const baseNavItems = [...mainNavItems, matchesNavItems[0]];
export const secondaryNavItems = [matchesNavItems[1], extraNavItems[0]];
