'use client';

import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Goal } from 'lucide-react';
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

const registerSchema = z.object({
    displayName: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
    email: z.string().email('Por favor, introduce un correo electrónico válido.'),
    password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres.'),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const { user, loading } = useUser();
  const router = useRouter();
  const auth = useAuth();
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
    if (!auth) return;
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
        if(userCredential.user) {
            await updateProfile(userCredential.user, {
                displayName: data.displayName
            });
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
