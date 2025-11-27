'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { checkPaymentStatusAction } from '@/lib/actions/payment-actions';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, Clock, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const transactionId = searchParams.get('transaction_id');

  const [status, setStatus] = useState<'checking' | 'approved' | 'rejected' | 'pending' | 'error'>('checking');
  const [credits, setCredits] = useState<number>(0);
  const [amount, setAmount] = useState<number>(0);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!transactionId) {
      setStatus('error');
      return;
    }

    // Función de polling
    const checkStatus = async () => {
      try {
        const result = await checkPaymentStatusAction(transactionId);

        if (result.success && result.status) {
          if (result.status === 'approved') {
            setStatus('approved');
            setCredits(result.credits || 0);
            setAmount(result.amount || 0);

            // Lanzar confetti! 🎉
            confetti({
              particleCount: 100,
              spread: 70,
              origin: { y: 0.6 },
            });

            // Parar polling
            return true;
          } else if (result.status === 'rejected' || result.status === 'cancelled') {
            setStatus('rejected');
            return true;
          } else if (result.status === 'pending') {
            setStatus('pending');
            // Continuar polling
            return false;
          }
        } else {
          setStatus('error');
          return true;
        }
      } catch (error) {
        console.error('Error checking payment status:', error);
        setRetryCount((prev) => prev + 1);

        // Después de 10 intentos fallidos, mostrar error
        if (retryCount >= 10) {
          setStatus('error');
          return true;
        }

        return false;
      }

      return false;
    };

    // Verificar inmediatamente
    checkStatus();

    // Polling cada 2 segundos hasta que el pago se confirme
    const interval = setInterval(async () => {
      const shouldStop = await checkStatus();
      if (shouldStop) {
        clearInterval(interval);
      }
    }, 2000);

    // Cleanup
    return () => clearInterval(interval);
  }, [transactionId, retryCount]);

  // Estado de carga
  if (status === 'checking' || status === 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="mb-6">
            <Loader2 className="w-16 h-16 animate-spin text-primary mx-auto" />
          </div>
          <h1 className="text-2xl font-bold mb-2">
            {status === 'checking' ? 'Verificando pago...' : 'Procesando pago...'}
          </h1>
          <p className="text-muted-foreground mb-4">
            {status === 'checking'
              ? 'Estamos verificando el estado de tu pago con Mercado Pago.'
              : 'Tu pago está siendo procesado. Esto puede tomar unos segundos.'}
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>Espera un momento...</span>
          </div>
        </div>
      </div>
    );
  }

  // Pago aprobado
  if (status === 'approved') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="mb-6">
            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-12 h-12 text-green-600 dark:text-green-400" />
            </div>
          </div>

          <h1 className="text-3xl font-bold mb-2">¡Pago Exitoso!</h1>
          <p className="text-lg text-muted-foreground mb-6">
            Tu compra se ha procesado correctamente
          </p>

          {/* Detalles de la compra */}
          <div className="bg-muted/50 rounded-lg p-6 mb-6 text-left">
            <div className="flex items-center justify-between mb-3">
              <span className="text-muted-foreground">Créditos comprados:</span>
              <span className="flex items-center gap-2 font-bold text-lg">
                <Sparkles className="w-5 h-5 text-yellow-500" />
                {credits}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Monto pagado:</span>
              <span className="font-bold">${amount} ARS</span>
            </div>
          </div>

          <div className="space-y-3">
            <Button
              onClick={() => router.push('/dashboard')}
              className="w-full"
              size="lg"
            >
              Ir al Dashboard
            </Button>
            <Button
              onClick={() => router.push('/players')}
              variant="outline"
              className="w-full"
            >
              Generar Fotos con IA
            </Button>
          </div>

          <p className="text-xs text-muted-foreground mt-6">
            Los créditos ya están disponibles en tu cuenta
          </p>
        </div>
      </div>
    );
  }

  // Pago rechazado
  if (status === 'rejected') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="mb-6">
            <div className="w-20 h-20 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto">
              <XCircle className="w-12 h-12 text-red-600 dark:text-red-400" />
            </div>
          </div>

          <h1 className="text-3xl font-bold mb-2">Pago Rechazado</h1>
          <p className="text-lg text-muted-foreground mb-6">
            No se pudo procesar el pago
          </p>

          <div className="bg-muted/50 rounded-lg p-4 mb-6">
            <p className="text-sm text-muted-foreground">
              El pago fue rechazado por Mercado Pago. Esto puede deberse a fondos
              insuficientes, límites de tarjeta o problemas de validación.
            </p>
          </div>

          <div className="space-y-3">
            <Button
              onClick={() => router.push('/dashboard')}
              className="w-full"
              size="lg"
            >
              Volver al Dashboard
            </Button>
            <Button
              onClick={() => router.back()}
              variant="outline"
              className="w-full"
            >
              Intentar Nuevamente
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Error
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="mb-6">
          <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/20 rounded-full flex items-center justify-center mx-auto">
            <XCircle className="w-12 h-12 text-amber-600 dark:text-amber-400" />
          </div>
        </div>

        <h1 className="text-3xl font-bold mb-2">Error al Verificar</h1>
        <p className="text-lg text-muted-foreground mb-6">
          No pudimos verificar el estado del pago
        </p>

        <div className="bg-muted/50 rounded-lg p-4 mb-6">
          <p className="text-sm text-muted-foreground">
            {!transactionId
              ? 'No se encontró el ID de transacción.'
              : 'Ocurrió un error al verificar el estado. Si realizaste el pago, los créditos se acreditarán automáticamente en unos minutos.'}
          </p>
        </div>

        <Button
          onClick={() => router.push('/dashboard')}
          className="w-full"
          size="lg"
        >
          Volver al Dashboard
        </Button>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    }>
      <PaymentSuccessContent />
    </Suspense>
  );
}
