'use client';

import { motion } from 'framer-motion';
import { SocialFeed } from '@/components/social/social-feed';

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

interface SocialTabProps { }

export function SocialTab({ }: SocialTabProps) {
  return (
    <div className="flex flex-col gap-6">
      <motion.div
        className="w-full space-y-6"
        variants={listVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={cardVariants}>
          <SocialFeed limit={10} showHeader={true} />
        </motion.div>
      </motion.div>
    </div>
  );
}
