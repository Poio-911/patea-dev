'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { getFootballHeadlines, FootballHeadline } from '@/ai/flows/get-football-headlines';
import { Loader2, Newspaper } from 'lucide-react';

export function FootballNewsCard() {
  const [headlines, setHeadlines] = useState<FootballHeadline[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHeadlines = async () => {
      try {
        const result = await getFootballHeadlines();
        if (result && result.headlines) {
          setHeadlines(result.headlines);
        }
      } catch (error) {
        console.error("Failed to fetch football headlines:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchHeadlines();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <Newspaper className="h-5 w-5 text-primary" />
            Últimas Noticias
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center min-h-[150px]">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Carousel
            opts={{
              align: "start",
              loop: true,
            }}
            className="w-full"
          >
            <CarouselContent>
              {headlines.map((headline, index) => (
                <CarouselItem key={index} className="md:basis-1/2 lg:basis-1/1">
                  <div className="p-1">
                    <Card className="bg-muted/50">
                      <CardContent className="flex flex-col gap-2 p-4">
                        <p className="text-sm font-bold">{headline.title}</p>
                        <p className="text-xs text-muted-foreground">{headline.summary}</p>
                        <p className="text-xs font-semibold text-primary/80 self-end mt-2">- {headline.source}</p>
                      </CardContent>
                    </Card>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="hidden sm:flex" />
            <CarouselNext className="hidden sm:flex" />
          </Carousel>
        )}
      </CardContent>
    </Card>
  );
}

    