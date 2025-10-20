
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { HelpDialog } from './help-dialog';

export function WelcomeDialog() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isNewUser = searchParams.get('new_user') === 'true';
  const [showWelcome, setShowWelcome] = useState(isNewUser);

  useEffect(() => {
    // This effect ensures the dialog appears if the URL param is present
    setShowWelcome(isNewUser);
  }, [isNewUser]);

  const handleClose = () => {
    setShowWelcome(false);
    // Navigate to the groups page after the tutorial
    router.replace('/groups');
  };
  
  if (!showWelcome) {
    return null;
  }

  // forceOpen will keep the dialog open until the user interacts with it
  // onExplicitClose provides the specific action to take when it's closed
  return <HelpDialog forceOpen={true} onExplicitClose={handleClose} />;
}
