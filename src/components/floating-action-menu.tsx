
'use client';

import { GroupsFab } from './groups/groups-fab';
import { HelpChatDialog } from './help-chat-dialog';

export function FloatingActionMenu() {

  return (
    <div className="fixed bottom-20 right-6 z-40 md:bottom-6 flex flex-col items-end gap-4">
        <HelpChatDialog />
        <GroupsFab />
    </div>
  );
}
