
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFirestore, useUser } from '@/firebase';
import { collection, addDoc, updateDoc, doc, query, where, getDocs, arrayUnion, writeBatch } from 'firebase/firestore';
import { nanoid } from 'nanoid';
import { useToast } from '@/hooks/use-toast';
import type { Group } from '@/lib/types';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
}

const createGroupSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
});
type CreateGroupForm = z.infer<typeof createGroupSchema>;

export function CreateGroupDialog({ open, onOpenChange, children }: DialogProps) {
  const [isCreating, setIsCreating] = useState(false);
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const form = useForm<CreateGroupForm>({ resolver: zodResolver(createGroupSchema), defaultValues: { name: '' } });

  const handleCreateGroup = async (data: CreateGroupForm) => {
    if (!firestore || !user?.uid) return;
    setIsCreating(true);
    try {
      const inviteCode = nanoid(8);
      const batch = writeBatch(firestore);
      
      const newGroupRef = doc(collection(firestore, 'groups'));
      const groupData: Omit<Group, 'id'> = {
        name: data.name,
        ownerUid: user.uid,
        inviteCode,
        members: [user.uid],
      };
      batch.set(newGroupRef, groupData);
      
      const userRef = doc(firestore, 'users', user.uid);
      batch.update(userRef, {
        activeGroupId: newGroupRef.id,
        groups: arrayUnion(newGroupRef.id)
      });
      
      await batch.commit();

      toast({ title: "Grupo creado", description: `"${data.name}" ha sido creado.` });
      onOpenChange(false);
      form.reset();
    } catch (error) {
      toast({ variant: 'destructive', title: "Error", description: "No se pudo crear el grupo." });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crear Nuevo Grupo</DialogTitle>
          <DialogDescription>Ingresá un nombre para tu nuevo grupo de fútbol.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handleCreateGroup)}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="create-name">Nombre del Grupo</Label>
              <Input id="create-name" placeholder="Mi Grupo de Fútbol" {...form.register('name')} />
              {form.formState.errors.name && <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isCreating}>
              {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
              Crear Grupo
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const joinGroupSchema = z.object({
  inviteCode: z.string().min(1, 'El código de invitación es obligatorio.'),
});
type JoinGroupForm = z.infer<typeof joinGroupSchema>;

export function JoinGroupDialog({ open, onOpenChange, children }: DialogProps) {
    const [isJoining, setIsJoining] = useState(false);
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const form = useForm<JoinGroupForm>({ resolver: zodResolver(joinGroupSchema), defaultValues: { inviteCode: '' } });

    const handleJoinGroup = async (data: JoinGroupForm) => {
        if (!firestore || !user?.uid) return;
        setIsJoining(true);
        try {
            const codeToSearch = data.inviteCode;
            const groupsQuery = query(collection(firestore, 'groups'), where('inviteCode', '==', codeToSearch));
            const snapshot = await getDocs(groupsQuery);

            if (snapshot.empty) {
                toast({ variant: 'destructive', title: "Código inválido", description: "No se encontró ningún grupo con ese código. Verificá que esté escrito exactamente igual." });
                setIsJoining(false);
                return;
            }

            const groupDoc = snapshot.docs[0];
            const groupData = groupDoc.data() as Group;

            if (groupData.members.includes(user.uid)) {
                toast({ variant: 'destructive', title: "Ya eres miembro", description: "Ya perteneces a este grupo." });
                setIsJoining(false);
                return;
            }

            await updateDoc(groupDoc.ref, { members: arrayUnion(user.uid) });
            await updateDoc(doc(firestore, 'users', user.uid), { activeGroupId: groupDoc.id, groups: arrayUnion(groupDoc.id) });

            toast({ title: "¡Te has unido!", description: `Ahora eres miembro de "${groupData.name}".` });
            onOpenChange(false);
            form.reset();
        } catch (error) {
            toast({ variant: 'destructive', title: "Error", description: "No se pudo unir al grupo." });
        } finally {
            setIsJoining(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {children}
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Unirse a un Grupo</DialogTitle>
                    <DialogDescription>Ingresá el código de invitación del grupo.</DialogDescription>
                </DialogHeader>
                <form onSubmit={form.handleSubmit(handleJoinGroup)}>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="join-code">Código de Invitación</Label>
                            <Input id="join-code" placeholder="Ej: GYpGe-7e" {...form.register('inviteCode')} />
                            {form.formState.errors.inviteCode && <p className="text-sm text-destructive">{form.formState.errors.inviteCode.message}</p>}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                        <Button type="submit" disabled={isJoining}>
                            {isJoining && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Unirse
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

const editGroupSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
});
type EditGroupForm = z.infer<typeof editGroupSchema>;

export function EditGroupDialog({ group, children }: { group: Group, children: React.ReactNode }) {
    const [open, setOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const firestore = useFirestore();
    const { toast } = useToast();
    const form = useForm<EditGroupForm>({
        resolver: zodResolver(editGroupSchema),
        defaultValues: { name: group.name }
    });

    const handleEditGroup = async (data: EditGroupForm) => {
        if (!firestore) return;
        setIsEditing(true);
        try {
            await updateDoc(doc(firestore, 'groups', group.id), { name: data.name });
            toast({ title: "Grupo actualizado" });
            setOpen(false);
        } catch (error) {
            toast({ variant: 'destructive', title: "Error", description: "No se pudo actualizar el nombre del grupo."});
        } finally {
            setIsEditing(false);
        }
    };
    
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Editar Grupo</DialogTitle>
                    <DialogDescription>Cambiá el nombre de tu grupo.</DialogDescription>
                </DialogHeader>
                <form onSubmit={form.handleSubmit(handleEditGroup)}>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-name">Nombre del Grupo</Label>
                            <Input id="edit-name" {...form.register('name')} />
                            {form.formState.errors.name && <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                        <Button type="submit" disabled={isEditing}>
                            {isEditing && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Guardar
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
