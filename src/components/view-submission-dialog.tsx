
'use client';

import { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from './ui/button';
import type { EvaluationSubmission, Player } from '@/lib/types';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { Star } from 'lucide-react';
import { Separator } from './ui/separator';

interface ViewSubmissionDialogProps {
  submission: EvaluationSubmission;
  children: React.ReactNode;
}

export function ViewSubmissionDialog({ submission, children, matchPlayers }: ViewSubmissionDialogProps & { matchPlayers?: Player[] }) {
  const { submission: formData } = submission;

  // Resolve MVP name from evaluated list or from extra match players list if provided
  const mvpName = useMemo(() => {
    if (!formData.mvpVote) return null;
    const evaluatedPlayer = formData.evaluations.find(e => e.subjectId === formData.mvpVote);
    if (evaluatedPlayer) return evaluatedPlayer.displayName;
    if (matchPlayers) {
      const matchPlayer = matchPlayers.find(p => p.id === formData.mvpVote);
      if (matchPlayer) return matchPlayer.name;
    }
    return 'Compañero';
  }, [formData.mvpVote, formData.evaluations, matchPlayers]);

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
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 border rounded-md bg-muted/50">
                  <p className="text-xs text-muted-foreground font-semibold uppercase">Goles</p>
                  <p className="text-2xl font-bold">{formData.evaluatorGoals}</p>
                </div>
                <div className="p-3 border rounded-md bg-muted/50">
                  <p className="text-xs text-muted-foreground font-semibold uppercase">Asistencias</p>
                  <p className="text-2xl font-bold">{formData.evaluatorAssists ?? 0}</p>
                </div>
              </div>

              <div className="p-3 border rounded-md bg-yellow-50 border-yellow-200">
                <p className="text-xs text-yellow-700 font-semibold uppercase flex items-center gap-1">
                  <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                  Voto MVP
                </p>
                <p className="font-bold text-yellow-900">
                  {mvpName}
                </p>
              </div>

              {formData.personalChronicle && (
                <div className="p-3 border rounded-md bg-blue-50 border-blue-100">
                  <p className="text-xs text-blue-700 font-semibold uppercase">Mi Crónica</p>
                  <p className="text-sm italic text-blue-900 line-clamp-4">"{formData.personalChronicle}"</p>
                </div>
              )}

              <div>
                <h3 className="font-semibold mb-2">Evaluaciones a compañeros:</h3>
                <div className="space-y-4">
                  {formData.evaluations.map((evaluation) => (
                    <div key={evaluation.assignmentId} className="border p-4 rounded-lg">
                      <p className="font-bold">{evaluation.displayName}</p>
                      <Separator className="my-2" />
                      {evaluation.evaluationType === 'points' && (
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-muted-foreground">Rating:</p>
                          <Badge>
                            <Star className="mr-1 h-3 w-3" /> {evaluation.rating}
                          </Badge>
                        </div>
                      )}

                      {evaluation.evaluationType === 'tags' && (
                        <div>
                          <p className="text-sm text-muted-foreground mb-2">Etiquetas seleccionadas:</p>
                          <div className="flex flex-wrap gap-2">
                            {evaluation.performanceTags?.map((tag) => (
                              <Badge key={tag.id} variant="outline">{tag.name}</Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {evaluation.evaluationType === 'text' && (
                        <div className="space-y-3">
                          <div>
                            <p className="text-sm text-muted-foreground mb-1">Descripción enviada:</p>
                            <p className="text-sm">{evaluation.textDescription || '—'}</p>
                          </div>
                          {evaluation.aiSummary && (
                            <div>
                              <p className="text-sm text-muted-foreground mb-1">Resumen IA:</p>
                              <p className="text-sm">{evaluation.aiSummary}</p>
                            </div>
                          )}
                          {evaluation.performanceTags && evaluation.performanceTags.length > 0 && (
                            <div>
                              <p className="text-sm text-muted-foreground mb-2">Etiquetas aplicadas:</p>
                              <div className="flex flex-wrap gap-2">
                                {evaluation.performanceTags.map((tag) => (
                                  <Badge key={tag.id} variant="outline">{tag.name}</Badge>
                                ))}
                              </div>
                            </div>
                          )}
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
