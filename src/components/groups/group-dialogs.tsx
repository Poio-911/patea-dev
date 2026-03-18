
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import type { Group } from '@/lib/types';
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogFooter as DialogFooter,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
  ResponsiveDialogTrigger as DialogTrigger,
} from '@/components/ui/responsive-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createGroupAction, editGroupNameAction, joinGroupByInviteCodeAction } from '@/lib/actions/group-actions';

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
  const { toast } = useToast();
  const form = useForm<CreateGroupForm>({ resolver: zodResolver(createGroupSchema), defaultValues: { name: '' } });

  const handleCreateGroup = async (data: CreateGroupForm) => {
    setIsCreating(true);
    try {
      const result = await createGroupAction(data.name);
      if (!result.success) {
        throw new Error(result.error || 'No se pudo crear el grupo.');
      }

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
    const { toast } = useToast();
    const form = useForm<JoinGroupForm>({ resolver: zodResolver(joinGroupSchema), defaultValues: { inviteCode: '' } });

    const handleJoinGroup = async (data: JoinGroupForm) => {
        setIsJoining(true);
        try {
      const result = await joinGroupByInviteCodeAction(data.inviteCode);
      if (!result.success) {
        throw new Error(result.error || 'No se pudo unir al grupo.');
      }

      toast({ title: "¡Te has unido!", description: `Ahora eres miembro de "${result.groupName}".` });
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

export function EditGroupDialog({
    group,
    children,
    open: openProp,
    onOpenChange: onOpenChangeProp,
}: {
    group: Group
    children?: React.ReactNode
    open?: boolean
    onOpenChange?: (open: boolean) => void
}) {
    const [internalOpen, setInternalOpen] = useState(false);
    const controlled = openProp !== undefined;
    const open = controlled ? openProp : internalOpen;
    const setOpen = (v: boolean) => {
        if (!controlled) setInternalOpen(v);
        onOpenChangeProp?.(v);
    };

    const [isEditing, setIsEditing] = useState(false);
    const { toast } = useToast();
    const form = useForm<EditGroupForm>({
        resolver: zodResolver(editGroupSchema),
        defaultValues: { name: group.name }
    });

    const handleEditGroup = async (data: EditGroupForm) => {
        setIsEditing(true);
        try {
        const result = await editGroupNameAction(group.id, data.name);
        if (!result.success) {
          throw new Error(result.error || 'No se pudo actualizar el nombre del grupo.');
        }
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
            {children && <DialogTrigger asChild>{children}</DialogTrigger>}
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
