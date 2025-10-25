
'use client';

import { useState } from 'react';
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

  const FabItem = ({ icon: Icon, label, children }: { icon: React.ElementType, label: string, children: React.ReactNode }) => (
     <motion.div variants={itemVariants} className="flex items-center gap-3 justify-end">
        <span className="text-sm font-semibold p-2 rounded-md shadow-md bg-background/70 backdrop-blur-lg">{label}</span>
        {children}
    </motion.div>
  );

  return (
    <>
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
        className="rounded-full w-auto h-14 bg-background/70 backdrop-blur-lg border-2 border-primary/50 text-primary shadow-lg hover:bg-background/90 hover:scale-105 active:scale-95 transition-all px-4"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle groups menu"
      >
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key={isOpen ? 'x' : 'groups'}
            initial={{ rotate: -45, opacity: 0, scale: 0.5 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: 45, opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-2"
          >
            {isOpen ? <X className="h-6 w-6" /> : <><Users2 className="h-5 w-5" /> <span className="font-semibold">Grupos</span></>}
          </motion.div>
        </AnimatePresence>
      </Button>
    </>
  );
}
