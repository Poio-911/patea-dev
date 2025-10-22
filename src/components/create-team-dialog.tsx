
'use client';

import { useState, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFirestore, useUser } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, PlusCircle, Shield } from 'lucide-react';
import { Player, GroupTeam } from '@/lib/types';

const shieldOptions = ['🛡️', '⚔️', '🔥', '💧', '⚡', '🌟', '💀', '🐲', '🦅', '🦁'];

const createTeamSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
  shield: z.string().min(1, 'Debes elegir un escudo.'),
  members: z.array(z.string()).min(1, 'Debes seleccionar al menos un miembro.'),
});

type CreateTeamFormData = z.infer<typeof createTeamSchema>;

interface CreateTeamDialogProps {
  groupPlayers: Player[];
}

export function CreateTeamDialog({ groupPlayers }: CreateTeamDialogProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CreateTeamFormData>({
    resolver: zodResolver(createTeamSchema),
    defaultValues: {
      name: '',
      shield: '🛡️',
      members: [],
    },
  });

  const filteredPlayers = useMemo(() => {
    return groupPlayers.filter(player =>
      player.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [groupPlayers, searchTerm]);
  
  const onSubmit = async (data: CreateTeamFormData) => {
    if (!firestore || !user?.activeGroupId) {
        toast({ variant: 'destructive', title: 'Error', description: 'No hay un grupo activo.' });
        return;
    }
    setIsSubmitting(true);
    try {
        const newTeam: Omit<GroupTeam, 'id'> = {
            name: data.name,
            shield: data.shield,
            ownerUid: user.uid,
            groupId: user.activeGroupId,
            members: data.members,
        };
        await addDoc(collection(firestore, 'groups', user.activeGroupId, 'teams'), newTeam);
        toast({ title: '¡Equipo Creado!', description: `El equipo "${data.name}" se ha formado.` });
        setOpen(false);
        form.reset();
    } catch (error) {
        console.error('Error creating team:', error);
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo crear el equipo.' });
    } finally {
        setIsSubmitting(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><PlusCircle className="mr-2 h-4 w-4" />Crear Equipo</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Crear un Nuevo Equipo Fijo</DialogTitle>
          <DialogDescription>
            Dale una identidad a tu cuadro. Elegí un nombre, un escudo y los integrantes.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="team-name">Nombre del Equipo</Label>
            <Input id="team-name" {...form.register('name')} placeholder="Ej: Furia Roja" />
            {form.formState.errors.name && <p className="text-destructive text-xs mt-1">{form.formState.errors.name.message}</p>}
          </div>

          <div>
             <Label>Escudo del Equipo</Label>
             <Controller
                name="shield"
                control={form.control}
                render={({ field }) => (
                    <div className="flex flex-wrap gap-2 mt-2">
                        {shieldOptions.map(shield => (
                            <button
                                type="button"
                                key={shield}
                                onClick={() => field.onChange(shield)}
                                className={`text-2xl p-2 rounded-full transition-transform ${field.value === shield ? 'bg-primary/20 scale-125' : 'hover:bg-accent'}`}
                            >
                                {shield}
                            </button>
                        ))}
                    </div>
                )}
             />
          </div>

          <div className="space-y-2">
            <Label>Miembros</Label>
            <Input
              placeholder="Buscar jugador..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <ScrollArea className="h-48 border rounded-md">
              <div className="p-2 space-y-1">
                {filteredPlayers.map(player => (
                  <Controller
                    key={player.id}
                    name="members"
                    control={form.control}
                    render={({ field }) => {
                        const isChecked = field.value?.includes(player.id) ?? false;
                        return (
                             <div className="flex items-center space-x-3 rounded-md p-2 hover:bg-accent has-[:checked]:bg-primary/10">
                                <Checkbox
                                    id={`member-${player.id}`}
                                    checked={isChecked}
                                    onCheckedChange={(checked) => {
                                        return checked
                                        ? field.onChange([...(field.value || []), player.id])
                                        : field.onChange((field.value || []).filter((id: string) => id !== player.id));
                                    }}
                                />
                                <Avatar className="h-8 w-8">
                                    <AvatarImage src={player.photoUrl} alt={player.name} />
                                    <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <Label htmlFor={`member-${player.id}`} className="flex-1 cursor-pointer font-medium">{player.name}</Label>
                            </div>
                        )
                    }}
                  />
                ))}
              </div>
            </ScrollArea>
             {form.formState.errors.members && <p className="text-destructive text-xs mt-1">{form.formState.errors.members.message}</p>}
          </div>
          
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Creando...' : 'Crear Equipo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

    