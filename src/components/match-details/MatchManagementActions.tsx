
'use client';

import React from 'react';
import type { Match, Player, MatchLocation } from '@/lib/types';
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
import { InvitePlayerDialog } from '../invite-player-dialog';
import { EditableTeamsDialog } from '../editable-teams-dialog';
import { RescheduleMatchDialog } from './RescheduleMatchDialog';
import { ChangeVenueDialog } from './ChangeVenueDialog';
import { Loader2, CheckCircle, Trash2, UserPlus, FileSignature, Shuffle, CalendarClock, MapPin } from 'lucide-react';
import Link from 'next/link';

interface MatchManagementActionsProps {
  match: Match;
  allGroupPlayers: Player[];
  canFinalize: boolean;
  isFinishing: boolean;
  isDeleting: boolean;
  onFinish: () => void;
  onDelete: () => void;
  isCompetitionMatch?: boolean;
  // Acciones de equipos consolidadas
  onShuffle?: () => void;
  isShuffling?: boolean;
  // Reprogramar y cambiar cancha
  onReschedule?: (date: string, time: string) => Promise<void>;
  isRescheduling?: boolean;
  onChangeLocation?: (location: MatchLocation) => Promise<void>;
  isChangingLocation?: boolean;
}

/**
 * Componente de acciones de gestión del partido (solo visible para el owner)
 * Incluye botones para finalizar, invitar y eliminar
 */
export const MatchManagementActions = React.memo(function MatchManagementActions({
  match,
  allGroupPlayers,
  canFinalize,
  isFinishing,
  isDeleting,
  onFinish,
  onDelete,
  isCompetitionMatch = false,
  onShuffle,
  isShuffling = false,
  onReschedule,
  isRescheduling = false,
  onChangeLocation,
  isChangingLocation = false,
}: MatchManagementActionsProps) {
  const isManual = match.type === 'manual';
  const isCollaborative = match.type === 'collaborative';
  const isCompetitive = ['league', 'cup', 'league_final', 'by_teams'].includes(match.type);
  const hasTeams = match.teams && match.teams.length === 2;
  const isFull = match.players && match.players.length === match.matchSize;

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-foreground/90">Acciones</h3>
      <div className="flex flex-wrap gap-2">
        {/* Invitar solo si es manual o colaborativo y no hay equipos */}
        {(isManual || isCollaborative) && !hasTeams && (
          <InvitePlayerDialog allGroupPlayers={allGroupPlayers} userMatches={[]} match={match}>
            <Button size="sm" variant="outline" aria-label="Invitar jugadores">
              <UserPlus className="mr-2 h-4 w-4" />
              Invitar Jugadores
            </Button>
          </InvitePlayerDialog>
        )}
        {/* Volver a sortear equipos: manual y colaborativo, solo si ya hay equipos */
          onShuffle && hasTeams && match.type !== 'by_teams' && match.type !== 'intergroup_friendly' && match.status === 'upcoming' && (
            <Button
              onClick={onShuffle}
              disabled={isShuffling}
              size="sm"
              variant="outline"
              aria-label="Volver a sortear equipos"
            >
              {isShuffling ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Shuffle className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              Sortear
            </Button>
          )}
        {/* Editar equipos: manual siempre, colaborativo solo si está completo */}
        {(isManual || (isCollaborative && isFull)) && (
          <EditableTeamsDialog match={match}>
            <Button size="sm" variant="outline" aria-label="Editar equipos">
              <CheckCircle className="mr-2 h-4 w-4" />
              Editar Equipos
            </Button>
          </EditableTeamsDialog>
        )}
        {/* Acciones generales */}
        {canFinalize && (
          <Button
            onClick={onFinish}
            disabled={isFinishing}
            size="sm"
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
        {match.status === 'completed' && (
          <Button asChild size="sm" variant="outline">
            <Link href={`/matches/${match.id}/evaluate`}>
              <FileSignature className="mr-2 h-4 w-4" />
              Evaluaciones
            </Link>
          </Button>
        )}
        {/* Reprogramar: solo upcoming, no competition */}
        {match.status === 'upcoming' && !isCompetitionMatch && onReschedule && (
          <RescheduleMatchDialog match={match} onReschedule={onReschedule} isSubmitting={isRescheduling}>
            <Button size="sm" variant="outline" aria-label="Reprogramar partido">
              <CalendarClock className="mr-2 h-4 w-4" aria-hidden="true" />
              Reprogramar
            </Button>
          </RescheduleMatchDialog>
        )}
        {/* Cambiar Cancha: solo upcoming, no competition */}
        {match.status === 'upcoming' && !isCompetitionMatch && onChangeLocation && (
          <ChangeVenueDialog match={match} onChangeLocation={onChangeLocation} isSubmitting={isChangingLocation}>
            <Button size="sm" variant="outline" aria-label="Cambiar cancha">
              <MapPin className="mr-2 h-4 w-4" aria-hidden="true" />
              Cambiar Cancha
            </Button>
          </ChangeVenueDialog>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={isDeleting}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
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
                Esta acción es permanente y no se puede deshacer. Los jugadores inscriptos recibirán una notificación de cancelación.
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
