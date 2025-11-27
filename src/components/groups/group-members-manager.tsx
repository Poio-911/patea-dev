'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Users, MoreVertical, UserMinus, Shield, Loader2, Crown } from 'lucide-react';
import {
  getGroupMembersWithRolesAction,
  assignGroupRoleAction,
  removeMemberFromGroupAction,
  getUserRoleInGroupAction,
} from '@/lib/actions/group-role-actions';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import type { GroupMember, Group } from '@/lib/types';
import type { GroupRole } from '@/lib/group-permissions';
import { hasPermission, getRoleLabel, getRoleDescription } from '@/lib/group-permissions';
import { RoleBadge } from './role-badge';
import { cn } from '@/lib/utils';

type GroupMembersManagerProps = {
  groupId: string;
  ownerId: string;
};

type MemberWithInfo = GroupMember & {
  name?: string;
  photoUrl?: string;
};

export function GroupMembersManager({ groupId, ownerId }: GroupMembersManagerProps) {
  const { user } = useUser();
  const { toast } = useToast();

  const [members, setMembers] = useState<MemberWithInfo[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<GroupRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<MemberWithInfo | null>(null);

  useEffect(() => {
    loadMembers();
    loadCurrentUserRole();
  }, [groupId]);

  const loadMembers = async () => {
    try {
      const result = await getGroupMembersWithRolesAction(groupId);
      if (result.success && result.members) {
        setMembers(result.members);
      }
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading members:', error);
      setIsLoading(false);
    }
  };

  const loadCurrentUserRole = async () => {
    if (!user?.uid) return;

    try {
      const result = await getUserRoleInGroupAction(groupId);
      if (result.success && result.role) {
        setCurrentUserRole(result.role);
      }
    } catch (error) {
      console.error('Error loading current user role:', error);
    }
  };

  const handleChangeRole = async (targetUserId: string, newRole: GroupRole) => {
    setActionLoading(targetUserId);
    try {
      const result = await assignGroupRoleAction(groupId, targetUserId, newRole);

      if (result.success) {
        toast({
          title: 'Rol actualizado',
          description: `El rol fue cambiado a ${getRoleLabel(newRole)}`,
        });
        await loadMembers();
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.error || 'No se pudo actualizar el rol',
        });
      }
    } catch (error) {
      console.error('Error changing role:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Ocurrió un error al cambiar el rol',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;

    setActionLoading(memberToRemove.userId);
    try {
      const result = await removeMemberFromGroupAction(groupId, memberToRemove.userId);

      if (result.success) {
        toast({
          title: 'Miembro removido',
          description: `${memberToRemove.name} fue removido del grupo`,
        });
        await loadMembers();
        setShowRemoveDialog(false);
        setMemberToRemove(null);
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.error || 'No se pudo remover al miembro',
        });
      }
    } catch (error) {
      console.error('Error removing member:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Ocurrió un error al remover al miembro',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const canManageRoles = currentUserRole && hasPermission(currentUserRole, 'roles.assign');
  const canRemoveMembers = currentUserRole && hasPermission(currentUserRole, 'members.remove');

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Miembros del Grupo ({members.length})
          </CardTitle>
          <CardDescription>
            Gestiona roles y permisos de los miembros
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="space-y-3">
            {members.map((member) => {
              const isOwner = member.userId === ownerId;
              const isCurrentUser = member.userId === user?.uid;
              const isLoadingAction = actionLoading === member.userId;

              return (
                <div
                  key={member.userId}
                  className={cn(
                    'flex items-center justify-between p-3 rounded-lg border',
                    isOwner && 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800'
                  )}
                >
                  <div className="flex items-center gap-3 flex-1">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={member.photoUrl} alt={member.name} />
                      <AvatarFallback>
                        {member.name?.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{member.name}</p>
                        {isOwner && (
                          <Crown className="w-4 h-4 text-amber-500" aria-label="Creador del grupo" />
                        )}
                        {isCurrentUser && (
                          <span className="text-xs text-muted-foreground">(Tú)</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Miembro desde {new Date(member.joinedAt).toLocaleDateString('es-AR', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </div>

                    <RoleBadge role={member.role} />
                  </div>

                  {/* Menú de acciones */}
                  {!isOwner && !isCurrentUser && (canManageRoles || canRemoveMembers) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" disabled={isLoadingAction}>
                          {isLoadingAction ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <MoreVertical className="w-4 h-4" />
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Gestionar miembro</DropdownMenuLabel>
                        <DropdownMenuSeparator />

                        {canManageRoles && (
                          <>
                            <DropdownMenuItem
                              onClick={() => handleChangeRole(member.userId, 'admin')}
                              disabled={member.role === 'admin'}
                            >
                              <Shield className="w-4 h-4 mr-2" />
                              Hacer Administrador
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleChangeRole(member.userId, 'moderator')}
                              disabled={member.role === 'moderator'}
                            >
                              <Shield className="w-4 h-4 mr-2" />
                              Hacer Moderador
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleChangeRole(member.userId, 'member')}
                              disabled={member.role === 'member'}
                            >
                              <Shield className="w-4 h-4 mr-2" />
                              Hacer Miembro
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}

                        {canRemoveMembers && (
                          <DropdownMenuItem
                            onClick={() => {
                              setMemberToRemove(member);
                              setShowRemoveDialog(true);
                            }}
                            className="text-red-600 dark:text-red-400"
                          >
                            <UserMinus className="w-4 h-4 mr-2" />
                            Remover del grupo
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              );
            })}

            {members.length === 0 && (
              <div className="text-center py-6 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No hay miembros en este grupo aún</p>
              </div>
            )}
          </div>

          {/* Leyenda de roles */}
          <div className="mt-6 pt-4 border-t space-y-2">
            <p className="text-sm font-semibold mb-2">Roles y Permisos:</p>
            {(['admin', 'moderator', 'member'] as GroupRole[]).map((role) => (
              <div key={role} className="flex items-start gap-2 text-sm">
                <RoleBadge role={role} size="sm" />
                <p className="text-muted-foreground">{getRoleDescription(role)}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Dialog de confirmación para remover */}
      <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Remover miembro?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que quieres remover a <strong>{memberToRemove?.name}</strong> del
              grupo? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setMemberToRemove(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              className="bg-red-600 hover:bg-red-700"
            >
              {actionLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
