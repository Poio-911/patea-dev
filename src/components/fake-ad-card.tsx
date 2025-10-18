
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { generateFakeAd, FakeAdOutput } from '@/ai/flows/generate-fake-ad';
import { Loader2, Clapperboard, RefreshCcw } from 'lucide-react';
import { Button } from './ui/button';
import { useToast } from '@/hooks/use-toast';

export function FakeAdCard() {
  const [ad, setAd] = useState<FakeAdOutput | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchAd = async () => {
    setLoading(true);
    try {
      const result = await generateFakeAd();
      if (result) {
        setAd(result);
      }
    } catch (error) {
      console.error("Failed to fetch fake ad:", error);
      toast({
        variant: 'destructive',
        title: 'Error de la IA',
        description: 'No se pudo generar el anuncio. Usando uno de respaldo.'
      });
      // Fallback ad
      setAd({
          productName: "Repaso-Instant™",
          slogan: "Para que no te duela tanto el baile.",
          description: "Parches de gel frío que se aplican en el alma después de una goleada humillante."
      })
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAd();
  }, []);

  return (
    <Card className="bg-gradient-to-tr from-gray-900 via-gray-800 to-slate-900 text-white border-slate-700">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                <Clapperboard className="h-5 w-5 text-amber-400" />
                <span>Espacio Publicitario</span>
            </div>
            <Button variant="ghost" size="icon" onClick={fetchAd} disabled={loading} className="h-7 w-7 text-muted-foreground hover:bg-white/20 hover:text-white">
                <RefreshCcw className={loading ? "animate-spin" : ""} size={16} />
            </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="text-center">
        {loading ? (
          <div className="flex flex-col items-center justify-center min-h-[120px]">
            <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
            <p className="text-sm text-muted-foreground mt-2">Produciendo comercial...</p>
          </div>
        ) : ad ? (
            <div className="flex flex-col items-center gap-3">
                 <h3 className="text-xl font-bold text-amber-400">{ad.productName}</h3>
                 <p className="text-lg font-semibold italic">&ldquo;{ad.slogan}&rdquo;</p>
                 <p className="text-xs text-muted-foreground max-w-xs">{ad.description}</p>
            </div>
        ) : (
            <p>No se pudo cargar el anuncio.</p>
        )}
      </CardContent>
    </Card>
  );
}
