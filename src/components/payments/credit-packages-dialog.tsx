'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/firebase/index';
import type { CreditPackage } from '@/lib/types';
import { createCreditPurchaseAction } from '@/lib/actions/payment-actions';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, CreditCard, Loader2, Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CreditPackagesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreditPackagesDialog({
  open,
  onOpenChange,
}: CreditPackagesDialogProps) {
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const { toast } = useToast();

  // Cargar paquetes disponibles
  useEffect(() => {
    if (open) {
      loadPackages();
    }
  }, [open]);

  const loadPackages = async () => {
    try {
      setLoading(true);
      const packagesSnapshot = await getDocs(collection(db, 'creditPackages'));
      const packagesData = packagesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as CreditPackage[];

      // Ordenar por precio (menor a mayor)
      packagesData.sort((a, b) => a.price - b.price);

      setPackages(packagesData);
    } catch (error) {
      console.error('Error cargando paquetes:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los paquetes de créditos',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (packageId: string) => {
    try {
      setPurchasing(packageId);

      const result = await createCreditPurchaseAction(packageId);

      if (result.success && result.initPoint) {
        // Redirigir a Mercado Pago
        window.location.href = result.initPoint;
      } else {
        toast({
          title: 'Error',
          description: result.error || 'No se pudo iniciar el pago',
          variant: 'destructive',
        });
        setPurchasing(null);
      }
    } catch (error) {
      console.error('Error al comprar:', error);
      toast({
        title: 'Error',
        description: 'Ocurrió un error al procesar la compra',
        variant: 'destructive',
      });
      setPurchasing(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Sparkles className="w-6 h-6 text-yellow-500" />
            Comprar Créditos de IA
          </DialogTitle>
          <DialogDescription>
            Elige un paquete de créditos para generar fotos profesionales con IA
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {packages.map((pkg) => (
              <div
                key={pkg.id}
                className={`
                  relative p-6 rounded-lg border-2 transition-all hover:shadow-lg
                  ${
                    pkg.popular
                      ? 'border-yellow-500 bg-yellow-50/50 dark:bg-yellow-950/20'
                      : 'border-border hover:border-primary/50'
                  }
                `}
              >
                {/* Badge Popular */}
                {pkg.popular && (
                  <Badge
                    variant="default"
                    className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-500 hover:bg-yellow-600"
                  >
                    <Star className="w-3 h-3 mr-1" />
                    Más Popular
                  </Badge>
                )}

                {/* Header del paquete */}
                <div className="text-center mb-4">
                  <h3 className="text-xl font-bold mb-2">{pkg.title}</h3>
                  {pkg.description && (
                    <p className="text-sm text-muted-foreground mb-3">
                      {pkg.description}
                    </p>
                  )}

                  {/* Precio y descuento */}
                  <div className="flex items-end justify-center gap-2 mb-1">
                    <span className="text-3xl font-bold">${pkg.price}</span>
                    <span className="text-muted-foreground mb-1">ARS</span>
                  </div>

                  {pkg.discountPercentage && pkg.discountPercentage > 0 && (
                    <Badge variant="secondary" className="mb-2">
                      {pkg.discountPercentage}% de descuento
                    </Badge>
                  )}
                </div>

                {/* Características */}
                <div className="space-y-2 mb-6">
                  <div className="flex items-center gap-2 text-sm">
                    <Sparkles className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                    <span>
                      <strong>{pkg.credits}</strong> créditos de IA
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="ml-6">
                      ≈ ${(pkg.price / pkg.credits).toFixed(0)} por crédito
                    </span>
                  </div>
                </div>

                {/* Botón de compra */}
                <Button
                  onClick={() => handlePurchase(pkg.id)}
                  disabled={purchasing !== null}
                  className="w-full"
                  size="lg"
                  variant={pkg.popular ? 'default' : 'outline'}
                >
                  {purchasing === pkg.id ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4 mr-2" />
                      Comprar Ahora
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Footer informativo */}
        <div className="mt-6 p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground">
          <p className="flex items-start gap-2">
            <CreditCard className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>
              Pago seguro procesado por <strong>Mercado Pago</strong>.
              Aceptamos tarjetas de crédito, débito y otros métodos de pago.
            </span>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
