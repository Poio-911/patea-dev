import confetti from 'canvas-confetti';

/**
 * Animaciones y utilidades para feedback visual en la aplicación
 */

// ============================================================================
// CONFETTI ANIMATIONS
// ============================================================================

/**
 * Confetti celebration para eventos importantes
 * Usado en: crear partido, crear equipo, shuffle teams
 */
export const celebrationConfetti = () => {
  confetti({
    particleCount: 150,
    spread: 100,
    origin: { y: 0.6 },
    colors: ['#DC2626', '#16A34A', '#2563EB', '#F59E0B', '#8B5CF6']
  });
};

/**
 * Confetti de éxito más moderado
 * Usado en: swap player, acciones secundarias
 */
export const successConfetti = () => {
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 }
  });
};

/**
 * Mini confetti para micro-interacciones
 * Usado en: unirse a partido, acciones pequeñas
 */
export const miniConfetti = () => {
  confetti({
    particleCount: 50,
    spread: 50,
    origin: { y: 0.65 },
    startVelocity: 25
  });
};

/**
 * Confetti explosión lateral (para acciones específicas)
 */
export const sideConfetti = (side: 'left' | 'right' = 'left') => {
  confetti({
    particleCount: 80,
    angle: side === 'left' ? 60 : 120,
    spread: 55,
    origin: { x: side === 'left' ? 0 : 1, y: 0.6 }
  });
};

// ============================================================================
// FRAMER MOTION VARIANTS
// ============================================================================

/**
 * Variantes para slide transitions entre steps/pages
 */
export const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 20 : -20,
    opacity: 0
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: {
      x: { type: 'spring', stiffness: 300, damping: 30 },
      opacity: { duration: 0.2 }
    }
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 20 : -20,
    opacity: 0,
    transition: {
      x: { type: 'spring', stiffness: 300, damping: 30 },
      opacity: { duration: 0.2 }
    }
  })
};

/**
 * Animación de shuffle para cards de equipos
 */
export const shuffleCardVariants = {
  initial: {
    rotateY: 0,
    opacity: 1,
    scale: 1
  },
  shuffle: {
    rotateY: [0, 180, 360],
    scale: [1, 0.95, 1],
    transition: {
      duration: 0.8,
      ease: 'easeInOut'
    }
  },
  exit: {
    opacity: 0,
    scale: 0.8,
    transition: { duration: 0.3 }
  }
};

/**
 * Stagger animation para listas
 */
export const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

export const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 24
    }
  }
};

/**
 * Scale animation para selección de items
 */
export const scaleOnHover = {
  rest: { scale: 1 },
  hover: {
    scale: 1.02,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 10
    }
  },
  tap: { scale: 0.98 }
};

/**
 * Pulse animation para elementos seleccionados
 */
export const pulseAnimation = {
  scale: [1, 1.05, 1],
  transition: {
    duration: 0.6,
    repeat: Infinity,
    repeatType: 'reverse' as const
  }
};

/**
 * Fade in animation
 */
export const fadeInVariants = {
  hidden: { opacity: 0, y: -10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: 'easeOut'
    }
  }
};

/**
 * Bounce in animation
 */
export const bounceInVariants = {
  hidden: { scale: 0, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 260,
      damping: 20
    }
  }
};

// ============================================================================
// ANIMATION CONFIGS
// ============================================================================

/**
 * Spring config suave para transiciones generales
 */
export const smoothSpring = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 30
};

/**
 * Spring config bouncy para efectos más dramáticos
 */
export const bouncySpring = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 10
};

/**
 * Transition config para layout animations
 */
export const layoutTransition = {
  type: 'spring' as const,
  stiffness: 500,
  damping: 30
};
