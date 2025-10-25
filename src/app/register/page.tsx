

'use client';

import { useUser, useFirestore, initializeFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { useAuth } from '@/firebase';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { writeBatch, collection, doc } from 'firebase/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { nanoid } from 'nanoid';
import type { Group, Player } from '@/lib/types';
import { SoccerPlayerIcon } from '@/components/icons/soccer-player-icon';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Camera } from 'lucide-react';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const registerSchema = z.object({
    displayName: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
    email: z.string().email('Por favor, introduce un correo electrónico válido.'),
    password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres.'),
    position: z.enum(['DEL', 'MED', 'DEF', 'POR'], { required_error: 'La posición es obligatoria.'}),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const { user, loading } = useUser();
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
        displayName: '',
        email: '',
        password: '',
    }
  });

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard?new_user=true');
    }
  }, [user, loading, router]);
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setProfileImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };


  const onSubmit = async (data: RegisterFormValues) => {
    if (!auth || !firestore) return;
    setIsSubmitting(true);
    
    let photoURL = `https://picsum.photos/seed/${data.displayName}/400/400`;

    try {
        // Step 1: Create user in Auth
        const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
        const newUser = userCredential.user;

        // Step 2: If a file was selected, upload it now that we have a user UID
        if (profileImageFile) {
            try {
                const { firebaseApp } = initializeFirebase();
                const storage = getStorage(firebaseApp);
                const fileExtension = profileImageFile.name.split('.').pop();
                const fileName = `${newUser.uid}.${fileExtension}`;
                const filePath = `profile-images/${newUser.uid}/${fileName}`;
                const storageRef = ref(storage, filePath);
                
                const uploadResult = await uploadBytes(storageRef, profileImageFile);
                photoURL = await getDownloadURL(uploadResult.ref);
            } catch (uploadError) {
                console.error("Error uploading profile image, using fallback.", uploadError);
                toast({
                    variant: 'destructive',
                    title: 'Error de subida',
                    description: 'No se pudo subir tu foto. Se usará una por defecto, podés cambiarla desde tu perfil.',
                });
            }
        }
        
        // Step 3: Update Auth profile with display name and final photoURL
        await updateProfile(newUser, {
            displayName: data.displayName,
            photoURL: photoURL,
        });

        // Step 4: Create Firestore documents in a batch for atomicity
        const batch = writeBatch(firestore);

        // 4a. Create user document in /users
        const userRef = doc(firestore, 'users', newUser.uid);
        const newUserProfile = {
          uid: newUser.uid,
          email: newUser.email,
          displayName: data.displayName,
          photoURL: photoURL,
          groups: [], // Start with no groups
          activeGroupId: null, // No active group initially
        };
        batch.set(userRef, newUserProfile);

        // 4b. Create player document in /players
        const playerRef = doc(firestore, 'players', newUser.uid); // Use user UID as player ID
        const baseStat = 50;
        const newPlayer: Omit<Player, 'id'> = {
            name: data.displayName,
            position: data.position,
            pac: baseStat,
            sho: baseStat,
            pas: baseStat,
            dri: baseStat,
            def: baseStat,
            phy: baseStat,
            ovr: baseStat,
            photoUrl: photoURL,
            stats: { matchesPlayed: 0, goals: 0, assists: 0, averageRating: 0 },
            ownerUid: newUser.uid,
            groupId: null, // No group initially
            cardGenerationCredits: 3, // Give 3 credits on registration
            lastCreditReset: new Date().toISOString(),
        };
        batch.set(playerRef, newPlayer);

        await batch.commit();
        
        toast({
            title: '¡Cuenta creada!',
            description: 'Te hemos redirigido al panel de control.',
        });
        // The useEffect will handle the redirect

    } catch (error: any) {
        toast({
            variant: 'destructive',
            title: 'Error de registro',
            description: error.message === 'Firebase: Error (auth/email-already-in-use).' ? 'Este correo electrónico ya está en uso.' : error.message,
          });
    } finally {
        setIsSubmitting(false);
    }
  }

  if (loading || user) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <SoccerPlayerIcon className="h-16 w-16 color-cycle-animation" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
            <div className="flex w-full flex-col items-center justify-center gap-2 mb-4">
                <div className="flex items-center gap-4">
                    <SoccerPlayerIcon className="h-12 w-12 text-primary" />
                    <h1 className="text-5xl font-bold font-headline">Pateá</h1>
                </div>
                 <p className="text-muted-foreground">
                    Armá tu perfil para empezar a jugar.
                </p>
            </div>
        </CardHeader>
        <CardContent>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="flex flex-col items-center gap-4">
                         <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/png, image/jpeg"
                            onChange={handleFileChange}
                        />
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="relative group"
                        >
                            <Avatar className="h-24 w-24 border-4 border-muted-foreground/20 group-hover:border-primary/50 transition-colors">
                                <AvatarImage src={imagePreview || undefined} alt="Foto de perfil" />
                                <AvatarFallback className="text-4xl">
                                    {form.getValues('displayName')?.charAt(0) || <Camera />}
                                </AvatarFallback>
                            </Avatar>
                            <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Camera className="h-8 w-8 text-white" />
                            </div>
                        </button>
                    </div>

                    <FormField
                        control={form.control}
                        name="displayName"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Nombre</FormLabel>
                                <FormControl>
                                    <Input placeholder="Tu nombre" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Correo Electrónico</FormLabel>
                                <FormControl>
                                    <Input placeholder="tu@email.com" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                     <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Contraseña</FormLabel>
                                <FormControl>
                                    <Input type="password" placeholder="********" {...field} />
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
                                            <SelectValue placeholder="Selecciona tu posición en el campo" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="DEL">DEL (Delantero)</SelectItem>
                                        <SelectItem value="MED">MED (Centrocampista)</SelectItem>
                                        <SelectItem value="DEF">DEF (Defensa)</SelectItem>
                                        <SelectItem value="POR">POR (Portero)</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                        {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creando cuenta...</> : 'Crear Cuenta'}
                    </Button>
                </form>
            </Form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
                ¿Ya tienes una cuenta?{' '}
                <Link href="/login" className="font-semibold text-primary hover:underline">
                    Inicia Sesión
                </Link>
            </p>
        </CardContent>
      </Card>
    </div>
  );
}
