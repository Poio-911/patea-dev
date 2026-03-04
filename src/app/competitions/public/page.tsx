
'use client';

import { PageHeader } from '@/components/page-header';
import { useCompetitionsData } from '@/hooks/use-competitions-data';
import { Globe, Loader2 } from 'lucide-react';
import { PublicCompetitionsBrowser } from '@/components/competitions/public-competitions-browser';
import { BackButton } from '@/components/navigation/back-button';

export default function PublicCompetitionsPage() {
    const {
        user,
        loading,
        myTeams
    } = useCompetitionsData();

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary opacity-50" />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-8 pb-20">
            <div className="flex items-center justify-between">
                <PageHeader
                    title="Explorador Público"
                    description="Competiciones abiertas de todo el mundo Pateá."
                    icon={<Globe className="h-8 w-8 text-primary" />}
                />
                <BackButton href="/competitions" label="Hub" />
            </div>

            <div className="space-y-6">
                <PublicCompetitionsBrowser userId={user?.uid || ''} userTeams={myTeams} />
            </div>
        </div>
    );
}
