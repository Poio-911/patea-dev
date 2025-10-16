'use client';

import { useUser, useFirestore } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Goal } from 'lucide-react';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { useAuth } from '@/firebase';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { writeBatch, collection, doc } from 'firebase/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
      router.push('/dashboard');
    }
  }, [user, loading, router]);


  const onSubmit = async (data: RegisterFormValues) => {
    if (!auth || !firestore) return;
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
        const newUser = userCredential.user;

        if(newUser) {
            const batch = writeBatch(firestore);

            // 1. Update auth profile
            await updateProfile(newUser, {
                displayName: data.displayName,
                photoURL: `https://picsum.photos/seed/${data.displayName}/400/400`
            });

            // 2. Create user document in /users
            const userRef = doc(firestore, 'users', newUser.uid);
            const newUserProfile = {
              uid: newUser.uid,
              email: newUser.email,
              displayName: data.displayName,
              photoURL: `https://picsum.photos/seed/${data.displayName}/400/400`,
              groups: [],
              activeGroupId: null,
            };
            batch.set(userRef, newUserProfile);

            // 3. Create player document in /players
            const playerRef = doc(firestore, 'players', newUser.uid); // Use user UID as player ID
            const baseStat = 75;
            const newPlayer = {
                name: data.displayName,
                position: data.position,
                pac: baseStat,
                sho: baseStat,
                pas: baseStat,
                dri: baseStat,
                def: baseStat,
                phy: baseStat,
                ovr: baseStat,
                photoUrl: `https://picsum.photos/seed/${data.displayName}/400/400`,
                stats: { matchesPlayed: 0, goals: 0, assists: 0, averageRating: 0 },
                ownerUid: newUser.uid,
                groupId: null,
            };
            batch.set(playerRef, newPlayer);

            await batch.commit();
        }
        
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
    }
  }

  if (loading || user) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Goal className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
            <div className="flex justify-center items-center gap-4 mb-4">
                <Goal className="h-12 w-12 text-primary" />
                <div>
                    <CardTitle className="text-3xl font-bold font-headline">Crear Cuenta</CardTitle>
                    <CardDescription>Únete al manager de fútbol definitivo.</CardDescription>
                </div>
            </div>
        </CardHeader>
        <CardContent>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                    <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                        {form.formState.isSubmitting ? 'Creando cuenta...' : 'Crear Cuenta'}
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
