'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clapperboard, Loader2 } from 'lucide-react';
import { youtubeGoalHighlights } from '@/lib/data';

export function HighlightReelCard() {
  const [selectedVideo, setSelectedVideo] = useState<{ videoId: string; title: string } | null>(null);
  
  useEffect(() => {
    // Select a random video on client-side mount to avoid hydration mismatch
    const randomIndex = Math.floor(Math.random() * youtubeGoalHighlights.length);
    setSelectedVideo(youtubeGoalHighlights[randomIndex]);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clapperboard className="h-5 w-5" />
          Jugada Destacada
        </CardTitle>
      </CardHeader>
      <CardContent>
        {selectedVideo ? (
          <div className="aspect-video">
            <iframe
              width="100%"
              height="100%"
              src={`https://www.youtube.com/embed/${selectedVideo.videoId}`}
              title={selectedVideo.title}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="rounded-lg"
            ></iframe>
          </div>
        ) : (
          <div className="flex items-center justify-center aspect-video bg-muted rounded-lg">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}