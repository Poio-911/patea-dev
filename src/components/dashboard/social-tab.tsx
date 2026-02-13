'use client';

import { motion } from 'framer-motion';
import type { Player, AvailablePlayer, SavedLocation } from '@/lib/types';
import { SocialFeed } from '@/components/social/social-feed';
import { AvailabilityCard } from '@/components/availability/availability-card';

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: 'easeOut',
    },
  },
};

const listVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

interface SocialTabProps {
  player: Player | null;
  availablePlayerData: AvailablePlayer | null;
  savedLocation?: SavedLocation;
}

export function SocialTab({
  player,
  availablePlayerData,
  savedLocation,
}: SocialTabProps) {
  return (
    <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
      <motion.div
        className="lg:col-span-2 space-y-6"
        variants={listVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={cardVariants}>
          <SocialFeed limit={10} showHeader={true} />
        </motion.div>
      </motion.div>

      <motion.div
        className="lg:col-span-1 space-y-6"
        variants={listVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={cardVariants}>
          <AvailabilityCard
            player={player}
            availablePlayerData={availablePlayerData}
            savedLocation={savedLocation}
          />
        </motion.div>
      </motion.div>
    </div>
  );
}
