'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
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
      <CardContent className="p-2">
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
