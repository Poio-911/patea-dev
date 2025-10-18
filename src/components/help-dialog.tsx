
'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from './ui/button';
import { generateOnboardingMessage, OnboardingMessageOutput } from '@/ai/flows/generate-welcome-message';
import { Loader2, Users, WandSparkles, Trophy, ListChecks, Search, HelpCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SoccerPlayerIcon } from './icons/soccer-player-icon';
import { MatchIcon } from './icons/match-icon';
import { EvaluationIcon } from './icons/evaluation-icon';
import { FindMatchIcon } from './icons/find-match-icon';

const iconMap = {
    groups: Users,
    players: SoccerPlayerIcon,
    matches: MatchIcon,
    evaluations: EvaluationIcon,
    find: FindMatchIcon,
}

interface HelpDialogProps {
  forceOpen?: boolean;
}

export function HelpDialog({ forceOpen = false }: HelpDialogProps) {
  const [isOpen, setIsOpen] = useState(forceOpen);
  const [message, setMessage] = useState<OnboardingMessageOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // If the dialog is opened (either forced or by trigger) and we don't have a message yet, fetch it.
    if (isOpen && !message) {
      setIsLoading(true);
      const fetchMessage = async () => {
        try {
          const result = await generateOnboardingMessage();
          setMessage(result);
        } catch (error) {
          console.error("Failed to generate help message", error);
          toast({
            variant: "destructive",
            title: "Error de Ayuda",
            description: "No se pudo cargar el tutorial."
          });
          // Simple fallback message
          setMessage({
              title: "Guía Rápida",
              introduction: "Aquí tienes un resumen de las funciones principales de la app.",
              sections: [
                { header: "Grupos", content: "Crea o únete a grupos para conectar con tus amigos.", icon: 'groups' },
                { header: "Jugadores", content: "Añade jugadores a tu grupo, cada uno con sus propias estadísticas y valoración (OVR).", icon: 'players' },
                { header: "Partidos", content: "Organiza partidos manuales (privados) o colaborativos (abiertos a que se apunten).", icon: 'matches' },
                { header: "Evaluaciones", content: "Después de cada partido, evalúa el rendimiento para que los jugadores evolucionen.", icon: 'evaluations' },
                { header: "Buscar", content: "Encuentra partidos públicos cercanos o jugadores libres para completar tu equipo.", icon: 'find' }
              ],
              conclusion: "¡Estás listo para saltar a la cancha!"
          });
        } finally {
          setIsLoading(false);
        }
      };
      fetchMessage();
    }
  }, [isOpen, message, toast]);

  // If this instance is being forced open (for new users), it will be controlled externally.
  // Otherwise, it's a simple trigger button.
  const DialogTriggerButton = (
    <DialogTrigger asChild>
      <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-full">
        <HelpCircle className="h-5 w-5" />
        <span className="sr-only">Ayuda</span>
      </Button>
    </DialogTrigger>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {!forceOpen && DialogTriggerButton}
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
            {isLoading || !message ? (
                <DialogTitle>Cargando guía...</DialogTitle>
            ) : (
                <>
                    <DialogTitle className="text-2xl font-bold font-headline text-center">{message.title}</DialogTitle>
                    <DialogDescription className="text-center">{message.introduction}</DialogDescription>
                </>
            )}
        </DialogHeader>

        {isLoading ? (
            <div className="flex flex-col items-center justify-center flex-grow text-center">
                <WandSparkles className="h-12 w-12 text-primary animate-pulse" />
                <p className="mt-4 font-semibold">La IA está preparando tu guía...</p>
            </div>
        ) : message && (
            <div className="flex-grow overflow-y-auto -mx-6 px-6 py-4 border-y space-y-4">
                {message.sections.map((section, index) => {
                    const Icon = iconMap[section.icon] || WandSparkles;
                    return (
                        <div key={index} className="flex items-start gap-4">
                            <div className="p-3 bg-primary/10 rounded-full">
                               <Icon className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-lg">{section.header}</h3>
                                <p className="text-sm text-muted-foreground">{section.content}</p>
                            </div>
                        </div>
                    );
                })}
            </div>
        )}
        
        <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-end gap-2">
            {!isLoading && message && <p className="text-sm text-muted-foreground text-center sm:text-left flex-grow">{message.conclusion}</p>}
            <Button onClick={() => setIsOpen(false)} disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
              {isLoading ? "Cargando..." : "¡Entendido!"}
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
