
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { HelpDialog } from './help-dialog';

export function WelcomeDialog() {
  const searchParams = useSearchParams();
  const isNewUser = searchParams.get('new_user') === 'true';
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    // Only trigger on initial load for a new user
    if (isNewUser) {
      // A small delay to ensure the UI is ready
      const timer = setTimeout(() => {
        setShowWelcome(true);
      }, 500); 
      return () => clearTimeout(timer);
    }
  }, [isNewUser]);

  if (!showWelcome) {
    return null;
  }

  // We reuse the HelpDialog component and trigger it programmatically
  return <HelpDialog forceOpen={true} />;
}
