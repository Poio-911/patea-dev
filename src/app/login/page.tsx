
'use client';

import { useUser, useAuth } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { SoccerPlayerIcon } from '@/components/icons/soccer-player-icon';
import { Mail } from 'lucide-react';
import { WhatsAppIcon } from '@/components/icons/whatsapp-icon';
import { createSessionCookie } from '@/lib/auth-actions';

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

  const onSubmit = async (data: LoginFormValues) => {
    if (!auth) return;
    try {
        const userCredential = await signInWithEmailAndPassword(auth, data.email, data.password);
        const idToken = await userCredential.user.getIdToken();
        await createSessionCookie(idToken);
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
       <div className="mx-auto flex w-full max-w-sm flex-grow flex-col items-center justify-center space-y-6 text-center">
        <Card className="w-full">
            <CardHeader className="text-center">
            <div className="flex w-full flex-col items-center justify-center gap-2">
                <div className="flex items-center gap-3">
                    <SoccerPlayerIcon className="h-10 w-10 text-primary" />
                    <h1 className="text-4xl font-bold font-headline">Pateá</h1>
                </div>
                <p className="text-muted-foreground text-center text-sm">
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
                
                <div className="mt-4 text-center text-sm">
                    <Link href="/forgot-password" className="font-medium text-primary hover:underline">
                        ¿Olvidaste tu contraseña?
                    </Link>
                </div>

                <p className="mt-6 text-center text-sm text-muted-foreground">
                    ¿No tienes una cuenta?{' '}
                    <Link href="/register" className="font-semibold text-primary hover:underline">
                        Regístrate
                    </Link>
                </p>
            </CardContent>
        </Card>
      </div>
      <footer className="py-4 text-center text-xs text-muted-foreground">
          <p className="font-semibold">Desarrollado por Santiago López</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-x-3 gap-y-1 mt-2">
            <a href="mailto:lopeztoma.santiago@gmail.com" className="flex items-center gap-1 hover:text-primary transition-colors">
                <Mail className="h-3 w-3"/>
                <span>lopeztoma.santiago@gmail.com</span>
            </a>
            <a href="https://wa.me/59892443585" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-primary transition-colors">
                <WhatsAppIcon className="h-3 w-3" />
                <span>+598 92 443 585</span>
            </a>
          </div>
          <p className="mt-3 text-muted-foreground/80">© 2024 Pateá. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}
