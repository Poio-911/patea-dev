'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Lightbulb, Loader2, MessageSquareQuote } from 'lucide-react';
import { generateBizarreQuote, BizarreQuoteOutput } from '@/ai/flows/generate-bizarre-quote';

export function BizarreQuoteCard() {
  const [quoteData, setQuoteData] = useState<BizarreQuoteOutput | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getQuote = async () => {
      try {
        const result = await generateBizarreQuote();
        setQuoteData(result);
      } catch (error) {
        console.error("Failed to fetch bizarre quote:", error);
        setQuoteData({ quote: 'No se pudo cargar la frase del día. Inténtalo de nuevo más tarde.', author: 'Error' });
      } finally {
        setLoading(false);
      }
    };
    
    // Only fetch quote once on component mount
    getQuote();
  }, []);

  return (
    <Card className="bg-gradient-to-br from-primary/80 via-primary to-accent/80 text-primary-foreground shadow-lg">
      <CardContent className="p-6">
          {loading ? (
            <div className="flex items-center gap-3 min-h-[80px] justify-center">
              <Loader2 className="h-5 w-5 animate-spin" />
              <p>Buscando una frase memorable...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center gap-4">
                <MessageSquareQuote className="h-8 w-8 opacity-80" />
                <blockquote className="text-xl font-semibold italic text-center">
                &ldquo;{quoteData?.quote}&rdquo;
                </blockquote>
                <p className="font-bold opacity-90">— {quoteData?.author}</p>
            </div>
          )}
      </CardContent>
    </Card>
  );
}
