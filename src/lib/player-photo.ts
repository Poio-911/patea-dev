import type { Player } from '@/lib/types';

export const getPlayerPhoto = (player: Partial<Player> & { photoUrl?: string; photoURL?: string }): string | undefined =>
  player.photoURL || player.photoUrl;
