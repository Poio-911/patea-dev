'use client';

import * as React from 'react';
import { useDoc, useFirestore, useUser } from '@/firebase';
import { doc, collection, addDoc, deleteDoc, updateDoc, onSnapshot, query } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Users, Plus, Trash2, Edit2, AlertTriangle, Shield } from 'lucide-react';
import { JerseyPreview } from '@/components/team-builder/jersey-preview';
import { JerseyDesigner } from '@/components/team-builder/jersey-designer';
import type { Cup, Jersey } from '@/lib/types';

interface Team {
  id: string;
  name: string;
  jersey: Jersey;
  cupId: string;
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

  const [teamName, setTeamName] = React.useState('');
  const [teamJersey, setTeamJersey] = React.useState<Jersey>({
    primaryColor: '#FF0000',
    secondaryColor: '#FFFFFF',
    pattern: 'solid',
  });

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

  const handleAddTeam = async () => {
    if (!firestore || !cupRef || !user) return;

    if (!teamName.trim()) {
      toast({
        variant: 'destructive',
        title: 'Nombre Requerido',
        description: 'Por favor ingresá un nombre para el equipo.',
      });
      return;
    }

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
        name: teamName.trim(),
        jersey: teamJersey,
        cupId,
        createdAt: new Date().toISOString(),
      });

      // Update cup.teams array with team reference
      await updateDoc(cupRef, {
        teams: [
          ...(cup?.teams || []),
          {
            id: newTeamRef.id,
            name: teamName.trim(),
            jersey: teamJersey,
          }
        ]
      });

      toast({
        title: 'Equipo Agregado',
        description: `${teamName} fue añadido a la copa.`,
      });

      setTeamName('');
      setTeamJersey({
        primaryColor: '#FF0000',
        secondaryColor: '#FFFFFF',
        pattern: 'solid',
      });
      setIsAddDialogOpen(false);
    } catch (error: any) {
      console.error('[CupTeamsTab] Error adding team:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo agregar el equipo.',
      });
    }
  };

  const handleEditTeam = async () => {
    if (!firestore || !cupRef || !editingTeam) return;

    if (!teamName.trim()) {
      toast({
        variant: 'destructive',
        title: 'Nombre Requerido',
        description: 'Por favor ingresá un nombre para el equipo.',
      });
      return;
    }

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
        name: teamName.trim(),
        jersey: teamJersey,
      });

      // Update cup.teams array
      const updatedTeams = (cup?.teams || []).map(t =>
        t.id === editingTeam.id
          ? { ...t, name: teamName.trim(), jersey: teamJersey }
          : t
      );
      await updateDoc(cupRef, { teams: updatedTeams });

      toast({
        title: 'Equipo Actualizado',
        description: `${teamName} fue modificado exitosamente.`,
      });

      setEditingTeam(null);
      setIsEditDialogOpen(false);
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
    setTeamName(team.name);
    setTeamJersey(team.jersey);
    setIsEditDialogOpen(true);
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
                    <CardTitle className="text-lg truncate">{team.name}</CardTitle>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEditDialog(team)}
                      disabled={!canModify}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setTeamToDelete(team.id)}
                      disabled={!canModify}
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

      {/* Add/Edit Team Dialog */}
      <Dialog open={isAddDialogOpen || isEditDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setIsAddDialogOpen(false);
          setIsEditDialogOpen(false);
          setEditingTeam(null);
          setTeamName('');
          setTeamJersey({ primaryColor: '#FF0000', secondaryColor: '#FFFFFF', pattern: 'solid' });
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTeam ? 'Editar Equipo' : 'Agregar Equipo'}</DialogTitle>
            <DialogDescription>
              {editingTeam ? 'Modificá el nombre y camiseta del equipo.' : 'Creá un nuevo equipo para la copa.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="teamName">Nombre del Equipo</Label>
              <Input
                id="teamName"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Ej: River Plate"
                maxLength={30}
              />
            </div>

            <div className="space-y-2">
              <Label>Camiseta del Equipo</Label>
              <JerseyDesigner
                value={teamJersey}
                onChange={setTeamJersey}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsAddDialogOpen(false);
              setIsEditDialogOpen(false);
            }}>
              Cancelar
            </Button>
            <Button onClick={editingTeam ? handleEditTeam : handleAddTeam}>
              {editingTeam ? 'Guardar Cambios' : 'Agregar Equipo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
