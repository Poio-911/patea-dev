
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

export function HeaderActions() {
  return (
    <Popover>
        <PopoverTrigger asChild>
            <Button variant="ghost" size="icon">
                <Settings className="h-5 w-5" />
            </Button>
        </PopoverTrigger>
        <PopoverContent className="w-96 p-0" align="start">
             <Tabs defaultValue="notifications" className="w-full">
                <TabsList className="grid w-full grid-cols-3 rounded-b-none">
                    <TabsTrigger value="notifications">
                        <Bell className="mr-2 h-4 w-4"/>
                        Alertas
                    </TabsTrigger>
                    <TabsTrigger value="settings">
                        <Settings className="mr-2 h-4 w-4"/>
                        Ajustes
                    </TabsTrigger>
                     <TabsTrigger value="help">
                        <HelpCircle className="mr-2 h-4 w-4"/>
                        Ayuda
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="notifications" className="m-0">
                    <NotificationBell isPopoverContent={true} />
                </TabsContent>
                <TabsContent value="settings" className="m-0 p-4">
                    <SettingsSheet isPopoverContent={true} />
                </TabsContent>
                 <TabsContent value="help" className="m-0 p-4">
                    <HelpDialog isPopoverContent={true} />
                </TabsContent>
            </Tabs>
        </PopoverContent>
    </Popover>
  )
}
