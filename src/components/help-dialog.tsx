
'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
  ResponsiveDialogFooter as DialogFooter,
  ResponsiveDialogTrigger as DialogTrigger,
} from '@/components/ui/responsive-dialog';
import { Button } from './ui/button';
import { Users, HelpCircle, UsersRound, Shirt, Lock, Trophy } from 'lucide-react';
import { SoccerPlayerIcon } from '@/components/icons/soccer-player-icon';
import { MatchIcon } from '@/components/icons/match-icon';
import { EvaluationIcon } from '@/components/icons/evaluation-icon';
import { FindMatchIcon } from '@/components/icons/find-match-icon';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from './ui/carousel';

interface HelpDialogProps {
  forceOpen?: boolean;
  onExplicitClose?: () => void;
  isPopoverContent?: boolean;
  children?: React.ReactNode;
}

const tutorialContent = [
  {
    icon: Users,
    title: "Paso 1: El Corazón del Club",
    content: "Todo empieza en tu Grupo. Es el punto de encuentro donde podés chatear, ver la actividad reciente y organizar la próxima juntada. Creá tu propio grupo o unite a uno con un código.",
  },
  {
    icon: Shirt,
    title: "Paso 2: Locker Room",
    content: "Diseñá la camiseta de tu equipo y armá planteles fijos. Los equipos tienen memoria: seguí su historial de victorias y la evolución de cada jugador a lo largo del tiempo.",
  },
  {
    icon: MatchIcon,
    title: "Paso 3: Modos de Juego",
    content: "Elegí cómo jugar: Manual (invitación directa), Colaborativo (inscripción abierta para el grupo) o Por Equipos (duelos clásicos con plantillas cerradas).",
  },
  {
    icon: Lock,
    title: "Paso 4: Subí de Nivel",
    content: "Después de jugar, puntuá a tus amigos para que su OVR y atributos evolucionen. ¡Tranquilo! Las evaluaciones son anónimas y seguras hasta que decidas revelar tu identidad.",
  },
  {
    icon: FindMatchIcon,
    title: "Paso 5: Mercado de Fichajes",
    content: "Encontrá jugadores libres para completar tu equipo o anotarte en partidos públicos compatibles con tu nivel. ¡Hacete ver y dejá tu huella en la cancha!",
  },
  {
    icon: Trophy,
    title: "Paso 6: Alcanzá la Cima",
    content: "Desbloqueá logros por tu constancia y talento. Compará tu nivel con la comunidad en los Rankings globales y convertite en una leyenda de Pateá.",
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
                <div className="p-1 px-10 text-center flex flex-col items-center h-[350px] justify-center">
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
  const pathname = usePathname() ?? '';

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      if (onExplicitClose) {
        onExplicitClose();
      }
      // Clean up URL if it contains the new_user param
      if (pathname.includes('new_user')) {
        router.replace(pathname.split('?')[0], { scroll: false });
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
