'use client';

import { motion, Variants } from 'framer-motion';
import { ReactNode, useRef } from 'react';
import { useInView } from 'framer-motion';

export type CardAnimationType = 'flip' | 'rotate' | 'zoom' | 'slide' | 'none';

interface AnimatedCardWrapperProps {
  children: ReactNode;
  animation?: CardAnimationType;
  delay?: number;
  className?: string;
}

const animationVariants: Record<CardAnimationType, Variants> = {
  flip: {
    hidden: {
      rotateY: -90,
      opacity: 0,
      scale: 0.8,
    },
    visible: {
      rotateY: 0,
      opacity: 1,
      scale: 1,
      transition: {
        type: 'spring',
        stiffness: 100,
        damping: 15,
        opacity: { duration: 0.3 },
      },
    },
  },
  rotate: {
    hidden: {
      rotate: -180,
      scale: 0.5,
      opacity: 0,
    },
    visible: {
      rotate: 0,
      scale: 1,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 120,
        damping: 20,
        opacity: { duration: 0.4 },
      },
    },
  },
  zoom: {
    hidden: {
      scale: 0,
      opacity: 0,
    },
    visible: {
      scale: 1,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 150,
        damping: 25,
        opacity: { duration: 0.3 },
      },
    },
  },
  slide: {
    hidden: {
      y: 50,
      opacity: 0,
      scale: 0.95,
    },
    visible: {
      y: 0,
      opacity: 1,
      scale: 1,
      transition: {
        type: 'spring',
        stiffness: 100,
        damping: 20,
        opacity: { duration: 0.3 },
      },
    },
  },
  none: {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  },
};

export function AnimatedCardWrapper({
  children,
  animation = 'flip',
  delay = 0,
  className,
}: AnimatedCardWrapperProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const variants = animationVariants[animation];

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={variants}
      className={className}
      style={{
        perspective: '1000px',
        transformStyle: 'preserve-3d',
      }}
      transition={{ delay }}
      whileTap={{ scale: 0.98 }}
    >
      {children}
    </motion.div>
  );
}
