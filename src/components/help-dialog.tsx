
'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
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
import { Users, HelpCircle } from 'lucide-react';
import { SoccerPlayerIcon } from './icons/soccer-player-icon';
import { MatchIcon } from './icons/match-icon';
import { EvaluationIcon } from './icons/evaluation-icon';
import { FindMatchIcon } from './icons/find-match-icon';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from './ui/carousel';

interface HelpDialogProps {
  forceOpen?: boolean;
  onExplicitClose?: () => void;
}

const tutorialContent = [
    {
        icon: Users,
        title: "Paso 1: Armá o unite a un Grupo",
        content: "Todo arranca acá. Un 'grupo' es tu cuadro de amigos. Podés crear el tuyo o sumarte a uno existente con un código. Tu 'grupo activo' es donde pasa toda la movida.",
    },
    {
        icon: SoccerPlayerIcon,
        title: "Paso 2: Manejá tu Plantel",
        content: "En 'Jugadores', agregá perfiles 'manuales' para los que no usan la app. Los que se registran aparecen acá automáticamente, y su carta de jugador evoluciona con el tiempo.",
    },
    {
        icon: MatchIcon,
        title: "Paso 3: Organizá Partidos",
        content: "Hay dos formas: 'Manual' (elegís los jugadores y la IA arma los equipos) o 'Colaborativo' (la gente de tu grupo se anota). ¡Incluso podés hacerlos públicos!",
    },
    {
        icon: EvaluationIcon,
        title: "Paso 4: Evaluá y Subí de Nivel",
        content: "Después de cada partido, en 'Evaluaciones', puntuás a tus compañeros. En base a eso, el sistema actualiza solo el OVR y los atributos de cada uno. ¡Como en el FIFA!",
    },
    {
        icon: FindMatchIcon,
        title: "Paso 5: Buscá Partidos y Jugadores",
        content: "En 'Buscar' tenés el mercado. Encontrá partidos públicos cerca o jugadores libres para completar tu equipo cuando te falte uno. Hacete visible para que otros te encuentren.",
    }
];

export function HelpDialog({ forceOpen = false, onExplicitClose }: HelpDialogProps) {
  const [isOpen, setIsOpen] = useState(forceOpen);
  const router = useRouter();
  const pathname = usePathname();

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      if (onExplicitClose) {
        onExplicitClose();
      }
      // Clean up URL
      if (pathname.includes('new_user')) {
          router.replace(pathname.split('?')[0], {scroll: false});
      }
    }
    setIsOpen(open);
  }

  const handleGotItClick = () => {
    handleOpenChange(false);
  }

  const DialogTriggerButton = (
    <DialogTrigger asChild>
      <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-full">
        <HelpCircle className="h-5 w-5" />
        <span className="sr-only">Ayuda</span>
      </Button>
    </DialogTrigger>
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      {!forceOpen && DialogTriggerButton}
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
            <DialogTitle className="text-2xl font-bold font-headline text-center">¡Bienvenido a tu Manager de Fútbol!</DialogTitle>
            <DialogDescription className="text-center">Acá tenés una guía rápida para que le saques todo el jugo a la app.</DialogDescription>
        </DialogHeader>

        <div className="flex-grow overflow-y-auto -mx-6 px-6 py-2">
           <Carousel className="w-full max-w-lg mx-auto">
                <CarouselContent>
                    {tutorialContent.map((section, index) => {
                        const Icon = section.icon;
                        return (
                            <CarouselItem key={index}>
                                <div className="p-1 text-center flex flex-col items-center h-[350px] justify-center">
                                    <div className="p-4 bg-primary/10 rounded-full mb-4">
                                       <Icon className="h-8 w-8 text-primary" />
                                    </div>
                                    <h3 className="text-xl font-semibold mb-2">{section.title}</h3>
                                    <p className="text-muted-foreground mb-4 px-4">{section.content}</p>
                                </div>
                            </CarouselItem>
                        )
                    })}
                </CarouselContent>
                <CarouselPrevious className="left-0" />
                <CarouselNext className="right-0" />
            </Carousel>
        </div>
        
        <DialogFooter>
            <Button onClick={handleGotItClick} className="w-full">
              ¡Entendido, a jugar!
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
