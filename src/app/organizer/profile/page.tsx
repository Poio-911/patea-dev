'use client';

import * as React from 'react';
import { useUser } from '@/firebase';
import { updateOrganizerProfileAction } from '@/lib/auth-actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Save, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { OrganizerProfile } from '@/lib/types';

export default function OrganizerProfilePage() {
  const { user } = useUser();
  const { toast } = useToast();

  const [isSavingProfile, setIsSavingProfile] = React.useState(false);
  const [profileForm, setProfileForm] = React.useState({
    displayName: '',
    phoneNumber: '',
    organizationName: '',
    contactEmail: '',
    bio: '',
  });

  React.useEffect(() => {
    if (!user) return;
    const organizerProfile: OrganizerProfile = user.organizerProfile || {};
    setProfileForm({
      displayName: user.displayName || '',
      phoneNumber: user.phoneNumber || '',
      organizationName: organizerProfile.organizationName || '',
      contactEmail: organizerProfile.contactEmail || user.email || '',
      bio: organizerProfile.bio || '',
    });
  }, [user]);

  const handleSaveOrganizerProfile = async () => {
    if (!profileForm.displayName.trim()) {
      toast({ variant: 'destructive', title: 'Falta nombre', description: 'Completá el nombre para guardar el perfil.' });
      return;
    }

    setIsSavingProfile(true);
    try {
      const result = await updateOrganizerProfileAction({
        displayName: profileForm.displayName.trim(),
        phoneNumber: profileForm.phoneNumber.trim(),
        organizationName: profileForm.organizationName.trim(),
        contactEmail: profileForm.contactEmail.trim(),
        bio: profileForm.bio.trim(),
      });

      if (!result?.success) {
        throw new Error((result as any)?.error || 'No se pudo guardar.');
      }

      toast({ title: 'Perfil actualizado', description: 'Los datos del organizador se guardaron correctamente.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'No se pudo guardar el perfil.' });
    } finally {
      setIsSavingProfile(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="space-y-2">
        <h1 className="text-3xl font-black tracking-tight uppercase">Perfil del Organizador</h1>
        <p className="text-muted-foreground">Configurá tus datos institucionales y de contacto para gestionar tus torneos.</p>
      </div>

      <Card className="bg-card/40 border-border/40 backdrop-blur-xl">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-lg font-black uppercase tracking-wide flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Datos de cuenta
              </CardTitle>
              <p className="text-sm text-muted-foreground">Estos datos identifican al organizador en el panel y futuras vistas de competición.</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="uppercase tracking-widest text-[10px] font-black border-primary/20 text-primary/90 bg-primary/5">
                {user?.role || 'player'}
              </Badge>
              <Badge variant="secondary" className="font-mono text-[10px]">{user?.email || 'sin-email'}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="organizer-display-name">Nombre visible</Label>
              <Input
                id="organizer-display-name"
                value={profileForm.displayName}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, displayName: e.target.value }))}
                placeholder="Ej: Liga Barrial Sur"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="organizer-org-name">Organización / Marca</Label>
              <Input
                id="organizer-org-name"
                value={profileForm.organizationName}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, organizationName: e.target.value }))}
                placeholder="Ej: Pateá Organizer"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="organizer-phone">Teléfono de contacto</Label>
              <Input
                id="organizer-phone"
                value={profileForm.phoneNumber}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, phoneNumber: e.target.value }))}
                placeholder="Ej: +54 11 5555-1234"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="organizer-contact-email">Email de contacto</Label>
              <Input
                id="organizer-contact-email"
                value={profileForm.contactEmail}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, contactEmail: e.target.value }))}
                placeholder="contacto@tuorganizacion.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="organizer-bio">Descripción corta</Label>
            <Textarea
              id="organizer-bio"
              value={profileForm.bio}
              onChange={(e) => setProfileForm((prev) => ({ ...prev, bio: e.target.value }))}
              placeholder="Contá brevemente cómo organizás torneos, zona y estilo de competencia."
              rows={3}
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveOrganizerProfile} disabled={isSavingProfile} className="font-bold">
              <Save className="mr-2 h-4 w-4" />
              {isSavingProfile ? 'Guardando...' : 'Guardar Perfil'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
