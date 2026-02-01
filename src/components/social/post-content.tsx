'use client';

import type { SocialActivity } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import {
  UserPlus,
  Star,
  Trophy,
  ArrowUp,
  ArrowDown,
  Goal,
  Users,
  Repeat2,
} from 'lucide-react';
import Link from 'next/link';

interface PostContentProps {
  activity: SocialActivity;
  isRepostContent?: boolean;
}

const typeConfig: Record<
  string,
  {
    icon: JSX.Element;
    getContent: (a: SocialActivity) => JSX.Element;
    iconBgClass?: string;
  }
> = {
  new_follower: {
    icon: <UserPlus className="h-4 w-4" />,
    iconBgClass: 'bg-pink-500/10 text-pink-500',
    getContent: () => (
      <span className="text-muted-foreground">empezaron a seguirlo</span>
    ),
  },
  match_played: {
    icon: <Users className="h-4 w-4" />,
    iconBgClass: 'bg-blue-500/10 text-blue-500',
    getContent: (a) => (
      <span>
        <span className="text-muted-foreground">jugó un partido</span>
        {a.metadata?.matchTitle && (
          <span className="text-foreground font-medium"> - {a.metadata.matchTitle}</span>
        )}
      </span>
    ),
  },
  match_organized: {
    icon: <Trophy className="h-4 w-4" />,
    iconBgClass: 'bg-amber-500/10 text-amber-500',
    getContent: (a) => (
      <span>
        <span className="text-muted-foreground">organizó el partido</span>
        {a.metadata?.matchTitle && (
          <span className="text-foreground font-medium"> - {a.metadata.matchTitle}</span>
        )}
      </span>
    ),
  },
  goal_scored: {
    icon: <Goal className="h-4 w-4" />,
    iconBgClass: 'bg-green-500/10 text-green-500',
    getContent: (a) => (
      <span>
        <span className="text-muted-foreground">marcó</span>{' '}
        <span className="font-semibold text-foreground">
          {a.metadata?.goals === 1 ? '1 gol' : `${a.metadata?.goals} goles`}
        </span>
        {a.metadata?.matchTitle && (
          <span className="text-muted-foreground"> en {a.metadata.matchTitle}</span>
        )}
      </span>
    ),
  },
  ovr_increased: {
    icon: <ArrowUp className="h-4 w-4" />,
    iconBgClass: 'bg-emerald-500/10 text-emerald-500',
    getContent: (a) => (
      <span className="flex items-center gap-2 flex-wrap">
        <span className="text-muted-foreground">subió su OVR</span>
        {a.metadata?.oldOvr && a.metadata?.newOvr && (
          <Badge variant="outline" className="border-emerald-500/50 text-emerald-600 dark:text-emerald-400 font-semibold">
            {a.metadata.oldOvr} <ArrowUp className="h-3 w-3 mx-1" /> {a.metadata.newOvr}
          </Badge>
        )}
        {a.metadata?.ovrChange && (
          <span className="text-emerald-600 dark:text-emerald-400 text-sm font-medium">
            (+{a.metadata.ovrChange})
          </span>
        )}
      </span>
    ),
  },
  ovr_decreased: {
    icon: <ArrowDown className="h-4 w-4" />,
    iconBgClass: 'bg-red-500/10 text-red-500',
    getContent: (a) => (
      <span className="flex items-center gap-2 flex-wrap">
        <span className="text-muted-foreground">bajó su OVR</span>
        {a.metadata?.oldOvr && a.metadata?.newOvr && (
          <Badge variant="outline" className="border-red-500/50 text-red-600 dark:text-red-400 font-semibold">
            {a.metadata.oldOvr} <ArrowDown className="h-3 w-3 mx-1" /> {a.metadata.newOvr}
          </Badge>
        )}
        {a.metadata?.ovrChange && (
          <span className="text-red-600 dark:text-red-400 text-sm font-medium">
            ({a.metadata.ovrChange})
          </span>
        )}
      </span>
    ),
  },
  achievement_unlocked: {
    icon: <Trophy className="h-4 w-4" />,
    iconBgClass: 'bg-yellow-500/10 text-yellow-500',
    getContent: (a) => (
      <span>
        <span className="text-muted-foreground">desbloqueó el logro</span>{' '}
        <span className="font-semibold text-foreground">{a.metadata?.achievementName}</span>
      </span>
    ),
  },
  player_created: {
    icon: <Star className="h-4 w-4" />,
    iconBgClass: 'bg-fuchsia-500/10 text-fuchsia-500',
    getContent: (a) => (
      <span>
        <span className="text-muted-foreground">creó su jugador</span>{' '}
        <span className="font-semibold text-foreground">{a.playerName}</span>
      </span>
    ),
  },
  repost: {
    icon: <Repeat2 className="h-4 w-4" />,
    iconBgClass: 'bg-cyan-500/10 text-cyan-500',
    getContent: () => <span className="text-muted-foreground">reposteó</span>,
  },
};

export function PostContent({ activity, isRepostContent = false }: PostContentProps) {
  const cfg = typeConfig[activity.type];
  const playerLink = activity.playerId ? `/players/${activity.playerId}` : null;
  const matchLink = activity.metadata?.matchId ? `/matches/${activity.metadata.matchId}` : null;

  return (
    <div className={isRepostContent ? 'pl-0' : ''}>
      <div className="flex items-start gap-2 text-sm leading-relaxed">
        {cfg?.icon && (
          <span className={`inline-flex items-center justify-center h-6 w-6 rounded-full shrink-0 ${cfg.iconBgClass || 'bg-muted'}`}>
            {cfg.icon}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-foreground">
            {playerLink ? (
              <Link href={playerLink} className="hover:underline">
                {activity.playerName || 'Usuario'}
              </Link>
            ) : (
              activity.playerName || 'Usuario'
            )}
          </span>{' '}
          {cfg ? cfg.getContent(activity) : (
            <span className="text-muted-foreground">{activity.type}</span>
          )}
        </div>
      </div>

      {/* Match link card preview if available */}
      {matchLink && !isRepostContent && (
        <Link
          href={matchLink}
          className="mt-3 block p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-2 text-sm">
            <Trophy className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{activity.metadata?.matchTitle || 'Ver partido'}</span>
          </div>
        </Link>
      )}
    </div>
  );
}

export default PostContent;
