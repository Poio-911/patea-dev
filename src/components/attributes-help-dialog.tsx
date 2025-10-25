
'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { attributeDescriptions, AttributeKey } from '@/lib/data';
import { Separator } from './ui/separator';
import { Button } from './ui/button';
import { HelpCircle } from 'lucide-react';

export function AttributesHelpDialog({ children }: { children?: React.ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {children ? (
            children
        ) : (
            <Button variant="ghost" size="icon" className="h-5 w-5">
                <HelpCircle className="h-4 w-4" />
            </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>¿Qué significan los atributos?</DialogTitle>
          <DialogDescription>
            Cada atributo mide una habilidad clave del jugador, al estilo de los videojuegos de fútbol.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          {Object.keys(attributeDescriptions).map(key => {
            const attrKey = key as AttributeKey;
            const { name, description } = attributeDescriptions[attrKey];
            return (
              <div key={key}>
                <h3 className="font-bold">{name}</h3>
                <p className="text-sm text-muted-foreground">{description}</p>
                <Separator className="mt-3" />
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
