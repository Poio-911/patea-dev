'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RefreshCw, X } from 'lucide-react';

export function UpdateNotification() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    // Check for updates every 60 seconds
    const checkForUpdates = async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          reg.update();
        }
      } catch (error) {
        console.error('Error checking for updates:', error);
      }
    };

    const interval = setInterval(checkForUpdates, 60000);

    // Listen for new service worker waiting
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });

    // Check if there's a waiting service worker
    navigator.serviceWorker.ready.then(reg => {
      setRegistration(reg);

      if (reg.waiting) {
        setShowUpdate(true);
      }

      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setShowUpdate(true);
          }
        });
      });
    });

    return () => {
      clearInterval(interval);
    };
  }, []);

  const handleUpdate = () => {
    if (!registration?.waiting) return;

    // Tell the waiting service worker to skip waiting
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  };

  const handleDismiss = () => {
    setShowUpdate(false);
  };

  if (!showUpdate) {
    return null;
  }

  return (
    <div className="fixed top-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-md">
      <Card className="p-4 shadow-lg border-primary/20 bg-card/95 backdrop-blur-sm">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
            <RefreshCw className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm mb-1">Nueva Versión Disponible</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Hay una actualización de Pateá disponible. Actualizá para obtener las últimas mejoras.
            </p>

            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleUpdate}
                className="flex-1"
              >
                Actualizar Ahora
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDismiss}
              >
                Después
              </Button>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </Card>
    </div>
  );
}
