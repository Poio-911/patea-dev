'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Users2, X, PlusCircle, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CreateGroupDialog, JoinGroupDialog } from './group-dialogs';

export function GroupsFab() {
  const [isOpen, setIsOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  const menuVariants = {
    closed: { opacity: 0, scale: 0.8, y: 20 },
    open: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        type: 'spring',
        stiffness: 300,
        damping: 20,
        staggerChildren: 0.05,
      },
    },
  };

  const itemVariants = {
    closed: { opacity: 0, y: 10 },
    open: { opacity: 1, y: 0 },
  };

  return (
    <>
      <div className="fixed bottom-24 right-4 z-40 md:bottom-6 md:right-6 flex flex-col items-end gap-3">
        <AnimatePresence>
          {isOpen && (
            <motion.div
              variants={menuVariants}
              initial="closed"
              animate="open"
              exit="closed"
              className="flex flex-col items-end gap-3"
            >
              <motion.div variants={itemVariants} className="flex items-center gap-2">
                <span className="text-sm font-semibold bg-background/80 backdrop-blur-sm p-2 rounded-md shadow-lg">
                  Unirse a Grupo
                </span>
                <Button
                  className="rounded-full w-12 h-12 shadow-md"
                  onClick={() => setJoinOpen(true)}
                >
                  <LogIn className="h-5 w-5" />
                </Button>
              </motion.div>
              <motion.div variants={itemVariants} className="flex items-center gap-2">
                <span className="text-sm font-semibold bg-background/80 backdrop-blur-sm p-2 rounded-md shadow-lg">
                  Crear Grupo
                </span>
                <Button
                  className="rounded-full w-12 h-12 shadow-md"
                  onClick={() => setCreateOpen(true)}
                >
                  <PlusCircle className="h-5 w-5" />
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <Button
          className="rounded-full w-14 h-14 bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 hover:scale-105 active:scale-95 transition-all"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Acciones de grupo"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={isOpen ? 'close' : 'add'}
              initial={{ rotate: -45, scale: 0 }}
              animate={{ rotate: 0, scale: 1 }}
              exit={{ rotate: 45, scale: 0 }}
              transition={{ duration: 0.2 }}
            >
              {isOpen ? <X className="h-6 w-6" /> : <Users2 className="h-6 w-6" />}
            </motion.div>
          </AnimatePresence>
        </Button>
      </div>

      <CreateGroupDialog open={createOpen} onOpenChange={setCreateOpen}>
        <></>
      </CreateGroupDialog>
      <JoinGroupDialog open={joinOpen} onOpenChange={setJoinOpen}>
        <></>
      </JoinGroupDialog>
    </>
  );
}
