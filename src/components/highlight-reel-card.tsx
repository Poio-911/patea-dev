'use client';

import { Card, CardContent } from '@/components/ui/card';

export function HighlightReelCard() {
  return (
    <Card>
      <CardContent className="p-2">
        <div className="aspect-video">
          <iframe
            width="100%"
            height="100%"
            src="https://www.youtube.com/embed/sRlR-bE7oY8?si=1tKdoXsp1Yd4ZvEB"
            title="YouTube video player"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="rounded-lg"
          ></iframe>
        </div>
      </CardContent>
    </Card>
  );
}
