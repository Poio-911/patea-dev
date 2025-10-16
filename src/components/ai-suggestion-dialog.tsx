'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { WandSparkles, Loader2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import type { Player } from '@/lib/types';
import { getPlayerImprovementSuggestionsAction } from '@/lib/actions';
import { mockEvaluations } from '@/lib/data';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type AISuggestionDialogProps = {
  player: Player;
  children: React.ReactNode;
};

export function AISuggestionDialog({ player, children }: AISuggestionDialogProps) {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleGenerate = () => {
    startTransition(async () => {
      const result = await getPlayerImprovementSuggestionsAction(player, mockEvaluations);
      if (result.error) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.error,
        });
        setSuggestions([]);
      } else {
        setSuggestions(result.suggestions);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>AI Performance Suggestions for {player.name}</DialogTitle>
          <DialogDescription>
            Get personalized feedback to help {player.name} improve their game.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          {!suggestions.length && !isPending && (
             <Alert>
                <WandSparkles className="h-4 w-4" />
                <AlertTitle>Ready to Analyze!</AlertTitle>
                <AlertDescription>
                    Click the button below to generate AI-powered suggestions based on {player.name}'s recent performance data.
                </AlertDescription>
            </Alert>
          )}

          {isPending && (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-4 text-muted-foreground">AI is analyzing performance...</p>
            </div>
          )}

          {suggestions.length > 0 && (
            <div className="space-y-2">
                <h3 className="font-semibold">Here are some suggestions:</h3>
                <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground bg-secondary/50 p-4 rounded-md">
                    {suggestions.map((suggestion, index) => (
                        <li key={index}>{suggestion}</li>
                    ))}
                </ul>
            </div>
          )}
        </div>

        <Button onClick={handleGenerate} disabled={isPending} className="w-full">
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <WandSparkles className="mr-2 h-4 w-4" />
              Generate Suggestions
            </>
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
