'use client';

import { GroupTeam } from '@/lib/types';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { JerseyPreview } from '../team-builder/jersey-preview';
import { Badge } from '../ui/badge';
import { Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TeamSelectorCardProps {
  team: GroupTeam;
  isSelected: boolean;
  onSelect: (teamId: string) => void;
  currentGroupId?: string;
  groupName?: string;
  disabled?: boolean;
}

export function TeamSelectorCard({
  team,
  isSelected,
  onSelect,
  currentGroupId,
  groupName,
  disabled = false
}: TeamSelectorCardProps) {
  const isFromDifferentGroup = currentGroupId && team.groupId !== currentGroupId;

  return (
    <div
      className={cn(
        "flex items-center space-x-3 rounded-md border p-3 transition-colors",
        "hover:bg-accent/30",
        isSelected && "bg-primary/10 border-primary ring-1 ring-primary/20",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <Checkbox
        id={`team-${team.id}`}
        checked={isSelected}
        onCheckedChange={() => !disabled && onSelect(team.id)}
        disabled={disabled}
      />
      {/* Jersey */}
      <div className="flex-shrink-0">
        <div className="w-14 h-14">
          <JerseyPreview jersey={team.jersey} />
        </div>
      </div>

      <Label
        htmlFor={`team-${team.id}`}
        className={cn(
          "flex-1 cursor-pointer min-w-0",
          disabled && "cursor-not-allowed"
        )}
      >
        {/* Team Info */}
        <div className="flex flex-col justify-center h-full py-1">
          {/* Team name - no truncate, wraps to multiple lines */}
          <p className="font-semibold text-sm leading-tight">{team.name}</p>

          {/* Team stats */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3 flex-shrink-0" />
              <span>{team.members.length} jugadores</span>
            </div>

            {/* Group badge if from different group */}
            {isFromDifferentGroup && groupName && (
              <>
                <span>·</span>
                <Badge variant="outline" className="text-xs py-0 h-4">
                  {groupName}
                </Badge>
              </>
            )}
          </div>
        </div>
      </Label>
    </div>
  );
}
