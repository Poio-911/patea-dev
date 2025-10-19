'use client';

import { useState, useMemo, useEffect } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
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
  deleteDoc,
  getDoc,
  runTransaction
} from 'firebase/firestore';
import type { Group, Player } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Users, MoreVertical, Edit, Trash2 } from 'lucide-react';
import { nanoid } from 'nanoid';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
} from "@/components/ui/alert-dialog";

const createGroupSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
});

const joinGroupSchema = z.object({
  inviteCode: z.string().min(1, 'El código de invitación es obligatorio.'),
});

const editGroupSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
});

type CreateGroupForm = z.infer<typeof createGroupSchema>;
type JoinGroupForm = z.infer<typeof joinGroupSchema>;
type EditGroupForm = z.infer<typeof editGroupSchema>;

export default function GroupsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  const [playerCounts, setPlayerCounts] = useState<Record<string, number>>({});

  const createForm = useForm<CreateGroupForm>({ resolver: zodResolver(createGroupSchema) });
  const joinForm = useForm<JoinGroupForm>({ resolver: zodResolver(joinGroupSchema) });
  const editForm = useForm<EditGroupForm>({ resolver: zodResolver(editGroupSchema) });

  const groupsQuery = useMemo(() => {
    if (!firestore || !user?.uid) return null;
    return query(collection(firestore, 'groups'), where('members', 'array-contains', user.uid));
  }, [firestore, user?.uid]);

  const { data: groups, loading: groupsLoading } = useCollection<Group>(groupsQuery);

  useEffect(() => {
    if (groups && firestore) {
      groups.forEach(async (group) => {
        const playersQuery = query(collection(firestore, 'players'), where('groupId', '==', group.id));
        const playersSnapshot = await getDocs(playersQuery);
        setPlayerCounts(prev => ({ ...prev, [group.id]: playersSnapshot.size }));
      });
    }
  }, [groups, firestore]);

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
        toast({
          variant: 'destructive',
          title: 'Código no válido',
          description: 'No se encontró ningún grupo con ese código de invitación.',
        });
        setIsJoining(false);
        return;
      }

      const groupDoc = querySnapshot.docs[0];
      const groupData = groupDoc.data() as Group;

      if (groupData.members.includes(user.uid)) {
        toast({
          variant: 'default',
          title: 'Ya eres miembro',
          description: `Ya perteneces al grupo "${groupData.name}".`,
        });
        setIsJoining(false);
        return;
      }

      const batch = writeBatch(firestore);
      const groupRef = doc(firestore, 'groups', groupDoc.id);
      const userRef = doc(firestore, 'users', user.uid);

      batch.update(groupRef, {
        members: arrayUnion(user.uid),
      });

      batch.update(userRef, {
        groups: arrayUnion(groupDoc.id),
        activeGroupId: groupDoc.id,
      });

      await batch.commit();

      toast({
        title: '¡Te has unido al grupo!',
        description: `Ahora eres miembro de "${groupData.name}" y se ha establecido como tu grupo activo.`,
      });
      joinForm.reset();

    } catch (error) {
      console.error('Error joining group:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo unir al grupo.',
      });
    } finally {
      setIsJoining(false);
    }
  };

  const handleSetActiveGroup = async (groupId: string) => {
    if (!firestore || !user) return;

    const userRef = doc(firestore, 'users', user.uid);

    try {
      await updateDoc(userRef, { activeGroupId: groupId });

      toast({
        title: 'Grupo Activado',
        description: 'Has cambiado tu grupo activo.'
      });
    } catch (error) {
      console.error("Error setting active group:", error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo cambiar el grupo activo.'
      });
    }
  };

  const handleEditGroup = (group: Group) => {
    setEditingGroupId(group.id);
    editForm.setValue('name', group.name);
  };

  const handleUpdateGroup = async (data: EditGroupForm) => {
    if (!firestore || !editingGroupId) return;
    setIsEditing(true);

    const groupRef = doc(firestore, 'groups', editingGroupId);
    try {
      await updateDoc(groupRef, { name: data.name });
      toast({ title: 'Grupo actualizado', description: 'El nombre del grupo ha sido cambiado.' });
      setEditingGroupId(null);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo actualizar el grupo.' });
    } finally {
      setIsEditing(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!firestore || !user || !deletingGroupId) return;
    setIsDeleting(true);

    const groupRef = doc(firestore, 'groups', deletingGroupId);

    try {
      await runTransaction(firestore, async (transaction) => {
        const groupDoc = await transaction.get(groupRef);
        if (!groupDoc.exists()) {
          throw new Error("El grupo no existe.");
        }
        if (groupDoc.data().ownerUid !== user.uid) {
          throw new Error("No tienes permiso para borrar este grupo.");
        }

        const playersQuery = query(collection(firestore, 'players'), where('groupId', '==', deletingGroupId));
        const playersSnapshot = await getDocs(playersQuery);
        playersSnapshot.forEach(playerDoc => transaction.delete(playerDoc.ref));

        const matchesQuery = query(collection(firestore, 'matches'), where('groupId', '==', deletingGroupId));
        const matchesSnapshot = await getDocs(matchesQuery);
        matchesSnapshot.forEach(matchDoc => transaction.delete(matchDoc.ref));

        transaction.delete(groupRef);

        const userDoc = await transaction.get(doc(firestore, 'users', user.uid));
        if (userDoc.exists() && userDoc.data().activeGroupId === deletingGroupId) {
          const userRef = doc(firestore, 'users', user.uid);
          const remainingGroups = groups?.filter(g => g.id !== deletingGroupId);
          const newActiveGroupId = remainingGroups && remainingGroups.length > 0 ? remainingGroups[0].id : null;
          transaction.update(userRef, { activeGroupId: newActiveGroupId });
        }
      });

      toast({ title: 'Grupo Eliminado', description: 'El grupo y todos sus datos han sido borrados.' });
      setDeletingGroupId(null);
    } catch (error: any) {
      console.error('Error deleting group:', error);
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'No se pudo eliminar el grupo.' });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Mis Grupos"
        description="Gestiona tus grupos, únete a uno nuevo o crea el tuyo."
      />

      <div className="space-y-4">
        {groupsLoading ? (
          <p>Cargando grupos...</p>
        ) : groups && groups.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.map(group => (
              <Card
                key={group.id}
                className={cn("flex flex-col", {
                  "border-primary ring-2 ring-primary": user?.activeGroupId === group.id
                })}
              >
                <CardHeader className="flex-row items-start justify-between">
                  <div>
                    <CardTitle>{group.name}</CardTitle>
                    <CardDescription>Propietario: {group.ownerUid === user?.uid ? 'Tú' : 'Otro'}</CardDescription>
                  </div>
                  {group.ownerUid === user?.uid && (
                    <AlertDialog>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical size={16} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditGroup(group)}>
                            <Edit className="mr-2 h-4 w-4" /> Editar Nombre
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem
                              onSelect={e => e.preventDefault()}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Eliminar Grupo
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Seguro que querés borrar "{group.name}"?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta acción es irreversible. Se borrarán todos los jugadores y partidos asociados a este grupo.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => setDeletingGroupId(null)}>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => { setDeletingGroupId(group.id); handleDeleteGroup(); }}
                            className="bg-destructive hover:bg-destructive/90"
                          >
                            {isDeleting ? 'Borrando...' : 'Sí, borrar'}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </CardHeader>
                <CardContent className="flex-grow">
                  <p className="text-sm text-muted-foreground">Jugadores: {playerCounts[group.id] || 0}</p>
                  <div className="mt-4">
                    <p className="text-xs font-semibold">Código de Invitación:</p>
                    <Input readOnly value={group.inviteCode} className="mt-1 h-8 bg-muted" />
                  </div>
                </CardContent>
                <CardFooter>
                  {user?.activeGroupId !== group.id && (
                    <Button variant="outline" className="w-full" onClick={() => handleSetActiveGroup(group.id)}>
                      Activar Grupo
                    </Button>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <Alert className="text-center">
            <Users className="h-4 w-4" />
            <AlertTitle>No estás en ningún grupo</AlertTitle>
            <AlertDescription>
              Crea tu primer grupo o únete a uno usando un código de invitación.
            </AlertDescription>
          </Alert>
        )}
      </div>

      <AlertDialog open={!!editingGroupId} onOpenChange={(open) => !open && setEditingGroupId(null)}>
        <AlertDialogContent>
          <form onSubmit={editForm.handleSubmit(handleUpdateGroup)}>
            <AlertDialogHeader>
              <AlertDialogTitle>Editar Nombre del Grupo</AlertDialogTitle>
            </AlertDialogHeader>
            <div className="py-4">
              <Input {...editForm.register('name')} />
              {editForm.formState.errors.name && (
                <p className="text-xs text-destructive mt-1">
                  {editForm.formState.errors.name.message}
                </p>
              )}
            </div>
            <AlertDialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEditingGroupId(null)}>Cancelar</Button>
              <Button type="submit" disabled={isEditing}>
                {isEditing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>

      <Separator />

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Unirse a un Grupo</CardTitle>
            <CardDescription>
              Introduce un código de invitación para unirte a un grupo existente.
            </CardDescription>
          </CardHeader>
          <form onSubmit={joinForm.handleSubmit(handleJoinGroup)}>
            <CardContent>
              <Input
                {...joinForm.register('inviteCode')}
                placeholder="Código de invitación"
                disabled={isJoining}
              />
              {joinForm.formState.errors.inviteCode && (
                <p className="mt-2 text-xs text-destructive">
                  {joinForm.formState.errors.inviteCode.message}
                </p>
              )}
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={isJoining}>
                {isJoining && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Unirse al Grupo
              </Button>
            </CardFooter>
          </form>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Crear un Grupo Nuevo</CardTitle>
            <CardDescription>
              Crea un nuevo espacio para tus partidos y jugadores.
            </CardDescription>
          </CardHeader>
          <form onSubmit={createForm.handleSubmit(handleCreateGroup)}>
            <CardContent>
              <Input
                {...createForm.register('name')}
                placeholder="Nombre del grupo"
                disabled={isCreating}
              />
              {createForm.formState.errors.name && (
                <p className="mt-2 text-xs text-destructive">
                  {createForm.formState.errors.name.message}
                </p>
              )}
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={isCreating}>
                {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Crear Grupo
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
