
'use client';

import { useState } from 'react';
import { useAuth } from '@/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { SoccerPlayerIcon } from '@/components/icons/soccer-player-icon';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const forgotPasswordSchema = z.object({
  email: z.string().email('Por favor, introduce un correo electrónico válido.'),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const auth = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (data: ForgotPasswordFormValues) => {
    if (!auth) return;
    setIsSubmitting(true);
    try {
      await sendPasswordResetEmail(auth, data.email);
      setEmailSent(true);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo enviar el correo. Verifica que el email sea correcto.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex w-full flex-col items-center justify-center gap-2">
             <SoccerPlayerIcon className="h-12 w-12 text-primary" />
            <CardTitle className="text-2xl font-bold">¿Olvidaste tu Contraseña?</CardTitle>
            <CardDescription>
              No pasa nada. Ingresá tu email y te mandamos un enlace para que la recuperes.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {emailSent ? (
            <Alert variant="default">
              <CardTitle className="text-lg">Correo Enviado</CardTitle>
              <AlertDescription className="mt-2">
                Revisá tu bandeja de entrada (y la de spam, por las dudas) para encontrar el enlace y restablecer tu contraseña.
              </AlertDescription>
            </Alert>
          ) : (
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
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {isSubmitting ? 'Enviando...' : 'Enviar Correo de Recuperación'}
                </Button>
              </form>
            </Form>
          )}

          <p className="mt-6 text-center text-sm text-muted-foreground">
            ¿Recordaste tu contraseña?{' '}
            <Link href="/login" className="font-semibold text-primary hover:underline">
              Volver a Iniciar Sesión
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
