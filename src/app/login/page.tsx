
'use client';

import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword } from 'firebase/auth';
import { useAuth } from '@/firebase';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';
import { SoccerPlayerIcon } from '@/components/icons/soccer-player-icon';

const loginSchema = z.object({
    email: z.string().email('Por favor, introduce un correo electrónico válido.'),
    password: z.string().min(1, 'La contraseña es obligatoria.'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { user, loading } = useUser();
  const router = useRouter();
  const auth = useAuth();
  const { toast } = useToast();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
        email: '',
        password: '',
    }
  });

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  const handleGoogleLogin = async () => {
    if (!auth) return;
    setIsGoogleLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      // The useEffect will handle the redirect
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error de inicio de sesión',
        description: error.message,
      });
      setIsGoogleLoading(false);
    }
  };

  const onSubmit = async (data: LoginFormValues) => {
    if (!auth) return;
    try {
        await signInWithEmailAndPassword(auth, data.email, data.password);
        // The useEffect will handle the redirect
    } catch (error: any) {
        toast({
            variant: 'destructive',
            title: 'Error de inicio de sesión',
            description: 'Las credenciales no son correctas. Por favor, inténtalo de nuevo.',
          });
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
          <div className="flex w-full flex-col items-center justify-center gap-4">
            <div className="flex items-center gap-4">
                <SoccerPlayerIcon className="h-16 w-16 text-primary" />
                <h1 className="text-6xl font-bold font-headline">Pateá</h1>
            </div>
            <p className="text-muted-foreground text-center">
                Inicia sesión para organizar los partidos con tus amigos.
            </p>
          </div>
        </CardHeader>
        <CardContent>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                        {form.formState.isSubmitting ? 'Iniciando sesión...' : 'Iniciar Sesión'}
                    </Button>
                </form>
            </Form>
            <div className="mt-4 text-center">
                <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
                    ¿Olvidaste tu contraseña?
                </Link>
            </div>
            <Separator className="my-6" />
            <Button onClick={handleGoogleLogin} variant="outline" className="w-full" disabled={isGoogleLoading}>
                {isGoogleLoading ? 'Cargando...' : 'Continuar con Google'}
            </Button>

            <p className="mt-6 text-center text-sm text-muted-foreground">
                ¿No tienes una cuenta?{' '}
                <Link href="/register" className="font-semibold text-primary hover:underline">
                    Regístrate
                </Link>
            </p>
        </CardContent>
      </Card>
    </div>
  );
}
