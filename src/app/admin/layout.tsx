'use client';

import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { BackButton } from '@/components/navigation/back-button';
import { getAuth } from 'firebase/auth';

const ADMIN_EMAILS = ['lopeztoma.santiago@gmail.com', 'admin@patea.app'];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const { user, loading } = useUser();
    const router = useRouter();
    const [isAuthorized, setIsAuthorized] = useState(false);

    useEffect(() => {
        if (!loading) {
            if (!user) {
                router.push('/login');
            } else {
                const hasAccess =
                    (user.email && ADMIN_EMAILS.includes(user.email.toLowerCase())) ||
                    (getAuth().currentUser?.email && ADMIN_EMAILS.includes(getAuth().currentUser!.email!.toLowerCase()));

                if (hasAccess) {
                    setIsAuthorized(true);
                } else {
                    router.push('/dashboard');
                }
            }
        }
    }, [user, loading, router]);

    if (loading || !isAuthorized) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-muted/20 pb-20">
            <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container flex h-14 items-center gap-4 px-4 md:px-8">
                    <BackButton href="/dashboard" label="Volver" />
                    <span className="font-bold text-lg text-primary ml-4">Panel Super Admin</span>
                </div>
            </header>
            <main className="container mx-auto p-4 md:p-8">
                {children}
            </main>
        </div>
    );
}
