'use client';

import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { SoccerPlayerIcon } from '@/components/icons/soccer-player-icon';
import { Trophy } from 'lucide-react';
import { motion } from 'framer-motion';

export default function HomePage() {
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      if (user.role === 'organizer') {
        router.push('/organizer');
      } else {
        router.push('/dashboard');
      }
    }
  }, [user, loading, router]);


  if (loading || user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-black">
        <SoccerPlayerIcon className="h-16 w-16 text-primary animate-pulse" />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden font-sans bg-black">
      {/* Background Video */}
      <video
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 h-full w-full object-cover z-0 opacity-30 sm:opacity-50"
      >
        <source src="/videos/bienvenida-cancha.mp4" type="video/mp4" />
      </video>

      {/* Dark Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/40 to-black/80 backdrop-blur-[0.5px] z-10" />

      {/* Content Container */}
      <div className="relative z-20 mx-auto flex w-full max-w-4xl flex-grow flex-col items-center justify-center p-4 sm:p-6 text-center">
        {/* Branding Section */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          className="mb-10 sm:mb-16 flex flex-col items-center gap-3 sm:gap-6"
        >
          <motion.div 
            animate={{ 
              y: [0, -12, 0],
              scale: [1, 1.05, 1],
              filter: ["drop-shadow(0 0 15px rgba(var(--primary), 0.2))", "drop-shadow(0 0 30px rgba(var(--primary), 0.5))", "drop-shadow(0 0 15px rgba(var(--primary), 0.2))"]
            }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          >
            <SoccerPlayerIcon className="h-14 w-14 sm:h-24 sm:w-24 text-primary" />
          </motion.div>
          <div className="space-y-0.5 sm:space-y-2">
            <h1 className="text-6xl font-black tracking-tighter text-white sm:text-9xl italic leading-[0.8] mb-1">
              PATEÁ
            </h1>
            <p className="text-[10px] sm:text-base font-bold uppercase tracking-[0.5em] text-primary/80">
              Tu fútbol, unificado.
            </p>
          </div>
        </motion.div>

        {/* Action Options (No Containers) */}
        <div className="flex flex-col gap-10 sm:gap-16 w-full max-w-lg">
          {/* Jugador Option */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="group flex flex-col items-center gap-4 sm:gap-6"
          >
            <Link href="/login" className="flex items-center gap-4 sm:gap-8 group/link">
              <span className="text-4xl sm:text-6xl font-black italic tracking-tighter text-white font-headline uppercase transition-all duration-300 group-hover/link:text-primary group-hover/link:-translate-x-2">
                JUGADOR
              </span>
              <div className="flex h-12 w-12 sm:h-20 sm:w-20 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 transition-all duration-500 group-hover/link:bg-primary group-hover/link:text-black group-hover/link:rotate-12 group-hover/link:scale-110">
                <SoccerPlayerIcon className="h-6 w-6 sm:h-10 sm:w-10" />
              </div>
            </Link>
            
            <div className="flex gap-4 animate-in fade-in slide-in-from-bottom-2 duration-700 delay-500">
              <Button asChild className="h-10 px-6 text-sm font-bold bg-primary text-black hover:bg-white rounded-full transition-all shadow-lg shadow-primary/20">
                <Link href="/login">Entrar</Link>
              </Button>
              <Button asChild variant="ghost" className="h-10 px-6 text-sm font-bold text-white bg-white/10 hover:bg-white/20 rounded-full border border-white/10 transition-all">
                <Link href="/register">Soy nuevo</Link>
              </Button>
            </div>
          </motion.div>

          {/* Organizador Option */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="group flex flex-col items-center gap-4 sm:gap-6"
          >
            <Link href="/organizer/login" className="flex items-center gap-4 sm:gap-8 group/link">
              <span className="text-4xl sm:text-6xl font-black italic tracking-tighter text-white font-headline uppercase transition-all duration-300 group-hover/link:text-primary group-hover/link:-translate-x-2">
                ORGANIZADOR
              </span>
              <div className="flex h-12 w-12 sm:h-20 sm:w-20 items-center justify-center rounded-2xl bg-white/5 text-zinc-400 border border-white/10 transition-all duration-500 group-hover/link:bg-white group-hover/link:text-black group-hover/link:-rotate-12 group-hover/link:scale-110">
                <Trophy className="h-6 w-6 sm:h-10 sm:w-10" />
              </div>
            </Link>

            <div className="flex gap-4 animate-in fade-in slide-in-from-bottom-2 duration-700 delay-700">
              <Button asChild className="h-10 px-6 text-sm font-bold bg-white text-black hover:bg-primary rounded-full transition-all shadow-lg shadow-white/10">
                <Link href="/organizer/login">Acceder</Link>
              </Button>
              <Button asChild variant="ghost" className="h-10 px-6 text-sm font-bold text-white bg-white/10 hover:bg-white/20 rounded-full border border-white/10 transition-all">
                <Link href="/organizer/login">Crear cuenta</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
