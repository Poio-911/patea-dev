
'use client';

import { useState, useMemo } from 'react';
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
import type { Group, Player } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Users, PlusCircle, LogIn } from 'lucide-react';
import { nanoid } from 'nanoid';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { TeamList } from '@/components/team-builder/team-list';


const joinGroupSchema = z.object({
  inviteCode: z.string().min(1, 'El código de invitación es obligatorio.'),
});
type JoinGroupForm = z.infer<typeof joinGroupSchema>;

const createGroupSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
});
type CreateGroupForm = z.infer<typeof createGroupSchema>;

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
  
  const loading = activeGroupLoading || playersLoading;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={activeGroup ? activeGroup.name : 'Mis Grupos'}
        description={activeGroup ? `Código de invitación: ${activeGroup.inviteCode}` : 'Gestiona tus grupos, únete a uno nuevo o crea el tuyo.'}
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
      
      {loading ? (
        <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
      ) : !activeGroup || !user ? (
        <Alert className="text-center py-10">
          <Users className="h-6 w-6 mx-auto mb-2" />
          <AlertTitle>No estás en ningún grupo</AlertTitle>
          <AlertDescription>Crea tu primer grupo o únete a uno usando un código de invitación.</AlertDescription>
        </Alert>
      ) : (
        <TeamList groupId={activeGroup.id} players={groupPlayers || []} currentUserId={user.uid} />
      )}
    </div>
  );
}
