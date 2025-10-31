
'use client';

import { useState, forwardRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Users2, X, PlusCircle, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CreateGroupDialog, JoinGroupDialog } from './group-dialogs';

export function GroupsFab() {
  const [isOpen, setIsOpen] = useState(false);

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

  const FabItem = forwardRef<HTMLDivElement, { icon: React.ElementType, label: string, children: React.ReactNode }>(
    ({ icon: Icon, label, children }, ref) => (
      <motion.div variants={itemVariants} className="flex items-center gap-3 justify-end" ref={ref}>
        <span className="text-sm font-semibold p-2 rounded-md shadow-md bg-background/70 backdrop-blur-lg">{label}</span>
        {children}
      </motion.div>
    )
  );
  FabItem.displayName = 'FabItem';


  return (
    <div className="fixed bottom-20 right-4 z-40 md:bottom-6 md:right-6 flex flex-col items-end gap-4">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            variants={menuVariants}
            initial="closed"
            animate="open"
            exit="closed"
            className="flex flex-col items-end gap-3"
          >
            <JoinGroupDialog>
               <FabItem icon={LogIn} label="Unirse a Grupo">
                   <Button size="icon" className="rounded-full w-12 h-12 bg-background/70 backdrop-blur-lg border-2 border-primary/50 text-primary shadow-lg hover:bg-background/90"><LogIn className="h-5 w-5" /></Button>
               </FabItem>
            </JoinGroupDialog>
            <CreateGroupDialog>
              <FabItem icon={PlusCircle} label="Crear Grupo">
                <Button size="icon" className="rounded-full w-12 h-12 bg-background/70 backdrop-blur-lg border-2 border-primary/50 text-primary shadow-lg hover:bg-background/90"><PlusCircle className="h-5 w-5" /></Button>
              </FabItem>
            </CreateGroupDialog>
          </motion.div>
        )}
      </AnimatePresence>

      <Button
        className="rounded-full w-14 h-14 bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 hover:scale-105 active:scale-95 transition-all"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle groups menu"
      >
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key={isOpen ? 'x' : 'plus'}
            initial={{ rotate: -45, opacity: 0, scale: 0.5 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: 45, opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.2 }}
          >
            {isOpen ? <X className="h-6 w-6" /> : <PlusCircle className="h-6 w-6" />}
          </motion.div>
        </AnimatePresence>
      </Button>
    </div>
  );
}
