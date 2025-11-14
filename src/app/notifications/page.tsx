
'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, writeBatch, doc } from 'firebase/firestore';
import type { Notification, NotificationType } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Bell, CheckCheck, FileSignature, UserPlus, Info, Swords, CheckCircle2, XCircle, FileText } from 'lucide-react';
import { format, formatDistanceToNow, isToday, isYesterday, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';

const notificationIcons: Record<NotificationType, React.ElementType> = {
    match_invite: UserPlus,
    new_joiner: UserPlus,
    evaluation_pending: FileSignature,
    match_update: Info,
    challenge_received: Swords,
    challenge_accepted: CheckCircle2,
    challenge_rejected: XCircle,
    league_application: FileText,
};

const IconWrapper = ({ type, className, ...props }: { type: Notification['type'], className?: string }) => {
    const Icon = notificationIcons[type] || Info;
    return (
        <Avatar {...props} className={cn('h-9 w-9', className)}>
            <AvatarFallback className={cn(
                "bg-transparent",
                type === 'match_invite' && 'bg-blue-500/10 text-blue-500',
                type === 'new_joiner' && 'bg-green-500/10 text-green-500',
                type === 'evaluation_pending' && 'bg-yellow-500/10 text-yellow-500',
                type === 'match_update' && 'bg-purple-500/10 text-purple-500',
                type === 'challenge_received' && 'bg-orange-500/10 text-orange-500',
                type === 'challenge_accepted' && 'bg-emerald-500/10 text-emerald-500',
                type === 'challenge_rejected' && 'bg-red-500/10 text-red-500',
                type === 'league_application' && 'bg-indigo-500/10 text-indigo-500',
            )}>
                <Icon className="h-5 w-5" />
            </AvatarFallback>
        </Avatar>
    );
};

export default function NotificationsPage() {
    const { user, loading: userLoading } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    const notificationsQuery = useMemo(() => {
        if (!firestore || !user?.uid) return null;
        return query(
            collection(firestore, 'users', user.uid, 'notifications'),
            orderBy('createdAt', 'desc')
        );
    }, [firestore, user?.uid]);

    const { data: notifications, loading: notificationsLoading } = useCollection<Notification>(notificationsQuery);

    const groupedNotifications = useMemo(() => {
        if (!notifications) return {};

        return notifications.reduce((acc, notification) => {
            const date = parseISO(notification.createdAt);
            let groupTitle: string;
            if (isToday(date)) {
                groupTitle = 'Hoy';
            } else if (isYesterday(date)) {
                groupTitle = 'Ayer';
            } else {
                groupTitle = format(date, 'EEEE, d \'de\' MMMM', { locale: es });
            }

            if (!acc[groupTitle]) {
                acc[groupTitle] = [];
            }
            acc[groupTitle].push(notification);
            return acc;
        }, {} as Record<string, Notification[]>);
    }, [notifications]);
    
    const unreadCount = useMemo(() => {
        if (!notifications) return 0;
        return notifications.filter(n => !n.isRead).length;
    }, [notifications]);

    const markAllAsRead = async () => {
        if (!firestore || !user?.uid || unreadCount === 0 || !notifications) return;
        const batch = writeBatch(firestore);
        notifications.forEach(n => {
            if (!n.isRead) {
                const notifRef = doc(firestore, 'users', user.uid, 'notifications', n.id);
                batch.update(notifRef, { isRead: true });
            }
        });
        try {
            await batch.commit();
            toast({
                title: "Notificaciones leídas",
                description: "Todas tus notificaciones han sido marcadas como leídas."
            });
        } catch (error) {
            console.error("Error marking all notifications as read:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "No se pudieron marcar las notificaciones como leídas."
            });
        }
    };

    if (userLoading || notificationsLoading) {
        return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    if (!user) {
        return (
            <Alert>
                <AlertTitle>Acceso Denegado</AlertTitle>
                <AlertDescription>Debes iniciar sesión para ver tus notificaciones.</AlertDescription>
            </Alert>
        );
    }
    
    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Notificaciones"
                description="Acá están todas tus notificaciones, las nuevas y las viejas."
            >
                {unreadCount > 0 && (
                    <Button onClick={markAllAsRead}>
                        <CheckCheck className="mr-2 h-4 w-4" />
                        Marcar todo como leído ({unreadCount})
                    </Button>
                )}
            </PageHeader>

            {notifications && notifications.length > 0 ? (
                <div className="space-y-6">
                    {Object.entries(groupedNotifications).map(([groupTitle, groupNotifications]) => (
                        <div key={groupTitle}>
                            <h3 className="text-sm font-semibold text-muted-foreground mb-2 capitalize">{groupTitle}</h3>
                            <div className="space-y-2">
                                {groupNotifications.map(notification => (
                                    <Link key={notification.id} href={notification.link} className="block">
                                        <div className={cn(
                                            "flex items-start gap-4 p-4 rounded-lg border transition-colors",
                                            notification.isRead ? "bg-card hover:bg-muted/50" : "bg-primary/10 border-primary/20 hover:bg-primary/20"
                                        )}>
                                            <IconWrapper type={notification.type} />
                                            <div className="flex-1">
                                                <p className="font-semibold text-sm leading-tight">{notification.title}</p>
                                                <p className="text-xs text-muted-foreground">{notification.message}</p>
                                                <p className="text-xs text-muted-foreground/80 mt-1">
                                                    {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: es })}
                                                </p>
                                            </div>
                                            {!notification.isRead && (
                                                <div className="h-2.5 w-2.5 rounded-full bg-primary mt-1" />
                                            )}
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <Alert className="text-center py-10">
                    <Bell className="mx-auto h-8 w-8 mb-2 text-muted-foreground" />
                    <AlertTitle>Bandeja Vacía</AlertTitle>
                    <AlertDescription>
                        Aún no tenés notificaciones. Cuando suceda algo importante, aparecerá acá.
                    </AlertDescription>
                </Alert>
            )}
        </div>
    );
}
