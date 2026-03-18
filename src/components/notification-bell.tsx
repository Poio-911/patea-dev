
'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import {
    ResponsivePopover as Popover,
    ResponsivePopoverContent as PopoverContent,
    ResponsivePopoverTrigger as PopoverTrigger,
} from "@/components/ui/responsive-popover"
import { Button } from './ui/button';
import { Bell, CheckCheck, FileSignature, UserPlus, Info, Swords, CheckCircle2, XCircle, FileText, Users, CalendarClock, TrendingUp, Award, ShieldQuestion } from 'lucide-react';
import type { Notification, NotificationType } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { ScrollArea } from './ui/scroll-area';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from './ui/avatar';
import { SoccerPlayerIcon } from '@/components/icons/soccer-player-icon';
import { markAllNotificationsAsReadAction } from '@/lib/actions/server-actions';

interface NotificationBellProps {
    isPopoverContent?: boolean;
}

const notificationIcons: Record<NotificationType, React.ElementType> = {
    match_invite: SoccerPlayerIcon,
    new_joiner: UserPlus,
    evaluation_pending: FileSignature,
    match_update: Info,
    challenge_received: Swords,
    challenge_accepted: CheckCircle2,
    challenge_rejected: XCircle,
    league_application: FileText,
    cup_application: FileText,
    new_follower: Users,
    match_invitation: CalendarClock,
    match_reminder: CalendarClock,
    ovr_milestone: TrendingUp,
    achievement_unlocked: Award,
    identity_reveal_requested: ShieldQuestion,
};

const IconWrapper = ({ type, className, ...props }: { type: Notification['type'], className?: string }) => {
    const Icon = notificationIcons[type] || Info;
    return (
        <Avatar {...props} className={cn(className)}>
            <AvatarFallback className="bg-card/70 text-foreground border border-border">
                <Icon className="h-4 w-4" />
            </AvatarFallback>
        </Avatar>
    );
};

export function NotificationBell({ isPopoverContent = false }: NotificationBellProps) {
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
        if (!user?.uid || unreadCount === 0) return;
        await markAllNotificationsAsReadAction(user.uid);
    };

    const Content = () => (
        <>
            <ScrollArea className="h-96">
                {loading ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">Cargando...</div>
                ) : notifications && notifications.length > 0 ? (
                    <div className="divide-y">
                        {notifications.map(notification => (
                            <Link key={notification.id} href={notification.link} className="block hover:bg-muted/30" onClick={() => setIsOpen(false)}>
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
        </>
    );

    if (isPopoverContent) {
        return <Content />;
    }

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-full">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <span className="absolute top-1.5 right-1.5 inline-flex rounded-full h-3 w-3 bg-primary"></span>
                    )}
                    <span className="sr-only">Ver notificaciones</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 max-w-[calc(100vw-2rem)] p-0" align="end">
                <div className="flex items-center justify-between p-4 border-b">
                    <h3 className="font-semibold text-lg">Notificaciones</h3>
                    {unreadCount > 0 && (
                        <Button variant="ghost" size="sm" onClick={markAllAsRead} className="h-auto px-2 py-1 text-xs">
                            <CheckCheck className="mr-2 h-3 w-3" />
                            Marcar todo como leído
                        </Button>
                    )}
                </div>
                <Content />
            </PopoverContent>
        </Popover>
    )
}
