'use client';

import * as React from 'react';
import { useFirestore, useDoc } from '@/firebase';
import { collection, addDoc, query, onSnapshot, deleteDoc, doc, writeBatch, updateDoc, getDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Trash2, Users, Shield, Edit2, AlertTriangle } from 'lucide-react';
import type { Jersey } from '@/lib/types';
import { JerseyPreview } from '@/components/team-builder/jersey-preview';
import { ManagePlayersDialogImproved } from '@/components/organizer/manage-players-dialog-improved';
import { CompactTeamDialog } from '@/components/organizer/compact-team-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
  isGhost?: boolean;
}

interface CompetitionTeamsTabProps {
  competitionId: string;
  competitionType: 'leagues' | 'cups';
  competitionName: string;
  isReadOnly?: boolean;
}

export function CompetitionTeamsTab({ competitionId, competitionType, competitionName, isReadOnly }: CompetitionTeamsTabProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [teams, setTeams] = React.useState<GhostTeam[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  
  const [rosterTeam, setRosterTeam] = React.useState<GhostTeam | null>(null);
  const [isRosterOpen, setIsRosterOpen] = React.useState(false);

  const [editingTeam, setEditingTeam] = React.useState<GhostTeam | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);

  const compRef = React.useMemo(() => {
    if (!firestore || !competitionId) return null;
    return doc(firestore, competitionType, competitionId);
  }, [firestore, competitionId, competitionType]);

  const { data: compData } = useDoc<any>(compRef);

  React.useEffect(() => {
    if (!firestore) return;
    const teamsRef = collection(firestore, competitionType, competitionId, 'teams');
    const unsub = onSnapshot(query(teamsRef), (snap) => {
      setTeams(snap.docs.map(d => ({ id: d.id, ...d.data() } as GhostTeam)));
      setLoading(false);
    }, (err) => {
      console.error('[CompetitionTeams] Error:', err);
      setLoading(false);
    });
    return () => unsub();
  }, [firestore, competitionId, competitionType]);

  const syncCupTeamsArray = async (updatedTeams: GhostTeam[]) => {
    if (competitionType !== 'cups' || !compRef) return;
    const arrayForCup = updatedTeams.map(t => ({
      id: t.id,
      name: t.name,
      jersey: t.jersey
    }));
    await updateDoc(compRef, { teams: arrayForCup });
  };

  const handleSaveTeam = async (teamName: string, jersey: Jersey) => {
    if (!firestore) return;
    const nameMatch = teams.find(t => t.name.toLowerCase().trim() === teamName.toLowerCase().trim());
    if (nameMatch) {
      toast({ variant: 'destructive', title: 'Equipo Duplicado', description: `Ya existe "${teamName}" en este torneo.` });
      return;
    }

    try {
      const teamsRef = collection(firestore, competitionType, competitionId, 'teams');
      const newDoc = await addDoc(teamsRef, {
        name: teamName,
        jersey,
        isGhost: true,
        playerCount: 0,
        players: [],
        createdAt: new Date().toISOString(),
      });

      if (competitionType === 'cups') {
        const newTeam = { id: newDoc.id, name: teamName, jersey, playerCount: 0, players: [] };
        await syncCupTeamsArray([...teams, newTeam]);
      }

      toast({ title: '¡Equipo Inscripto!', description: `${teamName} fue agregado.` });
      setIsAddOpen(false);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo crear el equipo.' });
    }
  };

  const handleSaveBulk = async (bulkTeams: Array<{ name: string; jersey: Jersey }>) => {
    if (!firestore) return;
    try {
      const batch = writeBatch(firestore);
      const teamsRef = collection(firestore, competitionType, competitionId, 'teams');
      const newTeamsForSync: any[] = [];

      for (const t of bulkTeams) {
        if (teams.find(ex => ex.name.toLowerCase().trim() === t.name.toLowerCase().trim())) continue;
        const newRef = doc(teamsRef);
        const data = { name: t.name, jersey: t.jersey, isGhost: true, playerCount: 0, players: [], createdAt: new Date().toISOString() };
        batch.set(newRef, data);
        newTeamsForSync.push({ id: newRef.id, ...data });
      }

      await batch.commit();
      if (competitionType === 'cups') {
        await syncCupTeamsArray([...teams, ...newTeamsForSync]);
      }
      toast({ title: 'Equipos Inscriptos', description: `Se agregaron ${newTeamsForSync.length} equipos.` });
      setIsAddOpen(false);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron crear los equipos.' });
    }
  };

  const handleDelete = async (teamId: string, teamName: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, competitionType, competitionId, 'teams', teamId));
      if (competitionType === 'cups') {
        await syncCupTeamsArray(teams.filter(t => t.id !== teamId));
      }
      toast({ title: 'Equipo eliminado', description: `${teamName} fue removido.` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar el equipo.' });
    }
  };

  const handleEditTeam = async (name: string, jersey: Jersey) => {
    if (!firestore || !editingTeam) return;
    try {
      const teamRef = doc(firestore, competitionType, competitionId, 'teams', editingTeam.id);
      await updateDoc(teamRef, { name, jersey });
      if (competitionType === 'cups') {
        const updated = teams.map(t => t.id === editingTeam.id ? { ...t, name, jersey } : t);
        await syncCupTeamsArray(updated);
      }
      toast({ title: 'Equipo Actualizado', description: `${name} fue modificado.` });
      setIsEditDialogOpen(false);
      setEditingTeam(null);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo actualizar el equipo.' });
    }
  };

  const handleAddPlayer = async (name: string, number: string) => {
    if (!firestore || !rosterTeam) return;
    const newPlayer = { id: `gp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`, name, number: number ? parseInt(number, 10) : '' };
    const updatedPlayers = [...(rosterTeam.players || []), newPlayer];
    const teamRef = doc(firestore, competitionType, competitionId, 'teams', rosterTeam.id);
    await updateDoc(teamRef, { players: updatedPlayers, playerCount: updatedPlayers.length });
  };

  const handleAddPlayersBulk = async (players: Array<{ name: string; number: string }>) => {
    if (!firestore || !rosterTeam) return;
    const newPs = players.map(p => ({ id: `gp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`, name: p.name, number: p.number ? parseInt(p.number, 10) : '' }));
    const updatedPlayers = [...(rosterTeam.players || []), ...newPs];
    const teamRef = doc(firestore, competitionType, competitionId, 'teams', rosterTeam.id);
    await updateDoc(teamRef, { players: updatedPlayers, playerCount: updatedPlayers.length });
  };

  const handleRemovePlayer = async (pid: string) => {
    if (!firestore || !rosterTeam) return;
    const updated = (rosterTeam.players || []).filter(p => p.id !== pid);
    const teamRef = doc(firestore, competitionType, competitionId, 'teams', rosterTeam.id);
    await updateDoc(teamRef, { players: updated, playerCount: updated.length });
  };

  const hasBracket = competitionType === 'cups' && compData?.bracket && compData.bracket.length > 0;

  if (loading) return <div className="grid gap-4 md:grid-cols-3">{[1, 2, 3].map(i => <Card key={i} className="animate-pulse h-32" />)}</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black uppercase tracking-tight">{teams.length} Equipos Inscriptos</h2>
          <p className="text-sm text-muted-foreground">Gestioná los equipos y sus planteles de jugadores personalizados.</p>
        </div>
        <Button onClick={() => setIsAddOpen(true)} disabled={isReadOnly || (hasBracket && competitionType === 'cups')}>
          <PlusCircle className="mr-2 h-4 w-4" /> Inscribir Equipo
        </Button>
      </div>

      {hasBracket && competitionType === 'cups' && (
        <Alert variant="destructive" className="bg-destructive/5 border-destructive/20">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>El bracket ya está generado.</strong> No podés agregar ni eliminar equipos sin regenerar el bracket (lo cual borraría el progreso actual).
          </AlertDescription>
        </Alert>
      )}

      {teams.length === 0 ? (
        <Card className="border-dashed py-12 text-center">
          <Users className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="font-bold text-lg">Sin equipos todavía</h3>
          <Button variant="outline" className="mt-4" onClick={() => setIsAddOpen(true)}>Inscribir Primer Equipo</Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {teams.map(team => (
            <Card key={team.id} className="group hover:border-primary/50 transition-colors bg-card/60 backdrop-blur-sm border-border/50 overflow-hidden">
              <CardContent className="p-4 flex items-start gap-4">
                <JerseyPreview jersey={team.jersey} size="sm" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-base uppercase truncate">{team.name}</h3>
                  <p className="text-xs text-muted-foreground">{team.playerCount || 0} jugadores</p>
                </div>
              </CardContent>
              <div className="bg-muted/30 px-4 py-3 border-t border-border/50 flex items-center justify-between">
                <Button variant="outline" size="sm" className="h-8 text-xs font-bold" onClick={() => { setRosterTeam(team); setIsRosterOpen(true); }}>
                  <Users className="h-3.5 w-3.5 mr-1.5" /> Plantel
                </Button>
                {!isReadOnly && (
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => { setEditingTeam(team); setIsEditDialogOpen(true); }} disabled={hasBracket && competitionType === 'cups'}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => handleDelete(team.id, team.name)} disabled={hasBracket && competitionType === 'cups'}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <CompactTeamDialog open={isAddOpen} onOpenChange={setIsAddOpen} onSave={handleSaveTeam} onBulkSave={handleSaveBulk} title="Inscribir Equipos" saveButtonText="Inscribir" />
      
      {editingTeam && (
        <CompactTeamDialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} onSave={handleEditTeam} initialName={editingTeam.name} initialJersey={editingTeam.jersey} title="Editar Equipo" saveButtonText="Guardar" />
      )}

      <ManagePlayersDialogImproved 
        open={isRosterOpen} 
        onOpenChange={setIsRosterOpen} 
        teamName={rosterTeam?.name || ''} 
        players={rosterTeam?.players || []} 
        onAddPlayer={handleAddPlayer} 
        onAddPlayersBulk={handleAddPlayersBulk} 
        onRemovePlayer={handleRemovePlayer} 
      />
    </div>
  );
}
