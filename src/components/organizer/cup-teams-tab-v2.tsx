'use client';

import * as React from 'react';
import { useDoc, useFirestore, useUser } from '@/firebase';
import { doc, collection, addDoc, deleteDoc, updateDoc, onSnapshot, query, writeBatch } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Users, Plus, Trash2, Edit2, AlertTriangle, Shield } from 'lucide-react';
import { JerseyPreview } from '@/components/team-builder/jersey-preview';
import { CompactTeamDialog } from '@/components/organizer/compact-team-dialog';
import { ManagePlayersDialogImproved } from '@/components/organizer/manage-players-dialog-improved';
import type { Cup, Jersey } from '@/lib/types';

interface Player {
  id: string;
  name: string;
  number: number | string;
}

interface Team {
  id: string;
  name: string;
  jersey: Jersey;
  cupId: string;
  players?: Player[];
  playerCount?: number;
}

interface CupTeamsTabProps {
  cupId: string;
  cupName: string;
}

export function CupTeamsTab({ cupId, cupName }: CupTeamsTabProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const cupRef = React.useMemo(() => {
    if (!firestore || !cupId) return null;
    return doc(firestore, 'cups', cupId);
  }, [firestore, cupId]);

  const { data: cup } = useDoc<Cup>(cupRef);

  const [teams, setTeams] = React.useState<Team[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [teamToDelete, setTeamToDelete] = React.useState<string | null>(null);
  const [editingTeam, setEditingTeam] = React.useState<Team | null>(null);
  const [rosterTeam, setRosterTeam] = React.useState<Team | null>(null);

  // Subscribe to teams
  React.useEffect(() => {
    if (!firestore || !cupId) return;

    const teamsQuery = query(collection(firestore, 'cups', cupId, 'teams'));
    const unsubscribe = onSnapshot(teamsQuery, (snapshot) => {
      const teamsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Team));
      setTeams(teamsData);
    });

    return () => unsubscribe();
  }, [firestore, cupId]);

  const hasBracket = cup?.bracket && cup.bracket.length > 0;
  const canModify = !hasBracket;

  const handleAddTeam = async (teamName: string, jersey: Jersey) => {
    if (!firestore || !cupRef || !user) return;

    // Check for duplicate name
    const existingTeam = teams.find(
      t => t.name.toLowerCase().trim() === teamName.toLowerCase().trim()
    );
    if (existingTeam) {
      toast({
        variant: 'destructive',
        title: 'Equipo Duplicado',
        description: `Ya existe un equipo con el nombre "${teamName}" en esta copa.`,
      });
      return;
    }

    // Check if limit reached (32 teams max)
    if (teams.length >= 32) {
      toast({
        variant: 'destructive',
        title: 'Límite Alcanzado',
        description: 'Una copa no puede tener más de 32 equipos.',
      });
      return;
    }

    try {
      const teamsCollection = collection(firestore, 'cups', cupId, 'teams');
      const newTeamRef = await addDoc(teamsCollection, {
        name: teamName,
        jersey,
        cupId,
        createdAt: new Date().toISOString(),
      });

      // Update cup.teams array with team reference
      await updateDoc(cupRef, {
        teams: [
          ...(cup?.teams || []),
          {
            id: newTeamRef.id,
            name: teamName,
            jersey,
          }
        ]
      });

      toast({
        title: 'Equipo Agregado',
        description: `${teamName} fue añadido a la copa.`,
      });
    } catch (error: any) {
      console.error('[CupTeamsTab] Error adding team:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo agregar el equipo.',
      });
    }
  };

  const handleBulkAddTeams = async (teamsData: Array<{ name: string; jersey: Jersey }>) => {
    if (!firestore || !cupRef || !user) return;

    try {
      // Check for duplicates
      const duplicates = teamsData.filter(newTeam =>
        teams.some(existingTeam =>
          existingTeam.name.toLowerCase().trim() === newTeam.name.toLowerCase().trim()
        )
      );

      if (duplicates.length > 0) {
        toast({
          variant: 'destructive',
          title: 'Equipos Duplicados',
          description: `Los siguientes equipos ya existen: ${duplicates.map(t => t.name).join(', ')}`,
        });
        return;
      }

      // Check if limit exceeded
      if (teams.length + teamsData.length > 32) {
        toast({
          variant: 'destructive',
          title: 'Límite Excedido',
          description: `No podés agregar ${teamsData.length} equipos. El límite es 32 y ya tenés ${teams.length}.`,
        });
        return;
      }

      const batch = writeBatch(firestore);
      const teamsCollection = collection(firestore, 'cups', cupId, 'teams');
      const newTeamsArray: Array<{ id: string; name: string; jersey: Jersey }> = [];

      // Add all teams in batch
      for (const teamData of teamsData) {
        const newTeamRef = doc(teamsCollection);
        batch.set(newTeamRef, {
          name: teamData.name,
          jersey: teamData.jersey,
          cupId,
          createdAt: new Date().toISOString(),
        });

        newTeamsArray.push({
          id: newTeamRef.id,
          name: teamData.name,
          jersey: teamData.jersey,
        });
      }

      // Update cup.teams array
      batch.update(cupRef, {
        teams: [...(cup?.teams || []), ...newTeamsArray]
      });

      await batch.commit();

      toast({
        title: '✨ Equipos Creados',
        description: `Se agregaron ${teamsData.length} equipos exitosamente.`,
      });
    } catch (error: any) {
      console.error('[CupTeamsTab] Error bulk adding teams:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudieron agregar los equipos.',
      });
    }
  };

  const handleEditTeam = async (teamName: string, jersey: Jersey) => {
    if (!firestore || !cupRef || !editingTeam) return;

    // Check for duplicate name (excluding current team)
    const existingTeam = teams.find(
      t => t.id !== editingTeam.id && t.name.toLowerCase().trim() === teamName.toLowerCase().trim()
    );
    if (existingTeam) {
      toast({
        variant: 'destructive',
        title: 'Equipo Duplicado',
        description: `Ya existe otro equipo con el nombre "${teamName}" en esta copa.`,
      });
      return;
    }

    try {
      const teamDocRef = doc(firestore, 'cups', cupId, 'teams', editingTeam.id);
      await updateDoc(teamDocRef, {
        name: teamName,
        jersey,
      });

      // Update cup.teams array
      const updatedTeams = (cup?.teams || []).map(t =>
        t.id === editingTeam.id
          ? { ...t, name: teamName, jersey }
          : t
      );
      await updateDoc(cupRef, { teams: updatedTeams });

      toast({
        title: 'Equipo Actualizado',
        description: `${teamName} fue modificado exitosamente.`,
      });

      setEditingTeam(null);
    } catch (error: any) {
      console.error('[CupTeamsTab] Error editing team:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo actualizar el equipo.',
      });
    }
  };

  const handleDeleteTeam = async () => {
    if (!firestore || !cupRef || !teamToDelete) return;

    try {
      const teamDocRef = doc(firestore, 'cups', cupId, 'teams', teamToDelete);
      await deleteDoc(teamDocRef);

      // Update cup.teams array
      const updatedTeams = (cup?.teams || []).filter(t => t.id !== teamToDelete);
      await updateDoc(cupRef, { teams: updatedTeams });

      toast({
        title: 'Equipo Eliminado',
        description: 'El equipo fue removido de la copa.',
      });

      setTeamToDelete(null);
    } catch (error: any) {
      console.error('[CupTeamsTab] Error deleting team:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo eliminar el equipo.',
      });
    }
  };

  const openEditDialog = (team: Team) => {
    setEditingTeam(team);
    setIsEditDialogOpen(true);
  };

  // Player management handlers
  const handleAddPlayer = async (name: string, number: string) => {
    if (!firestore || !rosterTeam) return;

    const newPlayer: Player = {
      id: `gp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name,
      number: number ? parseInt(number, 10) : ''
    };

    const updatedPlayers = [...(rosterTeam.players || []), newPlayer];
    const teamRef = doc(firestore, 'cups', cupId, 'teams', rosterTeam.id);

    await updateDoc(teamRef, {
      players: updatedPlayers,
      playerCount: updatedPlayers.length
    });
  };

  const handleAddPlayersBulk = async (players: Array<{ name: string; number: string }>) => {
    if (!firestore || !rosterTeam) return;

    const newPlayers: Player[] = players.map(p => ({
      id: `gp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: p.name,
      number: p.number ? parseInt(p.number, 10) : ''
    }));

    const updatedPlayers = [...(rosterTeam.players || []), ...newPlayers];
    const teamRef = doc(firestore, 'cups', cupId, 'teams', rosterTeam.id);

    await updateDoc(teamRef, {
      players: updatedPlayers,
      playerCount: updatedPlayers.length
    });
  };

  const handleRemovePlayer = async (playerId: string) => {
    if (!firestore || !rosterTeam) return;

    const updatedPlayers = (rosterTeam.players || []).filter(p => p.id !== playerId);
    const teamRef = doc(firestore, 'cups', cupId, 'teams', rosterTeam.id);

    await updateDoc(teamRef, {
      players: updatedPlayers,
      playerCount: updatedPlayers.length
    });
  };

  const validSizes = [2, 4, 8, 16, 32];
  const nextValidSize = validSizes.find(size => size > teams.length) || 32;
  const isValidSize = validSizes.includes(teams.length);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            Equipos Participantes
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {teams.length} equipo{teams.length !== 1 ? 's' : ''} inscripto{teams.length !== 1 ? 's' : ''}
            {!isValidSize && teams.length > 0 && (
              <span className="ml-2 text-amber-500 font-medium">
                • Necesitás {nextValidSize} equipos para generar el bracket
              </span>
            )}
          </p>
        </div>

        <Button
          onClick={() => setIsAddDialogOpen(true)}
          disabled={!canModify || teams.length >= 32}
          size="lg"
          className="font-bold"
        >
          <Plus className="mr-2 h-5 w-5" />
          Agregar Equipo
        </Button>
      </div>

      {/* Warning if bracket exists */}
      {hasBracket && (
        <Alert variant="destructive" className="border-destructive/50 bg-destructive/5">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>El bracket ya fue generado.</strong> Si agregás o eliminás equipos, deberás regenerar el bracket
            desde la pestaña Bracket, lo que eliminará todos los partidos jugados.
          </AlertDescription>
        </Alert>
      )}

      {/* Size requirement info */}
      {!hasBracket && (
        <Alert className="border-primary/20 bg-primary/5">
          <Shield className="h-4 w-4 text-primary" />
          <AlertDescription className="text-sm">
            <strong>Equipos requeridos:</strong> Una copa debe tener exactamente 2, 4, 8, 16 o 32 equipos para generar el bracket de eliminación directa.
            {teams.length > 0 && !isValidSize && (
              <span className="block mt-1 font-medium">
                Agregá {nextValidSize - teams.length} equipo{nextValidSize - teams.length !== 1 ? 's' : ''} más para alcanzar {nextValidSize}.
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Teams Grid */}
      {teams.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((team) => (
            <Card key={team.id} className="group hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <JerseyPreview jersey={team.jersey} size="md" />
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">{team.name}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {team.playerCount || 0} jugador{team.playerCount !== 1 ? 'es' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setRosterTeam(team)}
                      title="Gestionar jugadores"
                    >
                      <Users className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEditDialog(team)}
                      disabled={!canModify}
                      title="Editar equipo"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setTeamToDelete(team.id)}
                      disabled={!canModify}
                      title="Eliminar equipo"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
              <Users className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <div>
              <h3 className="font-bold text-lg">No hay equipos inscriptos</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-1">
                Empezá agregando equipos para poder generar el bracket de la copa.
              </p>
            </div>
            <Button onClick={() => setIsAddDialogOpen(true)} className="mt-2">
              <Plus className="mr-2 h-4 w-4" />
              Agregar Primer Equipo
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Add Team Dialog */}
      <CompactTeamDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSave={handleAddTeam}
        onBulkSave={handleBulkAddTeams}
        title="Identidad del Equipo"
        saveButtonText="Confirmar"
      />

      {/* Edit Team Dialog */}
      {editingTeam && (
        <CompactTeamDialog
          open={isEditDialogOpen}
          onOpenChange={(open) => {
            setIsEditDialogOpen(open);
            if (!open) setEditingTeam(null);
          }}
          onSave={handleEditTeam}
          initialName={editingTeam.name}
          initialJersey={editingTeam.jersey}
          title="Editar Identidad"
          saveButtonText="Guardar Cambios"
        />
      )}

      {/* Manage Players Dialog */}
      {rosterTeam && (
        <ManagePlayersDialogImproved
          open={!!rosterTeam}
          onOpenChange={(open) => !open && setRosterTeam(null)}
          teamName={rosterTeam.name}
          players={rosterTeam.players || []}
          onAddPlayer={handleAddPlayer}
          onAddPlayersBulk={handleAddPlayersBulk}
          onRemovePlayer={handleRemovePlayer}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!teamToDelete} onOpenChange={(open) => !open && setTeamToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este equipo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El equipo será removido permanentemente de la copa.
              {hasBracket && (
                <span className="block mt-2 text-destructive font-medium">
                  ⚠️ Tendrás que regenerar el bracket después de eliminar este equipo.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTeam} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
