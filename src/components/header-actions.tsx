
'use client';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "./ui/button";
import { Settings, Bell, HelpCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NotificationBell } from "./notification-bell";
import { SettingsSheet } from "./settings-sheet";
import { HelpDialog } from "./help-dialog";

// THIS COMPONENT IS DEPRECATED AND NO LONGER IN USE.
// It will be removed in a future cleanup.
// The functionality has been moved back to main-nav.tsx for better usability.
export function HeaderActions() {
  return null;
}
