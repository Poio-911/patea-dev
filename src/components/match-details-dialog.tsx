
'use client';

import { useState, useMemo } from 'react';
import { useDoc, useFirestore, useUser } from '@/firebase';
import type { Match, Player, Notification } from '@/lib/types';
import { doc, updateDoc, arrayUnion, arrayRemove, getDoc, writeBatch, collection, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, Clock, MapPin, Users, Info, Loader2, UserPlus, LogOut, Navigation, Edit, Trash2 } from 'lucide-react';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import Link from 'next/link';
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
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from './ui/input';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Calendar as CalendarPicker } from './ui/calendar';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface MatchDetailsDialogProps {
  match: Match;
  isOwner: boolean;
  children: React.ReactNode;
}

const editMatchSchema = z.object({
  date: z.string().min(1, 'La fecha es obligatoria.'),
  time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato de hora inválido (HH:MM).'),
});

type EditMatchFormData = z.infer<typeof editMatchSchema>;

const statusConfig: Record<Match['status'], { label: string; className: string }> = {
    upcoming: { label: 'Próximo', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' },
    active: { label: 'Activo', className: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' },
    completed: { label: 'Finalizado', className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' },
    evaluated: { label: 'Evaluado', className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300' },
};

export function MatchDetailsDialog({ match: initialMatch, isOwner, children }: MatchDetailsDialogProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();
  const [isJoining, setIsJoining] = useState(false);
  const [open, setOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);

  const form = useForm<EditMatchFormData>({
    resolver: zodResolver(editMatchSchema),
    defaultValues: {
      date: format(new Date(initialMatch.date), 'yyyy-MM-dd'),
      time: initialMatch.time,
    }
  });

  const matchRef = useMemo(() => {
    if (!firestore || !initialMatch?.id) return null;
    return doc(firestore, 'matches', initialMatch.id);
  }, [firestore, initialMatch?.id]);

  const { data: match, loading: matchLoading } = useDoc<Match>(matchRef);

  const currentMatch = match || initialMatch;

  const handleJoinOrLeaveMatch = async () => {
    // ... same as before
  };
  
  const handleSaveChanges = async (data: EditMatchFormData) => {
    if (!firestore) return;
    setIsSaving(true);
    try {
        await updateDoc(doc(firestore, 'matches', currentMatch.id), {
            date: parseISO(data.date).toISOString(),
            time: data.time,
        });
        toast({ title: "Partido actualizado", description: "La fecha y hora han sido modificadas." });
        setIsEditing(false);
    } catch (error) {
        toast({ variant: 'destructive', title: "Error", description: "No se pudo guardar los cambios." });
    } finally {
        setIsSaving(false);
    }
  };

  const handleDeleteMatch = async () => {
    if (!firestore) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(firestore, 'matches', currentMatch.id));
      toast({
        title: 'Partido Eliminado',
        description: 'El partido ha sido eliminado correctamente.'
      });
      setIsDeleteAlertOpen(false);
      setOpen(false);
      router.refresh(); // To update the matches list page
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar el partido.' });
    } finally {
      setIsDeleting(false);
    }
  };


  const statusInfo = statusConfig[currentMatch.status];
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(currentMatch.location.address)}&query_place_id=${currentMatch.location.placeId}`;


  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); setIsEditing(false); }}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">{currentMatch.title}</DialogTitle>
          <DialogDescription>Detalles completos del partido.</DialogDescription>
        </DialogHeader>
        <div className="flex-grow overflow-y-auto -mx-6 px-6 py-4 border-y">
            <div className="space-y-4">
                {isEditing ? (
                  <form onSubmit={form.handleSubmit(handleSaveChanges)} className="space-y-4 p-4 rounded-lg bg-muted/50 border border-dashed">
                      <h3 className="font-bold text-lg">Editando Partido</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <Input type="date" {...form.register('date')} />
                        </div>
                        <div>
                            <Input id="time" {...form.register('time')} />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                          <Button type="button" variant="ghost" onClick={() => setIsEditing(false)}>Cancelar</Button>
                          <Button type="submit" disabled={isSaving}>
                              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                              Guardar Cambios
                          </Button>
                      </div>
                  </form>
                ) : (
                <>
                  <div className="p-4 rounded-lg bg-muted/50 border">
                      <h3 className="font-bold text-lg">{currentMatch.location.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{currentMatch.location.address}</p>
                       <Button asChild size="sm" className="mt-3">
                          <Link href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
                              <Navigation className="mr-2 h-4 w-4" />
                              Ir en Google Maps
                          </Link>
                      </Button>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex items-center gap-3 p-3 rounded-lg border">
                          <Calendar className="h-5 w-5 text-muted-foreground" />
                          <div>
                              <p className="text-sm text-muted-foreground">Fecha</p>
                              <p className="font-bold">{format(new Date(currentMatch.date), "EEEE, d 'de' MMMM", { locale: es })}</p>
                          </div>
                      </div>
                       <div className="flex items-center gap-3 p-3 rounded-lg border">
                          <Clock className="h-5 w-5 text-muted-foreground" />
                          <div>
                              <p className="text-sm text-muted-foreground">Hora</p>
                              <p className="font-bold">{currentMatch.time} hs</p>
                          </div>
                      </div>
                  </div>
                </>
                )}


                <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-3 p-3 rounded-lg border">
                        <Users className="h-5 w-5 text-muted-foreground"/>
                        <div>
                            <p className="text-sm text-muted-foreground">Plazas</p>
                            <p className="font-bold">{currentMatch.players.length} / {currentMatch.matchSize}</p>
                        </div>
                    </div>
                     <div className="flex items-center gap-3 p-3 rounded-lg border">
                        <Info className="h-5 w-5 text-muted-foreground"/>
                        <div>
                            <p className="text-sm text-muted-foreground">Estado</p>
                             <Badge variant="outline" className={statusInfo.className}>{statusInfo.label}</Badge>
                        </div>
                    </div>
                </div>

                <Separator />

                <div>
                    <h3 className="font-semibold mb-3">Jugadores Apuntados</h3>
                    <ScrollArea className="h-48">
                        <div className="space-y-2 pr-4">
                            {matchLoading ? (
                                <div className="flex justify-center items-center h-full">
                                    <Loader2 className="h-6 w-6 animate-spin"/>
                                </div>
                            ) : currentMatch.players.length > 0 ? currentMatch.players.map((player, index) => (
                                <div key={`${player.uid}-${index}`} className="flex items-center justify-between p-2 rounded-md bg-background">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={player.photoUrl} alt={player.displayName} />
                                            <AvatarFallback>{player.displayName.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <span className="font-medium text-sm">{player.displayName}</span>
                                    </div>
                                    <Badge variant="secondary">{player.ovr}</Badge>
                                </div>
                            )) : (
                                <p className="text-sm text-muted-foreground text-center py-8">
                                    Aún no hay jugadores apuntados a este partido.
                                </p>
                            )}
                        </div>
                    </ScrollArea>
                </div>
            </div>
        </div>
         <DialogFooter className="border-t pt-4">
             {isOwner && (
                 <div className="flex w-full justify-between items-center">
                      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
                          <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="sm" disabled={isDeleting}>
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Eliminar Partido
                              </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                              <AlertDialogHeader>
                                  <AlertDialogTitle>¿Seguro que querés borrar el partido?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                      Esta acción es permanente y no se puede deshacer.
                                  </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={handleDeleteMatch} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                                      {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                      Sí, eliminar
                                  </AlertDialogAction>
                              </AlertDialogFooter>
                          </AlertDialogContent>
                      </AlertDialog>
                      <Button variant="outline" size="sm" onClick={() => setIsEditing(!isEditing)} disabled={isSaving}>
                          <Edit className="mr-2 h-4 w-4" />
                          {isEditing ? 'Cancelar Edición' : 'Editar Fecha y Hora'}
                      </Button>
                 </div>
             )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
