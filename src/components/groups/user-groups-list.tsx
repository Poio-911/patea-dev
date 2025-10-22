
'use client';

import { useState, useMemo } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, where, doc, updateDoc, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';
import type { Group } from '@/lib/types';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from '../ui/button';
import { Loader2, CheckCircle, PlusCircle, LogIn, Copy, Trash2, Edit, Users2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/alert-dialog';


const joinGroupSchema = z.object({
  inviteCode: z.string().min(1, 'El código de invitación es obligatorio.'),
});
type JoinGroupForm = z.infer<typeof joinGroupSchema>;

const createGroupSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
});
type CreateGroupForm = z.infer<typeof createGroupSchema>;

const editGroupSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
});
type EditGroupForm = z.infer<typeof editGroupSchema>;


export function UserGroupsList() {
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [isChangingGroup, setIsChangingGroup] = useState<string | null>(null);
  const [isDeletingGroup, setIsDeletingGroup] = useState<string | null>(null);
  const [isEditingGroup, setIsEditingGroup] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState<{ type: 'create' | 'join' | 'edit' | null, data?: any }>({ type: null });


  const joinForm = useForm<JoinGroupForm>({ resolver: zodResolver(joinGroupSchema) });
  const createForm = useForm<CreateGroupForm>({ resolver: zodResolver(createGroupSchema) });
  const editForm = useForm<EditGroupForm>();


  const groupsQuery = useMemo(() => {
    if (!firestore || !user?.uid) return null;
    return query(collection(firestore, 'groups'), where('members', 'array-contains', user.uid));
  }, [firestore, user?.uid]);

  const { data: groups, loading: groupsLoading } = useCollection<Group>(groupsQuery);

  const handleSetActiveGroup = async (groupId: string) => {
    if (!firestore || !user?.uid) return;
    setIsChangingGroup(groupId);
    const userRef = doc(firestore, 'users', user.uid);
    try {
      await updateDoc(userRef, { activeGroupId: groupId });
      toast({
        title: 'Grupo cambiado',
        description: `Ahora estás operando en el grupo ${groups?.find(g => g.id === groupId)?.name}.`,
      });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo cambiar de grupo.' });
    } finally {
      setIsChangingGroup(null);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: '¡Copiado!', description: 'Código de invitación copiado al portapapeles.' });
  }
  
  const handleDeleteGroup = async (groupId: string, groupName: string) => {
    if (!firestore || !user?.uid) return;
    setIsDeletingGroup(groupId);
    
    const batch = writeBatch(firestore);

    try {
        // Delete all players in the group
        const playersQuery = query(collection(firestore, 'players'), where('groupId', '==', groupId));
        const playersSnap = await getDocs(playersQuery);
        playersSnap.forEach(playerDoc => batch.delete(playerDoc.ref));

        // Delete all matches in the group
        const matchesQuery = query(collection(firestore, 'matches'), where('groupId', '==', groupId));
        const matchesSnap = await getDocs(matchesQuery);
        matchesSnap.forEach(matchDoc => batch.delete(matchDoc.ref));

        // Delete the group itself
        batch.delete(doc(firestore, 'groups', groupId));

        // Remove group from user's list and set active group to null if it was the one deleted
        const userRef = doc(firestore, 'users', user.uid);
        const userUpdate: any = {
            groups: user.groups?.filter(id => id !== groupId)
        };
        if (user.activeGroupId === groupId) {
            userUpdate.activeGroupId = null;
        }
        batch.update(userRef, userUpdate);
        
        await batch.commit();
        toast({ title: 'Grupo Eliminado', description: `El grupo "${groupName}" y todos sus datos han sido eliminados.` });
    } catch (error) {
        console.error("Error deleting group:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar el grupo.' });
    } finally {
        setIsDeletingGroup(null);
    }
  };
  
  const handleCreateGroup = async (data: CreateGroupForm) => {
      //... (implementation from groups/page.tsx, adapted)
  };
  
  const handleJoinGroup = async (data: JoinGroupForm) => {
     //... (implementation from groups/page.tsx, adapted)
  };
  
  const handleEditGroup = async (data: EditGroupForm) => {
    if (!firestore || !dialogOpen.data?.id) return;
    setIsEditingGroup(dialogOpen.data.id);
    try {
        await updateDoc(doc(firestore, 'groups', dialogOpen.data.id), { name: data.name });
        toast({ title: "Grupo actualizado" });
        setDialogOpen({ type: null });
    } catch (error) {
        toast({ variant: 'destructive', title: "Error", description: "No se pudo actualizar el nombre del grupo."});
    } finally {
        setIsEditingGroup(null);
    }
  }


  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="item-1">
        <AccordionTrigger>
            <div className="flex items-center gap-2">
                 <Users2 className="h-5 w-5"/>
                 <span className="font-semibold text-lg">Mis Grupos</span>
            </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-2">
            {groupsLoading ? <Loader2 className="h-5 w-5 animate-spin"/> : (
                groups && groups.length > 0 ? (
                    groups.map(group => {
                        const isActive = user?.activeGroupId === group.id;
                        return (
                            <div key={group.id} className={cn("flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-lg", isActive ? 'bg-green-100/50 dark:bg-green-900/30' : 'bg-muted/50')}>
                                <div className="flex-1">
                                    <p className="font-semibold">{group.name}</p>
                                    <p className="text-xs text-muted-foreground">Código: <span className="font-mono">{group.inviteCode}</span></p>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <Button size="sm" variant="ghost" onClick={() => handleCopyCode(group.inviteCode)}><Copy className="h-4 w-4"/></Button>
                                    {user?.uid === group.ownerUid && (
                                        <>
                                            <Button size="sm" variant="ghost" onClick={() => { editForm.reset({ name: group.name }); setDialogOpen({ type: 'edit', data: group })}}><Edit className="h-4 w-4"/></Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild><Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4"/></Button></AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader><AlertDialogTitle>¿Borrar "{group.name}"?</AlertDialogTitle><AlertDialogDescription>Esta acción es permanente. Se borrarán todos los jugadores y partidos asociados a este grupo.</AlertDialogDescription></AlertDialogHeader>
                                                    <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteGroup(group.id, group.name)} className="bg-destructive hover:bg-destructive/90">Borrar</AlertDialogAction></AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </>
                                    )}
                                    {isActive ? (
                                        <Button size="sm" disabled className="bg-green-600 hover:bg-green-600"><CheckCircle className="mr-2 h-4 w-4"/>Activo</Button>
                                    ) : (
                                        <Button size="sm" variant="outline" onClick={() => handleSetActiveGroup(group.id)} disabled={!!isChangingGroup}>
                                            {isChangingGroup === group.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                                            Activar
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )
                    })
                ) : <p className="text-sm text-muted-foreground text-center py-4">No perteneces a ningún grupo.</p>
            )}
             <div className="flex gap-2 pt-4">
                <Button variant="outline" className="w-full" onClick={() => { createForm.reset(); setDialogOpen({ type: 'create'})}}><PlusCircle className="mr-2 h-4 w-4"/>Crear Grupo</Button>
                <Button className="w-full" onClick={() => { joinForm.reset(); setDialogOpen({ type: 'join' })}}><LogIn className="mr-2 h-4 w-4"/>Unirse a Grupo</Button>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
