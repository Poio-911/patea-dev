'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
    ResponsiveDialog as Dialog,
    ResponsiveDialogContent as DialogContent,
    ResponsiveDialogDescription as DialogDescription,
    ResponsiveDialogFooter as DialogFooter,
    ResponsiveDialogHeader as DialogHeader,
    ResponsiveDialogTitle as DialogTitle,
    ResponsiveDialogTrigger as DialogTrigger,
} from '@/components/ui/responsive-dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Camera, Edit2 } from 'lucide-react';
import { updateProfileAction } from '@/lib/actions/server-actions';
import { isErrorResponse } from '@/lib/errors';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ImageCropperDialog } from '@/components/image-cropper-dialog';
import { initializeFirebase } from '@/firebase';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updateProfile, getAuth } from 'firebase/auth';
import type { User } from 'firebase/auth';
import type { Player, UserProfile } from '@/lib/types';
import { CountryPicker } from '@/components/ui/country-picker';

const currentYear = new Date().getFullYear();

const profileSchema = z.object({
    displayName: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
    position: z.enum(['DEL', 'MED', 'DEF', 'POR'], { required_error: 'La posición es obligatoria.' }),
    preferredFoot: z.enum(['derecho', 'izquierdo', 'ambidiestro']).optional(),
    phoneNumber: z.string().optional(),
    bio: z.string().max(160, 'Máximo 160 caracteres').optional(),
    birthYear: z.union([
        z.coerce.number().min(1950, 'Año demasiado antiguo').max(currentYear - 5, 'Año inválido'),
        z.literal(''),
    ]).optional(),
    nationality: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

interface EditProfileDialogProps {
    user: User;
    playerData: Player | null;
    userProfile?: UserProfile | null;
}

export function EditProfileDialog({ user, playerData, userProfile }: EditProfileDialogProps) {
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
            preferredFoot: playerData?.preferredFoot ?? undefined,
            phoneNumber: userProfile?.phoneNumber || '',
            bio: playerData?.bio || '',
            birthYear: playerData?.birthYear ?? '',
            nationality: playerData?.nationality || 'Uruguay',
        },
    });

    const watchBio = form.watch('bio');
    const watchBirthYear = form.watch('birthYear');
    const birthYearNum = typeof watchBirthYear === 'number' ? watchBirthYear : Number(watchBirthYear);
    const age = !isNaN(birthYearNum) && birthYearNum > 1950 ? currentYear - birthYearNum : null;

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

            const birthYearValue = data.birthYear === '' || data.birthYear === undefined
                ? undefined
                : typeof data.birthYear === 'number' ? data.birthYear : Number(data.birthYear);

            // 1. Update Server Side (Firestore + Admin SDK Auth)
            const res = await updateProfileAction(user.uid, {
                displayName: data.displayName,
                position: data.position,
                preferredFoot: data.preferredFoot,
                phoneNumber: data.phoneNumber || undefined,
                bio: data.bio || undefined,
                birthYear: birthYearValue,
                nationality: data.nationality || undefined,
                ...(finalPhotoURL && finalPhotoURL !== user.photoURL ? { photoURL: finalPhotoURL } : {})
            });

            if (isErrorResponse(res)) throw new Error(res.error || 'Error al actualizar en el servidor');

            // 2. Update Client Side Auth (so UI updates immediately without reload)
            // IMPORTANT: updateProfile() requires the native Firebase Auth User object (auth.currentUser),
            // NOT the custom UserProfile POJO from Firestore, which lacks internal methods like getIdToken().
            const { firebaseApp } = initializeFirebase();
            const currentUser = getAuth(firebaseApp).currentUser;
            if (currentUser) {
                await updateProfile(currentUser, {
                    displayName: data.displayName,
                    ...(finalPhotoURL !== user.photoURL ? { photoURL: finalPhotoURL } : {})
                });
            }

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
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div className="flex flex-col items-center gap-4 py-2">
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

                        <div className="grid grid-cols-2 gap-3">
                            <FormField
                                control={form.control}
                                name="position"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Posición</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Posición" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="DEL">Delantero</SelectItem>
                                                <SelectItem value="MED">Mediocampista</SelectItem>
                                                <SelectItem value="DEF">Defensor</SelectItem>
                                                <SelectItem value="POR">Portero</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="preferredFoot"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Pie hábil</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Pie" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="derecho">Derecho</SelectItem>
                                                <SelectItem value="izquierdo">Izquierdo</SelectItem>
                                                <SelectItem value="ambidiestro">Ambidiestro</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="bio"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Bio</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Contá algo sobre vos como jugador..."
                                            className="resize-none"
                                            rows={3}
                                            {...field}
                                        />
                                    </FormControl>
                                    <div className="flex justify-between">
                                        <FormMessage />
                                        <span className="text-xs text-muted-foreground ml-auto">
                                            {watchBio?.length || 0}/160
                                        </span>
                                    </div>
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-2 gap-3">
                            <FormField
                                control={form.control}
                                name="birthYear"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Año de nac.</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <Input
                                                    type="number"
                                                    placeholder="1995"
                                                    min={1950}
                                                    max={currentYear - 5}
                                                    {...field}
                                                    value={field.value ?? ''}
                                                />
                                                {age !== null && (
                                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                                                        {age}a
                                                    </span>
                                                )}
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="nationality"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Nacionalidad</FormLabel>
                                        <FormControl>
                                            <CountryPicker
                                                value={field.value as string | undefined}
                                                onChange={field.onChange}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="phoneNumber"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Teléfono / WhatsApp</FormLabel>
                                    <FormControl>
                                        <Input type="tel" placeholder="+54 9 11 1234-5678" {...field} />
                                    </FormControl>
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
