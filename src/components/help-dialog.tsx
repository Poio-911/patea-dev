
'use client';

import { useState } from 'react';
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { SoccerPlayerIcon } from './icons/soccer-player-icon';
import { MatchIcon } from './icons/match-icon';
import { EvaluationIcon } from './icons/evaluation-icon';
import { FindMatchIcon } from './icons/find-match-icon';

interface HelpDialogProps {
  forceOpen?: boolean;
}

const tutorialContent = [
    {
        icon: Users,
        title: "Paso 1: Armá o unite a un Grupo",
        content: "Todo arranca acá. Un 'grupo' es tu cuadro de amigos o tu comunidad de fútbol. Podés crear tu propio grupo (y te damos un código para invitar gente) o sumarte a uno que ya exista con su código. Toda tu movida (jugadores, partidos) pasa adentro de tu 'grupo activo'."
    },
    {
        icon: SoccerPlayerIcon,
        title: "Paso 2: Manejá tu Plantel",
        content: "En la sección 'Jugadores', podés agregar jugadores 'manuales' a tu grupo. Son perfiles que manejás vos, definiendo su puesto y habilidades (OVR, RIT, TIR, etc.). Los que se registran en la app también aparecen acá, pero su carta solo la pueden editar ellos mismos."
    },
    {
        icon: MatchIcon,
        title: "Paso 3: Organizá Partidos",
        content: "Hay dos formas. 'Manual': elegís a todos los jugadores y, al confirmar, los equipos se arman solos buscando el mayor equilibrio. 'Colaborativo': creás el evento y la gente de tu grupo se anota. También podés hacer un partido colaborativo 'Público' para que cualquiera en la app pueda encontrarlo y sumarse."
    },
    {
        icon: EvaluationIcon,
        title: "Paso 4: Evaluá y Subí de Nivel",
        content: "Después de cada partido, en 'Evaluaciones', podés puntuar a tus compañeros. Esto es clave: en base a esos puntajes, el sistema actualiza solo el OVR y los atributos de cada uno. ¡Así evolucionan con el tiempo, como en el FIFA!"
    },
    {
        icon: FindMatchIcon,
        title: "Paso 5: Buscá Partidos y Jugadores",
        content: "En la sección 'Buscar' tenés el mercado de pases. En 'Buscar Partidos', podés encontrar partidos públicos cerca tuyo. En 'Buscar Jugadores', ves a otros que se marcaron como 'disponibles' para jugar. Ideal para cuando te falta uno para completar."
    }
];

export function HelpDialog({ forceOpen = false }: HelpDialogProps) {
  const [isOpen, setIsOpen] = useState(forceOpen);

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
            <DialogTitle className="text-2xl font-bold font-headline text-center">¡Bienvenido a tu Manager de Fútbol!</DialogTitle>
            <DialogDescription className="text-center">Acá tenés una guía rápida para que le saques todo el jugo a la app.</DialogDescription>
        </DialogHeader>

        <div className="flex-grow overflow-y-auto -mx-6 px-6 py-2 border-y">
            <Accordion type="single" collapsible defaultValue="item-0">
                {tutorialContent.map((section, index) => {
                    const Icon = section.icon;
                    return (
                        <AccordionItem key={index} value={`item-${index}`}>
                            <AccordionTrigger>
                                <div className="flex items-center gap-4 text-left">
                                    <div className="p-3 bg-primary/10 rounded-full">
                                       <Icon className="h-5 w-5 text-primary" />
                                    </div>
                                    <span className="font-semibold text-base">{section.title}</span>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="pl-16 text-muted-foreground">
                                {section.content}
                            </AccordionContent>
                        </AccordionItem>
                    );
                })}
            </Accordion>
        </div>
        
        <DialogFooter>
            <Button onClick={() => setIsOpen(false)}>
              ¡Entendido!
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

    