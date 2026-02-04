'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Mail, Phone, Loader2, Check, Upload, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { doc, updateDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { updateProfile } from 'firebase/auth';
import { useAuth } from '@/firebase';
import type { UserProfile } from '@/lib/types';

type PersonalInfoEditorProps = {
    user: UserProfile;
};

export function PersonalInfoEditor({ user }: PersonalInfoEditorProps) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const auth = useAuth();

    const [open, setOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState({
        displayName: user.displayName || '',
        phoneNumber: user.phoneNumber || '',
    });

    const handleSave = async () => {
        if (!firestore || !auth?.currentUser) return;

        setIsSaving(true);
        try {
            const userRef = doc(firestore, 'users', user.uid);

            // Update Firestore
            await updateDoc(userRef, {
                displayName: formData.displayName,
                phoneNumber: formData.phoneNumber,
            });

            // Update Firebase Auth displayName
            if (formData.displayName !== user.displayName) {
                await updateProfile(auth.currentUser, {
                    displayName: formData.displayName,
                });
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
                            <Button variant="outline" size="sm" disabled>
                                <Upload className="h-4 w-4 mr-2" />
                                Cambiar foto
                            </Button>
                            <p className="text-xs text-muted-foreground mt-1">Próximamente disponible</p>
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
