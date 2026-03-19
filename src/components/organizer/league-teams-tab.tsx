'use client';

import * as React from 'react';
import { useFirestore } from '@/firebase';
import { collection, addDoc, query, onSnapshot, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Loader2, PlusCircle, Trash2, Users, Shield, Edit2 } from 'lucide-react';
import type { Jersey } from '@/lib/types';
import { JerseyPreview } from '@/components/team-builder/jersey-preview';
import { ManagePlayersDialogImproved } from '@/components/organizer/manage-players-dialog-improved';
import { CompactTeamDialog } from '@/components/organizer/compact-team-dialog';

interface GhostPlayer {
  id: string;
  name: string;
  number: number | string;
}

interface GhostTeam {
  id: string;
  name: string;
  jersey: Jersey;
  playerCount: number;
  players: GhostPlayer[];
  isGhost: true;
}

interface LeagueTeamsTabProps {
  leagueId: string;
  leagueName: string;
}

function AddGhostTeamDialog({ leagueId, open, onOpenChange, existingTeams }: { leagueId: string; open: boolean; onOpenChange: (v: boolean) => void; existingTeams: GhostTeam[] }) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const handleSave = async (teamName: string, jersey: Jersey) => {
    if (!firestore) return;

    // Check for duplicate team names (case-insensitive)
    const existingTeam = existingTeams.find(
      t => t.name.toLowerCase().trim() === teamName.toLowerCase().trim()
    );

    if (existingTeam) {
      toast({
        variant: 'destructive',
        title: 'Equipo Duplicado',
        description: `Ya existe un equipo con el nombre "${teamName}" en este torneo.`
      });
      return;
    }

    try {
      const teamsRef = collection(firestore, 'leagues', leagueId, 'teams');
      await addDoc(teamsRef, {
        name: teamName,
        jersey,
        isGhost: true,
        playerCount: 0,
        players: [],
        createdAt: new Date().toISOString(),
      });

      toast({ title: '¡Equipo Inscripto!', description: `${teamName} fue agregado al torneo.` });
      onOpenChange(false);
    } catch (e: any) {
      console.error('[AddGhostTeam] Error:', e);
      toast({ variant: 'destructive', title: 'Error', description: e.message || 'No se pudo crear el equipo.' });
      throw e;
    }
  };

  const handleSaveBulk = async (teams: Array<{ name: string; jersey: Jersey }>) => {
    if (!firestore) return;

    try {
      const batch = writeBatch(firestore);
      const teamsRef = collection(firestore, 'leagues', leagueId, 'teams');

      for (const team of teams) {
        // Skip duplicates
        const existingTeam = existingTeams.find(
          t => t.name.toLowerCase().trim() === team.name.toLowerCase().trim()
        );
        if (existingTeam) continue;

        const newTeamRef = doc(teamsRef);
        batch.set(newTeamRef, {
          name: team.name,
          jersey: team.jersey,
          isGhost: true,
          playerCount: 0,
          players: [],
          createdAt: new Date().toISOString(),
        });
      }

      await batch.commit();
      toast({ title: '¡Equipos Inscriptos!', description: `Se agregaron ${teams.length} equipos al torneo.` });
      onOpenChange(false);
    } catch (e: any) {
      console.error('[AddGhostTeamBulk] Error:', e);
      toast({ variant: 'destructive', title: 'Error', description: e.message || 'No se pudieron crear los equipos.' });
      throw e;
    }
  };

  return (
    <CompactTeamDialog
      open={open}
      onOpenChange={onOpenChange}
      onSave={handleSave}
      onBulkSave={handleSaveBulk}
      title="Identidad del Equipo"
      saveButtonText="Inscribir Equipo"
    />
  );
}

function ManageTeamRosterDialog({ leagueId, team, open, onOpenChange }: { leagueId: string; team: GhostTeam | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const firestore = useFirestore();
  const { toast } = useToast();

  if (!team) return null;

  const handleAddPlayer = async (name: string, number: string) => {
    if (!firestore) return;

    const newPlayer: GhostPlayer = {
      id: `gp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name,
      number: number ? parseInt(number, 10) : ''
    };

    const updatedPlayers = [...(team.players || []), newPlayer];
    const teamRef = doc(firestore, 'leagues', leagueId, 'teams', team.id);

    const { updateDoc } = await import('firebase/firestore');
    await updateDoc(teamRef, {
      players: updatedPlayers,
      playerCount: updatedPlayers.length
    });
  };

  const handleAddPlayersBulk = async (players: Array<{ name: string; number: string }>) => {
    if (!firestore) return;

    const newPlayers: GhostPlayer[] = players.map(p => ({
      id: `gp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: p.name,
      number: p.number ? parseInt(p.number, 10) : ''
    }));

    const updatedPlayers = [...(team.players || []), ...newPlayers];
    const teamRef = doc(firestore, 'leagues', leagueId, 'teams', team.id);

    const { updateDoc } = await import('firebase/firestore');
    await updateDoc(teamRef, {
      players: updatedPlayers,
      playerCount: updatedPlayers.length
    });
  };

  const handleRemovePlayer = async (playerId: string) => {
    if (!firestore) return;

    const updatedPlayers = (team.players || []).filter(p => p.id !== playerId);
    const teamRef = doc(firestore, 'leagues', leagueId, 'teams', team.id);

    const { updateDoc } = await import('firebase/firestore');
    await updateDoc(teamRef, {
      players: updatedPlayers,
      playerCount: updatedPlayers.length
    });
  };

  return (
    <ManagePlayersDialogImproved
      open={open}
      onOpenChange={onOpenChange}
      teamName={team.name}
      players={team.players || []}
      onAddPlayer={handleAddPlayer}
      onAddPlayersBulk={handleAddPlayersBulk}
      onRemovePlayer={handleRemovePlayer}
    />
  );
}

export function LeagueTeamsTab({ leagueId, leagueName }: LeagueTeamsTabProps) {
  const firestore = useFirestore();
  const [teams, setTeams] = React.useState<GhostTeam[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  
  const [rosterTeam, setRosterTeam] = React.useState<GhostTeam | null>(null);
  const [isRosterOpen, setIsRosterOpen] = React.useState(false);

  const [editingTeam, setEditingTeam] = React.useState<GhostTeam | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);

  const { toast } = useToast();

  React.useEffect(() => {
    if (!firestore) return;
    const teamsRef = collection(firestore, 'leagues', leagueId, 'teams');
    const q = query(teamsRef);
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as GhostTeam));
      setTeams(data);
      setLoading(false);
    }, (err) => {
      console.error('[LeagueTeams] Error:', err);
      setLoading(false);
    });
    return () => unsub();
  }, [firestore, leagueId]);

  const handleDelete = async (teamId: string, teamName: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'leagues', leagueId, 'teams', teamId));
      toast({ title: 'Equipo eliminado', description: `${teamName} fue removido del torneo.` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar el equipo.' });
    }
  };

  const handleEditTeam = async (teamName: string, jersey: Jersey) => {
    if (!firestore || !editingTeam) return;

    // Check for duplicate name (excluding current team)
    const existingTeam = teams.find(
      t => t.id !== editingTeam.id && t.name.toLowerCase().trim() === teamName.toLowerCase().trim()
    );

    if (existingTeam) {
      toast({
        variant: 'destructive',
        title: 'Equipo Duplicado',
        description: `Ya existe otro equipo con el nombre "${teamName}" en este torneo.`
      });
      return;
    }

    try {
      const teamRef = doc(firestore, 'leagues', leagueId, 'teams', editingTeam.id);
      await import('firebase/firestore').then(({ updateDoc }) => 
        updateDoc(teamRef, {
          name: teamName,
          jersey
        })
      );

      toast({ title: 'Equipo Actualizado', description: `${teamName} fue modificado exitosamente.` });
      setIsEditDialogOpen(false);
      setEditingTeam(null);
    } catch (e: any) {
      console.error('[EditTeam] Error:', e);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo actualizar el equipo.' });
    }
  };

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map(i => <Card key={i} className="animate-pulse"><CardContent className="h-28" /></Card>)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black uppercase tracking-tight">{teams.length} Equipos Inscriptos</h2>
          <p className="text-sm text-muted-foreground">Creá equipos manuales sin necesidad de que los jugadores tengan cuentas.</p>
        </div>
        <Button onClick={() => setIsAddOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" /> Inscribir Equipo
        </Button>
      </div>

      {teams.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center flex flex-col items-center gap-4">
            <Users className="h-16 w-16 text-muted-foreground/30" />
            <div className="space-y-1">
              <h3 className="font-bold text-lg">Sin equipos todavía</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Empezá inscribiendo los equipos que participarán. Los equipos manuales no necesitan cuentas de usuario para sus jugadores.
              </p>
            </div>
            <Button variant="outline" className="border-primary/20 hover:bg-primary/5 hover:text-primary" onClick={() => setIsAddOpen(true)}>
              <PlusCircle className="mr-2 h-4 w-4" /> Inscribir Primer Equipo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {teams.map(team => (
            <Card key={team.id} className="group flex flex-col hover:border-primary/50 transition-colors bg-card/60 backdrop-blur-sm border-border/50 overflow-hidden">
              <CardContent className="p-4 flex flex-1 items-start gap-4">
                {/* Jersey Mini Preview */}
                <div className="flex-shrink-0 mt-1">
                  <JerseyPreview jersey={team.jersey} size="sm" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-base uppercase tracking-tight leading-tight group-hover:text-primary transition-colors line-clamp-2">{team.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1.5">{team.playerCount || 0} jugadores registrados</p>
                </div>
              </CardContent>
              
              <div className="bg-muted/30 px-4 py-3 border-t border-border/50 flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-bold uppercase tracking-widest bg-background"
                  onClick={() => {
                    setRosterTeam(team);
                    setIsRosterOpen(true);
                  }}
                >
                  <Users className="h-3.5 w-3.5 mr-1.5" />
                  Plantel
                </Button>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setEditingTeam(team);
                      setIsEditDialogOpen(true);
                    }}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(team.id, team.name)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <AddGhostTeamDialog leagueId={leagueId} open={isAddOpen} onOpenChange={setIsAddOpen} existingTeams={teams} />

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
      
      <ManageTeamRosterDialog 
        leagueId={leagueId} 
        team={rosterTeam} 
        open={isRosterOpen} 
        onOpenChange={setIsRosterOpen} 
      />
    </div>
  );
}
