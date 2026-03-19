'use client';

import * as React from 'react';
import { QrCode, ExternalLink, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ShareQrCardProps {
  url: string;
  title?: string;
}

export function ShareQrCard({ url, title = 'Escaneá para ver la liga' }: ShareQrCardProps) {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(url)}&bgcolor=ffffff&color=000000&margin=8`;

  const handleDownload = () => {
    const downloadUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(url)}&bgcolor=ffffff&color=000000&margin=20`;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = 'qr-liga.png';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
  };

  return (
    <div className="flex flex-col items-center gap-3 p-4 rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm">
      <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-widest">
        <QrCode className="h-3.5 w-3.5 text-primary" />
        {title}
      </div>
      <div className="rounded-xl overflow-hidden border border-border/30 shadow-sm bg-white p-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrUrl}
          alt="QR code"
          width={140}
          height={140}
          className="block"
        />
      </div>
      <Button variant="ghost" size="sm" className="text-xs h-7 gap-1.5 text-muted-foreground" onClick={handleDownload}>
        <Download className="h-3 w-3" /> Descargar
      </Button>
    </div>
  );
}
