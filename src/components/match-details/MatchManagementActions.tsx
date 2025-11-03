'use client';

import React from 'react';
import type { Match, Player } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { InvitePlayerDialog } from '@/components/invite-player-dialog';
import { Loader2, CheckCircle, Trash2, UserPlus } from 'lucide-react';

interface MatchManagementActionsProps {
  match: Match;
  allGroupPlayers: Player[];
  canFinalize: boolean;
  canInvite: boolean;
  isFinishing: boolean;
  isDeleting: boolean;
  onFinish: () => void;
  onDelete: () => void;
}

/**
 * Componente de acciones de gestión del partido (solo visible para el owner)
 * Incluye botones para finalizar, invitar y eliminar
 */
export const MatchManagementActions = React.memo(function MatchManagementActions({
  match,
  allGroupPlayers,
  canFinalize,
  canInvite,
  isFinishing,
  isDeleting,
  onFinish,
  onDelete,
}: MatchManagementActionsProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-foreground/90">Gestión del Partido</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {canFinalize && (
          <Button
            onClick={onFinish}
            disabled={isFinishing}
            size="sm"
            className="min-h-[48px]"
            aria-label="Finalizar partido"
          >
            {isFinishing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <CheckCircle className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            Finalizar
          </Button>
        )}

        {canInvite && (
          <InvitePlayerDialog
            playerToInvite={null}
            userMatches={[match]}
            allGroupPlayers={allGroupPlayers}
            match={match}
          >
            <Button
              variant="outline"
              size="sm"
              className="min-h-[48px]"
              aria-label="Invitar jugador"
            >
              <UserPlus className="mr-2 h-4 w-4" aria-hidden="true" />
              Invitar
            </Button>
          </InvitePlayerDialog>
        )}

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              size="sm"
              disabled={isDeleting}
              className="min-h-[48px]"
              aria-label="Eliminar partido"
            >
              <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
              Eliminar
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Borrar este partido?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción es permanente y no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={onDelete}
                disabled={isDeleting}
                className="bg-destructive hover:bg-destructive/90"
              >
                {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
});
