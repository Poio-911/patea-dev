'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lightbulb, Loader2 } from 'lucide-react';
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
    <Card className="bg-gradient-to-r from-primary/10 via-background to-background">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <Lightbulb className="h-8 w-8 text-primary mt-1" />
          <div className="flex-1">
            {loading ? (
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <p className="text-muted-foreground">Buscando una frase memorable...</p>
              </div>
            ) : (
              <>
                <blockquote className="text-lg font-semibold italic">
                  "{quoteData?.quote}"
                </blockquote>
                <p className="text-right mt-2 font-bold text-primary">— {quoteData?.author}</p>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
