'use client';

import { Badge } from '@/components/ui/badge';
import { Shield, ShieldCheck, User } from 'lucide-react';
import type { GroupRole } from '@/lib/group-permissions';
import { getRoleLabel, getRoleColor } from '@/lib/group-permissions';
import { cn } from '@/lib/utils';

type RoleBadgeProps = {
  role: GroupRole;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'outline' | 'secondary';
};

const roleIcons: Record<GroupRole, any> = {
  admin: ShieldCheck,
  moderator: Shield,
  member: User,
};

const sizeClasses = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-1',
  lg: 'text-base px-3 py-1.5',
};

export function RoleBadge({
  role,
  showIcon = true,
  size = 'md',
  variant = 'default',
}: RoleBadgeProps) {
  const Icon = roleIcons[role];
  const label = getRoleLabel(role);
  const colorClass = getRoleColor(role);

  if (variant === 'default') {
    return (
      <Badge
        className={cn(
          'flex items-center gap-1 font-medium',
          colorClass,
          sizeClasses[size]
        )}
      >
        {showIcon && <Icon className="w-3 h-3" />}
        <span>{label}</span>
      </Badge>
    );
  }

  return (
    <Badge
      variant={variant}
      className={cn('flex items-center gap-1 font-medium', sizeClasses[size])}
    >
      {showIcon && <Icon className="w-3 h-3" />}
      <span>{label}</span>
    </Badge>
  );
}
