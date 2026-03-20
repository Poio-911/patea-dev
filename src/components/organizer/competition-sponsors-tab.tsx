'use client';

import * as React from 'react';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { Sponsor } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, ExternalLink, Megaphone, Loader2, Image as ImageIcon, Globe } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

interface CompetitionSponsorsTabProps {
  competitionId: string;
  competitionType: 'leagues' | 'cups';
  sponsors?: Sponsor[];
}

export function CompetitionSponsorsTab({ competitionId, competitionType, sponsors = [] }: CompetitionSponsorsTabProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isAdding, setIsAdding] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);

  // New sponsor state
  const [newName, setNewName] = React.useState('');
  const [newLogoUrl, setNewLogoUrl] = React.useState('');
  const [newWebsiteUrl, setNewWebsiteUrl] = React.useState('');

  const handleAddSponsor = async () => {
    if (!competitionId) return;
    if (!newName || !newLogoUrl) {
      toast({ variant: 'destructive', title: 'Faltan datos', description: 'Nombre y Logo son obligatorios.' });
      return;
    }

    setIsSaving(true);
    try {
      const { manageSponsorAction } = await import('@/lib/actions/server-actions');
      const res = await manageSponsorAction(competitionType, competitionId, 'add', {
        name: newName,
        logoUrl: newLogoUrl,
        websiteUrl: newWebsiteUrl,
        order: sponsors.length
      });
      if (!res?.success) throw new Error(res?.error || 'Error');

      toast({ title: 'Sponsor agregado', description: `${newName} ahora aparece en la competición.` });
      setIsOpen(false);
      setNewName('');
      setNewLogoUrl('');
      setNewWebsiteUrl('');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo agregar el sponsor.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSponsor = async (sponsor: Sponsor) => {
    try {
      const { manageSponsorAction } = await import('@/lib/actions/server-actions');
      const res = await manageSponsorAction(competitionType, competitionId, 'remove', sponsor);
      if (!res?.success) throw new Error(res?.error || 'Error');
      toast({ title: 'Sponsor eliminado' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar el sponsor.' });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
              <Megaphone className="h-6 w-6 text-primary" />
              Patrocinios y Publicidad
            </CardTitle>
            <CardDescription>
              Gestioná las marcas que apoyan tu torneo. Los logos aparecerán en la vista pública.
            </CardDescription>
          </div>
          
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button className="font-bold uppercase tracking-wide">
                <Plus className="mr-2 h-4 w-4" /> Agregar Sponsor
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle className="font-black uppercase tracking-tight">Nuevo Sponsor</DialogTitle>
              </DialogHeader>
              <div className="grid gap-6 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Nombre de la Marca</Label>
                  <Input id="name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ej: Nike, Gatorade, Kiosco Pepe" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="logo">URL del Logo (Imagen)</Label>
                  <div className="flex gap-2">
                    <Input id="logo" value={newLogoUrl} onChange={(e) => setNewLogoUrl(e.target.value)} placeholder="https://..." />
                    <div className="w-10 h-10 rounded-md border bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                      {newLogoUrl ? <img src={newLogoUrl} alt="Logo preview" className="w-full h-full object-contain" /> : <ImageIcon className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="web">Website o Red Social (Opcional)</Label>
                  <Input id="web" value={newWebsiteUrl} onChange={(e) => setNewWebsiteUrl(e.target.value)} placeholder="https://instagram.com/..." />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setIsOpen(false)}>Cancelar</Button>
                <Button onClick={handleAddSponsor} disabled={isSaving}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Guardar Sponsor'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sponsors.length === 0 ? (
          <div className="col-span-full py-12 flex flex-col items-center justify-center border-2 border-dashed rounded-3xl bg-muted/20 opacity-60">
            <Megaphone className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="font-bold text-muted-foreground">No hay sponsors configurados</p>
            <p className="text-sm text-muted-foreground/60">Agregá marcas para darle un toque profesional a tu torneo.</p>
          </div>
        ) : (
          sponsors.map((sponsor) => (
            <Card key={sponsor.id} className="overflow-hidden group hover:border-primary/40 transition-all shadow-md">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16 rounded-xl border-2 border-muted bg-white p-1">
                    <AvatarImage src={sponsor.logoUrl} className="object-contain" />
                    <AvatarFallback className="rounded-xl bg-primary/10 text-primary font-bold">
                      {sponsor.name.substring(0, 1)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black uppercase tracking-tight truncate">{sponsor.name}</h3>
                    {sponsor.websiteUrl && (
                      <a 
                        href={sponsor.websiteUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1 mt-1 font-medium"
                      >
                        <Globe className="h-3 w-3" />
                        Sitio Web
                      </a>
                    )}
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleDeleteSponsor(sponsor)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
