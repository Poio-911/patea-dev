'use client';

export function GameModeBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute min-w-full min-h-full w-auto h-auto top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 object-cover opacity-40"
        style={{
          filter: 'brightness(0.8) contrast(1.2) saturate(1.3)',
        }}
      >
        <source src="/videos/20488160-hd_720_1280_30fps.mp4" type="video/mp4" />
      </video>
      {/* Overlay gradient for better contrast */}
      <div className="absolute inset-0 bg-gradient-to-b from-blue-950/50 via-blue-900/30 to-blue-950/50" />
    </div>
  );
}
