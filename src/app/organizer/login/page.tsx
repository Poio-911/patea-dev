'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useAuth } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, ShieldCheck, FileSpreadsheet, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { createSessionCookie } from '@/lib/auth-actions';
import { initializeOrganizerProfileAction } from '@/lib/auth-actions';
import { useToast } from '@/hooks/use-toast';
import { SoccerPlayerIcon } from '@/components/icons/soccer-player-icon';

const loginSchema = z.object({
  email: z.string().email('Correo inválido.'),
  password: z.string().min(1, 'La contraseña es obligatoria.'),
});

const registerSchema = z.object({
  displayName: z.string().min(3, 'Mínimo 3 caracteres.'),
  email: z.string().email('Correo inválido.'),
  password: z.string().min(6, 'Mínimo 6 caracteres.'),
});

export default function OrganizerLoginPage() {
  const router = useRouter();
  const auth = useAuth();
  const { user, loading } = useUser();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const { toast } = useToast();

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const registerForm = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { displayName: '', email: '', password: '' },
  });

  React.useEffect(() => {
    // Si ya está logueado y tiene rol organizador, pasa de largo
    if (!loading && user) {
      if (user.role === 'organizer') {
        router.push('/organizer');
      } else {
        router.push('/dashboard');
      }
    }
  }, [user, loading, router]);

  const onLogin = async (data: z.infer<typeof loginSchema>) => {
    if (!auth) return;
    setIsSubmitting(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, data.email, data.password);
      const idToken = await userCredential.user.getIdToken(true);
      await createSessionCookie(idToken);
      
      toast({ title: 'Bienvenido de nuevo' });
      router.push('/organizer');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error al iniciar sesión',
        description: 'Verificá tus credenciales e intentá de nuevo.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const onRegister = async (data: z.infer<typeof registerSchema>) => {
    if (!auth) return;
    setIsSubmitting(true);
    try {
      // 1. Create Auth User
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      const newUser = userCredential.user;

      // 2. Set Display Name
      await updateProfile(newUser, { displayName: data.displayName });

      // 3. Create Session Cookie early for API access
      const idToken = await newUser.getIdToken(true);
      await createSessionCookie(idToken);

      // 4. Initialize Organizer Profile (uses the new server action)
      const initResult = await initializeOrganizerProfileAction({
        email: data.email,
        displayName: data.displayName,
      });

      if (!initResult.success) {
        throw new Error(initResult.error);
      }

      toast({ title: 'Cuenta creada', description: '¡Bienvenido al panel de organizador!' });
      router.push('/organizer');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error de registro',
        description: error.message.includes('auth/email-already-in-use') ? 'Este correo ya está registrado.' : error.message
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <SoccerPlayerIcon className="h-16 w-16 color-cycle-animation" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8 relative">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/20 rounded-full blur-[100px] pointer-events-none" />

      <Card className="w-full max-w-md bg-card/60 backdrop-blur-xl border-white/10 shadow-2xl relative z-10 overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl -mr-16 -mt-16 opacity-50 pointer-events-none" />

        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20">
            <Trophy className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="font-headline font-black text-3xl uppercase tracking-tighter">
            Pateá <span className="text-primary">Organizer</span>
          </CardTitle>
          <CardDescription className="text-base mt-2">
            El centro de control oficial para Ligas y Copas.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4">
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Ingresar</TabsTrigger>
              <TabsTrigger value="register">Registrarme</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login" className="space-y-4">
              <Form {...loginForm}>
                <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                  <FormField
                    control={loginForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Correo Electrónico</FormLabel>
                        <FormControl><Input placeholder="tu@email.com" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={loginForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contraseña</FormLabel>
                        <FormControl><Input type="password" placeholder="********" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full shadow-lg h-11" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Entrar al Panel'}
                  </Button>
                </form>
              </Form>
            </TabsContent>

            <TabsContent value="register" className="space-y-4">
              <Form {...registerForm}>
                <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
                  <FormField
                    control={registerForm.control}
                    name="displayName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre o Entidad</FormLabel>
                        <FormControl><Input placeholder="Organizadores Unidos" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={registerForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Correo Electrónico</FormLabel>
                        <FormControl><Input placeholder="tu@email.com" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={registerForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contraseña</FormLabel>
                        <FormControl><Input type="password" placeholder="********" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full shadow-lg h-11" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Crear Cuenta Organziadora'}
                  </Button>
                </form>
              </Form>
            </TabsContent>
          </Tabs>

          <div className="mt-8 space-y-3">
            <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/20 p-3">
              <ShieldCheck className="h-5 w-5 text-primary flex-shrink-0" />
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Autonomía Total</p>
                <p className="text-xs text-muted-foreground leading-tight">Creá tus propios equipos sin depender de registros.</p>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-center border-t border-border/10 pt-4 pb-6 bg-muted/10">
          <Button variant="link" className="text-xs text-muted-foreground hover:text-primary h-auto p-0" onClick={() => router.push('/login')}>
            ← Volver a Pateá Clásico
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
