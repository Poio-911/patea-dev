'use client';

import { useState } from 'react';
import {
    ResponsiveDialog as Dialog,
    ResponsiveDialogContent as DialogContent,
    ResponsiveDialogDescription as DialogDescription,
    ResponsiveDialogHeader as DialogHeader,
    ResponsiveDialogTitle as DialogTitle,
    ResponsiveDialogTrigger as DialogTrigger,
} from '@/components/ui/responsive-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ImageCropperDialog } from '@/components/image-cropper-dialog';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Mail, Phone, Loader2, Check, Upload, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { isErrorResponse } from '@/lib/errors';
import { updateProfileAction } from '@/lib/actions/server-actions';
import type { UserProfile } from '@/lib/types';

type PersonalInfoEditorProps = {
    user: UserProfile;
};

export function PersonalInfoEditor({ user }: PersonalInfoEditorProps) {
    const { toast } = useToast();

    const [open, setOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState({
        displayName: user.displayName || '',
        phoneNumber: user.phoneNumber || '',
    });

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const result = await updateProfileAction(user.uid, {
                displayName: formData.displayName,
                phoneNumber: formData.phoneNumber,
            });
            if (isErrorResponse(result)) {
                throw new Error(result.error || 'No se pudo actualizar el perfil.');
            }
            if (!result.success) {
                throw new Error('No se pudo actualizar el perfil.');
            }

            toast({
                title: 'Perfil actualizado',
                description: 'Tus datos personales se guardaron correctamente.',
            });

            setOpen(false);
        } catch (error) {
            console.error('Error updating profile:', error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'No se pudo actualizar tu perfil. Intentá de nuevo.',
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleOpenChange = (isOpen: boolean) => {
        setOpen(isOpen);
        if (!isOpen) {
            // Reset form data when closing
            setFormData({
                displayName: user.displayName || '',
                phoneNumber: user.phoneNumber || '',
            });
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <Settings className="mr-2 h-4 w-4" />
                    Editar Información Personal
                </Button>
            </DialogTrigger>

            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <User className="h-5 w-5" />
                        Información Personal
                    </DialogTitle>
                    <DialogDescription>
                        Actualizá tus datos personales y de contacto
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Avatar Section */}
                    <div className="flex items-center gap-4">
                        <Avatar className="h-20 w-20">
                            <AvatarImage src={user.photoURL || undefined} alt={user.displayName || 'Usuario'} />
                            <AvatarFallback className="text-lg">
                                {user.displayName?.substring(0, 2).toUpperCase() || 'US'}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                            <p className="text-sm text-muted-foreground mb-2">Foto de perfil</p>
                            <ImageCropperDialog
                                player={{ photoURL: user.photoURL || undefined }}
                                onSaveComplete={(newUrl) => {
                                    // Actualizar estado local para reflejar el cambio inmediato
                                    // (aunque el componente ImageCropperDialog ya actualiza Auth/Firestore,
                                    // esto fuerza el re-render visual del avatar en este diálogo)
                                    // Nota: PersonalInfoEditor usa 'user' prop, que viene de un hook upper-level.
                                    // Idealmente el hook useUser detectará el cambio, pero podemos forzar un refresh si es necesario.
                                    toast({ title: 'Imagen actualizada', description: 'Tu perfil se ha actualizado correctamente.' });
                                }}
                            >
                                <Button variant="outline" size="sm">
                                    <Upload className="h-4 w-4 mr-2" />
                                    Cambiar foto
                                </Button>
                            </ImageCropperDialog>
                        </div>
                    </div>

                    {/* Form Fields */}
                    <div className="space-y-4">
                        {/* Display Name */}
                        <div className="space-y-2">
                            <Label htmlFor="displayName">Nombre completo</Label>
                            <Input
                                id="displayName"
                                value={formData.displayName}
                                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                                placeholder="Tu nombre completo"
                            />
                        </div>

                        {/* Email (Read-only) */}
                        <div className="space-y-2">
                            <Label htmlFor="email">Correo electrónico</Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="email"
                                    value={user.email || ''}
                                    disabled
                                    className="pl-10 bg-muted"
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">
                                El correo no se puede modificar por seguridad
                            </p>
                        </div>

                        {/* Phone Number */}
                        <div className="space-y-2">
                            <Label htmlFor="phoneNumber">WhatsApp / Teléfono</Label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="phoneNumber"
                                    value={formData.phoneNumber}
                                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                                    placeholder="+54 9 11 1234-5678"
                                    className="pl-10"
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Formato recomendado: +54 9 11 1234-5678
                            </p>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-4">
                        <Button onClick={handleSave} disabled={isSaving} className="flex-1">
                            {isSaving ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Guardando...
                                </>
                            ) : (
                                <>
                                    <Check className="mr-2 h-4 w-4" />
                                    Guardar cambios
                                </>
                            )}
                        </Button>
                        <Button onClick={() => setOpen(false)} variant="outline" disabled={isSaving}>
                            Cancelar
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
