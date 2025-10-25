
'use client';

import { useState, useMemo } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, where, doc, updateDoc, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';
import type { Group } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Loader2, CheckCircle, PlusCircle, LogIn, Copy, Trash2, Edit, Users2, Eye, EyeOff, Crown, UserCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/alert-dialog';
import { CreateGroupDialog, JoinGroupDialog, EditGroupDialog } from './group-dialogs';


export function UserGroupsList() {
  const { user } = useUser();
  const [isChangingGroup, setIsChangingGroup] = useState<string | null>(null);
  const [isDeletingGroup, setIsDeletingGroup] = useState<string | null>(null);
  const [showCodeForGroup, setShowCodeForGroup] = useState<string | null>(null);
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

        batch.delete(doc(firestore, 'groups', groupId));

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

  return (
    <>
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Users2 className="h-5 w-5 text-primary"/>
            </div>
            <div>
              <CardTitle className="text-xl">Mis Grupos</CardTitle>
              <CardDescription>Gestioná tus grupos de fútbol</CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {groupsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary"/>
          </div>
        ) : groups && groups.length > 0 ? (
          <div className="space-y-3">
            {groups.map(group => {
              const isActive = user?.activeGroupId === group.id;
              const isOwner = user?.uid === group.ownerUid;
              const showCode = showCodeForGroup === group.id;

              return (
                <div key={group.id} className={cn(
                  "flex flex-col gap-4 p-4 rounded-lg border-2 transition-all",
                  isActive
                    ? 'bg-green-50 dark:bg-green-950/30 border-green-500 shadow-md'
                    : 'bg-card border-border hover:border-primary/50'
                )}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-lg">{group.name}</h3>
                        {isOwner && (
                          <Badge variant="default" className="bg-amber-500 hover:bg-amber-600">
                            <Crown className="h-3 w-3 mr-1"/>
                            Propietario
                          </Badge>
                        )}
                        {!isOwner && (
                          <Badge variant="secondary">
                            <UserCircle className="h-3 w-3 mr-1"/>
                            Miembro
                          </Badge>
                        )}
                        {isActive && (
                          <Badge variant="default" className="bg-green-600">
                            <CheckCircle className="h-3 w-3 mr-1"/>
                            Activo
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setShowCodeForGroup(showCode ? null : group.id)}
                          className="h-7 text-xs"
                        >
                          {showCode ? <EyeOff className="h-3 w-3 mr-1"/> : <Eye className="h-3 w-3 mr-1"/>}
                          {showCode ? 'Ocultar código' : 'Mostrar código'}
                        </Button>
                        {showCode && (
                          <>
                            <code className="px-2 py-1 bg-muted rounded text-sm font-mono font-bold">
                              {group.inviteCode}
                            </code>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleCopyCode(group.inviteCode)}
                              className="h-7"
                            >
                              <Copy className="h-3 w-3"/>
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {!isActive && (
                      <Button
                        size="default"
                        variant="default"
                        onClick={() => handleSetActiveGroup(group.id)}
                        disabled={!!isChangingGroup}
                        className="flex-1 sm:flex-none"
                      >
                        {isChangingGroup === group.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                        ) : null}
                        Activar Grupo
                      </Button>
                    )}

                    {isOwner && (
                      <>
                        <EditGroupDialog group={group}>
                             <Button size="default" variant="outline">
                                <Edit className="mr-2 h-4 w-4"/>
                                Editar
                            </Button>
                        </EditGroupDialog>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="default" variant="outline" className="text-destructive hover:text-destructive">
                              <Trash2 className="mr-2 h-4 w-4"/>
                              Eliminar
                            </Button>
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
                              <AlertDialogAction
                                onClick={() => handleDeleteGroup(group.id, group.name)}
                                className="bg-destructive hover:bg-destructive/90"
                              >
                                {isDeletingGroup === group.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                                Borrar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center py-12 px-4 border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20">
            <div className="p-4 bg-primary/10 rounded-full mb-4">
              <Users2 className="h-12 w-12 text-primary"/>
            </div>
            <h3 className="text-lg font-semibold mb-2">No tenés grupos todavía</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm">
              Creá tu primer grupo para empezar a gestionar partidos y jugadores, o unite a uno existente con un código de invitación.
            </p>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <CreateGroupDialog>
            <Button variant="default" size="lg" className="flex-1">
                <PlusCircle className="mr-2 h-5 w-5"/>
                Crear Grupo
            </Button>
          </CreateGroupDialog>
          <JoinGroupDialog>
            <Button variant="outline" size="lg" className="flex-1">
                <LogIn className="mr-2 h-5 w-5"/>
                Unirse a Grupo
            </Button>
          </JoinGroupDialog>
        </div>
      </CardContent>
    </Card>
    </>
  )
}
