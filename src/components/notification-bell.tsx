
'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { collection, query, where, orderBy, limit, writeBatch, doc } from 'firebase/firestore';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from './ui/button';
import { Bell, CheckCheck, FileSignature, UserPlus, Info } from 'lucide-react';
import type { Notification } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { ScrollArea } from './ui/scroll-area';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from './ui/avatar';
import { SoccerPlayerIcon } from './icons/soccer-player-icon';


const notificationIcons: Record<Notification['type'], React.ElementType> = {
    match_invite: SoccerPlayerIcon,
    new_joiner: UserPlus,
    evaluation_pending: FileSignature,
    match_update: Info,
};

const IconWrapper = ({ type, className, ...props }: { type: Notification['type'], className?: string }) => {
    const Icon = notificationIcons[type];
    return (
        <Avatar {...props} className={cn(className)}>
            <AvatarFallback className={cn(
                "bg-transparent text-foreground",
                type === 'match_invite' && 'bg-blue-500/20 text-blue-500',
                type === 'new_joiner' && 'bg-green-500/20 text-green-500',
                type === 'evaluation_pending' && 'bg-yellow-500/20 text-yellow-500',
                type === 'match_update' && 'bg-purple-500/20 text-purple-500',
            )}>
                <Icon className="h-4 w-4" />
            </AvatarFallback>
        </Avatar>
    );
};

export function NotificationBell() {
    const { user } = useUser();
    const firestore = useFirestore();
    const [isOpen, setIsOpen] = useState(false);

    const notificationsQuery = useMemo(() => {
        if (!firestore || !user?.uid) return null;
        return query(
            collection(firestore, 'users', user.uid, 'notifications'),
            orderBy('createdAt', 'desc'),
            limit(20)
        );
    }, [firestore, user?.uid]);
    
    const { data: notifications, loading } = useCollection<Notification>(notificationsQuery);

    const unreadCount = useMemo(() => {
        if (!notifications) return 0;
        return notifications.filter(n => !n.isRead).length;
    }, [notifications]);

    const markAllAsRead = async () => {
        if (!firestore || !user?.uid || unreadCount === 0) return;
        const batch = writeBatch(firestore);
        notifications?.forEach(n => {
            if (!n.isRead) {
                const notifRef = doc(firestore, 'users', user.uid, 'notifications', n.id);
                batch.update(notifRef, { isRead: true });
            }
        });
        await batch.commit();
    };

    useEffect(() => {
        if (isOpen && unreadCount > 0) {
            // Wait a bit before marking as read so user can see them
            const timer = setTimeout(() => {
                markAllAsRead();
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [isOpen, unreadCount, firestore, user, notifications]);

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                 <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-full">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <span className="absolute top-1.5 right-1.5 flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                        </span>
                    )}
                    <span className="sr-only">Ver notificaciones</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
                <div className="flex items-center justify-between p-4 border-b">
                    <h3 className="font-semibold text-lg">Notificaciones</h3>
                    {unreadCount > 0 && (
                         <Button variant="ghost" size="sm" onClick={markAllAsRead} className="h-auto px-2 py-1 text-xs">
                            <CheckCheck className="mr-2 h-3 w-3"/>
                            Marcar todo como leído
                        </Button>
                    )}
                </div>
                 <ScrollArea className="h-96">
                    {loading ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">Cargando...</div>
                    ) : notifications && notifications.length > 0 ? (
                        <div className="divide-y">
                            {notifications.map(notification => (
                                <Link key={notification.id} href={notification.link} className="block hover:bg-accent/50" onClick={() => setIsOpen(false)}>
                                    <div className={cn("flex items-start gap-3 p-4", !notification.isRead && "bg-primary/10")}>
                                        <div className="mt-1">
                                            <IconWrapper type={notification.type} className="h-8 w-8" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-semibold text-sm leading-tight">{notification.title}</p>
                                            <p className="text-xs text-muted-foreground">{notification.message}</p>
                                            <p className="text-xs text-muted-foreground/80 mt-1">
                                                {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: es })}
                                            </p>
                                        </div>
                                        {!notification.isRead && (
                                            <div className="h-2 w-2 rounded-full bg-primary mt-1" />
                                        )}
                                    </div>
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <p className="p-8 text-center text-sm text-muted-foreground">No tienes notificaciones.</p>
                    )}
                </ScrollArea>
                <div className="p-2 border-t text-center">
                    <Button variant="link" size="sm" asChild>
                        <Link href="/notifications">Ver todas</Link>
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    )
}
