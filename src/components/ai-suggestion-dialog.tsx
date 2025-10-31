
'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { WandSparkles, Loader2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import type { Player } from '@/lib/types';
import { getPlayerImprovementSuggestionsAction } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useUser } from '@/firebase';

type AISuggestionDialogProps = {
  player: Player;
  children: React.ReactNode;
};

export function AISuggestionDialog({ player, children }: AISuggestionDialogProps) {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const { user } = useUser();

  const handleGenerate = () => {
    startTransition(async () => {
      if (!user?.activeGroupId) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'No hay un grupo activo seleccionado.',
        });
        return;
      }
      setSuggestions([]); // Clear previous suggestions
      const result = await getPlayerImprovementSuggestionsAction(player.id, user.activeGroupId);
      
      if ('error' in result) {
        toast({
          variant: 'destructive',
          title: 'Error del Asistente',
          description: result.error,
        });
        setSuggestions([]);
      } else if ('suggestions' in result) {
        setSuggestions(result.suggestions);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Consejos para {player.name}</DialogTitle>
          <DialogDescription>
            Recibí comentarios personalizados para ayudar a {player.name} a mejorar su juego.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          {!suggestions.length && !isPending && (
             <Alert>
                <WandSparkles className="h-4 w-4" />
                <AlertTitle>¡Listo para el análisis!</AlertTitle>
                <AlertDescription>
                    Hacé clic en el botón para que nuestro asistente analice los datos de rendimiento y te dé un par de piques.
                </AlertDescription>
            </Alert>
          )}

          {isPending && (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-4 text-muted-foreground">Analizando rendimiento...</p>
            </div>
          )}

          {suggestions.length > 0 && (
            <div className="space-y-2">
                <h3 className="font-semibold">Un par de consejos para el crack:</h3>
                <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground bg-secondary/50 p-4 rounded-md">
                    {suggestions.map((suggestion, index) => (
                        <li key={index}>{suggestion}</li>
                    ))}
                </ul>
            </div>
          )}
        </div>

        <Button onClick={handleGenerate} disabled={isPending} className="w-full">
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analizando...
            </>
          ) : (
            <>
              <WandSparkles className="mr-2 h-4 w-4" />
              Pedir Consejo
            </>
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

    
