
'use client';

import { useEffect, useState, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from './ui/button';
import { generateOnboardingMessage, OnboardingMessageOutput } from '@/ai/flows/generate-welcome-message';
import { Loader2, Users, WandSparkles, Trophy, ListChecks, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
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

export function WelcomeDialog() {
  const searchParams = useSearchParams();
  const isNewUser = searchParams.get('new_user') === 'true';
  
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState<OnboardingMessageOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isNewUser) {
      setIsOpen(true);
      setIsLoading(true);
      const fetchMessage = async () => {
        try {
          const result = await generateOnboardingMessage();
          setMessage(result);
        } catch (error) {
          console.error("Failed to generate welcome message", error);
          toast({
            variant: "destructive",
            title: "Error de Bienvenida",
            description: "No se pudo cargar el tutorial de bienvenida. ¡Pero no te preocupes, puedes empezar a explorar!"
          });
          // Fallback message
          setMessage({
              title: "¡Bienvenido a la cancha!",
              introduction: "Tu nueva herramienta para organizar y disfrutar del fútbol amateur como nunca antes.",
              sections: [
                { header: "Grupos", content: "Crea o únete a grupos para conectar con tus amigos y compañeros de equipo.", icon: 'groups' },
                { header: "Jugadores", content: "Añade jugadores a tu grupo, cada uno con sus propias estadísticas y valoración (OVR).", icon: 'players' },
                { header: "Partidos", content: "Organiza partidos manuales (privados) o colaborativos (abiertos a que se apunten).", icon: 'matches' },
                { header: "Evaluaciones", content: "Después de cada partido, evalúa el rendimiento para que los jugadores evolucionen.", icon: 'evaluations' },
                { header: "Buscar", content: "Encuentra partidos públicos cercanos o jugadores libres para completar tu equipo.", icon: 'find' }
              ],
              conclusion: "¡Eso es todo! Estás listo para saltar a la cancha. ¡Empieza creando tu primer grupo o partido!"
          });
        } finally {
          setIsLoading(false);
        }
      };
      fetchMessage();
    }
  }, [isNewUser, toast]);

  if (!isNewUser) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
            {isLoading || !message ? (
                <DialogTitle>Cargando bienvenida...</DialogTitle>
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
                <p className="mt-4 font-semibold">La IA está preparando tu bienvenida personalizada...</p>
                <p className="text-sm text-muted-foreground">¡Gracias por unirte!</p>
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

