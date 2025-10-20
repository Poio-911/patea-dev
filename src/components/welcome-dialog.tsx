
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { HelpDialog } from './help-dialog';

export function WelcomeDialog() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isNewUser = searchParams.get('new_user') === 'true';
  const [showWelcome, setShowWelcome] = useState(isNewUser);

  useEffect(() => {
    setShowWelcome(isNewUser);
  }, [isNewUser]);

  const handleClose = () => {
    setShowWelcome(false);
    router.replace('/groups');
  };

  if (!showWelcome) {
    return null;
  }

  return <HelpDialog forceOpen={true} onExplicitClose={handleClose} />;
}
