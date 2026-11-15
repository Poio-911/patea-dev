
'use client';

import { useUser, useAuth } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { createSessionCookie } from '@/lib/auth-actions';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import Image from 'next/image';
import { Logo } from '@/components/logo';
import { SoccerPlayerIcon } from '@/components/icons/soccer-player-icon';
import { Mail } from 'lucide-react';
import { WhatsAppIcon } from '@/components/icons/whatsapp-icon';

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
            // Create server-side session cookie so API routes see auth
            try {
                const idToken = await userCredential.user.getIdToken(true);
                const res = await createSessionCookie(idToken);
                if (!res?.success) {
                    // Non-blocking: show toast but allow client session
                    toast({
                        variant: 'destructive',
                        title: 'Error creando sesión',
                        description: res?.error || 'Reintenta iniciar sesión si persiste.',
                    });
                }
            } catch (e: any) {
                // Non-blocking failure
                toast({
                    variant: 'destructive',
                    title: 'Error creando sesión',
                    description: e?.message || 'Reintenta iniciar sesión si persiste.',
                });
            }
            // Let the useUser hook handle the redirect via onAuthStateChanged
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
        <div className="min-h-screen bg-background lg:grid lg:grid-cols-[1.1fr_1fr]">
            <section className="relative flex min-h-[290px] flex-col justify-between overflow-hidden px-6 py-7 text-white sm:px-10 lg:min-h-screen lg:px-14 lg:py-12" aria-label="Bienvenido a Pateá">
                <Image src="/brand/patea_matchday.webp" alt="" fill priority sizes="(min-width: 1024px) 55vw, 100vw" className="object-cover object-[72%_center]" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/35" />
                <div className="relative"><Logo onPhoto /></div>
                <div className="relative mt-12 max-w-md pb-1 lg:pb-10">
                    <h1 className="font-headline text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">El próximo partido empieza acá.</h1>
                    <p className="mt-4 max-w-sm text-base leading-relaxed text-white/85 lg:text-lg">Organizá la juntada y llegá a la cancha con los equipos listos.</p>
                </div>
            </section>
            <main className="flex min-w-0 flex-col px-5 py-8 sm:px-10 lg:justify-center lg:py-12">
            <div className="mx-auto flex w-full max-w-sm flex-grow flex-col items-center justify-center space-y-6 text-left">
                <Card className="w-full border-0 bg-transparent shadow-none">
                    <CardHeader className="text-center">
                        <div className="flex w-full flex-col items-center justify-center gap-2">
                            <CardTitle className="text-2xl font-headline tracking-tight">Entrá a tu cuenta</CardTitle>
                            <p className="text-muted-foreground text-center text-sm">
                                Tus partidos y tu grupo, en un solo lugar.
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
                                            <FormLabel>Correo electrónico</FormLabel>
                                            <FormControl>
                                                <Input placeholder="tu@email.com" autoComplete="email" {...field} />
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
                                                <Input type="password" placeholder="********" autoComplete="current-password" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                                    {form.formState.isSubmitting ? 'Ingresando…' : 'Ingresar'}
                                </Button>
                            </form>
                        </Form>

                        <div className="mt-4 text-center text-sm">
                            <Link href="/forgot-password" className="font-medium text-primary hover:underline">
                                ¿Olvidaste tu contraseña?
                            </Link>
                        </div>

                        <p className="mt-6 text-center text-sm text-muted-foreground">
                            ¿Todavía no tenés cuenta?{' '}
                            <Link href="/register" className="font-semibold text-primary hover:underline">
                                Crear cuenta
                            </Link>
                        </p>
                    </CardContent>
                </Card>
            </div>
            <footer className="py-4 text-center text-xs text-muted-foreground">
                <p className="font-semibold">Desarrollado por Santiago López</p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-x-3 gap-y-1 mt-2">
                    <a href="mailto:lopeztoma.santiago@gmail.com" className="flex items-center gap-1 hover:text-primary transition-colors">
                        <Mail className="h-3 w-3" />
                        <span>lopeztoma.santiago@gmail.com</span>
                    </a>
                    <a href="https://wa.me/59892443585" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-primary transition-colors">
                        <WhatsAppIcon className="h-3 w-3" />
                        <span>+598 92 443 585</span>
                    </a>
                </div>
                <p className="mt-3 text-muted-foreground/80">Pateá. Fútbol entre amigos.</p>
            </footer>
            </main>
        </div>
    );
}
