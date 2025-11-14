
'use client';

import { useState, useMemo } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, where, doc, updateDoc, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';
import type { Group } from '@/lib/types';
import { Button } from '../ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '../ui/badge';
import { Loader2, CheckCircle, Copy, Trash2, Edit, MoreVertical, Crown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/alert-dialog';
import { EditGroupDialog } from './group-dialogs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';

export function UserGroupsList() {
  const { user } = useUser();
  const [isChangingGroup, setIsChangingGroup] = useState<string | null>(null);
  const [isDeletingGroup, setIsDeletingGroup] = useState<string | null>(null);
  const { toast } = useToast();
  const firestore = useFirestore();

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
        const playersQuery = query(collection(firestore, 'players'), where('groupId', '==', groupId));
        const playersSnap = await getDocs(playersQuery);
        playersSnap.forEach(playerDoc => batch.delete(playerDoc.ref));

        const matchesQuery = query(collection(firestore, 'matches'), where('groupId', '==', groupId));
        const matchesSnap = await getDocs(matchesQuery);
        matchesSnap.forEach(matchDoc => batch.delete(matchDoc.ref));
        
        const teamsQuery = query(collection(firestore, 'teams'), where('groupId', '==', groupId));
        const teamsSnap = await getDocs(teamsQuery);
        teamsSnap.forEach(teamDoc => batch.delete(teamDoc.ref));

        batch.delete(doc(firestore, 'groups', groupId));

        const userRef = doc(firestore, 'users', user.uid);
        const userGroups = user.groups || [];
        const userUpdate: any = {
            groups: userGroups.filter(id => id !== groupId)
        };
        if (user.activeGroupId === groupId) {
            userUpdate.activeGroupId = userGroups.length > 1 ? userGroups.find(id => id !== groupId) : null;
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

  if (groupsLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="h-48 animate-pulse bg-muted"></Card>
        ))}
      </div>
    );
  }

  if (!groups || groups.length === 0) {
    return null; // The parent component will handle the empty state
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {groups.map(group => {
        const isActive = user?.activeGroupId === group.id;
        const isOwner = user?.uid === group.ownerUid;

        return (
          <Card key={group.id} className={cn("flex flex-col", isActive && 'border-primary ring-2 ring-primary/50')}>
            <CardHeader className="flex-row items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <span>{group.name}</span>
                   {isOwner && (
                      <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                          <Crown className="h-3 w-3 mr-1"/>
                          Dueño
                      </Badge>
                  )}
                </CardTitle>
                <div className="flex items-center gap-2 mt-2">
                    <p className="text-xs text-muted-foreground">Código:</p>
                    <code className="text-sm font-bold font-mono bg-muted px-2 py-1 rounded-md">{group.inviteCode}</code>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleCopyCode(group.inviteCode)}>
                        <Copy className="h-4 w-4"/>
                    </Button>
                </div>
              </div>
              {isOwner && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 -mt-2">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(e) => e.preventDefault()}>
                     <EditGroupDialog group={group}>
                        <DropdownMenuItem onSelect={e => e.preventDefault()}>
                            <Edit className="mr-2 h-4 w-4"/> Editar
                        </DropdownMenuItem>
                    </EditGroupDialog>
                    <DropdownMenuSeparator />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <DropdownMenuItem onSelect={e => e.preventDefault()} className="text-destructive focus:text-destructive">
                          <Trash2 className="mr-2 h-4 w-4"/> Eliminar
                        </DropdownMenuItem>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Borrar "{group.name}"?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acción es permanente. Se borrarán todos los jugadores y partidos asociados a este grupo.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteGroup(group.id, group.name)} disabled={isDeletingGroup === group.id} className="bg-destructive hover:bg-destructive/90">
                              {isDeletingGroup === group.id && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                              Borrar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </CardHeader>
            <CardFooter className="mt-auto bg-muted/50 p-3">
              {isActive ? (
                <Badge className="w-full justify-center text-base py-1.5 bg-green-600 hover:bg-green-700">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Activo
                </Badge>
              ) : (
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => handleSetActiveGroup(group.id)}
                  disabled={!!isChangingGroup}
                >
                  {isChangingGroup === group.id ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Activar Grupo
                </Button>
              )}
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}
