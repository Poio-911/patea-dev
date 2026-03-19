'use client';

import * as React from 'react';
import { useFirestore } from '@/firebase';
import { collection, query, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Trash2, UserCheck, Mail, Phone, Star, Edit } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import type { Referee } from '@/lib/types';

interface LeagueRefereesTabProps {
  leagueId: string;
}

export function LeagueRefereesTab({ leagueId }: LeagueRefereesTabProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [referees, setReferees] = React.useState<Referee[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [editingReferee, setEditingReferee] = React.useState<Referee | null>(null);

  // Listen to referees in real-time
  React.useEffect(() => {
    if (!firestore) return;

    const refereesRef = collection(firestore, 'leagues', leagueId, 'referees');
    const q = query(refereesRef);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Referee));
      setReferees(data);
      setLoading(false);
    }, (err) => {
      console.error('[LeagueReferees] Error:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [firestore, leagueId]);

  const handleDelete = async (refereeId: string, refereeName: string) => {
    if (!firestore) return;

    try {
      await deleteDoc(doc(firestore, 'leagues', leagueId, 'referees', refereeId));
      toast({ title: 'Árbitro eliminado', description: `${refereeName} fue removido de la lista.` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar el árbitro.' });
    }
  };

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map(i => (
          <Card key={i} className="animate-pulse bg-muted/20 border-border/50">
            <CardContent className="h-32" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black uppercase tracking-tight">{referees.length} Árbitros Registrados</h2>
          <p className="text-sm text-muted-foreground">Gestioná los árbitros que dirigirán los partidos de esta liga.</p>
        </div>
        <Button onClick={() => setIsAddOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" /> Agregar Árbitro
        </Button>
      </div>

      {referees.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center flex flex-col items-center gap-4">
            <UserCheck className="h-16 w-16 text-muted-foreground/30" />
            <div className="space-y-1">
              <h3 className="font-bold text-lg">No hay árbitros todavía</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Agregá árbitros para asignarlos a los partidos del fixture y llevar un control profesional del torneo.
              </p>
            </div>
            <Button variant="outline" className="border-primary/20 hover:bg-primary/5 hover:text-primary" onClick={() => setIsAddOpen(true)}>
              <PlusCircle className="mr-2 h-4 w-4" /> Agregar Primer Árbitro
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {referees.map(referee => (
            <Card key={referee.id} className="group relative hover:border-primary/50 transition-colors bg-card/60 backdrop-blur-sm border-border/50 overflow-hidden">
              <CardContent className="p-5 flex flex-col gap-4">
                {/* Header with Avatar */}
                <div className="flex items-start gap-3">
                  <Avatar className="h-12 w-12 border-2 border-border">
                    <AvatarImage src={referee.photoUrl} />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold">
                      {referee.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-base uppercase tracking-tight truncate group-hover:text-primary transition-colors">
                      {referee.name}
                    </h3>
                    {referee.rating && (
                      <div className="flex items-center gap-1 mt-1">
                        <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                        <span className="text-sm font-bold text-yellow-400">{referee.rating.toFixed(1)}</span>
                        <span className="text-xs text-muted-foreground">/10</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Contact Info */}
                <div className="space-y-1.5 text-xs">
                  {referee.email && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate">{referee.email}</span>
                    </div>
                  )}
                  {referee.phone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                      <span>{referee.phone}</span>
                    </div>
                  )}
                </div>

                {/* Stats */}
                <div className="flex items-center justify-between pt-2 border-t border-border/30">
                  <Badge variant="secondary" className="text-xs">
                    {referee.assignedMatches?.length || 0} partidos asignados
                  </Badge>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={() => setEditingReferee(referee)}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(referee.id, referee.name)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {referee.notes && (
                  <p className="text-xs text-muted-foreground italic border-t border-border/30 pt-2">
                    "{referee.notes}"
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <AddEditRefereeDialog
        leagueId={leagueId}
        open={isAddOpen || !!editingReferee}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddOpen(false);
            setEditingReferee(null);
          }
        }}
        referee={editingReferee}
      />
    </div>
  );
}

interface AddEditRefereeDialogProps {
  leagueId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  referee: Referee | null;
}

function AddEditRefereeDialog({ leagueId, open, onOpenChange, referee }: AddEditRefereeDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = React.useState(false);

  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [notes, setNotes] = React.useState('');

  React.useEffect(() => {
    if (open && referee) {
      setName(referee.name);
      setEmail(referee.email || '');
      setPhone(referee.phone || '');
      setNotes(referee.notes || '');
    } else if (!open) {
      // Reset form when dialog closes
      setName('');
      setEmail('');
      setPhone('');
      setNotes('');
    }
  }, [open, referee]);

  const handleSave = async () => {
    if (!firestore) return;
    if (!name.trim()) {
      toast({ variant: 'destructive', title: 'Falta el nombre', description: 'El árbitro debe tener un nombre.' });
      return;
    }

    setIsSaving(true);
    try {
      const refereesRef = collection(firestore, 'leagues', leagueId, 'referees');

      if (referee) {
        // Update existing referee
        await updateDoc(doc(firestore, 'leagues', leagueId, 'referees', referee.id), {
          name: name.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          notes: notes.trim() || null,
        });
        toast({ title: 'Árbitro actualizado', description: `${name} fue actualizado correctamente.` });
      } else {
        // Create new referee
        await addDoc(refereesRef, {
          name: name.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          notes: notes.trim() || null,
          leagueId,
          assignedMatches: [],
          createdAt: new Date().toISOString(),
        });
        toast({ title: 'Árbitro agregado', description: `${name} fue agregado a la lista de árbitros.` });
      }

      onOpenChange(false);
    } catch (e: any) {
      console.error('[AddReferee] Error:', e);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar el árbitro.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-headline font-black text-2xl uppercase tracking-tight flex items-center gap-2">
            <UserCheck className="h-6 w-6 text-primary" />
            {referee ? 'Editar Árbitro' : 'Nuevo Árbitro'}
          </DialogTitle>
          <DialogDescription>
            {referee ? 'Modificá los datos del árbitro.' : 'Agregá un árbitro para asignarlo a los partidos del fixture.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-xs font-bold uppercase tracking-widest">Nombre Completo *</Label>
            <Input
              id="name"
              placeholder="Ej: Juan Pérez"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-xs font-bold uppercase tracking-widest">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="juanperez@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone" className="text-xs font-bold uppercase tracking-widest">Teléfono</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+598 99 123 456"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes" className="text-xs font-bold uppercase tracking-widest">Notas</Label>
            <Textarea
              id="notes"
              placeholder="Experiencia, disponibilidad, etc."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserCheck className="mr-2 h-4 w-4" />}
            {referee ? 'Guardar Cambios' : 'Agregar Árbitro'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
