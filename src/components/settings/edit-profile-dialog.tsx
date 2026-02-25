'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Camera, Edit2 } from 'lucide-react';
import { updateProfileAction } from '@/lib/actions/server-actions';
import { isErrorResponse } from '@/lib/errors';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ImageCropperDialog } from '@/components/image-cropper-dialog';
import { initializeFirebase } from '@/firebase';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updateProfile } from 'firebase/auth';
import type { User } from 'firebase/auth';
import type { Player } from '@/lib/types';

const profileSchema = z.object({
    displayName: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
    position: z.enum(['DEL', 'MED', 'DEF', 'POR'], { required_error: 'La posición es obligatoria.' }),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

interface EditProfileDialogProps {
    user: User;
    playerData: Player | null;
}

export function EditProfileDialog({ user, playerData }: EditProfileDialogProps) {
    const [open, setOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [generatedPhotoUrl, setGeneratedPhotoUrl] = useState<string | null>(null);
    const { toast } = useToast();

    const form = useForm<ProfileFormValues>({
        resolver: zodResolver(profileSchema),
        defaultValues: {
            displayName: user.displayName || '',
            position: playerData?.position || 'MED',
        },
    });

    const onSubmit = async (data: ProfileFormValues) => {
        setIsSubmitting(true);
        let finalPhotoURL = user.photoURL;

        try {
            if (generatedPhotoUrl && generatedPhotoUrl.startsWith('data:image')) {
                const response = await fetch(generatedPhotoUrl);
                const blob = await response.blob();
                const { firebaseApp } = initializeFirebase();
                const storage = getStorage(firebaseApp);
                const storagePath = `profile-images/${user.uid}/profile_${Date.now()}.webp`;
                const storageRef = ref(storage, storagePath);
                const uploadResult = await uploadBytes(storageRef, blob, { contentType: 'image/webp' });
                finalPhotoURL = await getDownloadURL(uploadResult.ref);
            }

            // 1. Update Server Side (Firestore + Admin SDK Auth)
            const res = await updateProfileAction(user.uid, {
                displayName: data.displayName,
                position: data.position,
                ...(finalPhotoURL && finalPhotoURL !== user.photoURL ? { photoURL: finalPhotoURL } : {})
            });

            if (isErrorResponse(res)) throw new Error(res.error || 'Error al actualizar en el servidor');

            // 2. Update Client Side Auth (so UI updates immediately without reload)
            await updateProfile(user, {
                displayName: data.displayName,
                ...(finalPhotoURL !== user.photoURL ? { photoURL: finalPhotoURL } : {})
            });

            toast({
                title: '¡Perfil actualizado!',
                description: 'Tus cambios se han guardado correctamente.',
            });
            setOpen(false);
        } catch (error) {
            console.error('Error updating profile:', error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'No se pudo actualizar el perfil. Inténtalo de nuevo.',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="w-full sm:w-auto">
                    <Edit2 className="w-4 h-4 mr-2" />
                    Editar Perfil
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Editar Perfil</DialogTitle>
                    <DialogDescription>
                        Actualiza tu información personal y foto de perfil.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <div className="flex flex-col items-center gap-4 py-4">
                            <Avatar className="h-24 w-24">
                                <AvatarImage src={imagePreview || user.photoURL || undefined} />
                                <AvatarFallback className="text-2xl">
                                    {user.displayName?.charAt(0).toUpperCase() || 'U'}
                                </AvatarFallback>
                            </Avatar>
                            <ImageCropperDialog
                                player={{ photoURL: imagePreview || user.photoURL || undefined }}
                                onSaveComplete={(newUrl: string) => {
                                    setImagePreview(newUrl);
                                    setGeneratedPhotoUrl(newUrl);
                                }}
                            >
                                <Button type="button" variant="outline" size="sm">
                                    <Camera className="w-4 h-4 mr-2" />
                                    Cambiar Foto
                                </Button>
                            </ImageCropperDialog>
                        </div>

                        <FormField
                            control={form.control}
                            name="displayName"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nombre o Apodo</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Tu nombre en la cancha" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="position"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Posición Favorita</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Elige tu posición" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="DEL">Delantero (DEL)</SelectItem>
                                            <SelectItem value="MED">Mediocampista (MED)</SelectItem>
                                            <SelectItem value="DEF">Defensor (DEF)</SelectItem>
                                            <SelectItem value="POR">Portero (POR)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                Guardar Cambios
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
