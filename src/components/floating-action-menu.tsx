
'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, X, Users2, LogIn, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUser } from '@/firebase';
import { HelpChatDialog } from './help-chat-dialog';
import { CreateGroupDialog, JoinGroupDialog } from './groups/group-dialogs';

export function FloatingActionMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useUser();

  if (!user) {
    return null;
  }

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

  const FabItem = ({ icon: Icon, label, onClick }: { icon: React.ElementType, label: string, onClick: () => void }) => (
     <motion.div variants={itemVariants} className="flex items-center gap-3 justify-end">
        <span className="text-sm font-semibold p-2 rounded-md shadow-md bg-background/70 backdrop-blur-lg">{label}</span>
        <Button
            size="icon"
            className="rounded-full w-12 h-12 bg-background/70 backdrop-blur-lg border-2 border-primary/50 text-primary shadow-lg hover:bg-background/90"
            onClick={onClick}
        >
            <Icon className="h-5 w-5" />
        </Button>
    </motion.div>
  );

  return (
    <>
      <div className="fixed bottom-20 right-6 z-40 md:bottom-6">
        <AnimatePresence>
          {isOpen && (
            <motion.div
              variants={menuVariants}
              initial="closed"
              animate="open"
              exit="closed"
              className="flex flex-col items-end gap-3"
            >
              <HelpChatDialog>
                 <FabItem icon={HelpCircle} label="Ayuda IA" onClick={() => {}} />
              </HelpChatDialog>
              <JoinGroupDialog>
                 <FabItem icon={LogIn} label="Unirse a Grupo" onClick={() => {}} />
              </JoinGroupDialog>
              <CreateGroupDialog>
                <FabItem icon={Users2} label="Crear Grupo" onClick={() => {}} />
              </CreateGroupDialog>
            </motion.div>
          )}
        </AnimatePresence>

        <Button
          size="icon"
          className="rounded-full w-14 h-14 bg-background/70 backdrop-blur-lg border-2 border-primary/50 text-primary shadow-lg hover:bg-background/90 hover:scale-105 active:scale-95 transition-all mt-4"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle action menu"
        >
          <AnimatePresence initial={false} mode="wait">
            <motion.div
              key={isOpen ? 'x' : 'plus'}
              initial={{ rotate: -45, opacity: 0, scale: 0.5 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={{ rotate: 45, opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.2 }}
            >
              {isOpen ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
            </motion.div>
          </AnimatePresence>
        </Button>
      </div>
    </>
  );
}
