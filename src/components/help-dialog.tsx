
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
        title: "Crea o Únete a un Grupo",
        content: "Todo comienza aquí. Un 'grupo' es tu equipo de amigos o tu comunidad de fútbol. Puedes crear tu propio grupo (se generará un código de invitación) o unirte a uno existente con su código. Toda tu actividad (jugadores, partidos) ocurrirá dentro de tu 'grupo activo'."
    },
    {
        icon: SoccerPlayerIcon,
        title: "Gestiona tu Plantilla",
        content: "En la sección 'Jugadores', puedes añadir jugadores 'manuales' a tu grupo. Estos son perfiles que tú controlas, definiendo su posición y habilidades (OVR, PAC, SHO, etc.). Los jugadores que se registran en la app con su cuenta también aparecen aquí, pero sus perfiles solo los pueden editar ellos mismos."
    },
    {
        icon: MatchIcon,
        title: "Organiza Partidos",
        content: "Hay dos tipos de partidos. 'Manual': eliges a todos los jugadores y la IA arma los equipos al instante. 'Colaborativo': creas el evento y los jugadores de tu grupo se apuntan. También puedes hacer un partido colaborativo 'Público' para que cualquiera en la app pueda encontrarlo y unirse."
    },
    {
        icon: EvaluationIcon,
        title: "Evalúa y Progresa",
        content: "Después de un partido, en la sección 'Evaluaciones', puedes calificar el rendimiento de tus compañeros. Esto es clave: basándose en estas evaluaciones, el sistema actualiza automáticamente el OVR y los atributos de cada jugador, ¡haciéndolos evolucionar con el tiempo!"
    },
    {
        icon: FindMatchIcon,
        title: "Busca Oportunidades",
        content: "En la sección 'Buscar', tienes un mercado. En la pestaña 'Buscar Partidos', puedes encontrar partidos públicos cerca de tu ubicación. En 'Buscar Jugadores', puedes ver a otros usuarios que se han marcado como 'disponibles' para jugar, ideal para completar tu equipo a último momento."
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
            <DialogDescription className="text-center">Aquí tienes una guía rápida de las funciones principales para que saques el máximo provecho.</DialogDescription>
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
