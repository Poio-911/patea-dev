import { FC, useState } from 'react';
import type { SocialActivity } from '@/lib/types';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { formatDistanceToNowStrict } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { UserPlus, Star, Trophy, ArrowUp, ArrowDown, Goal, Users, CheckCircle, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUser } from '@/firebase';
import { likeSocialActivityAction, unlikeSocialActivityAction } from '@/lib/actions/social-likes-actions';

interface Props {
  activity: SocialActivity;
  onLikeChange?: () => void;
}

const typeConfig: Record<string, { icon: JSX.Element; verb: (a: SocialActivity) => string; className?: string }> = {
  new_follower: {
    icon: <UserPlus className="h-4 w-4 text-foreground" />,
    verb: () => 'empezó a seguir a alguien',
  },
  match_played: {
    icon: <Users className="h-4 w-4 text-foreground" />,
    verb: a => `jugó un partido: ${a.metadata?.matchTitle || ''}`,
  },
  match_organized: {
    icon: <Users className="h-4 w-4 text-foreground" />,
    verb: a => `organizó el partido: ${a.metadata?.matchTitle || ''}`,
  },
  goal_scored: {
    icon: <Goal className="h-4 w-4 text-foreground" />,
    verb: a => `marcó ${a.metadata?.goals} gol(es)`,
  },
  ovr_increased: {
    icon: <ArrowUp className="h-4 w-4 text-foreground" />,
    verb: a => `subió su OVR a ${a.metadata?.newOvr} (+${a.metadata?.ovrChange})`,
  },
  ovr_decreased: {
    icon: <ArrowDown className="h-4 w-4 text-foreground" />,
    verb: a => `bajó su OVR a ${a.metadata?.newOvr} (${a.metadata?.ovrChange})`,
  },
  achievement_unlocked: {
    icon: <Trophy className="h-4 w-4 text-foreground" />,
    verb: a => `desbloqueó logro: ${a.metadata?.achievementName}`,
  },
  player_created: {
    icon: <Star className="h-4 w-4 text-fuchsia-500" />,
    verb: a => `creó jugador: ${a.playerName}`,
  },
};

export const ActivityCard: FC<Props> = ({ activity, onLikeChange }) => {
  const cfg = typeConfig[activity.type];
  const rawTs: any = activity.timestamp;
  const dateObj = rawTs && typeof rawTs?.toDate === 'function' ? rawTs.toDate() : new Date(rawTs);
  const timeAgo = formatDistanceToNowStrict(dateObj, { locale: es });

  // Likes logic
  const { user } = useUser();
  const [likes, setLikes] = useState(activity.likes || []);
  const [loading, setLoading] = useState(false);
  const likeCount = likes.length;
  const userLiked = user ? likes.includes(user.uid) : false;

  const handleLike = async () => {
    if (!user || loading) return;
    setLoading(true);
    try {
      if (userLiked) {
        setLikes(likes.filter((uid) => uid !== user.uid));
        await unlikeSocialActivityAction(activity.id, user.uid);
      } else {
        setLikes([...likes, user.uid]);
        await likeSocialActivityAction(activity.id, user.uid);
      }
      if (onLikeChange) onLikeChange();
    } catch (e) {
      // TODO: feedback de error
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn('flex gap-3 px-4 py-3 border-b border-neutral-200 dark:border-neutral-800')}>
      <Avatar className="h-10 w-10 shrink-0 ring-2 ring-foreground/50">
        {activity.playerPhotoUrl && (
          <AvatarImage src={activity.playerPhotoUrl} alt={activity.playerName} />
        )}
        <AvatarFallback>{(activity.playerName || activity.type || 'A').charAt(0)}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
          {cfg?.icon}
          <span className="font-semibold">{activity.playerName || 'Usuario'}</span>
          <span className="text-muted-foreground break-words">{cfg ? cfg.verb(activity) : activity.type}</span>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <Button
            variant={userLiked ? 'default' : 'outline'}
            size="sm"
            className={cn('px-2 py-1 h-7', userLiked ? 'bg-pink-500 text-white hover:bg-pink-600' : '')}
            onClick={handleLike}
            disabled={!user || loading}
            aria-label={userLiked ? 'Quitar like' : 'Dar like'}
          >
            <Heart className={cn('h-4 w-4', userLiked ? 'fill-pink-500 text-pink-500' : 'text-muted-foreground')} />
            <span className="ml-1 text-xs">{likeCount}</span>
          </Button>
        </div>
        <div className="text-xs text-neutral-500 mt-1">Hace {timeAgo}</div>
      </div>
    </div>
  );
};

export default ActivityCard;

