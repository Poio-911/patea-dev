
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
  runTransaction
} from 'firebase/firestore';
import type { Group } from '@/lib/types';
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
import { Loader2, Users, MoreVertical, Edit, Trash2, Copy, PlusCircle, LogIn } from 'lucide-react';
import { nanoid } from 'nanoid';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { WhatsAppIcon } from '@/components/icons/whatsapp-icon';
import { Label } from '@/components/ui/label';

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

function GroupCard({ group, user, playerCounts, onSetActive, onEdit, onDelete }: { group: Group, user: any, playerCounts: Record<string, number>, onSetActive: (id: string) => void, onEdit: (group: Group) => void, onDelete: (id: string) => void }) {
  const { toast } = useToast();
  
  const handleCopyCode = () => {
    navigator.clipboard.writeText(group.inviteCode);
    toast({
      title: '¡Copiado!',
      description: 'El código de invitación se ha copiado al portapapeles.',
    });
  };
  
  const handleShareWhatsApp = () => {
    const message = `¡Che, te invito a unirte a nuestro grupo de fútbol "${group.name}" en Pateá! Usa este código para entrar: ${group.inviteCode}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };
  
  return (
      <Card
        className={cn("flex flex-col transition-all", {
          "border-primary ring-2 ring-primary/50 shadow-lg": user?.activeGroupId === group.id
        })}
      >
        <CardHeader className="flex-row items-start justify-between pb-3">
          <div>
            <CardTitle>{group.name}</CardTitle>
            <CardDescription className="text-xs">
              Jugadores: <span className="font-bold">{playerCounts[group.id] || 0}</span> | Creado por: <span className="font-bold">{group.ownerUid === user?.uid ? 'Ti' : 'Otro'}</span>
            </CardDescription>
          </div>
          {group.ownerUid === user?.uid && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 -mt-2 -mr-2">
                  <MoreVertical size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(group)}>
                  <Edit className="mr-2 h-4 w-4" /> Editar Nombre
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem
                      onSelect={e => e.preventDefault()}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Eliminar Grupo
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                   <AlertDialogContent>
                        <AlertDialogHeader>
                        <AlertDialogTitle>¿Seguro que querés borrar "{group.name}"?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción es irreversible. Se borrarán todos los jugadores y partidos asociados a este grupo.
                        </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => onDelete(group.id)}
                            className="bg-destructive hover:bg-destructive/90"
                        >
                            Sí, borrar
                        </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </CardHeader>
        <CardContent className="flex-grow space-y-3">
            <div>
                <Label className="text-xs font-semibold">Código de Invitación</Label>
                <div className="flex items-center gap-2 mt-1">
                    <Input readOnly value={group.inviteCode} className="h-9 bg-muted/50" />
                    <Button variant="outline" size="icon" className="h-9 w-9 flex-shrink-0" onClick={handleCopyCode}>
                        <Copy size={16} />
                    </Button>
                </div>
            </div>
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-2">
            <Button variant="whatsapp" size="sm" onClick={handleShareWhatsApp}>
                <WhatsAppIcon className="mr-2 h-4 w-4" />
                Compartir por WhatsApp
            </Button>
            {user?.activeGroupId !== group.id && (
                <Button variant="outline" size="sm" onClick={() => onSetActive(group.id)}>
                    Activar Grupo
                </Button>
            )}
        </CardFooter>
      </Card>
  )
}

export default function GroupsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
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
        setJoinDialogOpen(false);
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
      setJoinDialogOpen(false);
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

  const handleEditTrigger = (group: Group) => {
    setEditingGroup(group);
    editForm.setValue('name', group.name);
    setEditDialogOpen(true);
  };

  const handleUpdateGroup = async (data: EditGroupForm) => {
    if (!firestore || !editingGroup) return;
    setIsEditing(true);

    const groupRef = doc(firestore, 'groups', editingGroup.id);
    try {
      await updateDoc(groupRef, { name: data.name });
      toast({ title: 'Grupo actualizado', description: 'El nombre del grupo ha sido cambiado.' });
      setEditDialogOpen(false);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo actualizar el grupo.' });
    } finally {
      setIsEditing(false);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!firestore || !user) return;
    setIsDeleting(true);

    const groupRef = doc(firestore, 'groups', groupId);

    try {
      await runTransaction(firestore, async (transaction) => {
        const groupDoc = await transaction.get(groupRef);
        if (!groupDoc.exists()) {
          throw new Error("El grupo no existe.");
        }
        if (groupDoc.data().ownerUid !== user.uid) {
          throw new Error("No tienes permiso para borrar este grupo.");
        }

        const playersQuery = query(collection(firestore, 'players'), where('groupId', '==', groupId));
        const playersSnapshot = await getDocs(playersQuery);
        playersSnapshot.forEach(playerDoc => transaction.delete(playerDoc.ref));

        const matchesQuery = query(collection(firestore, 'matches'), where('groupId', '==', groupId));
        const matchesSnapshot = await getDocs(matchesQuery);
        matchesSnapshot.forEach(matchDoc => transaction.delete(matchDoc.ref));

        transaction.delete(groupRef);

        const userDoc = await transaction.get(doc(firestore, 'users', user.uid));
        if (userDoc.exists() && userDoc.data().activeGroupId === groupId) {
          const userRef = doc(firestore, 'users', user.uid);
          const remainingGroups = groups?.filter(g => g.id !== groupId);
          const newActiveGroupId = remainingGroups && remainingGroups.length > 0 ? remainingGroups[0].id : null;
          transaction.update(userRef, { activeGroupId: newActiveGroupId });
        }
      });

      toast({ title: 'Grupo Eliminado', description: 'El grupo y todos sus datos han sido borrados.' });
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
                <Button variant="outline"><PlusCircle className="mr-2 h-4 w-4"/>Crear Grupo</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Crear un Grupo Nuevo</DialogTitle>
                    <DialogDescription>Crea un nuevo espacio para tus partidos y jugadores.</DialogDescription>
                </DialogHeader>
                 <form onSubmit={createForm.handleSubmit(handleCreateGroup)} className="space-y-4">
                    <div>
                        <Label htmlFor="create-group-name">Nombre del grupo</Label>
                        <Input id="create-group-name" {...createForm.register('name')} placeholder="Ej: Los Pibes del Lunes" disabled={isCreating} />
                        {createForm.formState.errors.name && <p className="mt-1 text-xs text-destructive">{createForm.formState.errors.name.message}</p>}
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={isCreating}>
                            {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Crear Grupo
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>

        <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
            <DialogTrigger asChild>
                <Button><LogIn className="mr-2 h-4 w-4"/>Unirse a un Grupo</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Unirse a un Grupo</DialogTitle>
                    <DialogDescription>Introduce un código de invitación para unirte a un grupo existente.</DialogDescription>
                </DialogHeader>
                <form onSubmit={joinForm.handleSubmit(handleJoinGroup)} className="space-y-4">
                    <div>
                        <Label htmlFor="join-group-code">Código de invitación</Label>
                        <Input id="join-group-code" {...joinForm.register('inviteCode')} placeholder="Ej: aB1cDeF2" disabled={isJoining}/>
                        {joinForm.formState.errors.inviteCode && <p className="mt-1 text-xs text-destructive">{joinForm.formState.errors.inviteCode.message}</p>}
                    </div>
                    <DialogFooter>
                         <Button type="submit" disabled={isJoining}>
                            {isJoining && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Unirse al Grupo
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
      </div>
      
      <Separator />

      <div className="space-y-4">
        {groupsLoading ? (
          <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
        ) : groups && groups.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groups.map(group => (
              <GroupCard
                key={group.id}
                group={group}
                user={user}
                playerCounts={playerCounts}
                onSetActive={handleSetActiveGroup}
                onEdit={handleEditTrigger}
                onDelete={handleDeleteGroup}
              />
            ))}
          </div>
        ) : (
          <Alert className="text-center py-10">
            <Users className="h-6 w-6 mx-auto mb-2" />
            <AlertTitle>No estás en ningún grupo</AlertTitle>
            <AlertDescription>
              Crea tu primer grupo o únete a uno usando un código de invitación.
            </AlertDescription>
          </Alert>
        )}
      </div>
      
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <form onSubmit={editForm.handleSubmit(handleUpdateGroup)}>
            <DialogHeader>
              <DialogTitle>Editar Nombre del Grupo</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="edit-group-name">Nuevo nombre</Label>
              <Input id="edit-group-name" {...editForm.register('name')} />
              {editForm.formState.errors.name && (
                <p className="text-xs text-destructive mt-1">
                  {editForm.formState.errors.name.message}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isEditing}>
                {isEditing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}

    