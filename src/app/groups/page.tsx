

'use client';

import { useState, useMemo, useEffect } from 'react';
import { useUser, useFirestore, useDoc, useCollection } from '@/firebase';
import {
  collection,
  query,
  where,
  addDoc,
  updateDoc,
  doc,
  arrayUnion,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import type { Group, Player, GroupTeam } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Users, Edit, Trash2, Copy, PlusCircle, LogIn, Star, Goal, Trophy, Shield } from 'lucide-react';
import { nanoid } from 'nanoid';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CreateTeamDialog } from '@/components/create-team-dialog';

const joinGroupSchema = z.object({
  inviteCode: z.string().min(1, 'El código de invitación es obligatorio.'),
});
type JoinGroupForm = z.infer<typeof joinGroupSchema>;

const createGroupSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
});
type CreateGroupForm = z.infer<typeof createGroupSchema>;

const JerseyIcon = ({ primaryColor, secondaryColor, style }: { primaryColor: string, secondaryColor: string, style: string }) => (
    <svg viewBox="0 0 486.347 486.347" className="w-full h-full">
      <defs>
        <pattern id={`stripes-${primaryColor}-${secondaryColor}`} patternUnits="userSpaceOnUse" width="20" height="20">
          <path d="M0 0 H 20 V 20 H 0 Z" fill={primaryColor} />
          <path d="M0 0 H 10 V 20 H 0 Z" fill={secondaryColor} />
        </pattern>
        <linearGradient id={`sash-${primaryColor}-${secondaryColor}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="45%" stopColor={primaryColor} />
          <stop offset="45%" stopColor={secondaryColor} />
          <stop offset="55%" stopColor={secondaryColor} />
          <stop offset="55%" stopColor={primaryColor} />
        </linearGradient>
      </defs>
      <g>
          <path d="M14.32,158.336c2.691,10.546,12.167,17.909,23.057,17.909c1.922,0,3.845-0.236,5.723-0.701l39.417-9.79 c4.466-1.072,5.626,2.404,5.626,4.396v249.939c0,13.049,10.63,23.676,23.686,23.676H374.7c13.063,0,23.699-10.627,23.699-23.676 V170.208c0-1.729,0.497-4.626,3.892-4.626c0.528,0,1.13,0.08,1.719,0.23l39.237,9.74c1.871,0.465,3.803,0.702,5.727,0.702 c10.892,0,20.369-7.364,23.051-17.909l13.577-53.215c1.566-6.141,0.645-12.509-2.605-17.941 c-3.241-5.422-8.411-9.253-14.559-10.778L343.975,45.511c-7.489-1.905-15.212-2.879-22.998-2.879l-30.453-0.05l-1.454,6.015 c-5.154,21.454-24.149,36.434-46.196,36.434c-22.051,0-41.05-14.979-46.198-36.434l-1.453-6.015h-28.569l-1.403,0.058 c-7.72,0-15.437,0.974-22.876,2.863L17.915,76.41c-6.155,1.525-11.319,5.356-14.569,10.778c-3.242,5.424-4.17,11.8-2.599,17.941 L14.32,158.336z" 
            fill={style === 'solid' ? primaryColor : style === 'stripes' ? `url(#stripes-${primaryColor}-${secondaryColor})` : `url(#sash-${primaryColor}-${secondaryColor})`} />
      </g>
    </svg>
);


export default function GroupsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [isJoining, setIsJoining] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);


  const joinForm = useForm<JoinGroupForm>({ resolver: zodResolver(joinGroupSchema) });
  const createForm = useForm<CreateGroupForm>({ resolver: zodResolver(createGroupSchema) });

  const activeGroupRef = useMemo(() => {
    if (!firestore || !user?.activeGroupId) return null;
    return doc(firestore, 'groups', user.activeGroupId);
  }, [firestore, user?.activeGroupId]);
  const { data: activeGroup, loading: activeGroupLoading } = useDoc<Group>(activeGroupRef);

  const groupPlayersQuery = useMemo(() => {
    if (!firestore || !user?.activeGroupId) return null;
    return query(collection(firestore, 'players'), where('groupId', '==', user.activeGroupId));
  }, [firestore, user?.activeGroupId]);
  const { data: groupPlayers, loading: playersLoading } = useCollection<Player>(groupPlayersQuery);

  const groupTeamsQuery = useMemo(() => {
    if (!firestore || !user?.activeGroupId) return null;
    return query(collection(firestore, 'groups', user.activeGroupId, 'teams'));
  }, [firestore, user?.activeGroupId]);
  const { data: groupTeams, loading: teamsLoading } = useCollection<GroupTeam>(groupTeamsQuery);

  const { topOvrPlayers, topScorers, mostMatchesPlayers } = useMemo(() => {
    if (!groupPlayers) return { topOvrPlayers: [], topScorers: [], mostMatchesPlayers: [] };
    const sortedByOvr = [...groupPlayers].sort((a, b) => b.ovr - a.ovr).slice(0, 5);
    const sortedByGoals = [...groupPlayers].sort((a, b) => (b.stats?.goals || 0) - (a.stats?.goals || 0)).slice(0, 3);
    const sortedByMatches = [...groupPlayers].sort((a, b) => (b.stats?.matchesPlayed || 0) - (a.stats?.matchesPlayed || 0)).slice(0, 3);
    return { topOvrPlayers: sortedByOvr, topScorers: sortedByGoals, mostMatchesPlayers: sortedByMatches };
  }, [groupPlayers]);

  const handleCreateGroup = async (data: CreateGroupForm) => {
    if (!firestore || !user) return;
    setIsCreating(true);

    const batch = writeBatch(firestore);
    const newGroupRef = doc(collection(firestore, 'groups'));
    const userRef = doc(firestore, 'users', user.uid);

    try {
      const newGroup: Omit<Group, 'id'> = {
        name: data.name,
        ownerUid: user.uid,
        inviteCode: nanoid(8),
        members: [user.uid],
      };

      batch.set(newGroupRef, newGroup);

      batch.update(userRef, {
        groups: arrayUnion(newGroupRef.id),
        activeGroupId: newGroupRef.id,
      });

      await batch.commit();

      toast({
        title: '¡Grupo Creado!',
        description: `El grupo "${data.name}" se ha creado y establecido como tu grupo activo.`,
      });
      createForm.reset();
      setCreateDialogOpen(false);
    } catch (error) {
      console.error('Error creating group:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo crear el grupo.',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinGroup = async (data: JoinGroupForm) => {
    if (!firestore || !user) return;
    setIsJoining(true);
    try {
      const q = query(collection(firestore, 'groups'), where('inviteCode', '==', data.inviteCode));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        toast({ variant: 'destructive', title: 'Código no válido' });
        return;
      }
      const groupDoc = querySnapshot.docs[0];
      const groupData = groupDoc.data() as Group;

      if (groupData.members.includes(user.uid)) {
        toast({ title: 'Ya eres miembro' });
        return;
      }

      const batch = writeBatch(firestore);
      batch.update(doc(firestore, 'groups', groupDoc.id), { members: arrayUnion(user.uid) });
      batch.update(doc(firestore, 'users', user.uid), {
        groups: arrayUnion(groupDoc.id),
        activeGroupId: groupDoc.id,
      });
      await batch.commit();
      toast({ title: '¡Te has unido al grupo!', description: `Ahora eres miembro de "${groupData.name}".` });
      setJoinDialogOpen(false);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo unir al grupo.' });
    } finally {
      setIsJoining(false);
    }
  };
  
  const loading = activeGroupLoading || playersLoading || teamsLoading;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={activeGroup ? activeGroup.name : 'Mis Grupos'}
        description={activeGroup ? 'El panel de control de tu grupo.' : 'Gestiona tus grupos, únete a uno nuevo o crea el tuyo.'}
      >
        <div className="flex items-center gap-2">
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild><Button variant="outline"><PlusCircle className="mr-2 h-4 w-4"/>Crear Grupo</Button></DialogTrigger>
                <DialogContent>
                    <DialogHeader><DialogTitle>Crear un Grupo Nuevo</DialogTitle></DialogHeader>
                    <form onSubmit={createForm.handleSubmit(handleCreateGroup)} className="space-y-4">
                        <div>
                            <Label htmlFor="create-group-name">Nombre del grupo</Label>
                            <Input id="create-group-name" {...createForm.register('name')} placeholder="Ej: Los Pibes del Lunes" disabled={isCreating} />
                        </div>
                        <DialogFooter><Button type="submit" disabled={isCreating}>{isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Crear</Button></DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
            <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
                <DialogTrigger asChild><Button><LogIn className="mr-2 h-4 w-4"/>Unirse a un Grupo</Button></DialogTrigger>
                <DialogContent>
                    <DialogHeader><DialogTitle>Unirse a un Grupo</DialogTitle></DialogHeader>
                    <form onSubmit={joinForm.handleSubmit(handleJoinGroup)} className="space-y-4">
                        <div>
                            <Label htmlFor="join-group-code">Código de invitación</Label>
                            <Input id="join-group-code" {...joinForm.register('inviteCode')} placeholder="Ej: aB1cDeF2" disabled={isJoining}/>
                        </div>
                        <DialogFooter><Button type="submit" disabled={isJoining}>{isJoining && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Unirse</Button></DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
      </PageHeader>
      
      <Separator />

      {loading ? (
        <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
      ) : !activeGroup ? (
        <Alert className="text-center py-10">
          <Users className="h-6 w-6 mx-auto mb-2" />
          <AlertTitle>No estás en ningún grupo</AlertTitle>
          <AlertDescription>Crea tu primer grupo o únete a uno usando un código de invitación.</AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                                <div className="flex items-center gap-2"><Shield className="h-6 w-6 text-primary" />Equipos del Grupo</div>
                                <CreateTeamDialog groupPlayers={groupPlayers || []} />
                            </CardTitle>
                            <CardDescription>Equipos fijos creados por los miembros para desafíos internos.</CardDescription>
                        </CardHeader>
                        <CardContent>
                             {groupTeams && groupTeams.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {groupTeams.map(team => (
                                        <Card key={team.id} className="p-4 flex items-center gap-4">
                                            <div className="h-16 w-16 flex-shrink-0">
                                              <JerseyIcon {...team.jersey} />
                                            </div>
                                            <div>
                                                <h4 className="font-bold">{team.name}</h4>
                                                <p className="text-sm text-muted-foreground">{team.members.length} miembros</p>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-center text-sm text-muted-foreground py-4">Aún no se han creado equipos fijos en este grupo.</p>
                            )}
                        </CardContent>
                    </Card>
                </div>
                 <div className="lg:col-span-1 space-y-8">
                    <Card>
                        <CardHeader><CardTitle className="flex items-center gap-2"><Star className="h-5 w-5 text-amber-500"/>Top 5 Jugadores (OVR)</CardTitle></CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {topOvrPlayers.map((player, index) => (
                                    <div key={player.id} className="flex items-center gap-3">
                                        <div className="font-bold text-sm w-4">{index + 1}.</div>
                                        <Avatar className="h-9 w-9"><AvatarImage src={player.photoUrl} alt={player.name} /><AvatarFallback>{player.name.charAt(0)}</AvatarFallback></Avatar>
                                        <p className="font-medium flex-1 truncate">{player.name}</p>
                                        <div className="font-bold text-primary">{player.ovr}</div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2"><Goal className="h-5 w-5 text-red-500"/>Máximos Goleadores</CardTitle></CardHeader>
                    <CardContent>
                         <div className="space-y-3">
                            {topScorers.map((player, index) => (
                                <div key={player.id} className="flex items-center gap-3">
                                    <div className="font-bold text-sm w-4">{index + 1}.</div>
                                    <Avatar className="h-9 w-9"><AvatarImage src={player.photoUrl} alt={player.name} /><AvatarFallback>{player.name.charAt(0)}</AvatarFallback></Avatar>
                                    <p className="font-medium flex-1 truncate">{player.name}</p>
                                    <div className="font-bold">{player.stats?.goals || 0}</div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-yellow-500"/>Más Partidos</CardTitle></CardHeader>
                    <CardContent>
                         <div className="space-y-3">
                            {mostMatchesPlayers.map((player, index) => (
                                <div key={player.id} className="flex items-center gap-3">
                                    <div className="font-bold text-sm w-4">{index + 1}.</div>
                                    <Avatar className="h-9 w-9"><AvatarImage src={player.photoUrl} alt={player.name} /><AvatarFallback>{player.name.charAt(0)}</AvatarFallback></Avatar>
                                    <p className="font-medium flex-1 truncate">{player.name}</p>
                                    <div className="font-bold">{player.stats?.matchesPlayed || 0}</div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
      )}
    </div>
  );
}
