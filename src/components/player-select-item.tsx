"use client";

import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { cn } from "@/lib/utils";
import type { Player } from "@/lib/types";
import { PlayerPositionBadge } from "@/components/player-styles";

export type PlayerSelectItemVariant = "row" | "card" | "draggableRow";

interface PlayerSelectItemProps {
  player: Pick<Player, "id" | "name" | "photoURL" | "position" | "ovr"> & { uid?: string; displayName?: string };
  selected?: boolean;
  onToggle?: () => void;
  variant?: PlayerSelectItemVariant;
  selectionControl?: "checkbox" | "none";
  showPosition?: boolean;
  showOvr?: boolean;
  density?: "sm" | "md";
  rightActions?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  dragHandle?: React.ReactNode;
  avatarSize?: "sm" | "md" | "lg";
}

export function PlayerSelectItem({
  player,
  selected = false,
  onToggle,
  variant = "row",
  selectionControl = "none",
  showPosition = true,
  showOvr = true,
  density = "sm",
  rightActions,
  disabled,
  className,
  dragHandle,
  avatarSize = "md",
}: PlayerSelectItemProps) {
  const name = player.displayName || player.name;
  const id = player.uid || player.id;
  const compact = density === "sm";

  const avatarClasses = avatarSize === "sm" ? "h-8 w-8" : avatarSize === "md" ? "h-10 w-10" : "h-12 w-12";

  const content = (
    <div className={cn(
      "flex items-center gap-3 rounded-lg border p-3 transition-colors",
      selected ? "bg-primary/10 border-primary" : "hover:bg-accent/50",
      disabled && "opacity-50 cursor-not-allowed",
      className
    )}>
      {dragHandle}
      <Avatar className={avatarClasses}>
        <AvatarImage src={player.photoURL} alt={name} />
        <AvatarFallback>{name?.charAt(0) || "?"}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="font-semibold truncate">{name}</p>
        {(showPosition || showOvr) && (
          <div className={cn("flex items-center gap-2", compact ? "text-xs" : "text-sm")}>
            {showPosition && (
              <PlayerPositionBadge position={player.position} showIcon={false} size={compact ? "sm" : "md"} textOnly={true} />
            )}
            {showOvr && <span className="text-muted-foreground">{compact ? player.ovr : `OVR ${player.ovr}`}</span>}
          </div>
        )}
      </div>
      {selectionControl === "checkbox" && (
        <div className={cn(
          "flex h-5 w-5 items-center justify-center rounded-sm border",
          selected ? "bg-primary text-primary-foreground" : "bg-background"
        )}>
          {selected && <span className="block h-3 w-3 bg-primary-foreground rounded-[2px]" />}
        </div>
      )}
      {rightActions}
    </div>
  );

  if (variant === "card") {
    return (
      <div
        className={cn(
          "cursor-pointer transition-all border-2 rounded-lg",
          selected ? "border-primary ring-2 ring-primary/50" : "border-border"
        )}
        onClick={onToggle}
      >
        <div className="p-3">{content}</div>
      </div>
    );
  }

  // row and draggableRow behave similarly; drag handle is passed via props
  return (
    <div onClick={onToggle}>{content}</div>
  );
}
