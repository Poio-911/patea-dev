'use client';

import { useState, useMemo } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, where, doc, updateDoc } from 'firebase/firestore';
import type { Group } from '@/lib/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronsUpDown } from 'lucide-react';
import { Skeleton } from './ui/skeleton';
import { useToast } from '@/hooks/use-toast';

export function GroupSwitcher() {
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const groupsQuery = useMemo(() => {
    if (!firestore || !user?.uid) return null;
    return query(collection(firestore, 'groups'), where('members', 'array-contains', user.uid));
  }, [firestore, user?.uid]);

  const { data: groups, loading: groupsLoading } = useCollection<Group>(groupsQuery);

  const handleGroupChange = async (groupId: string) => {
    if (!firestore || !user?.uid) return;
    
    const userRef = doc(firestore, 'users', user.uid);
    try {
      await updateDoc(userRef, {
        activeGroupId: groupId
      });
      toast({
        title: 'Grupo cambiado',
        description: `Ahora estás en el grupo ${groups?.find(g => g.id === groupId)?.name}.`,
      });
    } catch (error) {
      console.error("Error al cambiar de grupo:", error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo cambiar de grupo.',
      });
    }
  };

  if (userLoading || groupsLoading) {
    return <Skeleton className="h-8 w-[200px]" />;
  }

  if (!user || !groups || groups.length === 0) {
    return <div className="text-sm text-muted-foreground">No perteneces a ningún grupo</div>;
  }

  return (
    <Select onValueChange={handleGroupChange} value={user.activeGroupId || ''}>
      <SelectTrigger className="w-auto gap-2 border-0 shadow-none focus:ring-0">
        <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
        <SelectValue placeholder="Seleccionar grupo..." />
      </SelectTrigger>
      <SelectContent>
        {groups.map((group) => (
          <SelectItem key={group.id} value={group.id}>
            {group.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
