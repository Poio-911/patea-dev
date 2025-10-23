
'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from './ui/button';

interface FirstTimeInfoDialogProps {
  featureKey: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}

export function FirstTimeInfoDialog({
  featureKey,
  title,
  description,
  children,
}: FirstTimeInfoDialogProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Check if the user has seen this info dialog before
    const hasSeen = localStorage.getItem(featureKey);
    if (!hasSeen) {
      setIsOpen(true);
    }
  }, [featureKey]);

  const handleClose = () => {
    // Mark as seen and close the dialog
    localStorage.setItem(featureKey, 'true');
    setIsOpen(false);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold font-headline">{title}</DialogTitle>
          <DialogDescription className="text-base pt-2">{description}</DialogDescription>
        </DialogHeader>
        {children}
        <DialogFooter>
          <Button onClick={handleClose} className="w-full">¡Entendido!</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
