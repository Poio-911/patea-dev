
'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from './ui/button';
import type { EvaluationSubmission } from '@/lib/types';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { Star } from 'lucide-react';
import { Separator } from './ui/separator';

interface ViewSubmissionDialogProps {
  submission: EvaluationSubmission;
  children: React.ReactNode;
}

export function ViewSubmissionDialog({ submission, children }: ViewSubmissionDialogProps) {
  const { submission: formData } = submission;

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Resumen de tu Evaluación</DialogTitle>
          <DialogDescription>
            Esto fue lo que enviaste. El organizador procesará los datos pronto.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-grow py-4 space-y-4 overflow-y-hidden">
          <ScrollArea className="h-full pr-4">
            <div className="space-y-6">
              <div className="p-3 border rounded-md bg-muted/50">
                  <p className="text-sm font-semibold">Tus Goles Reportados</p>
                  <p className="text-2xl font-bold">{formData.evaluatorGoals}</p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Evaluaciones a compañeros:</h3>
                <div className="space-y-4">
                  {formData.evaluations.map((evaluation) => (
                    <div key={evaluation.assignmentId} className="border p-4 rounded-lg">
                      <p className="font-bold">{evaluation.displayName}</p>
                      <Separator className="my-2" />
                      {evaluation.evaluationType === 'points' ? (
                        <div className="flex items-center gap-2">
                           <p className="text-sm text-muted-foreground">Rating:</p>
                           <Badge>
                               <Star className="mr-1 h-3 w-3"/> {evaluation.rating}
                           </Badge>
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm text-muted-foreground mb-2">Etiquetas seleccionadas:</p>
                          <div className="flex flex-wrap gap-2">
                            {evaluation.performanceTags?.map((tag) => (
                              <Badge key={tag.id} variant="outline">{tag.name}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
