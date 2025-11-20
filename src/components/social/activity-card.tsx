import { FC } from 'react';
import type { SocialActivity } from '@/lib/types';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { formatDistanceToNowStrict } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { UserPlus, Star, Trophy, ArrowUp, ArrowDown, Goal, Users, CheckCircle } from 'lucide-react';

// Map activity type to icon and styling
const typeConfig: Record<string, { icon: JSX.Element; verb: (a: SocialActivity) => string; className?: string }> = {
  new_follower: {
    icon: <UserPlus className="h-4 w-4 text-sky-500" />,
    verb: () => 'empezó a seguir a alguien',
  },
  match_played: {
    icon: <Users className="h-4 w-4 text-indigo-500" />,
    verb: a => `jugó un partido: ${a.metadata?.matchTitle || ''}`,
  },
  match_organized: {
    icon: <Users className="h-4 w-4 text-purple-500" />,
    verb: a => `organizó el partido: ${a.metadata?.matchTitle || ''}`,
  },
  goal_scored: {
    icon: <Goal className="h-4 w-4 text-green-600" />,
    verb: a => `marcó ${a.metadata?.goals} gol(es)`,
  },
  ovr_increased: {
    icon: <ArrowUp className="h-4 w-4 text-emerald-500" />,
    verb: a => `subió su OVR a ${a.metadata?.newOvr} (+${a.metadata?.ovrChange})`,
  },
  ovr_decreased: {
    icon: <ArrowDown className="h-4 w-4 text-rose-500" />,
    verb: a => `bajó su OVR a ${a.metadata?.newOvr} (${a.metadata?.ovrChange})`,
  },
  achievement_unlocked: {
    icon: <Trophy className="h-4 w-4 text-yellow-500" />,
    verb: a => `desbloqueó logro: ${a.metadata?.achievementName}`,
  },
  player_created: {
    icon: <Star className="h-4 w-4 text-fuchsia-500" />,
    verb: a => `creó jugador: ${a.playerName}`,
  },
};

interface Props { activity: SocialActivity; }

export const ActivityCard: FC<Props> = ({ activity }) => {
  const cfg = typeConfig[activity.type];
  const rawTs: any = activity.timestamp;
  const dateObj = rawTs && typeof rawTs?.toDate === 'function' ? rawTs.toDate() : new Date(rawTs);
  const timeAgo = formatDistanceToNowStrict(dateObj, { locale: es });
  return (
    <div className={cn('flex gap-3 px-4 py-3 border-b border-neutral-200 dark:border-neutral-800')}>      
      <Avatar className="h-10 w-10 shrink-0 ring-2 ring-white/50">
        {activity.playerPhotoUrl && (
          <AvatarImage src={activity.playerPhotoUrl} alt={activity.playerName} />
        )}
        <AvatarFallback>{(activity.playerName || activity.type || 'A').charAt(0)}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-sm">
          {cfg?.icon}
          <span className="font-semibold truncate">{activity.playerName || 'Usuario'}</span>
          <span className="text-muted-foreground truncate">{cfg ? cfg.verb(activity) : activity.type}</span>
        </div>
        <div className="text-xs text-neutral-500 mt-1">Hace {timeAgo}</div>
      </div>
    </div>
  );
};

export default ActivityCard;
