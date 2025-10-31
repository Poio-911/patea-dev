
'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
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
import { TeamsIcon } from './icons/teams-icon';

interface HelpDialogProps {
  forceOpen?: boolean;
  onExplicitClose?: () => void;
  isPopoverContent?: boolean;
  children?: React.ReactNode;
}

const tutorialContent = [
    {
        icon: Users,
        title: "Paso 1: Armá o unite a un Grupo",
        content: "Todo arranca acá. Un 'grupo' es tu cuadro. Podés crear el tuyo o sumarte a uno existente con un código. Tu 'grupo activo' es donde pasa toda la movida.",
    },
    {
        icon: TeamsIcon,
        title: "Paso 2: Creá Equipos y Planteles",
        content: "En 'Grupos', podés crear equipos persistentes con su propia camiseta y plantel. En 'Jugadores', agregá perfiles para quienes no usan la app. ¡Las cartas de cada integrante evolucionan con el tiempo!",
    },
    {
        icon: MatchIcon,
        title: "Paso 3: Organizá Partidos",
        content: "Hay tres formas: 'Manual' (elegís l@s participantes), 'Colaborativo' (la gente de tu grupo se anota) o 'Por Equipos' (enfrentá a dos de tus equipos creados).",
    },
    {
        icon: EvaluationIcon,
        title: "Paso 4: Evaluá y Subí de Nivel",
        content: "Después de cada partido, en 'Evaluaciones', puntuás a tus compañer@s. En base a eso, el sistema actualiza solo el OVR y los atributos de cada un@. ¡Como en el FIFA!",
    },
    {
        icon: FindMatchIcon,
        title: "Paso 5: Buscá Partidos y Jugador@s",
        content: "En 'Buscar' tenés el mercado. Encontrá partidos públicos cerca o jugador@s libres para completar tu equipo. Hacete visible para que otr@s te encuentren.",
    }
];

const HelpContent = ({ onConfirm }: { onConfirm?: () => void }) => (
    <>
      <DialogHeader>
          <DialogTitle className="text-2xl font-bold font-headline text-center">¡Bienvenid@ a Pateá!</DialogTitle>
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
          <Button onClick={onConfirm} className="w-full">
            ¡Entendido, a jugar!
          </Button>
      </DialogFooter>
    </>
);


export function HelpDialog({ forceOpen = false, onExplicitClose, children, isPopoverContent = false }: HelpDialogProps) {
  const [isOpen, setIsOpen] = useState(forceOpen);
  const router = useRouter();
  const pathname = usePathname();

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      if (onExplicitClose) {
        onExplicitClose();
      }
      // Clean up URL if it contains the new_user param
      if (pathname.includes('new_user')) {
          router.replace(pathname.split('?')[0], {scroll: false});
      }
    }
    setIsOpen(open);
  }
  
  if (isPopoverContent) {
    return <HelpContent />;
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      {!forceOpen && (
        <DialogTrigger asChild>
          {children || (
              <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-full">
                <HelpCircle className="h-5 w-5" />
                <span className="sr-only">Ayuda</span>
              </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <HelpContent onConfirm={() => handleOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
